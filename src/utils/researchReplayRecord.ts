import {researchFormPresentation} from './researchFormPresentation'
import {gateFromInterrupts} from './analysis/gate'
import {normalizeResearchInterrupt,validateResearchField,type ResearchForm} from '@/api/szRun'
import type {ArchiveFileRef} from './researchArchiveCompletion'
import {readResearchProgress} from './researchProgress'
export interface ReplayMessage {id:string;role:'user'|'assistant';text:string;remoteId?:string;at?:number}
export interface ReplayForm {id:string;form:ResearchForm;answers:Record<string,unknown>;afterMessageId:string;answerMessageId?:string;phase:string;submitted:boolean}
export interface ReplayFile {path:string;name:string;phase:string;content?:string;ref?:ArchiveFileRef}
export interface ResearchReplayRecord {version:2;id:string;ownerId:string;taskId:string;agentId:string;threadId:string;projectId?:string;title:string;savedAt:string;messages:ReplayMessage[];forms:ReplayForm[];files:ReplayFile[];gaps:string[]}
export type ReplayStep={id:string;phase:string;message?:ReplayMessage;form?:ReplayForm}
export function replayJournalKey(owner:string,agent:string,task:string,thread:string){return 'shidiaoyanzhen.replay-forms.v1:'+JSON.stringify([owner,agent,task,thread])}
export function mergeReplayMessages(...sets:ReplayMessage[][]):ReplayMessage[]{
 const out:ReplayMessage[]=[],ids=new Map<string,number>()
 for(const set of sets)for(const message of set){
  if(!message||!message.id||!['user','assistant'].includes(message.role)||typeof message.text!=='string'||!message.text.trim())continue
  const index=ids.get(message.id)??(message.remoteId?ids.get(message.remoteId):undefined)
  if(index!==undefined){const prior=out[index]!;out[index]={...prior,...message,id:prior.id,remoteId:message.remoteId||(message.id!==prior.id?message.id:prior.remoteId)};ids.set(message.id,index);continue}
  ids.set(message.id,out.length);if(message.remoteId)ids.set(message.remoteId,out.length);out.push({...message})
 }
 return out
}
export function replaySteps(record:ResearchReplayRecord):ReplayStep[]{
 const steps:ReplayStep[]=[],used=new Set<string>(),aliases=new Set(record.messages.flatMap(m=>[m.id,...(m.remoteId?[m.remoteId]:[])]));let phase=''
 const matches=(message:ReplayMessage,id:string)=>message.id===id||message.remoteId===id
 const add=(form:ReplayForm)=>{
  if(used.has(form.id))return;used.add(form.id);phase=form.phase||phase;steps.push({id:'form:'+form.id,phase,form})
  if(form.submitted&&!aliases.has(form.answerMessageId||'')&&Object.keys(form.answers).length){
   const view=researchFormPresentation(form.form),fields=form.form.fields.flatMap(field=>{const value=form.answers[field.key];if(value===undefined||value===null||value==='')return [];const values=Array.isArray(value)?value:[value];return [view.label(field)+'：'+values.map(value=>view.option(field,String(value)).title).join('、')]})
   if(fields.length)steps.push({id:'historical-answer:'+form.id,phase,message:{id:'historical-answer:'+form.id,role:'user',text:[view.title,...fields].join('\n')}})
  }
 }
 record.forms.filter(f=>!f.afterMessageId&&!aliases.has(f.answerMessageId||'')).forEach(add)
 for(const message of record.messages){
  record.forms.filter(f=>!!f.answerMessageId&&matches(message,f.answerMessageId)).forEach(add)
  const ledger=readResearchProgress(message.text);if(ledger)phase=ledger.phase
  steps.push({id:'message:'+message.id,phase,message})
  record.forms.filter(f=>matches(message,f.afterMessageId)&&!aliases.has(f.answerMessageId||'')).forEach(add)
 }
 record.forms.filter(f=>!used.has(f.id)).forEach(add)
 return steps
}
export function mergeReplayForms(...sets:ReplayForm[][]):ReplayForm[]{
 const forms=new Map<string,ReplayForm>()
 for(const set of sets)for(const form of set){const prior=forms.get(form.id);forms.set(form.id,prior?.submitted&&!form.submitted?prior:form)}
 return [...forms.values()]
}
export function replayQuestionnaireIdentity(record:ResearchReplayRecord,file:ReplayFile|null):{projectId:string;error:string}{
 if(!file)return {projectId:'',error:'未选择问卷。'}
 const pathProject=/(?:^|[/\\])artifacts[/\\](sz-[^/\\]+)(?:[/\\]|$)/.exec(file.path)?.[1]||''
 if(record.projectId&&pathProject&&record.projectId!==pathProject)return {projectId:'',error:'保存记录与问卷文件的研究归属不一致，请核对原研究后重新保存。'}
 const projectId=record.projectId||pathProject
 return {projectId,error:projectId?'':'旧记录未保存可核对的问卷归属，请在原研究中重新保存演示记录。'}
}
export interface ReplayRound {id:string;phase:string;messages?:ReplayMessage[];form?:ReplayForm}
/** Replay advances by user interaction, form or explicit phase change, not transcript fragments. */
export function replayRounds(record:ResearchReplayRecord,visible:(message:ReplayMessage)=>boolean=message=>!!message.text.trim()):ReplayRound[]{
 const rounds:ReplayRound[]=[];let current:ReplayRound|undefined
 const flush=()=>{if(current?.messages?.length)rounds.push(current);current=undefined}
 for(const step of replaySteps(record)){
  if(step.form){flush();rounds.push({id:step.id,phase:step.phase,form:step.form});continue}
  const message=step.message
  if(!message)continue
  if(!visible(message)){if(current&&!current.phase&&step.phase)current.phase=step.phase;continue}
  if(current&&(message.role==='user'||!!current.phase&&!!step.phase&&current.phase!==step.phase))flush()
  if(!current)current={id:'round:'+message.id,phase:step.phase,messages:[]}
  if(step.phase)current.phase=step.phase
  current.messages!.push(message)
 }
 flush();return rounds
}
export function replayFilePhase(path:string){
 if(/(?:报告|答辩|交付|图表|PPT)/i.test(path))return 'G4'
 if(/(?:数据|统计|质检|清洗|分析结果)/.test(path))return 'G3'
 if(/(?:问卷|预测试|题项)/.test(path))return 'G2'
 if(/(?:研究简报|研究问题|调查方案)/.test(path))return 'G1'
 return ''
}
export function validateReplayRecord(record:ResearchReplayRecord,owner:string,task:string){
 if(record?.version!==2||record.ownerId!==owner||record.taskId!==task||!record.id||!record.threadId||!Array.isArray(record.messages)||!Array.isArray(record.forms)||!Array.isArray(record.files)||!Array.isArray(record.gaps))throw Error('演示记录不属于当前账号或任务，未打开。')
 if(record.messages.some(m=>!m||typeof m.id!=='string'||typeof m.text!=='string'||!['user','assistant'].includes(m.role))||record.forms.some(f=>!f||!f.id||!f.form||!Array.isArray(f.form.fields)||!f.answers||typeof f.answers!=='object')||record.files.some(f=>!f||typeof f.path!=='string'||typeof f.name!=='string'))throw Error('演示记录内容不完整，未打开。')
 return record
}

