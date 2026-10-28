import { buildResearchRequest, normalizeResearchInterrupt, reconcileResearchPending, streamResearchRun } from '@/api/szRun'
import { reactive, markRaw } from 'vue'
import { defineStore } from 'pinia'
import { getAccessToken } from '@/api/http'
import { fetchAguiEvents } from '@/api/aguiEvents'
import { extractInterrupts } from '@/api/agui'
import { verifyResearchAgent, interruptResearchSession } from '@/api/researchAgent'
import { fetchSessionTranscript, fetchSessionRunStatus } from '@/api/session'
import { listPendingInterrupts, listLiveInterruptIds, registerInterrupts, removePendingInterrupt } from '@/api/formInterrupt'
import { fetchArtifactTree, fetchArtifactContent } from '@/api/artifact'
import { collectResolvedToolCallIds } from '@/utils/analysis/gateRebuild'
import { createResearchIdentity, loadResearchIdentity, saveResearchIdentity, type ResearchScope, type StoredResearchIdentity } from '@/utils/researchRunIdentity'
import type { ResearchIdentity, ResearchRunStatus } from '@/api/szRun'
import type { AguiEvent, AguiInterrupt, AguiRunRequest } from '@/types/agui'
import type { SessionTextMessage } from '@/api/session'
import type { ArtifactContent, ArtifactNode } from '@/types/sandbox'

export interface ResearchMessage { id:string; role:'user'|'assistant'; text:string }
export interface ResearchRunResult {status:ResearchRunStatus;message:string;texts:Record<string,string>;interrupts:AguiInterrupt[]}
export interface ResearchRunServices {
  verify: (agentId:string) => Promise<void>
  run: (identity:ResearchIdentity, request:AguiRunRequest, onEvent:(event:AguiEvent)=>void, signal:AbortSignal) => Promise<ResearchRunResult>
  transcript: (agentId:string,threadId:string) => Promise<{messages:SessionTextMessage[]}>
  pending: (agentId:string,threadId:string) => Promise<AguiInterrupt[]>
  events?: (threadId:string) => Promise<Array<{runId?:string;payload:AguiEvent}>>
  live?: (agentId:string,threadId:string) => Promise<string[] | null>
  stop?: (agentId:string,threadId:string) => Promise<{session_id:string;interrupted:boolean}>
  runStatus: (agentId:string,threadId:string) => Promise<{running:boolean;pendingWork?:boolean}>
  register: (agentId:string,threadId:string,items:AguiInterrupt[],runId:string) => Promise<void>
  remove: (agentId:string,threadId:string,toolCallId:string) => Promise<void>
  tree: (agentId:string,threadId:string) => Promise<ArtifactNode[]>
  read: (agentId:string,threadId:string,path:string) => Promise<ArtifactContent>
}
type State = 'idle'|'checking'|'running'|'interrupt'|'uncertain'|'finished'|'working'
const idOf = (item:AguiInterrupt) => String(item.id || item.interruptId || '')
function description(error:unknown) { return error instanceof Error ? error.message : '请求失败，请检查连接和登录状态。' }

