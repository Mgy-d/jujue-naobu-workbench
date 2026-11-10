import {canMessageCompletedResearch} from '@/utils/researchConversationReadiness'
import { isUnresolvedInterruptsError } from '@/api/interruptRelease'
import { readResearchProgress, type ResearchProgressHint } from '@/utils/researchProgress'
import { buildResearchRequest, recoverResearchPlan, matchingBackgroundRuns, sameResearchToolInput, normalizeResearchInterrupt, reconcileResearchPending, streamResearchRun, successfulResearchHitlIds, conflictingResearchHitlIds } from '@/api/szRun'
import { reactive, markRaw } from 'vue'
import { defineStore } from 'pinia'
import { getAccessToken } from '@/api/http'
import { extractInterrupts, runEventError } from '@/api/agui'
import { verifyResearchAgent, interruptResearchSession, fetchResearchRunStatus, fetchResearchRecoveryEvents, type ResearchSessionStatus } from '@/api/researchAgent'
import { fetchSessionTranscript, fetchSessionProgress, mergeTranscript, type SessionProgress } from '@/api/session'
import { listPendingInterrupts, listLiveInterruptIds, registerInterrupts, removePendingInterrupt } from '@/api/formInterrupt'
import { fetchArtifactTree, fetchArtifactContent } from '@/api/artifact'
import { collectResolvedToolCallIds } from '@/utils/analysis/gateRebuild'
import { createResearchIdentity, loadResearchIdentity, saveResearchIdentity, type ResearchScope, type StoredResearchIdentity } from '@/utils/researchRunIdentity'
import { RESEARCH_AGENT_DEMO, createDemoResearchServices } from '@/utils/researchDemoAgent'
import { USER_KEY } from '@/stores/user'
import type { ResearchIdentity, ResearchRunStatus } from '@/api/szRun'
import type { AguiEvent, AguiInterrupt, AguiRunRequest } from '@/types/agui'
import type { SessionTextMessage } from '@/api/session'
import type { ArtifactContent, ArtifactNode } from '@/types/sandbox'

export interface ResearchMessage { id:string; role:'user'|'assistant'; text:string; local?:boolean; remoteId?:string; at?:number }
export interface ResearchRunResult {status:ResearchRunStatus;message:string;texts:Record<string,string>;interrupts:AguiInterrupt[]}
export interface ResearchRunServices {
  verify: (agentId:string) => Promise<void>
  run: (identity:ResearchIdentity, request:AguiRunRequest, onEvent:(event:AguiEvent)=>void, signal:AbortSignal) => Promise<ResearchRunResult>
  transcript: (agentId:string,threadId:string) => Promise<{messages:SessionTextMessage[]}>
  pending: (agentId:string,threadId:string) => Promise<AguiInterrupt[]>
  events?: (threadId:string) => Promise<Array<{runId?:string;payload:AguiEvent}>>
  historyEvents?: (threadId:string) => Promise<Array<{runId?:string;payload:AguiEvent}>>
  live?: (agentId:string,threadId:string) => Promise<string[] | null>
  stop?: (agentId:string,threadId:string) => Promise<{session_id:string;interrupted:boolean}>
  runStatus: (agentId:string,threadId:string) => Promise<ResearchSessionStatus>
  progress?: (agentId:string,threadId:string) => Promise<SessionProgress>
  register: (agentId:string,threadId:string,items:AguiInterrupt[],runId:string) => Promise<void>
  remove: (agentId:string,threadId:string,toolCallId:string) => Promise<void>
  tree: (agentId:string,threadId:string) => Promise<ArtifactNode[]>
  read: (agentId:string,threadId:string,path:string) => Promise<ArtifactContent>
}
export interface FormSubmissionFeedback {
  startedAt:number
  issued:boolean
  runStartedAt:number|null
  replyAt:number|null
  lastEventAt:number
  settledAt:number|null
  checkedAt:number|null
  checkMessage:string
  checkFailed:boolean
  checking:boolean
}

type State = 'idle'|'checking'|'running'|'interrupt'|'uncertain'|'finished'|'working'|'awaiting'
const idOf = (item:AguiInterrupt) => String(item.id || item.interruptId || '')
function description(error:unknown) { return error instanceof Error ? error.message : '请求失败，请检查连接和登录状态。' }

