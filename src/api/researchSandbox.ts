export interface SandboxFile { fileId:string; name:string; size:number; sha256:string; sandboxPath:string }
export interface SandboxWorkspace { workspaceId:string; title:string; files:SandboxFile[] }
export interface SandboxArtifact { artifactId:string; versionId:string; name:string; size:number; sha256:string }
export interface SandboxRun { workspaceId:string;runId:string;inputFingerprint:string;executionStatus:string;outputStatus:string;error:string|null;log:string;artifacts:SandboxArtifact[];inputs:SandboxFile[] }
const prefix = '/sandbox-api/v1'
const knownErrorMessages: Record<string, string> = {
  execution_unavailable: '沙箱暂不可运行：Docker 引擎或固定 Python 环境未就绪，本次任务未启动；已上传数据仍保留在本机工作区。',
}
function connectionError(message:string) {
  return Object.assign(new Error(message), {name:'SandboxConnectionError'})
}
export function sandboxClient(token:string) {
  async function send(path:string, init:RequestInit = {}):Promise<Response> {
    let response:Response
    try {
      response = await fetch(prefix + path, {...init, headers:{Authorization:'Bearer '+token,...init.headers}, signal:AbortSignal.timeout(15000)})
    } catch (error) {
      if(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name))
        throw connectionError('请求超时，无法确认本次操作是否完成。请重新连接核对运行状态，再决定是否重试。')
      throw connectionError('无法连接本机分析服务，请先启动服务，再点击连接。若刚提交过任务，请先核对状态，避免重复运行。')
    }
    if(!response.ok) {
      const error = await response.json().catch(()=>null)
      if(response.status===401)
        throw Object.assign(new Error('访问令牌缺失或无效，请核对本机分析服务的令牌后重新连接。'),{name:'SandboxAuthenticationError'})
      if(knownErrorMessages[error?.code]) throw new Error(knownErrorMessages[error.code])
      if([502,503,504].includes(response.status))
        throw connectionError('本机分析服务暂不可达，请确认服务已启动，再点击连接核对状态。')
      throw new Error(typeof error?.message==='string' ? error.message : '服务请求失败（'+response.status+'），请核对状态后重试。')
    }
    return response
  }
  async function request<T>(path:string, init:RequestInit = {}):Promise<T> {
    const response = await send(path,init)
    try { return await response.json() }
    catch { throw connectionError('服务返回了无法识别的响应，请确认本机分析服务和页面代理配置后重新连接。') }
  }
  const post = <T>(path:string, data:unknown, extra = {}) => request<T>(path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(data)})
  return {
    workspaces:async()=>(await request<{workspaces:SandboxWorkspace[]}>('/workspaces')).workspaces,
    workspace:(id:string)=>request<SandboxWorkspace>('/workspaces/'+id),
    create:(title:string)=>post<SandboxWorkspace>('/workspaces',{title}),
    upload:(id:string,file:File)=>request<SandboxFile>('/workspaces/'+id+'/files',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent(file.name)},body:file}),
    run:(id:string)=>request<SandboxRun>('/runs/'+id),
    events:(id:string,after:number)=>request<{events:any[]}>('/runs/'+id+'/events?after='+after),
    start:(id:string,data:unknown,key:string)=>post<SandboxRun>('/workspaces/'+id+'/runs',data,{'Idempotency-Key':key}),
    cancel:(id:string)=>post<SandboxRun>('/runs/'+id+'/cancel',{}),
    commit:(id:string)=>post<SandboxRun>('/runs/'+id+'/commit',{}),
    async download(runId:string, item:SandboxArtifact) {
      const response = await send('/runs/'+runId+'/artifacts/'+item.artifactId+'/versions/'+item.versionId)
      const blob=await response.blob(); const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')
      if(hash!==item.sha256) throw new Error('结果校验不一致，下载已拒绝。')
      return blob
    }
  }
}