/** Task identity, user identity and all late responses are guarded separately. */
export class ResearchRunSession {
  scope:ResearchScope|null = null; identity:StoredResearchIdentity|null = null; baseline:string|null = null
  status:State = 'idle'; error = ''; notice = ''; probeText = ''; probePassed = false
  messages:ResearchMessage[] = []; interrupts:AguiInterrupt[] = []; artifacts:ArtifactNode[] = []; preview:ArtifactContent|null = null
  busy = false; stopping = false; halted = false
  private epoch = 0; private controller:AbortController|null = null; private verifiedKey = ''
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>, private services:ResearchRunServices, private owner:()=>string, private uuid:()=>string = ()=>crypto.randomUUID()) {}
  private active(epoch:number) { return epoch===this.epoch && !!this.scope && this.scope.ownerId===this.owner() }
  private persist(next:StoredResearchIdentity) {
    if (!this.scope || this.owner()!==this.scope.ownerId) throw new Error('登录账户已变化，运行身份未写入。')
    this.baseline=saveResearchIdentity(this.storage,this.scope,this.baseline,next)
    this.identity=next
  }
  private invalidate() { this.epoch++;this.controller?.abort();this.controller=null;this.busy=false;this.stopping=false }
  dispose() { this.invalidate();this.verifiedKey='';this.probePassed=false;this.scope=null;this.identity=null;this.halted=false;this.messages=[];this.interrupts=[];this.artifacts=[];this.preview=null }
  async select(scope:ResearchScope) {
    if(this.scope && this.scope.ownerId===scope.ownerId && this.scope.agentId===scope.agentId && this.scope.taskId===scope.taskId && this.owner()===scope.ownerId)return
    this.invalidate()
    this.scope={...scope};this.halted=false;this.identity=null;this.baseline=null;this.messages=[];this.interrupts=[];this.artifacts=[];this.preview=null;this.error='';this.notice='';this.status='idle'
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
      if(result.status!=='success' || !text) throw new Error('模型探测没有收到完整成功终态和文字，请核对模型通道。')
      this.probePassed=true;this.verifiedKey=scope.ownerId+':'+scope.agentId;this.status=this.identity?priorStatus:'idle';this.notice='模型已返回文字；这是一次连接检查，不代表研究阶段完成。'
    }catch(e){if(!this.active(epoch))return;this.probePassed=false;this.status='uncertain';this.error=description(e)}
    finally{clearTimeout(timer);if(this.active(epoch)){this.busy=false;this.controller=null}}
  }
  async start(text:string) {
    if (!this.scope || this.busy || this.stopping || !text.trim()) return
    if (!this.probePassed) {this.error='请先测试模型响应，再启动研究。';return}
    if (this.status==='interrupt' || this.status==='working' || this.status==='uncertain' || this.status==='running') {this.error='当前运行仍待确认或核对，请先恢复会话。';return}
    const epoch=this.epoch, scope={...this.scope};this.busy=true;this.error='';this.notice=''
    const ctl=new AbortController();this.controller=ctl
    try {
      await this.services.verify(scope.agentId);if(!this.active(epoch))return
      if (this.identity && this.identity.status!=='new') {
        const [pending,status]=await Promise.all([this.services.pending(scope.agentId,this.identity.threadId),this.services.runStatus(scope.agentId,this.identity.threadId)])
        if(!this.active(epoch))return
        if(pending.length || status.running || status.pendingWork) throw new Error('会话仍在运行或存在待确认内容，请先恢复会话。')
      }
      let identity=this.identity || createResearchIdentity(scope,this.uuid)
      const runId='run-'+this.uuid()
      identity={...identity,runId,status:'running',pendingIds:[],submittedIds:[]}
      this.persist(identity)
      this.status='running';this.interrupts=[];this.preview=null
      this.messages.push({id:'u-'+this.uuid(),role:'user',text})
      const runIdentity:ResearchIdentity={agentId:scope.agentId,projectId:identity.projectId,threadId:identity.threadId,runId}
      const request=buildResearchRequest(runIdentity,'【项目ID】'+identity.projectId+'\n'+text)
      const result=await this.services.run(runIdentity,request,event=>this.onEvent(epoch,runIdentity,event),ctl.signal)
      if(!this.active(epoch))return
      await this.applyResult(epoch,result,[])
    } catch(e) { if(!this.active(epoch))return;this.status='uncertain';this.error=description(e)+' 当前运行结果需核对，未自动重试。';if(this.identity && this.identity.status==='running'){try{this.persist({...this.identity,status:'uncertain'})}catch{}} }
    finally{if(this.active(epoch)){this.busy=false;this.controller=null}}
  }
  private onEvent(epoch:number, identity:ResearchIdentity, event:AguiEvent) {
    if(!this.active(epoch) || typeof event.threadId==='string'&&event.threadId!==identity.threadId || typeof event.runId==='string'&&event.runId!==identity.runId)return
    if(event.type==='TEXT_MESSAGE_CONTENT' && typeof event.delta==='string') {
      const id=typeof event.messageId==='string'?event.messageId:'assistant';const existing=this.messages.find(m=>m.id===id && m.role==='assistant')
      if(existing)existing.text+=event.delta;else this.messages.push({id,role:'assistant',text:event.delta})
    }
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
      try{await this.services.remove(scope.agentId,thread,toolId)}
      catch{if(this.active(epoch))this.halt('已答表单登记清理失败；已停止继续和刷新恢复，请交平台核查。');return false}
      if(!this.active(epoch))return false
    }
    return true
  }
  private async applyResult(epoch:number,result:ResearchRunResult,submitted:AguiInterrupt[]) {
    if(!this.active(epoch) || !this.identity || !this.scope)return
    for(const [id,text] of Object.entries(result.texts)){const existing=this.messages.find(m=>m.id===id && m.role==='assistant');if(existing)existing.text=text;else if(text)this.messages.push({id,role:'assistant',text})}
    if(result.status==='interrupt') {
      const ids=result.interrupts.map(idOf)
      if(!ids.length || ids.some(id=>!id) || new Set(ids).size!==ids.length) throw new Error('中断身份不完整，不能安全继续。')
      for(const item of result.interrupts)normalizeResearchInterrupt(item)
      this.persist({...this.identity,status:'interrupt',pendingIds:ids})
      this.interrupts=result.interrupts;this.status='interrupt';this.notice='等待填写表单；提交会沿用原会话和原运行。'
      try {await this.services.register(this.scope.agentId,this.identity.threadId,result.interrupts,this.identity.runId)}
      catch {if(this.active(epoch))this.error='待答表单登记失败；刷新后可能无法恢复，请先核对服务。'}
      if(!this.active(epoch))return
      await this.cleanupConsumed(epoch,submitted,result.interrupts)
      return
    }
    if(result.status!=='success') {this.persist({...this.identity,status:'uncertain'});this.status='uncertain';this.error=result.message || '运行没有明确成功终态，请核对会话。';return}
    // Delete only confirmed consumed IDs, never the session-wide registry and never a new gate.
    if(!await this.cleanupConsumed(epoch,submitted,[]) || !this.active(epoch) || !this.scope || !this.identity)return
    this.interrupts=[]
    try {
      const state=await this.services.runStatus(this.scope.agentId,this.identity.threadId)
      if(!this.active(epoch) || !this.identity)return
      if(state.running || state.pendingWork){this.persist({...this.identity,status:'running',pendingIds:[]});this.status='working';this.notice='本轮回复已结束，后台仍有工作；请稍后核对会话。';return}
      this.persist({...this.identity,status:'finished',pendingIds:[]});this.status='finished';this.notice='本轮对话已结束；研究成果和阶段确认仍需核对。'
    }catch(e){
      if(!this.active(epoch) || !this.identity)return
      this.persist({...this.identity,status:'uncertain',pendingIds:[]});this.status='uncertain';this.error='本轮回复已结束，但后台状态无法核对，请恢复会话。'+description(e)
    }
  }
  async submit(answers:Record<string,Record<string,unknown>>) {
    if(!this.scope || !this.identity || this.status!=='interrupt' || this.busy || this.stopping)return
    const epoch=this.epoch, scope={...this.scope}, previous=[...this.interrupts]
    const identity:ResearchIdentity={agentId:scope.agentId,projectId:this.identity.projectId,threadId:this.identity.threadId,runId:this.identity.runId}
    let request:AguiRunRequest
    try {request=buildResearchRequest(identity,'',previous,answers)}
    catch(e){this.error=description(e);return}
    const ctl=new AbortController();this.controller=ctl;this.busy=true;this.error='';this.notice='正在核对服务端待答表单。'
    let issued=false
    try {
      const [serverPending,live]=await Promise.all([this.services.pending(scope.agentId,identity.threadId),this.services.live?this.services.live(scope.agentId,identity.threadId):Promise.resolve(null)])
      if(!this.active(epoch))return
      const expected=previous.map(idOf).sort(), actual=serverPending.map(idOf).sort()
      if(expected.length!==actual.length || expected.some((id,i)=>id!==actual[i]) || live!==null && (live.length!==expected.length || [...live].sort().some((id,i)=>id!==expected[i]))) throw Error('服务端待答表单已变化，请恢复会话核对，未提交任何答复。')
      if(serverPending.some(item=>typeof item.metadata?.runId==='string' && item.metadata.runId && item.metadata.runId!==identity.runId)) throw Error('服务端待答表单的运行身份不匹配，未提交。')
      if(!this.identity)throw Error('运行身份已失效。')
      this.persist({...this.identity,status:'submitting',submittedIds:[...new Set([...this.identity.submittedIds,...previous.map(idOf)])]})
      this.status='running';this.notice='正在提交表单并等待服务端回应。';issued=true
      const result=await this.services.run(identity,request,event=>this.onEvent(epoch,identity,event),ctl.signal)
      if(!this.active(epoch))return
      await this.applyResult(epoch,result,previous)
    } catch(e){if(!this.active(epoch))return;if(issued){this.status='uncertain';this.error='提交结果未确认，请先恢复会话核对，不要重复提交。'+description(e);if(this.identity)try{this.persist({...this.identity,status:'uncertain'})}catch{}}else{this.status='interrupt';this.error=description(e)}}
    finally{if(this.active(epoch)){this.busy=false;this.controller=null}}
  }
  async recover() {
    if(!this.scope || !this.identity || !this.identity.runId || this.busy || this.stopping || this.halted)return
    const epoch=this.epoch, scope={...this.scope}, identity={...this.identity};this.busy=true;this.error='';this.notice='正在核对会话、待答表单和运行状态。'
    try {
      const [transcript,pending,status]=await Promise.all([this.services.transcript(scope.agentId,identity.threadId),this.services.pending(scope.agentId,identity.threadId),this.services.runStatus(scope.agentId,identity.threadId)])
      if(!this.active(epoch))return
      const resolved=collectResolvedToolCallIds(transcript.messages as never[])
      // A new background form may lack runId in the registration. Accept only
      // an exact, unambiguous match in this session's recorded terminal events.
      const unknown=pending.filter(item=>!identity.pendingIds.includes(idOf(item)) && !identity.submittedIds.includes(idOf(item)) && !resolved.has(String(item.toolCallId || idOf(item).split(':').slice(1).join(':'))))
      let confirmedIdentity=identity
      if(unknown.length) {
        if(!this.services.events)throw Error('待答表单缺少可核对的运行身份。')
        const events=await this.services.events(identity.threadId)
        if(!this.active(epoch))return
        const matches=new Set<string>()
        for(const record of events){
          const event=record.payload, run=record.runId
          if(!run || event.type!=='RUN_FINISHED' || (event.outcome as {type?:string}|undefined)?.type!=='interrupt')continue
          if(typeof event.threadId==='string' && event.threadId!==identity.threadId || typeof event.runId==='string' && event.runId!==run)continue
          const ids=extractInterrupts(event).map(idOf)
          if(pending.every(item=>ids.includes(idOf(item))))matches.add(run)
        }
        if(matches.size!==1)throw Error('待答表单缺少可核对的运行身份。')
        confirmedIdentity={...identity,runId:[...matches][0]!,pendingIds:pending.map(idOf),status:'interrupt'}
      }
      const recovered=reconcileResearchPending(pending,resolved,confirmedIdentity)
      if(confirmedIdentity!==identity)this.persist(confirmedIdentity)
      this.messages=(transcript.messages || []).filter(m=>m.role==='user'||m.role==='assistant').map(m=>({id:m.id,role:m.role as 'user'|'assistant',text:(m.content || []).filter(b=>b.type==='text').map(b=>b.text||'').join('')})).filter(m=>m.text)
      this.interrupts=recovered
      if(status.running || status.pendingWork){this.status='working';this.notice='服务端仍有工作，等待后再刷新状态。';return}
      if(recovered.length){this.status='interrupt';this.notice='已恢复待答表单，请核对后继续。';return}
      const unresolved=identity.pendingIds.filter(id=>{const toolId=id.split(':').slice(1).join(':');return !toolId || !resolved.has(toolId)})
      if(unresolved.length){this.status='uncertain';this.error='无法核对已记录的待答表单，请勿重复提交。';return}
      this.status='finished';this.notice='会话当前空闲；以真实产物与人工确认判断研究进度。'
    } catch(e){if(!this.active(epoch))return;this.status='uncertain';this.interrupts=[];this.messages=[];this.artifacts=[];this.preview=null;if(description(e).includes('已答中断'))this.halt(description(e));else this.error=description(e)}
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
  try {
    const part=getAccessToken().split('.')[1]
    if(!part)return ''
    const value=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))) as {sub?:unknown}
    return typeof value.sub==='string' && value.sub ? value.sub : ''
  } catch {return ''}
}

const services:ResearchRunServices={
  verify:verifyResearchAgent,
  stop:interruptResearchSession,
  run:streamResearchRun,
  transcript:fetchSessionTranscript,
  pending:listPendingInterrupts,
  async events(threadId){
    const events:Array<{runId?:string;payload:AguiEvent}>=[]
    let cursor=0
    for(let pageNumber=0;pageNumber<10;pageNumber++){
      const page=await fetchAguiEvents(threadId,cursor,500)
      if(page.sessionId!==threadId || !Array.isArray(page.events))throw Error('会话事件记录身份不匹配。')
      events.push(...page.events)
      if(page.events.length<500)return events
      if(!Number.isInteger(page.nextAfterSequence) || page.nextAfterSequence<=cursor)throw Error('会话事件记录不完整。')
      cursor=page.nextAfterSequence
    }
    throw Error('会话事件记录超过核对范围，无法安全恢复。')
  },
  runStatus:fetchSessionRunStatus,
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
  const session=reactive(new ResearchRunSession(storage,markRaw(services),currentResearchOwner)) as ResearchRunSession
  return {session}
})