/** Task identity, user identity and all late responses are guarded separately. */
export class ResearchRunSession {
  scope:ResearchScope|null = null; identity:StoredResearchIdentity|null = null; baseline:string|null = null
  reportedProgress:ResearchProgressHint|null = null
  lastStatusCheckAt = ''
  serverPhase = ''
  nextStage = ''
  recoveryDiagnostic:Record<string,unknown>|null=null
  status:State = 'idle'; error = ''; notice = ''; probeText = ''; probePassed = false
  messages:ResearchMessage[] = []; interrupts:AguiInterrupt[] = []; artifacts:ArtifactNode[] = []; preview:ArtifactContent|null = null
  formSubmission:FormSubmissionFeedback|null = null
  busy = false; stopping = false; halted = false
  private epoch = 0; private controller:AbortController|null = null; private verifiedKey = ''
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>, private services:ResearchRunServices, private owner:()=>string, private uuid:()=>string = ()=>crypto.randomUUID()) {}
  private pendingRecoveryMessage() {
    return '服务端报告原会话仍有未处理的确认事项，请先恢复待答表单；本次不能作为普通对话继续。'
  }
  private recordPendingRejection() {
    if (this.identity) this.persist({...this.identity, status:'uncertain', unresolvedInterrupts:true})
    this.status='uncertain';this.nextStage='';this.interrupts=[]
    this.error=this.pendingRecoveryMessage()
    this.notice='本次请求被服务端拒绝，未开始新的回复；没有自动重试或处理审核。'
  }
  private active(epoch:number) { return epoch===this.epoch && !!this.scope && this.scope.ownerId===this.owner() }
  private persist(next:StoredResearchIdentity) {
    if (!this.scope || this.owner()!==this.scope.ownerId) throw new Error('登录账户已变化，运行身份未写入。')
    this.baseline=saveResearchIdentity(this.storage,this.scope,this.baseline,next)
    this.identity=next
  }
  private invalidate() { this.formSubmission=null;this.epoch++;this.controller?.abort();this.controller=null;this.busy=false;this.stopping=false }
  dispose() { this.recoveryDiagnostic=null;this.reportedProgress=null;this.lastStatusCheckAt='';this.serverPhase='';this.nextStage='';this.invalidate();this.verifiedKey='';this.probePassed=false;this.scope=null;this.identity=null;this.halted=false;this.messages=[];this.interrupts=[];this.artifacts=[];this.preview=null }
  async select(scope:ResearchScope) {
    if(this.scope && this.scope.ownerId===scope.ownerId && this.scope.agentId===scope.agentId && this.scope.taskId===scope.taskId && this.owner()===scope.ownerId)return
    this.invalidate()
    this.recoveryDiagnostic=null;this.scope={...scope};this.reportedProgress=null;this.lastStatusCheckAt='';this.serverPhase='';this.nextStage='';this.halted=false;this.identity=null;this.baseline=null;this.messages=[];this.interrupts=[];this.artifacts=[];this.preview=null;this.error='';this.notice='';this.status='idle'
    this.probePassed=this.verifiedKey===scope.ownerId+':'+scope.agentId
    if (scope.ownerId!==this.owner()) { this.error='登录账户已变化，请重新登录。';this.status='uncertain';return }
    try { const loaded=loadResearchIdentity(this.storage,scope);this.identity=loaded.identity;this.baseline=loaded.baseline }
    catch(e){this.status='uncertain';this.error=description(e);return}
    if(this.identity?.status==='blocked'){this.halted=true;this.status='uncertain';this.error='该会话的表单登记异常，已停止重试；请交平台核查。';return}
    if (this.identity && this.identity.status!=='new') await this.recover()
  }
  async probe() {
    if (!this.scope || this.busy || this.stopping || this.owner()!==this.scope.ownerId) return
    const epoch=this.epoch, scope={...this.scope}, priorStatus=this.status, ctl=new AbortController();this.controller=ctl;this.busy=true;this.status='checking';this.error='';this.notice=''
    const timer=setTimeout(()=>ctl.abort(),45000)
    try {
      await this.services.verify(scope.agentId);if(!this.active(epoch))return
      const probe:ResearchIdentity={agentId:scope.agentId,projectId:'sz-probe-'+this.uuid(),threadId:'main-probe-'+this.uuid(),runId:'run-probe-'+this.uuid()}
      const request=buildResearchRequest(probe,'你好，请只回复一句话。这是模型响应检查，不启动研究、不生成产物。')
      const result=await this.services.run(probe,request,()=>{},ctl.signal);if(!this.active(epoch))return
      const text=Object.values(result.texts).join('').trim();this.probeText=text
      if(result.status!=='success' || !text) throw new Error(result.message || '模型探测没有收到完整成功终态和文字，请核对模型通道。')
      this.probePassed=true;this.verifiedKey=scope.ownerId+':'+scope.agentId;this.status=this.identity?priorStatus:'idle';this.notice='模型已返回文字；这是一次连接检查，不代表研究阶段完成。'
    }catch(e){if(!this.active(epoch))return;this.probePassed=false;this.status='uncertain';this.error=description(e)}
    finally{clearTimeout(timer);if(this.active(epoch)){this.busy=false;this.controller=null}}
  }
  async start(text:string, options: {requireModelProbe?:boolean;allowIdleMessage?:boolean;recoverExpiredGate?:boolean} = {}) {
    if (!this.scope || this.busy || this.stopping || this.halted || !text.trim()) return
    if (this.identity?.unresolvedInterrupts) {this.status='uncertain';this.error=this.pendingRecoveryMessage();this.notice='请先核对原会话的待答表单，当前内容未发送。';return}
    if (options.requireModelProbe !== false && !this.probePassed) {this.error='请先测试模型响应，再启动研究。';return}
    if (this.status==='interrupt' || this.status==='working' || this.status==='uncertain' && !options.allowIdleMessage || this.status==='running') {this.error='当前运行仍待确认或核对，请先恢复会话。';return}
    const epoch=this.epoch, scope={...this.scope};this.busy=true;this.nextStage='';this.error='';this.notice='正在核对智能体和会话，尚未发送本次内容。'
    const ctl=new AbortController();this.controller=ctl
    let issued=false
    try {
      await this.services.verify(scope.agentId);if(!this.active(epoch))return
      if (this.identity && this.identity.status!=='new') {
        const [pending,status,live]=await Promise.all([this.services.pending(scope.agentId,this.identity.threadId),this.services.runStatus(scope.agentId,this.identity.threadId),options.allowIdleMessage && this.services.live ? this.services.live(scope.agentId,this.identity.threadId) : Promise.resolve([])])
        if(!this.active(epoch))return
        if(pending.length || live?.length || status.running || status.pendingWork || status.continuationPlanned) throw new Error('会话仍在运行或存在待确认内容，请先恢复会话。')
        let completedConversation=false
        if(status.completedRun && options.allowIdleMessage){
          const transcript=await this.services.transcript(scope.agentId,this.identity.threadId)
          if(!this.active(epoch) || !this.identity)return
          if(!canMessageCompletedResearch(transcript.messages,this.identity))throw Error('本轮已结束，但历史表单或工具的终态仍无法核实；本次内容未发送，请核对原会话。')
          completedConversation=true
        }
        if(status.manualAttention){
          const transcript=await this.services.transcript(scope.agentId,this.identity.threadId)
          if(!this.active(epoch) || !this.identity)return
          if(!options.allowIdleMessage || !this.manualResumeClear(transcript.messages,this.identity))throw Error('人工接续前仍需核对原会话的工具结果和审核状态，当前内容未发送。')
        }
        if(!completedConversation && (status.continuationUnknown || options.allowIdleMessage && (live===null || this.status==='uncertain'))){
          const transcript = await this.services.transcript(scope.agentId,this.identity.threadId)
          if(!this.active(epoch) || !this.identity)return
          const expiredRecovery=options.recoverExpiredGate===true && options.allowIdleMessage===true
            && this.expiredGateRecoveryAllowed(transcript.messages,this.identity,live)
          if(options.recoverExpiredGate && !expiredRecovery){
            const conflicts=conflictingResearchHitlIds(transcript.messages)
            const resultCount=transcript.messages.flatMap(message=>message.content).filter(block=>block.type==='tool_result').length
            throw Error('恢复请求未发送：已提交审核 '+this.identity.submittedIds.length+' 项，待核对审核 '+this.identity.pendingIds.length+' 项，平台实时登记 '+(live===null?'不可用':live.length+' 项')+'，异常结果 '+conflicts.size+' 项，读取到工具结果 '+resultCount+' 项。原审核终态尚未核实，请保留此信息供排查。')
          }
          if(!expiredRecovery && !this.confirmedInputHint(transcript.messages,this.identity) && !(options.allowIdleMessage && this.recordedFormsResolved(transcript.messages,this.identity)))throw new Error('后台下一步尚未确认，未发送，请先核对会话。')
        }
      }
      let identity=this.identity || createResearchIdentity(scope,this.uuid)
      const runId='run-'+this.uuid()
      identity={...identity,runId,status:'running',pendingIds:[],submittedIds:[]}
      this.persist(identity)
      this.formSubmission=null
      this.status='running';this.interrupts=[];this.preview=null;this.notice='请求已发出，等待服务端运行事件。'
      const runIdentity:ResearchIdentity={agentId:scope.agentId,projectId:identity.projectId,threadId:identity.threadId,runId}
      const request=buildResearchRequest(runIdentity,'【项目ID】'+identity.projectId+'\n'+text)
      this.messages.push({id:request.messages[0]!.id,role:'user',text,local:true,at:Date.now()})
      issued=true
      const result=await this.services.run(runIdentity,request,event=>this.onEvent(epoch,runIdentity,event),ctl.signal)
      if(!this.active(epoch))return
      await this.applyResult(epoch,result,[])
    } catch(e) { if(!this.active(epoch))return;if(isUnresolvedInterruptsError(description(e))){this.recordPendingRejection();return}this.status='uncertain';this.notice=issued?'本次请求已发出，结果需要核对。':'本次内容尚未发送，已保留输入。';this.error=description(e)+(issued?' 当前运行结果需核对，未自动重试。':'');if(this.identity && this.identity.status==='running'){try{this.persist({...this.identity,status:'uncertain'})}catch{}} }
    finally{if(this.active(epoch)){this.busy=false;this.controller=null}}
  }
  private onEvent(epoch:number, identity:ResearchIdentity, event:AguiEvent) {
    if(!this.active(epoch) || typeof event.threadId==='string'&&event.threadId!==identity.threadId || typeof event.runId==='string'&&event.runId!==identity.runId)return
    if(this.formSubmission?.issued){
      if(event.type==='RUN_STARTED'){
        this.formSubmission.runStartedAt ??= Date.now()
        this.formSubmission.lastEventAt=Date.now()
      }
      if(event.type==='TEXT_MESSAGE_CONTENT' && typeof event.delta==='string' && event.delta.trim()){
        this.formSubmission.replyAt ??= Date.now()
        this.formSubmission.lastEventAt=Date.now()
      }
    }
    if(event.type==='RUN_STARTED')this.notice='已收到服务端运行事件，等待智能体回复。'
    if(event.type==='TEXT_MESSAGE_CONTENT' && typeof event.delta==='string') {
      this.notice='正在接收智能体回复。'
      const id=typeof event.messageId==='string'?event.messageId:'assistant';const existing=this.messages.find(m=>m.id===id && m.role==='assistant')
      if(existing)existing.text+=event.delta;else this.messages.push({id,role:'assistant',text:event.delta})
    }
  }
  private rememberReportedProgress() {
    const replies = this.messages.filter(message=>message.role==='assistant')
    for(let index=replies.length-1;index>=0;index--){
      const progress = readResearchProgress(replies[index]!.text)
      if(progress){
        this.reportedProgress=progress
        this.serverPhase=progress.phase
        return
      }
    }
  }
  private expiredGateRecoveryAllowed(messages:SessionTextMessage[],identity:StoredResearchIdentity,live:string[]|null) {
    if(identity.submittedIds.length || live?.length)return false
    const blocks=messages.flatMap(message=>message.content) as Array<{type:string;id?:string;output?:unknown}>
    const results=blocks.filter(block=>block.type==='tool_result' && block.id)
    const timeoutResult=(id:string)=>{
      const matches=results.filter(result=>result.id===id)
      return matches.length===1 && JSON.stringify(matches[0]!.output ?? '').includes('[HITL_TIMEOUT]')
    }
    const conflicts=conflictingResearchHitlIds(messages)
    if([...conflicts].some(id=>!timeoutResult(id)))return false
    const timeoutNotice=messages.some(message=>message.content.some(block=>block.type==='text' && /^\s*(?:\[平台留痕\]\s*)?等待用户审核超时[，,][\s\S]*(?:表单|闸门)[\s\S]*已自动关闭/.test(block.text || '')))
    if(!timeoutNotice)return false
    // When the optional live registry is unavailable, require a unique timeout
    // result for every known gate before sending this recovery-only request.
    if(live===null)return identity.pendingIds.length>0 && identity.pendingIds.every(id=>timeoutResult(id.split(':').slice(1).join(':')))
    return true
  }
  private recordedFormsResolved(messages:SessionTextMessage[],identity:StoredResearchIdentity) {
    const conflicts=conflictingResearchHitlIds(messages)
    if(conflicts.size)return false
    const successful=successfulResearchHitlIds(messages)
    return [...identity.pendingIds,...identity.submittedIds].every(id=>{
      const toolId=id.split(':').slice(1).join(':')
      return !!toolId && successful.has(toolId)
    })
  }
  private manualResumeClear(messages:SessionTextMessage[],identity:StoredResearchIdentity) {
    if(!this.recordedFormsResolved(messages,identity))return false
    const resolved=collectResolvedToolCallIds(messages as never[])
    return !messages.some(message=>message.content.some(block=>{
      const call=block as {type:string;id?:string}
      return call.type==='tool_call' && (!call.id || !resolved.has(call.id))
    }))
  }
  private confirmedInputHint(messages:SessionTextMessage[],identity:StoredResearchIdentity) {
    const latest = messages.filter(message =>
      (message.role === 'assistant' || message.role === 'user')
      && message.content.some(block => block.type === 'text' && block.text?.trim())
    ).at(-1)
    if(latest?.role !== 'assistant')return null
    const text=latest.content.filter(block=>block.type==='text').map(block=>block.text || '').join('')
    let hint=readResearchProgress(text)
    // A brief final reply can follow the full ledger in the same session.
    // Require an explicit current wait, verified G3 context and resolved tools.
    if(!hint && !text.includes('[进度]') && this.serverPhase==='G3'
        && /统计(?:段|执行)?(?:继续)?等待(?:你|团队|用户)(?:的)?确认/u.test(text.replace(/\*\*|__/g,''))
        && !/HITL_TIMEOUT|审核超时|统计(?:段)?(?:正在执行|已启动|已完成)/u.test(text)
        && this.recordedFormsResolved(messages,identity)){
      const resolved=collectResolvedToolCallIds(messages as never[])
      const unresolved=messages.some(message=>message.content.some(block=>{
        const call=block as {type:string;id?:string}
        return call.type==='tool_call' && (!call.id || !resolved.has(call.id))
      }))
      if(!unresolved)hint={phase:'G3',awaitingInput:true,currentWork:'无',nextStep:'等待团队确认统计执行',state:'等待人工'}
    }
    if(!hint?.awaitingInput)return null
    const conflicts = conflictingResearchHitlIds(messages)
    const successful = successfulResearchHitlIds(messages)
    const knownIds = [...identity.pendingIds,...identity.submittedIds]
    if(knownIds.some(id=>{
      const toolId = id.split(':').slice(1).join(':')
      return !toolId || conflicts.has(toolId) || !successful.has(toolId)
    }))return null
    return hint
  }
  private idleUserMessage(messages:SessionTextMessage[],identity:StoredResearchIdentity) {
    const latest=messages.filter(message=>message.content.some(block=>block.type==='text' && block.text?.trim())).at(-1)
    if(latest?.role!=='user' || !this.recordedFormsResolved(messages,identity))return false
    const text=latest.content.filter(block=>block.type==='text').map(block=>block.text || '').join('')
    if(!text.startsWith('【项目ID】'+identity.projectId+'\n'))return false
    const resolved=collectResolvedToolCallIds(messages as never[])
    return !messages.some(message=>message.content.some(block=>{
      const call=block as {type:string;id?:string}
      return call.type==='tool_call' && (!call.id || !resolved.has(call.id))
    }))
  }
  private rememberFormPhase(items:AguiInterrupt[]) {
    const phases = new Set(items.flatMap(item=>normalizeResearchInterrupt(item).title.match(/\bG[1-4]\b/g) || []))
    if(phases.size===1)this.serverPhase=[...phases][0]!
  }
  private halt(message:string) {
    this.halted=true;this.status='uncertain';this.error=message;this.notice=''
    if(this.identity)try{this.persist({...this.identity,status:'blocked'})}catch{}
  }
  private async cleanupConsumed(epoch:number,submitted:AguiInterrupt[],newItems:AguiInterrupt[]):Promise<boolean> {
    if(!this.scope || !this.identity)return false
    const scope={...this.scope}, thread=this.identity.threadId
    const newIds=new Set(newItems.map(item=>item.toolCallId || idOf(item).split(':').slice(1).join(':')))
    for(const item of submitted){
      if(!this.active(epoch))return false
      const toolId=item.toolCallId || idOf(item).split(':').slice(1).join(':')
      if(!toolId || newIds.has(toolId)){this.halt('新旧表单身份无法区分，已停止清理和继续；请交平台核查。');return false}
      if(item.metadata?.toolName==='plan_exit' && item.metadata.recoveredPlan===true)continue
      try{await this.services.remove(scope.agentId,thread,toolId)}
      catch{if(this.active(epoch))this.halt('已答表单登记清理失败；已停止继续和刷新恢复，请交平台核查。');return false}
      if(!this.active(epoch))return false
    }
    return true
  }
  private async applyResult(epoch:number,result:ResearchRunResult,submitted:AguiInterrupt[]) {
    if(!this.active(epoch) || this.halted || !this.identity || !this.scope)return
    for(const [id,text] of Object.entries(result.texts)){const existing=this.messages.find(m=>m.id===id && m.role==='assistant');if(existing)existing.text=text;else if(text)this.messages.push({id,role:'assistant',text})}
    this.rememberReportedProgress()
    if(result.status==='interrupt') {
      const ids=result.interrupts.map(idOf)
      if(!ids.length || ids.some(id=>!id) || new Set(ids).size!==ids.length) throw new Error('中断身份不完整，不能安全继续。')
      for(const item of result.interrupts)normalizeResearchInterrupt(item)
      this.rememberFormPhase(result.interrupts)
      this.persist({...this.identity,status:'interrupt',pendingIds:ids,unresolvedInterrupts:false})
      this.interrupts=result.interrupts;this.status='interrupt';this.notice='等待填写表单；提交会沿用原会话和原运行。'
      try {await this.services.register(this.scope.agentId,this.identity.threadId,result.interrupts,this.identity.runId)}
      catch {if(this.active(epoch))this.error='待答表单登记失败；刷新后可能无法恢复，请先核对服务。'}
      if(!this.active(epoch))return
      await this.cleanupConsumed(epoch,submitted,result.interrupts)
      return
    }
    if(result.status!=='success') {
      if(isUnresolvedInterruptsError(result.message)){this.recordPendingRejection();return}
      this.persist({...this.identity,status:'uncertain'});this.status='uncertain'
      this.error=result.message || '运行没有明确成功终态，请核对会话。'
      this.notice='本次运行结果尚未确认，请核对会话；没有自动重试。'
      return
    }
    if(submitted.length && this.identity.unresolvedInterrupts)this.persist({...this.identity,unresolvedInterrupts:false})
    // Delete only confirmed consumed IDs, never the session-wide registry and never a new gate.
    if(!await this.cleanupConsumed(epoch,submitted,[]) || !this.active(epoch) || !this.scope || !this.identity)return
    this.interrupts=[]
    try {
      const state=await this.services.runStatus(this.scope.agentId,this.identity.threadId)
      if(!this.active(epoch) || !this.identity)return
      this.lastStatusCheckAt=new Date().toISOString()
      this.serverPhase=state.phase || this.serverPhase
      if(state.running || state.pendingWork){this.persist({...this.identity,status:'running',pendingIds:[]});this.status='working';this.notice='本轮回复已结束，后台仍有工作；请稍后核对会话。';return}
      if(state.continuationPlanned){this.persist({...this.identity,status:'running',pendingIds:[]});this.status='working';this.notice='本轮回复已结束，进度台账仍有待推进工作；请恢复会话核对。';return}
      if(state.continuationUnknown)throw new Error('当前后台未提供待办状态，进度台账也无法确认，请恢复会话核对。')
      if(state.awaitingInput){
        const pending=await this.services.pending(this.scope.agentId,this.identity.threadId)
        if(!this.active(epoch) || !this.identity)return
        if(pending.length)throw new Error('服务端出现新的待答表单，请恢复会话核对其运行身份。')
        this.nextStage=state.nextStage || '';this.persist({...this.identity,status:'finished',pendingIds:[]});this.status='awaiting';this.notice='本轮回复已结束；服务端等待后续输入，当前没有登记待审核表单。';return
      }
      this.persist({...this.identity,status:'finished',pendingIds:[]});this.status='finished';this.notice='本轮对话已结束；研究成果和阶段确认仍需核对。'
    }catch(e){
      if(!this.active(epoch) || !this.identity)return
      this.persist({...this.identity,status:'uncertain',pendingIds:[]});this.notice='';this.status='uncertain';this.error='本轮回复已结束，但后台状态无法核对，请恢复会话。'+description(e)
    }
  }
  async submit(answers:Record<string,Record<string,unknown>>) {
    if(!this.scope || !this.identity || this.status!=='interrupt' || this.busy || this.stopping)return
    const epoch=this.epoch, scope={...this.scope}, previous=[...this.interrupts]
    const identity:ResearchIdentity={agentId:scope.agentId,projectId:this.identity.projectId,threadId:this.identity.threadId,runId:this.identity.runId}
    let request:AguiRunRequest
    try {request=buildResearchRequest(identity,'',previous,answers)}
    catch(e){this.error=description(e);return}
    const now=Date.now()
    this.formSubmission={startedAt:now,issued:false,runStartedAt:null,replyAt:null,lastEventAt:now,settledAt:null,checkedAt:null,checkMessage:'',checkFailed:false,checking:false}
    const ctl=new AbortController();this.controller=ctl;this.busy=true;this.error='';this.notice='正在核对服务端待答表单。'
    let issued=false
    try {
      const [serverPending,live]=await Promise.all([this.services.pending(scope.agentId,identity.threadId),this.services.live?this.services.live(scope.agentId,identity.threadId):Promise.resolve(null)])
      if(!this.active(epoch))return
      const expected=previous.map(idOf).sort(), actual=serverPending.map(idOf).sort()
      let provenUnregisteredPlan=false
      if(!serverPending.length && previous.length===1 && previous[0]!.metadata?.toolName==='plan_exit' && previous[0]!.metadata.recoveredPlan===true && this.services.historyEvents){
        const [transcript,history,state]=await Promise.all([this.services.transcript(scope.agentId,identity.threadId),this.services.historyEvents(identity.threadId),this.services.runStatus(scope.agentId,identity.threadId)])
        if(!this.active(epoch))return
        const proof=recoverResearchPlan(transcript.messages,history,identity.threadId)
        provenUnregisteredPlan=!!proof && proof.runId===identity.runId && !state.running && !state.pendingWork
          && JSON.stringify(proof.interrupts.map(item=>({id:idOf(item),input:item.metadata?.toolInput})))===JSON.stringify(previous.map(item=>({id:idOf(item),input:item.metadata?.toolInput})))
        if(!provenUnregisteredPlan)throw Error('待确认计划或运行身份已变化，未提交任何答复。')
      }
      if(!provenUnregisteredPlan && (expected.length!==actual.length || expected.some((id,i)=>id!==actual[i])) || live!==null && (live.length!==expected.length || [...live].sort().some((id,i)=>id!==expected[i]))) throw Error('服务端待答表单已变化，请恢复会话核对，未提交任何答复。')
      if(serverPending.some(item=>typeof item.metadata?.runId==='string' && item.metadata.runId && item.metadata.runId!==identity.runId)) throw Error('服务端待答表单的运行身份不匹配，未提交。')
      if(!this.identity)throw Error('运行身份已失效。')
      this.persist({...this.identity,status:'submitting',submittedIds:[...new Set([...this.identity.submittedIds,...previous.map(idOf)])]})
      this.status='running';this.nextStage='';this.notice='正在提交表单并等待服务端回应。';issued=true
      this.formSubmission!.issued=true
      const result=await this.services.run(identity,request,event=>this.onEvent(epoch,identity,event),ctl.signal)
      if(!this.active(epoch))return
      if(this.formSubmission && Object.values(result.texts).some(text=>text.trim())){
        this.formSubmission.replyAt ??= Date.now()
        this.formSubmission.lastEventAt=Date.now()
      }
      await this.applyResult(epoch,result,previous)
    } catch(e){if(!this.active(epoch))return;if(isUnresolvedInterruptsError(description(e))){this.recordPendingRejection();return}if(issued){this.status='uncertain';this.error='提交结果未确认，请先恢复会话核对，不要重复提交。'+description(e);if(this.identity)try{this.persist({...this.identity,status:'uncertain'})}catch{}}else{this.status='interrupt';this.error=description(e)}}
    finally{if(this.active(epoch)){
      if(this.formSubmission)this.formSubmission.settledAt=Date.now()
      this.busy=false;this.controller=null
    }}
  }
  async checkFormSubmission() {
    const feedback=this.formSubmission
    if(!feedback || feedback.checking || !this.scope || !this.identity || this.halted)return
    const epoch=this.epoch,scope={...this.scope},identity={...this.identity}
    feedback.checking=true
    try{
      const state=await this.services.runStatus(scope.agentId,identity.threadId)
      if(!this.active(epoch) || this.formSubmission!==feedback || this.identity?.runId!==identity.runId)return
      feedback.checkedAt=Date.now();feedback.checkFailed=false
      feedback.checkMessage=state.running?'服务端报告会话仍在运行'
        :state.pendingWork?'服务端报告后台仍有待处理工作'
        :state.awaitingInput?'服务端报告正在等待输入，请核对最新回复'
        :state.continuationUnknown || state.continuationPlanned?'服务端尚未确认下一步状态'
        :'服务端报告会话空闲，等待本次请求返回或核对会话'
    }catch{
      if(this.active(epoch) && this.formSubmission===feedback){
        feedback.checkedAt=Date.now();feedback.checkFailed=true
        feedback.checkMessage='本次状态核对失败，暂时无法确认后台进展'
      }
    }finally{
      if(this.active(epoch) && this.formSubmission===feedback)feedback.checking=false
    }
  }
  private reconciling = false
  /** Remove only our submitted registration after a unique durable HITL result exists.
   * This is registration housekeeping, never a stage approval or conflict recovery. */
  async reconcileSubmitted(): Promise<void> {
    if(this.reconciling || this.halted || !this.scope || !this.identity?.submittedIds.length || this.identity.status==='finished')return
    const epoch=this.epoch, scope={...this.scope}, identity={...this.identity}
    const current=()=>this.active(epoch) && this.identity?.threadId===identity.threadId && this.identity?.runId===identity.runId
    this.reconciling=true
    try {
      const [transcript,pending]=await Promise.all([
        this.services.transcript(scope.agentId,identity.threadId),
        this.services.pending(scope.agentId,identity.threadId),
      ])
      if(!current())return
      const conflicts=conflictingResearchHitlIds(transcript.messages)
      if(identity.submittedIds.some(id=>conflicts.has(id.split(':').slice(1).join(':')))){
        this.halt('审核存在重复结果或平台超时冲突，已停止推进；请核对平台持久记录。');return
      }
      const successful=successfulResearchHitlIds(transcript.messages)
      for(const item of pending){
        if(!current())return
        const id=idOf(item),toolId=String(item.toolCallId || id.split(':').slice(1).join(':'))
        if(!identity.submittedIds.includes(id) || !successful.has(toolId))continue
        const remoteRun=item.metadata?.runId
        if(typeof remoteRun==='string' && remoteRun && remoteRun!==identity.runId)continue
        await this.services.remove(scope.agentId,identity.threadId,toolId)
      }
    } catch {
      // A missing response is not evidence of acceptance. Preserve submitted IDs.
      if(current())this.notice='审核提交仍需核对；本次对账未确认完成，没有重投审核。'
    } finally { this.reconciling=false }
  }
  /** Explicit read-only recheck after service repair. Never resubmit or delete a gate here. */
  async recheckBlocked() {
    if(!this.halted || !this.scope || !this.identity || this.busy || this.stopping)return
    const epoch=this.epoch,scope={...this.scope},identity={...this.identity}
    this.busy=true;this.error='';this.notice='正在核对已保存的审核结果和服务端登记。'
    let verified=false
    try {
      const [transcript,pending,status,live]=await Promise.all([
        this.services.transcript(scope.agentId,identity.threadId),this.services.pending(scope.agentId,identity.threadId),
        this.services.runStatus(scope.agentId,identity.threadId),this.services.live?.(scope.agentId,identity.threadId)??Promise.resolve(null),
      ])
      if(!this.active(epoch))return
      if(status.running || status.pendingWork)throw Error('服务端仍在处理，请稍后再核对。')
      if(status.continuationUnknown)throw Error('服务端进度仍需核对，暂不能解除保护。')
      if(live===null)throw Error('服务端未提供可核对的实时审核登记，暂不能解除保护。')
      if(pending.length || live.length)throw Error('服务端仍有待答审核，请由平台核查后再恢复；未重新提交。')
      const ids=[...new Set([...identity.submittedIds,...identity.pendingIds])]
      const successful=successfulResearchHitlIds(transcript.messages)
      if(!ids.length || ids.some(id=>!successful.has(id.split(':').slice(1).join(':'))))throw Error('未找到全部原审核的成功记录，保护仍保留；空登记不能证明审核已完成。')
      this.persist({...identity,status:'uncertain',pendingIds:[]})
      this.halted=false;verified=true
    } catch(e){if(this.active(epoch)){this.error=description(e);this.notice='';this.status='uncertain'}}
    finally{if(this.active(epoch))this.busy=false}
    if(verified && this.active(epoch))await this.recover()
  }
  async recover(options: {readOnly?:boolean} = {}) {
    if(!this.scope || !this.identity || !this.identity.runId || this.busy || this.stopping || this.halted)return
    const epoch=this.epoch, scope={...this.scope}, identity={...this.identity};this.recoveryDiagnostic=null;this.busy=true;this.error='';this.notice='正在核对会话、待答表单和运行状态。'
    if(!options.readOnly)await this.reconcileSubmitted()
    if(!this.active(epoch) || this.halted){if(this.active(epoch))this.busy=false;return}
    try {
      const [transcriptResult,pendingResult,statusResult,progressResult]=await Promise.allSettled([
        this.services.transcript(scope.agentId,identity.threadId),
        this.services.pending(scope.agentId,identity.threadId),
        this.services.runStatus(scope.agentId,identity.threadId),
        this.services.progress?.(scope.agentId,identity.threadId) ?? Promise.resolve(null),
      ])
      if(!this.active(epoch))return
      this.nextStage=''
      if(transcriptResult.status==='rejected')throw transcriptResult.reason
      const transcript=transcriptResult.value
      const conflicts=conflictingResearchHitlIds(transcript.messages)
      if(identity.submittedIds.some(id=>conflicts.has(id.split(':').slice(1).join(':')))){
        this.halt('审核存在重复结果或平台超时冲突，已停止推进；请核对平台持久记录。');return
      }
      this.messages=mergeTranscript(this.messages.map(message=>({...message,at:message.at ?? 0})),transcript.messages || [])
      this.rememberReportedProgress()
      // Keep readable messages even if a separate status/pending request failed.
      if(pendingResult.status==='rejected')throw pendingResult.reason
      if(statusResult.status==='rejected')throw statusResult.reason
      let pending=pendingResult.value
      const status=statusResult.value
      this.lastStatusCheckAt=new Date().toISOString()
      this.serverPhase=status.phase || this.serverPhase
      if(progressResult.status==='fulfilled' && progressResult.value?.sessionId===identity.threadId){
        const snapshot=progressResult.value
        const report=readResearchProgress(snapshot.progressLine || snapshot.lastText || '')
        if(report){this.reportedProgress=report;this.serverPhase=report.phase}
        if(['G1','G2','G3','G4'].includes(snapshot.phase || ''))this.serverPhase=snapshot.phase!
      }
      const hasAskingPlan=transcript.messages.some(message=>message.content.some(value=>{
        const block=value as {type:string;name?:string;state?:string}
        return message.role==='assistant' && block.type==='tool_call' && block.name==='plan_exit' && block.state==='asking'
      }))
      if(!pending.length && hasAskingPlan && this.services.historyEvents && !status.running && !status.pendingWork){
        const history=await this.services.historyEvents(identity.threadId)
        if(!this.active(epoch))return
        const proof=recoverResearchPlan(transcript.messages,history,identity.threadId)
        if(proof){
          identity.runId=proof.runId;identity.pendingIds=proof.interrupts.map(idOf);identity.status='interrupt'
          pending=proof.interrupts
          this.persist(identity)
        }
      }
      // Pre-fix clients did not persist this marker. Recover it only from this exact run's server event.
      if(identity.unresolvedInterrupts===undefined && !pending.length && (identity.status==='uncertain' || this.status==='uncertain') && this.services.events){
        const records=await this.services.events(identity.threadId).catch(()=>null)
        if(!this.active(epoch))return
        if(records?.some(record=>record.runId===identity.runId && record.payload.threadId===identity.threadId
          && record.payload.runId===identity.runId && isUnresolvedInterruptsError(runEventError(record.payload) || ''))){
          identity.unresolvedInterrupts=true
          this.persist({...identity,status:'uncertain'})
        }
      }
      // A registry miss must not erase the server's explicit unresolved-interrupt rejection.
      if(identity.unresolvedInterrupts && !pending.length){
        const live = this.services.live ? await this.services.live(scope.agentId,identity.threadId) : null
        if(!this.active(epoch))return
        if(live===null)throw Error('服务端曾报告未决待办，但待答登记未返回表单，实时待办接口不可用。请保留原会话，核对平台待办状态。')
        if(live.length)throw Error('服务端仍有 '+live.length+' 项未决待办，但未返回可填写的表单。请核对原会话的待答内容，不能重复发送继续指令。')
        if(!status.running && !status.pendingWork && !status.continuationPlanned && this.identity){
          this.persist({...this.identity,unresolvedInterrupts:false})
        }
      }
      // A resume can still own its SDK registration while the model is running.
      // Keep submitted IDs and wait for an idle snapshot before judging revival.
      const hasSubmittedPending = pending.some(item=>identity.submittedIds.includes(idOf(item)))
      if((status.running || status.pendingWork) && (!pending.length || hasSubmittedPending)){
        this.interrupts=[];this.status='working'
        this.notice=hasSubmittedPending ? '已提交的表单仍在服务端处理中，正在核对处理结果。' : '运行接口报告会话仍在运行，当前没有返回待答表单；下方进度为会话最近报告的记录。'
        return
      }
      const resolved=collectResolvedToolCallIds(transcript.messages as never[])
      // A new background form may lack runId in the registration. Accept only
      // an exact, unambiguous match in this session's recorded terminal events.
      const unknown=pending.filter(item=>!identity.pendingIds.includes(idOf(item)) && !identity.submittedIds.includes(idOf(item)) && item.metadata?.runId!==identity.runId && !resolved.has(String(item.toolCallId || idOf(item).split(':').slice(1).join(':'))))
      let confirmedIdentity=identity
      if(unknown.length) {
        const findMatches=(events:Array<{runId?:string;payload:AguiEvent}>)=>{
          const matches=matchingBackgroundRuns(events,identity.threadId,pending)
          for(const record of events){
            const event=record.payload,run=record.runId
            if(!run||event.type!=='RUN_FINISHED'||(event.outcome as {type?:string}|undefined)?.type!=='interrupt')continue
            if(event.threadId!==identity.threadId||typeof event.runId==='string'&&event.runId!==run)continue
            const items=extractInterrupts(event)
            if(pending.every(item=>items.some(candidate=>idOf(candidate)===idOf(item)&&String(candidate.toolCallId||idOf(candidate).split(':').slice(1).join(':'))===String(item.toolCallId||idOf(item).split(':').slice(1).join(':'))&&candidate.metadata?.toolName===item.metadata?.toolName&&sameResearchToolInput(candidate.metadata?.toolInput,item.metadata?.toolInput))))matches.add(run)
          }
          return matches
        }
        let recent:Array<{runId?:string;payload:AguiEvent}>=[]
        try{if(this.services.events)recent=await this.services.events(identity.threadId)}catch{if(!this.services.historyEvents)throw Error('待答表单缺少可核对的运行身份。')}
        if(!this.active(epoch))return
        let inspected=recent
        let matches=findMatches(recent)
        // The current watermark may point at a later background run than the pending form.
        // Search same-session history only when the latest window supplies no binding.
        if(matches.size===0&&this.services.historyEvents){
          const history=await this.services.historyEvents(identity.threadId)
          if(!this.active(epoch))return
          inspected=history;matches=findMatches(history)
        }
        if(matches.size!==1){
          const toolIds=new Set(pending.map(item=>String(item.toolCallId||idOf(item).split(':').slice(1).join(':'))))
          const relevant=inspected.filter(record=>{
            const event=record.payload
            return toolIds.has(String(event.toolCallId||''))||extractInterrupts(event).some(item=>toolIds.has(String(item.toolCallId||idOf(item).split(':').slice(1).join(':'))))
          })
          const runs=new Set(relevant.map(record=>record.runId).filter(Boolean))
          const select=(record:{runId?:string;payload:AguiEvent})=>{
            const e=record.payload
            return {recordRunId:record.runId,type:e.type,threadId:e.threadId,runId:e.runId,toolCallId:e.toolCallId,toolCallName:e.toolCallName,delta:e.type==='TOOL_CALL_ARGS'?e.delta:undefined,interrupts:extractInterrupts(e).map(item=>({id:idOf(item),toolCallId:item.toolCallId,metadata:item.metadata})),outcomeType:(e.outcome as {type?:string}|undefined)?.type}
          }
          this.recoveryDiagnostic={version:1,capturedAt:new Date().toISOString(),threadId:identity.threadId,originalRunId:identity.runId,pending:pending.map(item=>({id:idOf(item),toolCallId:item.toolCallId,metadata:item.metadata})),scannedEvidence:inspected.length,matchedRuns:[...matches],eventTypes:inspected.reduce((counts,record)=>{const type=String(record.payload.type);counts[type]=(counts[type]||0)+1;return counts},{} as Record<string,number>),targetEvents:relevant.map(select),runBoundaryEvents:inspected.filter(record=>runs.has(record.runId)&&['RUN_STARTED','RUN_FINISHED','RUN_ERROR'].includes(String(record.payload.type))).map(select)}
          throw Error('后台表单尚未恢复：已核对 '+inspected.length+' 条运行/工具记录，找到 '+relevant.length+' 条目标工具事件，可确认的运行 '+matches.size+' 个。未提交，请导出核对信息定位。')
        }
        confirmedIdentity={...identity,runId:[...matches][0]!,pendingIds:pending.map(idOf),status:'interrupt'}
      }
      const recovered=reconcileResearchPending(pending,resolved,confirmedIdentity)
      if(confirmedIdentity!==identity)this.persist(confirmedIdentity)
      this.interrupts=recovered
      if(recovered.length){
        this.rememberFormPhase(recovered)
        this.status='interrupt';this.notice='已恢复待答表单，请核对后继续。';return
      }
      if(status.running || status.pendingWork){this.status='working';this.notice='运行接口报告会话仍在运行，当前没有返回待答表单；下方进度为会话最近报告的记录。';return}
      if(status.completedRun){
        const live=this.services.live ? await this.services.live(scope.agentId,identity.threadId) : null
        if(!this.active(epoch))return
        if(live?.length)throw Error('当前仍有待答事项，请先恢复表单。')
        if(!canMessageCompletedResearch(transcript.messages,identity))throw Error('本轮已结束，但历史表单或工具的终态仍无法核实，请核对原会话；未自动继续或提交。')
        this.status='awaiting';this.error='';this.notice='当前回复已结束，可以在原对话补充材料或继续提问。'
        return
      }
      if(status.manualAttention){
        if(!this.manualResumeClear(transcript.messages,identity))throw Error('平台已停止自动补醒，但原会话仍有未核实的工具或审核结果，请先核对待答事项。')
        const live=this.services.live ? await this.services.live(scope.agentId,identity.threadId) : null
        if(!this.active(epoch))return
        if(live?.length)throw Error('原会话仍有实时待答事项，请先恢复对应表单。')
        this.status='awaiting';this.error='';this.notice='平台已停止自动补醒，当前会话及后台任务均空闲。可以在原对话发送说明或补充材料；研究阶段仍需人工确认。'
        return
      }
      if(status.continuationPlanned){this.status='working';this.notice='进度台账仍有待推进工作；这不代表子任务当前仍在执行，请核对会话。';return}
      if(status.continuationUnknown){
        const hint = this.confirmedInputHint(transcript.messages,identity)
        if(hint){
          this.serverPhase=hint.phase;this.nextStage=hint.nextStage || ''
          this.status='awaiting';this.error='';this.notice='当前会话等待你的确认或补充内容。'
          return
        }
      }
      if(status.continuationUnknown && this.idleUserMessage(transcript.messages,identity)){
        const live=this.services.live ? await this.services.live(scope.agentId,identity.threadId) : null
        if(!this.active(epoch))return
        if(!live?.length){
          this.status='awaiting';this.error=''
          this.notice='服务端报告会话当前空闲，最近记录是你发送的消息。可以继续发送补充说明或询问处理结果。'
          return
        }
      }
      if(status.continuationUnknown){this.status='uncertain';this.error='当前后台未提供待办状态，进度台账也无法确认，请恢复会话核对。';this.notice='会话消息已读取，但后台下一步分类仍不明确。需要结合当前待答表单及会话记录核对。';return}
      const unresolved=identity.pendingIds.filter(id=>{const toolId=id.split(':').slice(1).join(':');return !toolId || !resolved.has(toolId)})
      if(unresolved.length){this.status='uncertain';this.error='无法核对已记录的待答表单，请勿重复提交。';return}
      if(status.awaitingInput){this.nextStage=status.nextStage || '';this.status='awaiting';this.notice='本轮回复已结束；服务端等待后续输入，当前没有登记待审核表单。';return}
      this.status='finished';this.notice='会话当前空闲；以真实产物与人工确认判断研究进度。'
    } catch(e){if(!this.active(epoch))return;this.notice='';this.status='uncertain';this.nextStage='';this.interrupts=[];this.artifacts=[];this.preview=null;if(this.messages.length)this.notice='当前显示已读取的会话内容，最新状态仍需核对。';if(description(e).includes('已答中断'))this.halt(description(e));else this.error=description(e)}
    finally{if(this.active(epoch))this.busy=false}
  }
  async stopServer() {
    if(!this.scope || !this.identity || !this.services.stop || this.stopping || !['running','working'].includes(this.status))return
    const epoch=this.epoch, scope={...this.scope}, thread=this.identity.threadId;this.stopping=true;this.error=''
    try {
      const result=await this.services.stop(scope.agentId,thread)
      if(!this.active(epoch))return
      if(result.session_id!==thread || typeof result.interrupted!=='boolean')throw Error('停止响应的会话身份不匹配。')
      this.invalidate();this.status='uncertain';this.notice=result.interrupted?'已请求服务端停止，请恢复会话核对实际状态。':'服务端未报告活动运行，仍需恢复会话核对状态。'
      if(this.identity)try{this.persist({...this.identity,status:'uncertain'})}catch(e){this.error=description(e)}
    }catch(e){if(this.active(epoch))this.error='服务端停止请求失败，运行可能仍在继续。'+description(e)}
    finally{if(this.active(epoch))this.stopping=false}
  }
  stop() {if(!this.busy)return;this.invalidate();this.status='uncertain';this.error='已停止本页接收；服务端任务可能仍在运行，请先恢复会话核对。';if(this.identity)try{this.persist({...this.identity,status:'uncertain'})}catch{}}
  async refreshArtifacts() {
    if(!this.scope || !this.identity || this.busy)return
    const epoch=this.epoch,scope={...this.scope},thread=this.identity.threadId;this.busy=true;this.error=''
    try {const tree=await this.services.tree(scope.agentId,thread);if(!this.active(epoch))return;if(!Array.isArray(tree))throw Error('产物树格式无效。');this.artifacts=tree;this.notice=tree.length?'产物列表已读取，请核对具体路径及所属运行。':'当前会话没有可读取的产物。'}
    catch(e){if(this.active(epoch)){this.artifacts=[];this.preview=null;this.error=description(e)}}
    finally{if(this.active(epoch))this.busy=false}
  }
  async previewArtifact(path:string) {
    if(!this.scope || !this.identity || this.busy)return
    const all=(nodes:ArtifactNode[]):ArtifactNode[]=>nodes.flatMap(n=>[n,...(n.children?all(n.children):[])])
    if(!all(this.artifacts).some(n=>n.type==='file' && n.path===path)){this.error='请选择当前会话产物树中的文件。';return}
    const epoch=this.epoch,scope={...this.scope},thread=this.identity.threadId;this.busy=true;this.preview=null;this.error=''
    try{const result=await this.services.read(scope.agentId,thread,path);if(!this.active(epoch))return;if(result.path!==path)throw Error('产物返回路径不匹配。');this.preview=result}
    catch(e){if(this.active(epoch))this.error=description(e)}finally{if(this.active(epoch))this.busy=false}
  }
}


