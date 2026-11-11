<template>
<div class="record-workspace">
 <section class="record-chat" aria-label="研究过程演示">
  <div ref="stream" class="record-stream">
   <div class="record-intro"><span>记录演示</span><label>保存版本 <select :value="record.id" @change="emit('version',($event.target as HTMLSelectElement).value)"><option v-for="version in versions" :key="version.id" :value="version.id">{{new Date(version.savedAt).toLocaleString('zh-CN')}}</option></select></label><button type="button" @click="emit('exit')">退出演示</button></div>
   <details v-if="record.gaps.length" class="record-gaps"><summary>有 {{record.gaps.length}} 项历史内容未完整保存</summary><ul><li v-for="(gap,index) in record.gaps" :key="index">{{readableResearchText(gap)}}</li></ul></details>
   <template v-for="step in visibleSteps" :key="step.id">
    <div v-if="step.role" class="record-message" :class="step.role" :data-round="step.roundId"><span v-if="step.role==='assistant'" class="author">市调助手</span><div class="message-body" v-html="step.html"></div></div>
    <div v-else-if="step.form" class="saved-form"><strong>{{researchFormPresentation(step.form.form).title}}</strong><p>{{step.form.submitted?'已保存当时填写的内容':'此表单未保存完整的提交答案'}}</p><button type="button" @click="showForm(step.form)">查看当时表单</button></div>
   </template>
   <p v-if="cursor===steps.length" class="record-end">演示到此结束。{{record.gaps.length?'部分历史内容存在缺口，可查看上方说明。':''}}</p>
  </div>
  <footer class="record-controls"><div><button type="button" @click="restart">从头演示</button><button type="button" :disabled="cursor<=1" @click="move(-1)">上一步</button><button type="button" :disabled="!steps.length" @click="togglePlay">{{playing?'暂停':'播放'}}</button><button type="button" :disabled="cursor>=steps.length" class="primary" @click="move(1)">下一步</button><span>{{cursor}} / {{steps.length}} 步</span></div><label>跳到 <select :value="currentPhase" @change="jump(($event.target as HTMLSelectElement).value)"><option value="">研究准备</option><option v-for="phase in phases" :key="phase" :value="phase">{{readableResearchText(phase)}}</option></select></label></footer>
 </section>
 <aside v-if="drawerOpen" class="record-results" aria-label="演示成果预览"><header><strong>{{readableResearchText(currentPhase)||'研究准备'}} · 成果预览</strong></header><p class="record-file-note">展示本次保存版本的相关成果。</p><div class="record-file-grid"><article v-for="file in displayFiles" :key="file.cardKey"><strong>{{file.name}}</strong><small v-if="artifactSourceLabel(file,displayFiles)">{{artifactSourceLabel(file,displayFiles)}}</small><label v-if="file.formats.length>1">格式 <select :value="file.path" @change="formatSelections[file.cardKey]=($event.target as HTMLSelectElement).value"><option v-for="variant in file.formats" :key="variant.path" :value="variant.path">{{variant.name.split('.').at(-1)?.toUpperCase()}}</option></select></label><button type="button" @click="previewFile(file)">预览</button><button type="button" @click="download(file)">下载</button></article></div><p v-if="!visibleFiles.length">本环节尚未保存可展示成果。</p><button v-if="record.files.length" type="button" @click="allFiles=!allFiles">{{allFiles?'仅看当前环节':'查看全部已存成果'}}</button><p v-if="fileError" role="alert">{{fileError}}</p></aside>
 <dialog ref="formDialog" class="record-form-dialog" @cancel="playing=false"><header><h3>{{selectedForm?researchFormPresentation(selectedForm.form).title:'当时填写的内容'}}</h3><button type="button" aria-label="关闭历史表单" @click="formDialog?.close()">×</button></header><p>{{selectedForm?.submitted?'已填入当时提交的答案，仅用于演示。':'历史答案未记录，以下仅展示当时表单。'}}</p><ResearchDecisionForm v-if="selectedForm" :form="selectedForm.form" :answers="selectedForm.answers" :busy="true" :hide-header="true"/><footer><button type="button" class="primary" @click="formDialog?.close();move(1)">{{selectedForm?.submitted?'演示提交并继续':'跳过缺失答案，继续演示'}}</button></footer></dialog>
 <dialog ref="fileDialog" class="record-file-dialog" @close="selectedFile=null" @cancel="playing=false"><header><h3>{{selectedFile?.name}}</h3><button type="button" aria-label="关闭成果预览" @click="fileDialog?.close()">×</button></header><div v-if="selectedFile" class="record-preview">
  <ResearchPdfPreview v-if="/\.pdf$/i.test(selectedFile.path)" :key="record.id+selectedFile.path" :agent-id="record.agentId" :thread-id="record.threadId" :path="selectedFile.path" :read-file="readSelectedFile"/>
  <ResearchPptPreview v-else-if="/\.pptx$/i.test(selectedFile.path)" :key="record.id+selectedFile.path" :agent-id="record.agentId" :thread-id="record.threadId" :path="selectedFile.path" :read-file="readSelectedFile"/>
  <ResearchWordPreview v-else-if="/\.docx$/i.test(selectedFile.path)" :key="record.id+selectedFile.path" :agent-id="record.agentId" :thread-id="record.threadId" :path="selectedFile.path" :read-file="readSelectedFile"/>
  <ResearchImagePreview v-else-if="/\.(png|jpe?g|svg|gif|webp|bmp|avif)$/i.test(selectedFile.path)" :key="record.id+selectedFile.path" :agent-id="record.agentId" :thread-id="record.threadId" :path="selectedFile.path" :read-file="readSelectedFile"/>
  <template v-else-if="selectedFile.content!==undefined&&isQuestionnairePath(selectedFile.path)"><p v-if="questionnaireIdentity.error" role="alert">{{questionnaireIdentity.error}}</p><AgentQuestionnairePreview v-else :historical="true" :content="selectedFile.content" :project-id="questionnaireIdentity.projectId" :thread-id="record.threadId" :path="selectedFile.path"/></template>
  <ResearchArtifactPreview v-else :path="selectedFile.path" :content="selectedFile.content"/>
 </div></dialog>
