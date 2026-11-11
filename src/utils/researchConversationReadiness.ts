type IdentityHistory={pendingIds:string[];submittedIds:string[]}
const record=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
/**
 * Called only after a fresh same-session COMPLETED or explicit expired-review closure, idle parent/background and
 * empty current form registries. Permission for an ordinary message, never for
 * resume/approval. Incomplete historical tool traces do not prove a current lock.
 */
export function canMessageCompletedResearch(messages:unknown[],identity:IdentityHistory):boolean{
 const toolId=(id:string)=>id.split(':').slice(1).join(':')
 const known=new Set([...identity.pendingIds,...identity.submittedIds].map(toolId)),submitted=new Set(identity.submittedIds.map(toolId))
 if([...known].some(id=>!id))return false
 const results=new Map<string,Record<string,unknown>[]>()
 for(const raw of messages){
  const message=record(raw);if(!message||!Array.isArray(message.content))continue
  for(const value of message.content){
   const block=record(value)
   if(block?.type==='tool_result'&&typeof block.id==='string'&&known.has(block.id))results.set(block.id,[...(results.get(block.id)??[]),block])
  }
 }
 for(const id of known){
  const matches=results.get(id)??[]
  // Keep contradictions for the tracked audit unresolved. Never replay them.
  if(matches.length>1)return false
  if(submitted.has(id)&&matches.some(result=>JSON.stringify(result.output??'').includes('[HITL_TIMEOUT]')))return false
 }
 return true
}
