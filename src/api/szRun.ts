import { extractInterrupts, parseAguiStream, runAgui, runEventError, userMessage } from '@/api/agui'
import { gateFromInterrupts } from '@/utils/analysis/gate'
import type { AguiEvent, AguiInterrupt, AguiResumeItem, AguiRunRequest } from '@/types/agui'

export interface ResearchIdentity { agentId: string; projectId: string; threadId: string; runId: string }
export type ResearchRunStatus = 'running' | 'success' | 'interrupt' | 'error' | 'uncertain'
export interface ResearchField {
  key: string; label: string; kind: string; options: string[]; required: boolean
  placeholder: string; pageTitle: string; initialValue?: unknown
  min?: number; max?: number; step?: number; minLength?: number; maxLength?: number; pattern?: string
}
export interface ResearchForm { interruptId: string; toolName: string; title: string; message: string; fields: ResearchField[] }
const allowedKinds = ['text', 'textarea', 'number', 'select', 'radio-group', 'checkbox-group', 'other-text']
const allowedItemKeys = ['key', 'label', 'kind', 'options', 'min', 'max', 'minLength', 'maxLength', 'pattern', 'placeholder', 'required', 'step', 'initialValue']
const interruptId = (item: AguiInterrupt) => String(item.id || item.interruptId || '').trim()
function object(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') { try { return object(JSON.parse(value)) } catch { return null } }
  return null
}
function number(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined }

/** Fail closed if an unfamiliar field would otherwise be dropped or changed. */
export function normalizeResearchInterrupt(interrupt: AguiInterrupt): ResearchForm {
  const id = interruptId(interrupt)
  const toolName = String(interrupt.metadata?.toolName || '')
  if (!id || !['ui_form_advanced', 'ui_gate'].includes(toolName)) throw new Error('中断身份或表单类型不支持，不能安全提交。')
  const input = object(interrupt.metadata?.toolInput ?? interrupt.metadata?.toolContent) || {}
  const existing = gateFromInterrupts([interrupt])
  if (!existing) throw new Error('表单字段不完整，不能安全提交。')
  let fields: ResearchField[] = []
  if (Array.isArray(input.pages)) {
    for (const rawPage of input.pages) {
      const page = object(rawPage)
      if (!page || !Array.isArray(page.items)) throw new Error('表单分页结构不支持，不能安全提交。')
      for (const rawItem of page.items) {
        const item = object(rawItem)
        if (!item || Object.keys(item).some(k => !allowedItemKeys.includes(k))) throw new Error('表单包含不支持的字段配置，不能安全提交。')
        const key = typeof item.key === 'string' ? item.key.trim() : ''
        const kind = typeof item.kind === 'string' ? item.kind : ''
        if (!key || !allowedKinds.includes(kind)) throw new Error('表单包含不支持的控件或缺少字段标识。')
        if (fields.some(field => field.key === key)) throw new Error('表单存在重复字段，不能安全提交。')
        if (item.options !== undefined && (!Array.isArray(item.options) || !item.options.every(v => typeof v === 'string'))) throw new Error('表单选项结构不支持。')
        const options = Array.isArray(item.options) ? item.options as string[] : []
        if (['select', 'radio-group', 'checkbox-group'].includes(kind) && !options.length) throw new Error('表单选择项为空，不能安全提交。')
        if (item.pattern !== undefined) { if (typeof item.pattern !== 'string') throw new Error('表单校验规则不支持。'); try { new RegExp(item.pattern) } catch { throw new Error('表单校验规则无效。') } }
        fields.push({key,kind,label:typeof item.label === 'string' && item.label ? item.label : key,options,required:item.required === true,
          placeholder:typeof item.placeholder === 'string' ? item.placeholder : '',pageTitle:typeof page.title === 'string' ? page.title : '',initialValue:item.initialValue,
          min:number(item.min),max:number(item.max),step:number(item.step),minLength:number(item.minLength),maxLength:number(item.maxLength),pattern:typeof item.pattern === 'string' ? item.pattern : undefined})
      }
    }
  } else if (toolName === 'ui_gate') {
    fields = existing.fields.map(field => ({...field, pageTitle: ''}))
  }
  if (!fields.length) throw new Error('表单没有可验证的字段，不能安全提交。')
  if (toolName === 'ui_gate' && !fields.some(field => field.key === 'decision')) throw new Error('审批表单缺少审核结论。')
  return { interruptId:id, toolName, title:existing.title, message:existing.message, fields }
}

function validateField(field: ResearchField, value: unknown): void {
  const empty = value === null || value === undefined || typeof value === 'string' && !value.trim() || Array.isArray(value) && value.length === 0
  if (empty) { if (field.required) throw new Error('请填写：' + field.label); return }
  if (field.kind === 'checkbox-group') {
    if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !field.options.includes(v)) || new Set(value).size !== value.length) throw new Error(field.label + '的选项无效。')
    if (field.min !== undefined && value.length < field.min || field.max !== undefined && value.length > field.max) throw new Error(field.label + '的选择数量不符合要求。')
  } else if (field.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || field.min !== undefined && value < field.min || field.max !== undefined && value > field.max) throw new Error(field.label + '的数值不符合要求。')
    if (field.step !== undefined && field.step > 0) { const steps = (value - (field.min ?? 0)) / field.step; if (Math.abs(steps - Math.round(steps)) > 1e-8) throw new Error(field.label + '的数值间隔不符合要求。') }
  } else {
    if (typeof value !== 'string') throw new Error(field.label + '的内容类型无效。')
    if (['select', 'radio-group'].includes(field.kind) && !field.options.includes(value)) throw new Error(field.label + '的选项无效。')
    if (field.minLength !== undefined && value.length < field.minLength || field.maxLength !== undefined && value.length > field.maxLength) throw new Error(field.label + '的文字长度不符合要求。')
    if (field.pattern && !new RegExp(field.pattern).test(value)) throw new Error(field.label + '的格式不符合要求。')
  }
}

