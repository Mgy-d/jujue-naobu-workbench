<template>
 <div v-if="forms.length" class="form-invitation">
  <div><strong>有{{forms.length>1?forms.length+'份':''}}内容需要你确认</strong><span>{{titles.join('、')}}</span></div>
  <button type="button" class="form-button primary" @click="open">{{submitting?'查看本次填写':'继续填写'}}</button>
 </div>
 <dialog ref="dialog" class="research-form-dialog" aria-labelledby="research-form-dialog-title" @cancel.prevent="close">
  <header class="form-dialog-head">
   <div><h2 id="research-form-dialog-title">{{currentPresentation?.title||'填写与确认'}}</h2><p v-if="forms.length>1">第 {{page+1}} / {{forms.length}} 份 · 请逐份核对后提交</p></div>
   <button type="button" class="form-close" aria-label="暂时关闭，保留填写内容" @click="close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
  </header>
  <nav v-if="forms.length>1" class="form-dialog-tabs" aria-label="待填表单"><button v-for="(form,index) in forms" :key="form.interruptId" type="button" :aria-current="page===index?'step':undefined" :disabled="busy" @click="go(index)">{{index+1}}<span>{{titles[index]}}</span></button></nav>
  <div ref="body" class="form-dialog-body">
   <p v-if="currentPresentation?.description" class="form-description">{{currentPresentation.description}}</p>
   <div v-if="error||validationError" class="form-dialog-error" role="alert">{{readableResearchText(validationError||error||'')}}</div>
   <ResearchDecisionForm v-for="(form,index) in forms" v-show="page===index" :key="form.interruptId" :form="form" :answers="answers[form.interruptId]" :busy="busy" hide-header @field="(field,event)=>changed(form.interruptId,field,event)" @choice="(field,option)=>chosen(form.interruptId,field,option)" />
  </div>
  <footer class="form-dialog-footer">
   <p role="status" aria-live="polite"><span v-if="submitting" class="form-pulse"/>{{submitting?(responseReceived?'服务端已响应，正在处理…':'正在提交，请勿重复点击…'):error?'本次结果需要核对，填写内容已保留。':'暂时关闭会保留当前填写内容。'}}</p>
   <div class="form-dialog-actions"><button type="button" class="form-button secondary" @click="close">{{submitting?'收起':'稍后填写'}}</button><button v-if="page>0" type="button" class="form-button secondary" :disabled="busy" @click="go(page-1)">上一步</button><button v-if="page<forms.length-1" type="button" class="form-button primary" :disabled="busy" @click="go(page+1)">下一份</button><button v-else type="button" class="form-button primary" :disabled="busy||!canSubmit" :aria-busy="submitting" @click="submit">{{submitting?'正在提交…':forms.length>1?'确认并提交全部':'确认并提交'}}</button></div>
  </footer>
 </dialog>