/** Decode only the stable account subject for local namespacing; the server still checks authorization. */
export function currentResearchOwner():string {
  // 演示模式：mock 登录没有 JWT，用本地账号名做本机命名空间（仅本机数据，不涉服务端授权）。
  if (RESEARCH_AGENT_DEMO) {
    try {
      const raw=localStorage.getItem(USER_KEY)
      const parsed=raw?JSON.parse(raw) as {username?:string}:null
      return 'demo:'+(parsed?.username||'guest')
    } catch { return 'demo:guest' }
  }
  try {
    const part=getAccessToken().split('.')[1]
    if(!part)return ''
    const value=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))) as {sub?:unknown}
    return typeof value.sub==='string' && value.sub ? value.sub : ''
  } catch {return ''}
}

const liveServices:ResearchRunServices={
  verify:verifyResearchAgent,
  stop:interruptResearchSession,
  run:streamResearchRun,
  transcript:fetchSessionTranscript,
  pending:listPendingInterrupts,
  events:fetchResearchRecoveryEvents,
  historyEvents:threadId=>fetchResearchRecoveryEvents(threadId,true),
  runStatus:fetchResearchRunStatus,
  progress:(agentId,threadId)=>fetchSessionProgress(agentId,threadId,5000),
  register:registerInterrupts,
  remove:removePendingInterrupt,
  tree:fetchArtifactTree,
  read:fetchArtifactContent,
  async live(agentId,threadId){
    try{return await listLiveInterruptIds(agentId,threadId)}
    catch(error){if(error && typeof error==='object' && 'status' in error && error.status===404)return null;throw error}
  },
}
export const useResearchRuns=defineStore('research-runs',()=>{
  const storage=markRaw({getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value)})
  // 演示模式（VITE_RESEARCH_AGENT_MODE=demo）：智能体对话走本机模拟脚本，不连接后端。
  const services:ResearchRunServices=RESEARCH_AGENT_DEMO?markRaw(createDemoResearchServices(localStorage)):markRaw(liveServices)
  const session=reactive(new ResearchRunSession(storage,services,currentResearchOwner)) as ResearchRunSession
  return {session}
})
