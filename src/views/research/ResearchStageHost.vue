<template>
  <section class="research-stage-host" aria-labelledby="research-stage-title">
    <header><div><p class="eyebrow">第 {{ phase + 1 }} 阶段 · 完整研究</p><h2 id="research-stage-title">{{ title }}</h2></div><span>本机草稿 · 尚未正式确认</span></header>
    <p class="description">{{ phase === 1 ? '比较方向并记录选择依据。这里的拟选仅保存在本机，尚未正式采用。' : '对齐研究问题、抽样、招募、测量和分析计划。本机方案标记不代表正式版本或服务器确认。' }}</p>
    <div class="actions"><button :disabled="readOnly" @click="emit('save-local')">保存本机草稿</button><button class="secondary" @click="checked = true">检查草稿完整性</button><button v-if="!editor" disabled>保存正式候选（待接入）</button><span class="muted">正式候选与阶段确认见右侧项目区。</span></div>
    <component v-if="editor" :is="editor" :phase="phase" :context="context" :draft="editorDraft" :read-only="readOnly" :issues="issues" :upstream="upstream" @update-draft="forwardUpdate" @save-request="requestCandidate" />
    <div v-else class="editor-pending" role="status"><strong>{{ title }}编辑组件待接入</strong><p>当前仅保留本机草稿和摘要，编辑组件交付后再验收填写。</p></div>
    <section v-if="!editor" class="draft-summary"><h3>本机资料摘要</h3><p v-if="topic">{{ topic.directions.length }} 个方向；{{ selectedTopicTitle }}</p><p v-if="plan">{{ plan.researchQuestions.length }} 个研究问题，{{ plan.measures.length }} 个测量变量，{{ plan.analyses.length }} 项分析安排。</p></section>
    <details v-if="legacyText" class="legacy-draft"><summary>旧版资料已保留，请对照新字段核对</summary><p>无法直接映射的旧说明和来源保留在这里，没有自动推断成详细方案。</p><pre>{{ legacyText }}</pre></details>
    <details class="upstream"><summary>上游本机资料参考（未正式确认）</summary><p>赛事背景：{{ competition.background || '尚未填写' }}</p><p>届次／组别：{{ competition.edition || '未知' }} / {{ competition.group || '未知' }}</p><p v-if="phase === 2">本机拟选方向：{{ upstreamTopicTitle }}（未正式采用）</p><p>这里提供本机参考，不代表已确认输入版本；编辑本阶段不会改写上游资料。</p></details>
    <div v-if="checked" class="check-result" role="status"><strong>本机完整性提示</strong><ul v-if="issues.length"><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul><p v-else>未发现本机必填缺项；仍需核对真实依据和正式服务端检查。</p><p>统计预检只检查方案规则，没有执行统计；本机检查不会确认或推进阶段。</p></div>
    <p v-if="actionFeedback" role="alert">{{ actionFeedback }}</p>
  </section>
</template>
<script setup lang="ts">
import {computed,defineAsyncComponent,readonly,ref,watch,type Component} from 'vue'
import type {CompetitionDraft,DraftContext,TopicAnalysisDraft,ResearchPlanDraft,ContestActionRequest,ResearchStageDraftUpdate} from '../../types/research-contracts'
import {checkTopicAnalysisDraft,checkResearchPlanDraft,normalizeTopicAnalysisDraft,normalizeResearchPlanDraft} from '../../utils/researchDrafts'

