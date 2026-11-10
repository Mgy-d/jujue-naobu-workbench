import {rawFetch,getAccessToken,authSnapshot,sameAuth} from './http'

export type ResearchDocumentKind='task'|'session'|'record'|'artifact'
export interface ResearchDocument<T=unknown>{kind:ResearchDocumentKind;id:string;data:T;revision:number;updatedAt:string}
export class ResearchCloudError extends Error {constructor(message:string,public status:number){super(message)}}
export function researchCloudOwner():string {
  try{const part=getAccessToken().split('.')[1];return part?String(JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).sub || ''):''}catch{return ''}
}
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const auth=authSnapshot()
  if(!getAccessToken())throw new ResearchCloudError('请先登录后保存到公司数据库。',401)
  const response=await rawFetch('/collection-api/research'+path,{method,body,timeoutMs:method==='GET'?8000:30000})
  if(!sameAuth(auth))throw new ResearchCloudError('登录账号已变化，本次结果未采用。',409)
  if(!response.ok){const detail=await response.json().catch(()=>null);throw new ResearchCloudError(response.status===401?'研究存储服务尚未接受当前登录，请核对后端认证配置。':detail?.message || '公司数据库服务读取失败（'+response.status+'）',response.status)}
  return (response.status===204?undefined:await response.json()) as T
}

/** Writes are serialized per document and use server revisions, including across reloads. */
export class ResearchCloudDocuments {
  owner=''
  private versions=new Map<string,number>()
  private queue=new Map<string,Promise<unknown>>()
  private key(kind:ResearchDocumentKind,id:string){return kind+':'+id}
  private versionKey(){return 'shidiaoyanzhen.cloud-revisions.v1:'+encodeURIComponent(this.owner)}
  select(owner:string){
    if(owner===this.owner)return
    this.owner=owner;this.queue.clear();this.versions.clear()
    try{const saved=JSON.parse(localStorage.getItem(this.versionKey())||'{}');for(const [key,value] of Object.entries(saved))if(Number.isInteger(value)&&Number(value)>=0)this.versions.set(key,Number(value))}catch{}
  }
  private remember(kind:ResearchDocumentKind,id:string,revision:number){
    this.versions.set(this.key(kind,id),revision)
    localStorage.setItem(this.versionKey(),JSON.stringify(Object.fromEntries(this.versions)))
  }
  async list<T>(kind:ResearchDocumentKind,preserveIds=new Set<string>()):Promise<ResearchDocument<T>[]>{
    const owner=this.owner,rows=await request<ResearchDocument<T>[]>('/documents/'+kind)
    if(owner!==this.owner)throw Error('账号已变化')
    for(const row of rows)if(!preserveIds.has(row.id))this.remember(kind,row.id,row.revision)
    return rows
  }
  async get<T>(kind:ResearchDocumentKind,id:string):Promise<ResearchDocument<T>|null>{
    const owner=this.owner
    try{const row=await request<ResearchDocument<T>>('/documents/'+kind+'/'+encodeURIComponent(id));if(owner!==this.owner)throw Error('账号已变化');this.remember(kind,id,row.revision);return row}
    catch(error){if(error instanceof ResearchCloudError&&error.status===404)return null;throw error}
  }
  save<T>(kind:ResearchDocumentKind,id:string,data:T):Promise<ResearchDocument<T>>{
    const owner=this.owner,key=this.key(kind,id),copy=JSON.parse(JSON.stringify(data)) as T
    const work=async()=>{
      if(!owner || owner!==this.owner || owner!==researchCloudOwner())throw Error('保存账号与当前登录不一致')
      if(!this.versions.has(key))await this.get(kind,id)
      const expectedRevision=this.versions.get(key)||0
      const row=await request<ResearchDocument<T>>('/documents/'+kind+'/'+encodeURIComponent(id),'PUT',{expectedRevision,data:copy})
      if(owner!==this.owner)throw Error('账号已变化')
      this.remember(kind,id,row.revision)
      return row
    }
    const pending=(this.queue.get(key)||Promise.resolve()).catch(()=>undefined).then(work)
    this.queue.set(key,pending)
    return pending
  }
  async create<T>(kind:ResearchDocumentKind,id:string,data:T):Promise<ResearchDocument<T>>{
    const owner=this.owner
    if(!owner||owner!==researchCloudOwner())throw Error('当前保存账号不一致')
    const row=await request<ResearchDocument<T>>('/documents/'+kind+'/'+encodeURIComponent(id),'PUT',{expectedRevision:0,data})
    if(owner!==this.owner)throw Error('账号已变化')
    this.remember(kind,id,row.revision);return row
  }
  async remove(kind:ResearchDocumentKind,id:string){
    const owner=this.owner,key=this.key(kind,id)
    await this.queue.get(key)?.catch(()=>undefined)
    if(owner!==this.owner)throw Error('账号已变化')
    if(!this.versions.has(key))await this.get(kind,id)
    await request('/documents/'+kind+'/'+encodeURIComponent(id)+'?revision='+(this.versions.get(key)||0),'DELETE')
    this.versions.delete(key)
    localStorage.setItem(this.versionKey(),JSON.stringify(Object.fromEntries(this.versions)))
  }
}
export const researchCloud=new ResearchCloudDocuments()
export async function archiveResearchFile(taskId:string,fileName:string,sourcePath:string,bytes:ArrayBuffer){
  if(bytes.byteLength>20*1024*1024)throw Error('文件超过20MB，尚未归档到公司数据库。')
  const view=new Uint8Array(bytes);let binary=''
  for(let offset=0;offset<view.length;offset+=8192)binary+=String.fromCharCode(...view.subarray(offset,offset+8192))
  const contentBase64=btoa(binary)
  return request<{id:string;contentHash:string}>('/files/'+crypto.randomUUID(),'PUT',{taskId,fileName,sourcePath,contentBase64})
}

