import {rawFetch} from '@/api/http'

/** Read original bytes through the same supported route used by Word preview. */
export async function readArtifactDownload(agentId:string,threadId:string,path:string,signal?:AbortSignal):Promise<Blob>{
 if(!agentId||!threadId||!path)throw Error('文件的会话或路径不完整，请核对会话。')
 const url='/api/agents/'+encodeURIComponent(agentId)+'/sessions/'+encodeURIComponent(threadId)+'/artifacts/download'
 const response=await rawFetch(url,{method:'GET',params:{path},signal,timeoutMs:30000})
 if(!response.ok){
  const detail=await response.json().catch(()=>null)
  throw Error('下载失败（HTTP '+response.status+'）'+(typeof detail?.message==='string'?'：'+detail.message:'，请稍后重试。'))
 }
 const blob=await response.blob()
 if(!blob.size)throw Error('文件内容为空，未发起下载。')
 const ext=path.split('.').pop()?.toLowerCase()
 if(/text\/html/i.test(blob.type)&&!['html','htm'].includes(ext??''))throw Error('服务返回了网页，未取得原文件。请核对登录状态。')
 if(blob.size<65536){
  const text=await blob.text()
  if(/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)&&!['html','htm'].includes(ext??''))throw Error('服务返回了网页，未取得原文件。请核对登录状态。')
  try{
   const value=JSON.parse(text)
   if(value&&typeof value.message==='string'&&/^(?:NOT_FOUND|UNAUTHORIZED|FORBIDDEN|INTERNAL_SERVER_ERROR|ERROR|401|403|404|500)$/.test(String(value.code)))throw Error('未取得原文件：'+value.message)
  }catch(error){if(error instanceof Error&&!(error instanceof SyntaxError))throw error}
 }
 return blob
}