const props=defineProps<{phase:1|2;context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft;competition:CompetitionDraft;topicAnalysis?:TopicAnalysisDraft;readOnly?:boolean;editorComponent?:Component}>()
const emit=defineEmits<{'update-draft':[value:ResearchStageDraftUpdate];'save-local':[];'save-candidate':[]}>()
const topicDelivery=import.meta.glob('../../components/research/TopicAnalysisEditor.vue'),planDelivery=import.meta.glob('../../components/research/ResearchPlanEditor.vue')
function optionalEditor(delivery:Record<string,()=>Promise<unknown>>){const load=Object.values(delivery)[0];return load?defineAsyncComponent(load as ()=>Promise<{default:Component}>):null}
const topicEditor=optionalEditor(topicDelivery),planEditor=optionalEditor(planDelivery)
const editor=computed(()=>props.editorComponent||(props.phase===1?topicEditor:planEditor)),editorDraft=computed(()=>readonly(props.draft))
const title=computed(()=>props.phase===1?'选题分析':'研究方案')
const topic=computed(()=>props.phase===1?props.draft as TopicAnalysisDraft:null),plan=computed(()=>props.phase===2?props.draft as ResearchPlanDraft:null)
const selectedTopicTitle=computed(()=>{const current=topic.value;return current?.directions.find(d=>d.id===current.selectedDirectionId)?.title||'尚未拟选'})
const upstreamTopicTitle=computed(()=>{const topic=props.topicAnalysis;return topic?.directions.find(d=>d.id===topic.selectedDirectionId)?.title||'尚未拟选'})
const upstream=computed(()=>props.phase===1?readonly(props.competition):{competition:readonly(props.competition),topic:props.topicAnalysis?readonly(props.topicAnalysis):null})
const checked=ref(false),actionFeedback=ref('')
const issues=computed(()=>topic.value?checkTopicAnalysisDraft(topic.value,props.competition):checkResearchPlanDraft(plan.value!,{competition:props.competition,topic:props.topicAnalysis??null}))
const legacyText=computed(()=>{
  const old=props.draft.legacyDraft;if(!old)return ''
  const lines:string[]=[]
  if('candidates' in old){for(const c of old.candidates)lines.push('旧方向：'+c.title,'研究问题：'+c.researchQuestion,'调查对象：'+c.targetPopulation,'可行性说明：'+c.feasibility);lines.push('原选择理由：'+old.selectionReason)}
  else lines.push('原研究问题：'+old.researchQuestion,'原调查对象：'+old.targetPopulation,'抽样说明：'+old.samplingPlan,'招募说明：'+old.recruitmentPlan,'测量说明：'+old.measurementPlan,'证据需求：'+old.evidenceNeeds,'分析说明：'+old.analysisPlan)
  for(const source of old.sources)lines.push('旧来源：'+source.title+' · '+source.locator+'（保留原核实状态）')
  return lines.join('\n')
})
watch(()=>[props.context.localTaskId,props.context.revision,props.phase],()=>{checked.value=false;actionFeedback.value=''})
function current(event:ContestActionRequest){return event?.context?.localTaskId===props.context.localTaskId&&event.context.revision===props.context.revision}
function forwardUpdate(event:{context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft}){
  if(props.readOnly){actionFeedback.value='当前资料只读，编辑请求未应用。';return}
  if(!current(event)){actionFeedback.value='忽略了其他任务或旧修订的组件事件。';return}
  if(props.phase===1){const draft=normalizeTopicAnalysisDraft(event.draft);if(draft){emit('update-draft',{context:event.context,draft,phase:1});return}}
  else {const draft=normalizeResearchPlanDraft(event.draft);if(draft){emit('update-draft',{context:event.context,draft,phase:2});return}}
  actionFeedback.value='组件草稿格式无效，当前编辑未替换。'
}
function requestCandidate(event:ContestActionRequest){if(props.readOnly){actionFeedback.value='当前资料只读，保存请求未执行。';return}if(current(event)){emit('save-candidate');return}actionFeedback.value='忽略了其他任务或旧修订的保存请求。'}
</script>
<style scoped>
.research-stage-host{padding:28px;color:#234b3e}.research-stage-host>header{display:flex;align-items:center;justify-content:space-between;gap:20px}h2{margin:6px 0;font-size:23px}header>span,.eyebrow{font-size:11px;color:#658274}.eyebrow{margin:0}.description,.upstream{font-size:13px;color:#6a7f75;line-height:1.8}.actions{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0}button{font:inherit;font-size:12px;background:#176f5b;color:white;border:1px solid #176f5b;border-radius:7px;padding:10px 13px;cursor:pointer}button.secondary{background:white;color:#28624f}button:disabled{background:#eef1ee;color:#8b9890;border-color:#e1e7e2;cursor:default}.editor-pending{padding:18px 20px;border:1px dashed #b9cfc1;border-radius:9px;background:#f3f6f3;font-size:13px;line-height:1.8}.draft-summary{margin:24px 0;font-size:13px}.upstream,.legacy-draft{padding:16px;background:#f6f8f4;border-radius:8px;margin-top:20px;font-size:13px;line-height:1.8}summary{cursor:pointer}.legacy-draft pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.check-result{margin-top:18px;padding:14px 18px;border-left:3px solid #9fb174;background:#f6f8f2;font-size:13px;line-height:1.8}p[role=alert]{color:#9b542b;font-size:13px}p,li{overflow-wrap:anywhere}button:focus-visible,summary:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}
</style>