</template>
<script setup lang="ts">
import {readableResearchText} from '@/utils/researchDisplayText'
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue'
import {validateResearchField,type ResearchForm,type ResearchField} from '@/api/szRun'
import {researchFormPresentation} from '@/utils/researchFormPresentation'
import ResearchDecisionForm from './ResearchDecisionForm.vue'
const props=defineProps<{forms:ResearchForm[];answers:Record<string,Record<string,unknown>>;scopeKey:string;busy:boolean;submitting:boolean;canSubmit:boolean;error:string;responseReceived:boolean;requestIssued:boolean}>()
const emit=defineEmits<{field:[id:string,field:ResearchField,event:Event];choice:[id:string,field:ResearchField,option:string];submit:[]}>()
const dialog=ref<HTMLDialogElement>(),body=ref<HTMLElement>(),page=ref(0),validationError=ref('')
const titles=computed(()=>props.forms.map(form=>researchFormPresentation(form).title))
const currentPresentation=computed(()=>props.forms[page.value]?researchFormPresentation(props.forms[page.value]!):null)
let observedScope='',seen=new Set<string>(),generation=0
async function open(){const ticket=generation;await nextTick();if(ticket!==generation||!props.forms.length||!dialog.value?.isConnected)return;if(!dialog.value.open)dialog.value.showModal()}
function close(){dialog.value?.close()}
function changed(id:string,field:ResearchField,event:Event){validationError.value='';emit('field',id,field,event)}
function chosen(id:string,field:ResearchField,option:string){validationError.value='';emit('choice',id,field,option)}
async function validate(index:number){
 const form=props.forms[index];if(!form)return false
 for(const field of form.fields){try{validateResearchField(field,props.answers[form.interruptId]?.[field.key])}catch{
  page.value=index;validationError.value='请检查“'+researchFormPresentation(form).label(field)+'”的填写内容。';await nextTick()
  const section=body.value?.querySelectorAll('.decision-form')[index]
  const target=Array.from(section?.querySelectorAll<HTMLElement>('[data-field-key]')||[]).find(node=>node.dataset.fieldKey===field.key)
  target?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target?.querySelector<HTMLElement>('input,textarea,select')?.focus({preventScroll:true});return false
 }}return true
}
async function go(index:number){if(props.busy)return;const ticket=generation;if(index>page.value&&!await validate(page.value))return;if(ticket!==generation||props.busy)return;page.value=index;validationError.value='';await nextTick();body.value?.scrollTo({top:0})}
async function submit(){if(props.busy||!props.canSubmit)return;const ticket=generation;for(let i=0;i<props.forms.length;i++){if(!await validate(i)||ticket!==generation)return}if(ticket!==generation||props.busy||!props.canSubmit)return;emit('submit')}
// Collapse only once the real request is issued, never on a click or validation failure.
watch(()=>props.requestIssued,(issued,previous)=>{if(issued && !previous && props.submitting)close()})
watch(()=>[props.scopeKey,props.forms.map(form=>form.interruptId).join('|')] as const,async()=>{
 generation++;if(observedScope!==props.scopeKey){close();seen=new Set();observedScope=props.scopeKey;page.value=0;validationError.value=''}
 if(!props.forms.length){close();validationError.value='';page.value=0;return}
 page.value=Math.min(page.value,props.forms.length-1)
 const fresh=props.forms.findIndex(form=>!seen.has(form.interruptId));props.forms.forEach(form=>seen.add(form.interruptId))
 if(fresh>=0){page.value=fresh;validationError.value='';await open()}
},{immediate:true})
onBeforeUnmount(()=>{generation++;close()})
</script>
<style scoped>
.form-invitation{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:20px 0;padding:18px 20px;border:1px solid #a2c6bd;border-radius:12px;background:#fff;color:#183f3b}.form-invitation strong{display:block;font-size:16px;font-weight:700}.form-invitation span{display:block;margin-top:5px;font-size:14px;line-height:1.6;color:#486460}.form-invitation>div{min-width:0}.form-invitation .form-button{flex-shrink:0}
.research-form-dialog{box-sizing:border-box;width:min(680px,calc(100vw - 32px));max-height:calc(100dvh - 48px);padding:0;border:0;border-radius:16px;color:#243b3a;background:#fff;box-shadow:0 24px 80px #112f3933;font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;overflow:hidden}.research-form-dialog[open]{display:flex;flex-direction:column;animation:form-arrive .22s ease-out}.research-form-dialog::backdrop{background:rgb(13 39 43 / .46)}
.form-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:26px 28px 22px;border-bottom:1px solid #dce9e5;background:#f7fbf9}.form-dialog-head h2{margin:0;font-size:21px;line-height:1.5;font-weight:700;letter-spacing:.01em;color:#123e37}.form-dialog-head p{margin:8px 0 0;font-size:13px;color:#526f69}.form-close{display:grid;place-items:center;flex-shrink:0;width:34px;height:34px;padding:0;border:1px solid #c9dcd6;border-radius:9px;background:#fff;color:#355a54;cursor:pointer;transition:background .16s,color .16s}.form-close:hover{background:#e3f1eb;color:#064c41}
.form-dialog-tabs{display:flex;gap:8px;padding:14px 28px;border-bottom:1px solid #e2ece8;overflow-x:auto;flex-shrink:0}.form-dialog-tabs button{display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid #d3e3dd;border-radius:8px;background:#fff;color:#43635c;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}.form-dialog-tabs span{max-width:150px;overflow:hidden;text-overflow:ellipsis}.form-dialog-tabs [aria-current=step]{color:#006f60;background:#e8f5ef;border-color:#4d9c8d;font-weight:700}
.form-dialog-body{padding:22px 28px;overflow-y:auto;overscroll-behavior:contain;min-height:0;scrollbar-gutter:stable}.form-description{margin:0 0 20px;line-height:1.8;font-size:14px;color:#405c57}.form-dialog-error{margin-bottom:16px;padding:12px 14px;border:1px solid #e2b58d;border-radius:8px;background:#fff7ed;color:#8b4219;font-size:14px;line-height:1.7}.form-dialog-body :deep(.decision-form){margin:0}.form-dialog-body :deep(.decision-field:first-of-type){margin-top:0}.form-dialog-body :deep(.decision-field>label){font-size:15px;color:#203f39;font-weight:700}.form-dialog-body :deep(.decision-option){transition:background .18s,border-color .18s,transform .15s}.form-dialog-body :deep(.decision-option:active:not(.disabled)){transform:scale(.995)}.form-dialog-body :deep(.decision-option.selected){background:#edf7f2;border-color:#138873;box-shadow:inset 0 0 0 1px #138873}.form-dialog-body :deep(.decision-option b){font-size:15px;color:#25423c}.form-dialog-body :deep(.decision-field textarea),.form-dialog-body :deep(.decision-field>input){color:#253e37;font-size:15px}
.form-dialog-footer{flex-shrink:0;padding:16px 28px 22px;border-top:1px solid #dce9e5;background:#fff}.form-dialog-footer p{display:flex;align-items:center;gap:8px;margin:0 0 13px;font-size:13px;line-height:1.6;color:#506961}.form-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px}.form-button{position:relative;min-height:42px;padding:10px 19px;border:1px solid transparent;border-radius:9px;font:inherit;font-size:14px;font-weight:650;line-height:1.5;cursor:pointer;transition:background .18s,border-color .18s,transform .14s,box-shadow .18s}.form-button.primary{background:#087b6b;color:#fff;box-shadow:inset 0 1px 0 #ffffff24,0 2px 3px #07594c18}.form-button.primary:hover:not(:disabled){background:#065e50;box-shadow:inset 0 1px 0 #ffffff30,0 3px 6px #07594c20;transform:translateY(-1px)}.form-button.secondary{background:#fff;border-color:#b9d1c8;color:#36594e}.form-button.secondary:hover:not(:disabled){background:#f0f7f3;border-color:#80af9e}.form-button:active:not(:disabled){transform:translateY(1px);box-shadow:inset 0 2px 3px #12342b18}.form-button:focus-visible,.form-close:focus-visible,.form-dialog-tabs button:focus-visible{outline:2px solid #158b76;outline-offset:3px}.form-button:disabled,.form-dialog-tabs button:disabled{cursor:default;opacity:.55}.form-pulse{width:12px;height:12px;box-sizing:border-box;border:2px solid #bbdad0;border-top-color:#087b6b;border-radius:50%;animation:form-spin .8s linear infinite}
@keyframes form-arrive{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes form-spin{to{transform:rotate(360deg)}}@media(max-width:600px){.research-form-dialog{width:calc(100vw - 20px);max-height:calc(100dvh - 24px)}.form-dialog-head{padding:20px}.form-dialog-head h2{font-size:19px}.form-dialog-body{padding:20px}.form-dialog-tabs{padding:12px 20px}.form-dialog-footer{padding:14px 20px 18px}.form-dialog-actions{flex-wrap:wrap}.form-invitation{padding:15px;gap:12px}.form-invitation span{font-size:13px}.form-invitation .form-button{padding:9px 12px}}@media(prefers-reduced-motion:reduce){.research-form-dialog[open],.form-pulse{animation:none}.form-button,.form-close,.form-dialog-body :deep(.decision-option){transition:none;scroll-behavior:auto}}
</style>
