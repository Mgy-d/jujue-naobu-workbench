/** Presentation only: emphasize an ordinary continuation, never a gate/approval decision. */
export function conversationActionItems(labels:string[]) {
  const primary=labels.find(label=>label==='继续下一步' || label==='进入下一步')
  return labels.map(label=>({label,primary:label===primary})).sort((a,b)=>Number(b.primary)-Number(a.primary))
}

/** Track mounted message identities; loading history and streaming updates are not new arrivals. */
export function createConversationArrivalTracker() {
  let activeScope:string|null=null
  const seen=new Set<string>()
  return {
    observe(scope:string,ids:string[],allowNew:boolean):string[] {
      if(scope!==activeScope){activeScope=scope;seen.clear();ids.forEach(id=>seen.add(id));return []}
      const fresh=ids.filter(id=>!seen.has(id))
      ids.forEach(id=>seen.add(id))
      return allowNew?[...new Set(fresh)]:[]
    },
  }
}


/** Runtime state controls the heading. A model-written completed ledger cannot certify completion. */
export function conversationReceiptState(input:{status:string;busy?:boolean;error?:string;halted?:boolean;timedOut?:boolean;hasForms?:boolean;responseTimedOut?:boolean}) {
  if(input.responseTimedOut)return {title:'本次处理超时，结果待核对',tone:'attention',canCompose:false}
  if(input.error || input.halted || input.timedOut || input.status==='uncertain')return {title:'需要核对会话状态',tone:'attention',canCompose:false}
  if(input.busy || ['running','checking','submitting'].includes(input.status))return {title:input.status==='checking'?'正在核对会话':'正在处理本次请求',tone:'active',canCompose:false}
  if(input.hasForms || input.status==='interrupt')return {title:'等待你填写或确认',tone:'waiting',canCompose:false}
  if(input.status==='working')return {title:'后台进度待核对',tone:'active',canCompose:false}
  if(input.status==='awaiting')return {title:'等待你补充或确认',tone:'waiting',canCompose:true}
  if(input.status==='finished')return {title:'本轮回复已结束',tone:'idle',canCompose:true}
  return {title:'当前会话',tone:'waiting',canCompose:input.status==='idle'}
}
/** G4 is the last phase; an idle final phase offers concrete controls rather than generic advancement. */
export function hideGenericResearchContinuation(status:string,phase:string):boolean {
  return phase==='G4' && (status==='finished'||status==='awaiting')
}


/** Waiting for a user or showing a failure must not occupy a large process panel. */
export function showActiveResearchReceipt(state:{busy:boolean;status:string}){
 return state.busy||['checking','working','running'].includes(state.status)
}