export interface ArchivedResearchFile {id:string;taskId:string;fileName:string;sourcePath:string;contentHash:string;size:number;createdAt:string}
export function listResearchFiles(taskId:string){return request<ArchivedResearchFile[]>('/files?'+new URLSearchParams({taskId}))}
export async function readResearchFile(id:string):Promise<ArrayBuffer>{
 const auth=authSnapshot();const response=await rawFetch('/collection-api/research/files/'+encodeURIComponent(id),{method:'GET',timeoutMs:30000})
 if(!sameAuth(auth))throw Error('账号已变化，未采用附件内容。')
 if(!response.ok)throw Error('数据库附件读取失败（HTTP '+response.status+'）')
 return response.arrayBuffer()
}

/** Import only records with a validated current-owner binding; never overwrite server history. */
export async function syncOwnedLocalRecords(owner:string,storage:Storage):Promise<string[]>{
 const {loadResearchIdentity}=await import('@/utils/researchRunIdentity');const failures:string[]=[]
 const valid=()=>owner===researchCloudOwner()&&owner===researchCloud.owner
 for(const key of Object.keys(storage)){
  if(!key.startsWith('shidiaoyanzhen.agent-run.v1:'+encodeURIComponent(owner)+':'))continue
  if(!valid())throw Error('账号已变化，历史同步已停止。')
  try{
   const value=JSON.parse(storage.getItem(key)||'null');const scope={ownerId:owner,agentId:value?.agentId,taskId:value?.taskId}
   const identity=loadResearchIdentity(storage,scope).identity
   if(!identity || identity.ownerId!==owner)continue
   let task=await researchCloud.get('task',identity.taskId)
   if(!task){
    const {TASK_STORAGE_KEY,cleanTask}=await import('@/utils/researchDrafts')
    let localTask:ReturnType<typeof cleanTask>=null
    for(const registryKey of [TASK_STORAGE_KEY+':'+encodeURIComponent(owner),TASK_STORAGE_KEY]){
     try{const registry=JSON.parse(storage.getItem(registryKey)||'null');const candidate=cleanTask(registry?.tasks?.[identity.taskId]);if(candidate?.localTaskId===identity.taskId){localTask=candidate;break}}catch{}
    }
    if(!localTask){failures.push(identity.taskId+'：未找到可核实的本机任务草稿；历史记录保留，未自动创建任务');continue}
    if(!valid())throw Error('账号已变化')
    // The identity was validated for this exact owner/task; expectedRevision=0 prevents overwrites.
    try{task=await researchCloud.create('task',identity.taskId,localTask)}catch(error){if(error instanceof ResearchCloudError&&error.status===409)task=await researchCloud.get('task',identity.taskId);else throw error}
    if(!task)throw Error('任务补传未确认，未导入关联记录')
   }
   if(!valid())throw Error('账号已变化')
   const raw=storage.getItem('shidiaoyanzhen.record.v1:'+owner+':'+identity.agentId+':'+identity.taskId)
   if(!raw)continue
   const record=JSON.parse(raw)
   if(record?.version!==1||!Array.isArray(record.messages)||!Array.isArray(record.files)||!Array.isArray(record.gaps))throw Error('本机成果格式不完整')
   if(!await researchCloud.get('record',identity.taskId)){
    if(!valid())throw Error('账号已变化')
    await researchCloud.save('record',identity.taskId,{taskId:identity.taskId,record})
   }
   const sessionId=identity.taskId+':'+identity.agentId
   if(!await researchCloud.get('session',sessionId)){
    if(!valid())throw Error('账号已变化')
    await researchCloud.save('session',sessionId,{taskId:identity.taskId,identity,phase:record.phase,capturedAt:record.savedAt,messages:record.messages,source:'local-saved-record'})
   }
  }catch(error){if(!valid())throw error;failures.push(key+'：'+(error instanceof Error?error.message:'同步失败'))}
 }
 return failures
}