/** Recover only original form schemas; missing historical answers are never guessed. */
export function recoverReplayFormHistory(messages:{id:string;role?:string;content:unknown[]}[]):{forms:ReplayForm[];gaps:string[]}{
 const forms:ReplayForm[]=[],gaps:string[]=[];let lastTextId='',phase=''
 const results=new Map<string,{state?:string;output?:unknown}[]>();for(const message of messages)for(const raw of message.content||[]){const block=raw as {type:string;id?:string;state?:string;output?:unknown};if(block.type==='tool_result'&&block.id)results.set(block.id,[...(results.get(block.id)||[]),block])}
 for(const message of messages){
  for(const raw of message.content||[]){
   const block=raw as {type:string;id?:string;name?:string;input?:unknown}
   if(block.type==='text'&&(!message.role||['user','assistant'].includes(message.role))){lastTextId=message.id;const ledger=readResearchProgress(String((raw as {text?:string}).text||''));if(ledger)phase=ledger.phase}
   if(block.type!=='tool_call'||!block.id||!['ui_gate','ui_form','ui_form_advanced','plan_exit'].includes(block.name||''))continue
   if(typeof block.input!=='string'&&(!block.input||typeof block.input!=='object'||Array.isArray(block.input))){gaps.push('一份历史表单缺少原始字段，未能还原。');continue}
   try{
    const interrupt={id:message.id+':'+block.id,toolCallId:block.id,metadata:{toolName:block.name,toolInput:block.input as string|Record<string,unknown>}}
    let form:ResearchForm
    if(block.name==='ui_form'){
     const original=typeof block.input==='string'?JSON.parse(block.input):block.input as Record<string,unknown>,schema=(original.schema||original.inputSchema) as {properties?:Record<string,{type?:string}>}|undefined
     const existing=gateFromInterrupts([interrupt])
     if(!existing||!schema?.properties||existing.fields.length!==Object.keys(schema.properties).length||Object.values(schema.properties).some(field=>!['string','number','integer','boolean','array'].includes(field.type||'')))throw Error('旧式表单包含无法展示的字段。')
     form={interruptId:existing.interruptId,toolName:'ui_form',title:existing.title,message:existing.message,fields:existing.fields.map(field=>({...field,pageTitle:''}))}
    }else form=normalizeResearchInterrupt(interrupt)
    if(!forms.some(f=>f.id===form.interruptId)){
     let answers:Record<string,unknown>={},submitted=false
     const matches=results.get(block.id)||[]
     if(matches.length===1&&matches[0]?.state==='success')try{
      const output=matches[0].output
      let value=typeof output==='string'?JSON.parse(output):output
      if(value&&typeof value==='object'&&typeof value.output==='string')value=JSON.parse(value.output)
      if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length&&Object.keys(value).every(key=>form.fields.some(f=>f.key===key))){for(const field of form.fields)validateResearchField(field,value[field.key]);answers=value;submitted=true}
     }catch{ /* A timeout, partial result or unrecognized payload is not a historical answer. */ }
     forms.push({id:form.interruptId,form,answers,afterMessageId:lastTextId,phase:/\bG[1-4]\b/.exec(form.title)?.[0]||phase,submitted})
    }
   }catch{let title='历史表单';try{const input=typeof block.input==='string'?JSON.parse(block.input):block.input;if(input&&typeof (input as {title?:unknown}).title==='string')title=(input as {title:string}).title}catch{};gaps.push(title+'：原字段格式暂不支持还原，未伪造填写过程。')}
  }
 }
 return {forms,gaps}
}

export function recoverReplayForms(messages:{id:string;role?:string;content:unknown[]}[]):ReplayForm[]{return recoverReplayFormHistory(messages).forms}
