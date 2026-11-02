import { fetchAguiEvents, fetchAguiEventWatermark } from '@/api/aguiEvents'
import type { AguiEvent } from '@/types/agui'
import { http } from '@/api/http'
import { fetchSessionProgress, fetchSessionRunStatus } from '@/api/session'
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


export interface ResearchSessionStatus {
  running:boolean
  pendingWork?:boolean
  /** Older platforms expose only a model-written ledger. This is not proof of an active child. */
  continuationPlanned?:boolean
  /** Parent is idle, but its model-written progress ledger cannot determine completion. */
  continuationUnknown?:boolean
  awaitingInput?:boolean
}

/** Keep old-platform idle parents distinct from completed research, without changing math-model behavior. */
export async function fetchResearchRunStatus(agentId:string,threadId:string):Promise<ResearchSessionStatus> {
  const state=await fetchSessionRunStatus(agentId,threadId) as {sessionId?:string;running?:unknown;pendingWork?:unknown}
  if(!state || typeof state.running!=='boolean')throw new Error('服务端运行状态不完整，请恢复会话核对。')
  if(state.sessionId!==undefined && state.sessionId!==threadId)throw new Error('运行状态的会话身份不匹配。')
  if(typeof state.pendingWork==='boolean')return {running:state.running,pendingWork:state.pendingWork}
  if(state.running)return {running:true}
  const progress=await fetchSessionProgress(agentId,threadId) as {sessionId?:string;nextAction?:string}
  if(progress?.sessionId!==undefined && progress.sessionId!==threadId)throw new Error('进度台账的会话身份不匹配。')
  switch(progress?.nextAction){
    case 'UNKNOWN':return {running:false,continuationUnknown:true}
    case 'CONTINUE':return {running:false,continuationPlanned:true}
    case 'WAIT_HITL':return {running:false,awaitingInput:true}
    case 'DONE':case 'IDLE':return {running:false}
    default:throw new Error('当前后台未提供待办状态，进度台账也无法确认，请恢复会话核对。')
  }
}


/** Read a bounded snapshot of the most recent server run, including its start. */
export async function fetchResearchRecoveryEvents(threadId:string):Promise<Array<{runId?:string;payload:AguiEvent}>> {
  let cursor=0, ceiling=Infinity
  try{
    const mark=await fetchAguiEventWatermark(threadId)
    if(mark.latest===true){
      if(mark.sessionId!==threadId || !Number.isInteger(mark.nextAfterSequence) || !Number.isInteger(mark.lastRunStartSequence) || (mark.lastRunStartSequence||0)<0 || mark.nextAfterSequence<(mark.lastRunStartSequence||0))throw Error('会话事件水位身份或范围无效。')
      cursor=Math.max(0,(mark.lastRunStartSequence||0)-1);ceiling=mark.nextAfterSequence
    }
  }catch(error){if(error instanceof Error && error.message==='会话事件水位身份或范围无效。')throw error}
  const events:Array<{runId?:string;payload:AguiEvent}>=[]
  for(let pageNumber=0;pageNumber<50;pageNumber++){
    const page=await fetchAguiEvents(threadId,cursor,500)
    if(page.sessionId!==threadId || !Array.isArray(page.events))throw Error('会话事件记录身份不匹配。')
    events.push(...page.events.filter(e=>e.eventSequence<=ceiling))
    if(page.events.length<500 || page.nextAfterSequence>=ceiling)return events
    if(!Number.isInteger(page.nextAfterSequence) || page.nextAfterSequence<=cursor)throw Error('会话事件记录不完整。')
    cursor=page.nextAfterSequence
  }
  throw Error('会话事件记录超过核对范围，无法安全恢复。')
}
