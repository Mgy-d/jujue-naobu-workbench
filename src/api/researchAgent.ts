import { http } from '@/api/http'
import { configuredResearchAgent } from '@/config/researchAgent'

/** The list is accessible to ordinary authenticated users; detail is admin-only on this source version. */
export async function verifyResearchAgent(agentId:string):Promise<void> {
  const expected=configuredResearchAgent()
  if(expected.id!==agentId)throw new Error('当前智能体配置已变化，请重新进入任务。')
  const page=await http.get<{content?:Array<{id?:string;name?:string;status?:string}>;totalPages?:number}>('/api/agents',{search:expected.name,size:'100'},{timeoutMs:10000})
  if(!page || !Array.isArray(page.content))throw new Error('智能体列表格式不完整，暂不能确认目标。')
  const exact=page.content.find(item=>item.id===expected.id && item.name===expected.name)
  if(!exact)throw new Error('服务端未找到与市调名称和编号一致的智能体，请核对部署版本。')
  if(exact.status!=='active')throw new Error('市调智能体未发布或未启用，无法发起运行。')
}

/** Request stop for the specific authenticated session. A 202 response does not prove every background task stopped. */
export async function interruptResearchSession(agentId:string,threadId:string):Promise<{session_id:string;interrupted:boolean}> {
  const path='/api/agents/'+encodeURIComponent(agentId)+'/sessions/'+encodeURIComponent(threadId)+'/interrupt'
  const result=await http.post<{session_id:string;interrupted:boolean}>(path,undefined,{timeoutMs:10000})
  if(!result || result.session_id!==threadId || typeof result.interrupted!=='boolean')throw new Error('停止响应的会话身份不匹配。')
  return result
}
