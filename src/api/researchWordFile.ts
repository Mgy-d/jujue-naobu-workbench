import {rawFetch} from '@/api/http'
/** The platform download controller supports authenticated file bytes without a ticket. */
export function fetchResearchWordFile(agentId:string,threadId:string,path:string,signal?:AbortSignal):Promise<Response>{
 if(!agentId||!threadId||!path)throw Error('Word 文件的会话或路径不完整。')
 const base='/api/agents/'+encodeURIComponent(agentId)+'/sessions/'+encodeURIComponent(threadId)+'/artifacts/download'
 return rawFetch(base,{method:'GET',params:{path},signal,timeoutMs:15000})
}