</div>
</template>
<script setup lang="ts">
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {replaySteps,replayQuestionnaireIdentity,replayRounds,type ResearchReplayRecord,type ReplayForm,type ReplayMessage,type ReplayFile} from '@/utils/researchReplayRecord'
import {readableResearchText} from '@/utils/researchDisplayText'
import {isPrimaryResearchArtifact,prioritizeArtifacts,groupArtifactCards,selectedArtifactVariant,artifactSourceLabel} from '@/utils/researchArtifactDisplay'
import {researchFormPresentation} from '@/utils/researchFormPresentation'
import {renderResearchMessage,isResearchPlatformNotice} from '@/utils/researchMessageRender'
const isQuestionnairePath=(path:string)=>/(?:^|[/\\])问卷结构\.json$/i.test(path)
import ResearchDecisionForm from './ResearchDecisionForm.vue'
import ResearchArtifactPreview from './ResearchArtifactPreview.vue'
import AgentQuestionnairePreview from './AgentQuestionnairePreview.vue'
import ResearchPdfPreview from './ResearchPdfPreview.vue'
import ResearchPptPreview from './ResearchPptPreview.vue'
import ResearchWordPreview from './ResearchWordPreview.vue'
import ResearchImagePreview from './ResearchImagePreview.vue'
const props=defineProps<{record:ResearchReplayRecord;versions:ResearchReplayRecord[];drawerOpen:boolean;readFile:(record:ResearchReplayRecord,file:ReplayFile)=>Promise<Blob>}>()
const emit=defineEmits<{exit:[];version:[id:string]}>()
const renderedMessages=computed(()=>new Map(replaySteps(props.record).flatMap(step=>step.message?[[step.message.id,renderResearchMessage(step.message.text,step.message.role)] as const]:[])))
const steps=computed(()=>replayRounds(props.record,message=>!!renderedMessages.value.get(message.id)&&!isResearchPlatformNotice(message.text))),cursor=ref(1),playing=ref(false),stream=ref<HTMLElement>(),formDialog=ref<HTMLDialogElement>(),fileDialog=ref<HTMLDialogElement>(),selectedForm=ref<ReplayForm|null>(null),selectedFile=ref<ReplayFile|null>(null),fileError=ref(''),allFiles=ref(false)
const visibleSteps=computed(()=>{
 const entries:{id:string;roundId:string;role?:'user'|'assistant';html?:string;form?:ReplayForm}[]=[]
 for(const round of steps.value.slice(0,cursor.value)){
  if(round.form){entries.push({id:round.id,roundId:round.id,form:round.form});continue}
  for(const message of round.messages||[]){
   const html=renderedMessages.value.get(message.id)||'',previous=entries.at(-1)
   if(previous?.role==='assistant'&&message.role==='assistant'&&previous.roundId===round.id)previous.html+='\n'+html
   else entries.push({id:message.id,roundId:round.id,role:message.role,html})
  }
 }
 return entries
}),currentPhase=computed(()=>steps.value[Math.min(cursor.value,steps.value.length)-1]?.phase||''),phases=computed(()=>[...new Set(steps.value.map(s=>s.phase).filter(Boolean))]),visibleFiles=computed(()=>{if(allFiles.value)return props.record.files;const files=props.record.files.filter(f=>f.phase===currentPhase.value),primary=files.filter(isPrimaryResearchArtifact);return primary.length?primary:files.filter(f=>!/(?:_proof|_state|_input|分析代码)\//.test(f.path)&&/\.(?:md|json|csv|tsv|png|jpe?g|pdf|pptx|docx|svg|webp)$/i.test(f.path))})
const questionnaireIdentity=computed(()=>replayQuestionnaireIdentity(props.record,selectedFile.value))
const formatSelections=ref<Record<string,string>>({})
const displayFiles=computed(()=>groupArtifactCards(prioritizeArtifacts(visibleFiles.value)).map(card=>({...selectedArtifactVariant(card,formatSelections.value[card.key]),cardKey:card.key,formats:card.files})))
let timer:ReturnType<typeof setTimeout>|undefined,generation=0
function pause(){playing.value=false;clearTimeout(timer)}
async function showForm(form:ReplayForm){pause();selectedForm.value=form;await nextTick();if(formDialog.value?.isConnected&&!formDialog.value.open)formDialog.value.showModal()}
function schedule(){clearTimeout(timer);if(playing.value)timer=setTimeout(()=>{move(1,true);if(playing.value)schedule()},2400)}
function move(delta:number,automatic=false){if(!automatic)pause();cursor.value=Math.max(1,Math.min(steps.value.length,cursor.value+delta));if(cursor.value>=steps.value.length)pause()}
function togglePlay(){if(playing.value){pause();return}if(cursor.value>=steps.value.length)cursor.value=1;playing.value=true;schedule()}
function restart(){pause();formDialog.value?.close();fileDialog.value?.close();cursor.value=1;allFiles.value=false}
function jump(phase:string){pause();const index=steps.value.findIndex(step=>step.phase===phase);if(index>=0)cursor.value=index+1}
async function previewFile(file:ReplayFile){pause();fileError.value='';selectedFile.value=file;await nextTick();if(fileDialog.value?.isConnected&&!fileDialog.value.open)fileDialog.value.showModal()}
async function readSelectedFile(signal:AbortSignal){const record=props.record,file=selectedFile.value;if(!file)throw Error('未选择成果');const blob=await props.readFile(record,file);if(signal.aborted||record.id!==props.record.id||selectedFile.value?.path!==file.path)throw Error('预览已切换');return blob}
async function download(file:ReplayFile){pause();const token=generation;fileError.value='';try{const blob=await props.readFile(props.record,file);if(token!==generation)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){if(token===generation)fileError.value=error instanceof Error?error.message:'下载失败'}}
watch(()=>props.record.id,()=>{generation++;formatSelections.value={};restart()})
watch(cursor,async()=>{const step=steps.value[cursor.value-1];if(step?.form)void showForm(step.form);await nextTick();const start=Array.from(stream.value?.querySelectorAll<HTMLElement>('[data-round]')||[]).find(node=>node.dataset.round===step?.id);if(start&&stream.value)stream.value.scrollTo({top:Math.max(0,start.offsetTop-stream.value.offsetTop-12),behavior:'smooth'})})
watch(()=>steps.value[0]?.id,()=>{if(steps.value[0]?.form)void showForm(steps.value[0].form)},{immediate:true})
onBeforeUnmount(()=>{generation++;pause();formDialog.value?.close();fileDialog.value?.close()})
</script>
<style scoped>
.record-workspace{display:flex;flex:1;min-height:0;overflow:hidden;background:var(--bg,#f2f9f8);color:var(--ink,#193f43)}.record-chat{display:flex;flex:1;min-width:0;flex-direction:column}.record-stream{flex:1;overflow:auto;padding:20px 30px}.record-intro{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #c5ded7}.record-intro>span{font-weight:700;color:#0b7067}.record-intro label{margin-left:auto;font-size:12px}.record-message{max-width:100%;margin:0 0 20px;font-size:16px;line-height:1.85;overflow-wrap:anywhere}.author{display:block;color:#6b8888;font-size:12px;margin-bottom:6px}.user{width:fit-content;max-width:85%;margin-left:auto;padding:10px 16px;background:#177c6e;color:#fff;border-radius:14px}.message-body :deep(p){margin:.4em 0}.message-body :deep(table){border-collapse:collapse;display:block;overflow:auto}.message-body :deep(td),.message-body :deep(th){padding:8px;border:1px solid #c8ded8}.record-controls{padding:12px 22px;border-top:1px solid #b7d4cb;background:#fff;display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;align-items:center}.record-controls>div{display:flex;align-items:center;gap:8px}.record-controls span,.record-controls label{font-size:12px;color:#4c6d6d}button,select{font:inherit;color:#0b7067;border:1px solid #abcfc5;border-radius:8px;background:white;padding:7px 11px;cursor:pointer}button:hover:not(:disabled){background:#e7f4ef}button:disabled{opacity:.45;cursor:default}button.primary{background:#0b8075;color:#fff;border-color:#0b8075}button.primary:hover{background:#09675e}button:focus-visible,select:focus-visible{outline:2px solid #168b7e;outline-offset:3px}.record-results{width:34%;min-width:290px;max-width:520px;border-left:2px solid #8dbeb1;overflow:auto;padding:20px;box-sizing:border-box}.record-results header{font-size:18px;padding-bottom:14px;border-bottom:1px solid #b8d8ce}.record-file-note{font-size:12px;color:#678783}.record-file-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.record-file-grid article{background:white;border:1px solid #accfc5;border-radius:12px;padding:12px;min-width:0}.record-file-grid strong{display:block;font-size:13px;overflow-wrap:anywhere;margin-bottom:12px}.record-file-grid button{font-size:12px;padding:6px 9px;margin:0 5px 4px 0}.saved-form{margin:16px 0;padding:14px 16px;border:1px solid #b5d4c9;background:white;border-radius:10px}.saved-form p,.record-end,.record-gaps{font-size:13px;line-height:1.8}.record-gaps{padding:10px 14px;background:#fff7e9;border-radius:8px;margin-bottom:16px}.record-gaps summary{cursor:pointer}.record-form-dialog,.record-file-dialog{box-sizing:border-box;width:min(760px,calc(100vw - 40px));max-height:85vh;border:1px solid #aacfc5;border-radius:16px;padding:20px;color:#234c50;background:#fff}.record-file-dialog{width:min(1080px,calc(100vw - 40px))}dialog::backdrop{background:#123c4555}dialog header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d0e4dc;padding-bottom:12px;gap:12px}dialog h3{margin:0;font-size:18px;overflow-wrap:anywhere}dialog>p{font-size:13px;color:#66817f}dialog footer{display:flex;justify-content:flex-end;border-top:1px solid #d0e4dc;padding-top:12px}.record-preview{padding-top:16px}[role=alert]{color:#945420}@media(max-width:900px){.record-results{width:38%;min-width:240px}.record-file-grid{grid-template-columns:1fr}.record-stream{padding:16px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
.record-file-grid small,.record-file-grid label{display:block;font-size:11px;color:#5b7972;margin-bottom:9px;overflow-wrap:anywhere}.record-file-grid select{font-size:12px;padding:3px 7px}
</style>