/** Never cancel a sibling form on the user's behalf. */
export function makeResearchResume(interrupts: AguiInterrupt[], answers: Record<string, Record<string, unknown>>): AguiResumeItem[] {
  if (!interrupts.length || new Set(interrupts.map(interruptId)).size !== interrupts.length) throw new Error('未决中断不完整或重复。')
  return interrupts.map(item => {
    const form = normalizeResearchInterrupt(item), values = answers[form.interruptId]
    if (!values || typeof values !== 'object') throw new Error('请先回答全部待确认表单。')
    if(Object.keys(values).some(key=>!form.fields.some(field=>field.key===key)))throw new Error('答复包含无法识别的字段，未提交。')
    const clean: Record<string, unknown> = {}
    for (const field of form.fields) { const value = values[field.key]; validateField(field, value); if (value !== undefined) clean[field.key] = value }
    if (form.toolName === 'ui_gate' && !['通过', '不通过'].includes(String(clean.decision))) throw new Error('审核结论只能选择通过或不通过。')
    const payload: Record<string, unknown> = { output: JSON.stringify(clean) }
    if (form.toolName === 'ui_gate') { payload.decision = clean.decision; payload.feedback = clean.feedback ?? '' }
    return { interruptId:form.interruptId, status:'resolved', payload }
  })
}

export function buildResearchRequest(identity: ResearchIdentity, text: string, interrupts: AguiInterrupt[] = [], answers: Record<string, Record<string, unknown>> = {}): AguiRunRequest & {forwardedProps:{web_search:'off'}} {
  if (!identity.agentId || !identity.projectId || !identity.threadId || !identity.runId) throw new Error('缺少原始运行身份，无法安全发送或续跑。')
  if (interrupts.length) return {threadId:identity.threadId,runId:identity.runId,messages:[],resume:makeResearchResume(interrupts,answers),forwardedProps:{web_search:'off'}}
  if (!text.trim()) throw new Error('请输入研究问题。')
  return {threadId:identity.threadId,runId:identity.runId,messages:[userMessage('u-' + crypto.randomUUID(),text)],forwardedProps:{web_search:'off'}}
}

export class ResearchRunTracker {
  status: ResearchRunStatus = 'running'; message = ''; texts: Record<string,string> = {}; interrupts: AguiInterrupt[] = []
  constructor(readonly threadId: string, readonly runId: string) {}
  accept(event: AguiEvent): void {
    if (this.status !== 'running') return
    if (typeof event.threadId === 'string' && event.threadId !== this.threadId || typeof event.runId === 'string' && event.runId !== this.runId) { this.status='error';this.message='事件的会话或运行身份不匹配。';return }
    const error = runEventError(event)
    if (error) { this.status='error';this.message=error;return }
    if (event.type === 'TEXT_MESSAGE_CONTENT' && typeof event.delta === 'string') { const id = typeof event.messageId === 'string' ? event.messageId : 'assistant';this.texts[id]=(this.texts[id] || '')+event.delta }
    if (event.type !== 'RUN_FINISHED') return
    const outcome = object(event.outcome), kind = outcome?.type
    if (kind === 'interrupt') { this.interrupts=extractInterrupts(event);this.status=this.interrupts.length?'interrupt':'uncertain';if (!this.interrupts.length)this.message='服务提示需要确认，但未返回完整中断身份。' }
    else if (kind === 'success') this.status='success'
    else { this.status='uncertain';this.message='结束事件没有明确成功状态，请核对会话。' }
  }
  finish(){ if(this.status==='running'){this.status='uncertain';this.message='连接结束但没有收到运行终态，请核对会话。'} return {status:this.status,message:this.message,texts:this.texts,interrupts:this.interrupts} }
}

export async function streamResearchRun(identity: ResearchIdentity, request: AguiRunRequest, onEvent: (event: AguiEvent) => void, signal?: AbortSignal) {
  const tracker=new ResearchRunTracker(identity.threadId, identity.runId)
  const response=await runAgui(identity.agentId,request,signal)
  await parseAguiStream(response,event=>{const before=tracker.status;tracker.accept(event);if(before==='running' && tracker.status!=='error')onEvent(event)},signal)
  return tracker.finish()
}

/** A locally saved pending ID or explicit server run ID must prove ownership. */
export function reconcileResearchPending(items: AguiInterrupt[], resolved: Set<string>, identity: {runId:string;pendingIds:string[];submittedIds:string[]}): AguiInterrupt[] {
  if (!identity.runId) throw new Error('缺少原始运行编号，无法安全恢复。')
  const result: AguiInterrupt[] = []
  for (const item of items) {
    const id=interruptId(item), toolId=String(item.toolCallId || id.split(':').slice(1).join(':'))
    if (!id || !toolId) throw new Error('中断身份不完整，无法安全恢复。')
    if (identity.submittedIds.includes(id)) throw new Error('已答中断重新出现，请停止重试并联系平台核查。')
    if (resolved.has(toolId)) continue
    const remoteRun=item.metadata?.runId
    if (typeof remoteRun === 'string' && remoteRun && remoteRun !== identity.runId) throw new Error('待答表单的运行身份不匹配。')
    if (!identity.pendingIds.includes(id) && remoteRun !== identity.runId) throw new Error('待答表单缺少可核对的运行身份。')
    normalizeResearchInterrupt(item)
    result.push(item)
  }
  return result
}
