import { http } from '@/api/http'

/** Ticket path is based on the delivered platform source; runtime availability still needs verification. */
export async function researchDownloadUrl(agentId:string,threadId:string,path:string):Promise<{url:string;fileName:string}> {
  if(!agentId || !threadId || !path)throw new Error('下载身份或产物路径不完整。')
  const base='/api/agents/'+encodeURIComponent(agentId)+'/sessions/'+encodeURIComponent(threadId)+'/artifacts'
  const query=new URLSearchParams({path}).toString()
  const result=await http.post<{ticket:string;fileName:string}>(base+'/download-ticket?'+query,undefined,{timeoutMs:10000})
  if(!result || typeof result.ticket!=='string' || !result.ticket || typeof result.fileName!=='string')throw new Error('下载票据响应不完整。')
  return {url:base+'/download?'+new URLSearchParams({ticket:result.ticket}).toString(),fileName:result.fileName}
}
