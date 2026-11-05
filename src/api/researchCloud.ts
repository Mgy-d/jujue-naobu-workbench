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
