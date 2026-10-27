<template>
  <section class="research-stage-host" aria-labelledby="research-stage-title">
    <header><div><p class="eyebrow">第 {{ phase + 1 }} 阶段 · 完整研究</p><h2 id="research-stage-title">{{ title }}</h2></div><span>本机草稿 · 尚未正式确认</span></header>
    <p class="description">{{ phase === 1 ? '比较候选方向，记录研究问题、调查对象、可行性与选择理由。拟选方向只属于当前本机任务，不代表正式采用。' : '记录调查对象、抽样、招募、测量、证据需求与分析计划。方案草稿独立保留，尚未正式采用，也没有执行调查。' }}</p>
    <div class="actions"><button :disabled="readOnly" @click="emit('save-local')">保存本机草稿</button><button class="secondary" @click="checked = true">检查草稿完整性</button><button v-if="!editor" disabled>保存正式候选（待接入）</button><button disabled>确认本阶段（待接入）</button></div>
    <component v-if="editor" :is="editor" :phase="phase" :context="context" :draft="draft" :read-only="readOnly" :issues="issues" :upstream="upstream" @update-draft="forwardUpdate" @save-request="requestCandidate" />
    <div v-else class="editor-pending" role="status"><strong>{{ title }}编辑组件待接入</strong><p>本机草稿的数据管理与保存接点已准备；当前显示已保存资料摘要，尚不能在此填写。组件交付后再验收实际填写操作。</p></div>
    <section v-if="topic" class="draft-summary"><h3>本机资料摘要</h3><p v-if="!topic.candidates.length" class="muted">尚未记录候选方向。</p><article v-for="candidate in topic.candidates" :key="candidate.id"><h4>{{ candidate.title || '未命名方向' }}<small v-if="candidate.id === topic.selectedCandidateId">本机拟选</small></h4><dl><div><dt>研究问题</dt><dd>{{ candidate.researchQuestion || '尚未填写' }}</dd></div><div><dt>调查对象</dt><dd>{{ candidate.targetPopulation || '尚未填写' }}</dd></div><div><dt>可行性</dt><dd>{{ candidate.feasibility || '尚未填写' }}</dd></div></dl></article><p>选择理由：{{ topic.selectionReason || '尚未填写' }}</p></section>
    <section v-if="plan" class="draft-summary"><h3>本机资料摘要</h3><dl><div v-for="field in planFields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ plan[field.key] || '尚未填写' }}</dd></div></dl></section>
    <section class="evidence"><h3>本阶段来源与未知项</h3><p v-if="!draft.sources.length" class="muted">尚未记录来源。</p><ul><li v-for="source in draft.sources" :key="source.sourceId">{{ source.title || '未命名来源' }} · {{ source.locator || '定位待补充' }}<small>{{ evidenceLabel(source.evidenceStatus) }}</small></li></ul><p v-if="!draft.unknowns.length" class="muted">尚未整理未知项；这不代表没有未知项。</p><ul><li v-for="unknown in draft.unknowns" :key="unknown.id">{{ unknown.text }}<small>{{ unknown.blocksDecision ? '影响当前决定，需先核对' : '保留待核对' }}</small></li></ul></section>
    <details class="upstream"><summary>上游本机资料参考（未正式确认）</summary><p>赛事背景：{{ competition.background || '尚未填写' }}</p><p>届次／组别：{{ competition.edition || '未知' }} / {{ competition.group || '未知' }}</p><p v-if="phase === 2">本机拟选方向：{{ upstreamTopicTitle }}（未正式采用）</p><p>这不是已确认版本。查看与编辑本阶段不会确认或改写上游资料。</p></details>
    <div v-if="checked" class="check-result" role="status"><strong>本机完整性提示</strong><ul v-if="issues.length"><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul><p v-else>未发现本机必填缺项；仍需核对真实依据并等待正式检查。</p><p>本机检查不会正式采用方向、方案或推进阶段。</p></div>
    <p v-if="actionFeedback" role="alert">{{ actionFeedback }}</p>
  </section>
</template>
<script setup lang="ts">
import {computed,defineAsyncComponent,readonly,ref,watch,type Component} from 'vue'
import type {CompetitionDraft,DraftContext,TopicAnalysisDraft,ResearchPlanDraft,ContestActionRequest,ResearchStageDraftUpdate} from '../../types/research-contracts'
import {checkTopicAnalysisDraft,checkResearchPlanDraft,normalizeTopicAnalysisDraft,normalizeResearchPlanDraft} from '../../utils/researchDrafts'
import {BUSINESS_API_STATUS} from '../../api/research'
const props=defineProps<{phase:1|2;context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft;competition:CompetitionDraft;topicAnalysis?:TopicAnalysisDraft;readOnly?:boolean;editorComponent?:Component}>()
const emit=defineEmits<{'update-draft':[value:ResearchStageDraftUpdate];'save-local':[]}>()
const topicDelivery=import.meta.glob('../../components/research/TopicAnalysisEditor.vue')
const planDelivery=import.meta.glob('../../components/research/ResearchPlanEditor.vue')
function optionalEditor(delivery:Record<string,()=>Promise<unknown>>){const load=Object.values(delivery)[0];return load?defineAsyncComponent(load as ()=>Promise<{default:Component}>):null}
const topicEditor=optionalEditor(topicDelivery),planEditor=optionalEditor(planDelivery)
const editor=computed(()=>props.editorComponent||(props.phase===1?topicEditor:planEditor))
const title=computed(()=>props.phase===1?'选题分析':'研究方案')
const upstreamTopicTitle=computed(()=>{const topic=props.topicAnalysis;return topic?.candidates.find(c=>c.id===topic.selectedCandidateId)?.title||'尚未拟选'})
const topic=computed(()=>props.phase===1?props.draft as TopicAnalysisDraft:null)
const plan=computed(()=>props.phase===2?props.draft as ResearchPlanDraft:null)
const planFields: {key: Exclude<keyof ResearchPlanDraft,'sources'|'unknowns'>;label:string}[]=[{key:'researchQuestion',label:'研究问题'},{key:'targetPopulation',label:'调查对象'},{key:'samplingPlan',label:'抽样安排'},{key:'recruitmentPlan',label:'招募安排'},{key:'measurementPlan',label:'测量安排'},{key:'evidenceNeeds',label:'证据需求'},{key:'analysisPlan',label:'分析计划'}]
const upstream=computed(()=>({competition:readonly(props.competition),...(props.phase===2&&props.topicAnalysis?{topicAnalysis:readonly(props.topicAnalysis)}:{})}))
const checked=ref(false),actionFeedback=ref(''),issues=computed(()=>topic.value?checkTopicAnalysisDraft(topic.value):checkResearchPlanDraft(plan.value!))
watch(()=>[props.context.localTaskId,props.context.revision,props.phase],()=>{checked.value=false;actionFeedback.value=''})
function current(event:ContestActionRequest){return event?.context?.localTaskId===props.context.localTaskId&&event.context.revision===props.context.revision}
function forwardUpdate(event:{context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft}){
  if(props.readOnly){actionFeedback.value='当前资料只读，编辑请求未应用。';return}
  if(!current(event)){actionFeedback.value='忽略了其他任务或旧修订的组件事件。';return}
  if(props.phase===1){const draft=normalizeTopicAnalysisDraft(event.draft);if(draft){emit('update-draft',{context:event.context,draft,phase:1});return}}
  else {const draft=normalizeResearchPlanDraft(event.draft);if(draft){emit('update-draft',{context:event.context,draft,phase:2});return}}
  actionFeedback.value='组件草稿格式无效，当前编辑未替换。'
}
function requestCandidate(event:ContestActionRequest){actionFeedback.value=props.readOnly?'当前资料只读，保存请求未执行。':current(event)?BUSINESS_API_STATUS.message:'忽略了其他任务或旧修订的保存请求。'}
const evidenceLabel=(value:string)=>({'unverified':'未核实','user-provided':'用户提供，待核对','source-cited':'已标注来源，仍需核对适用性'}[value]||'未核实')
</script>
<style scoped>
.research-stage-host{padding:28px;color:#234b3e}.research-stage-host>header{display:flex;align-items:center;justify-content:space-between;gap:20px}h2{margin:6px 0;font-size:23px}header>span,.eyebrow{font-size:11px;color:#658274}.eyebrow{margin:0}.description,.muted,.upstream{font-size:13px;color:#6a7f75;line-height:1.8}.actions{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0}button{font:inherit;font-size:12px;background:#176f5b;color:white;border:1px solid #176f5b;border-radius:7px;padding:10px 13px;cursor:pointer}button.secondary{background:white;color:#28624f}button:disabled{background:#eef1ee;color:#8b9890;border-color:#e1e7e2;cursor:default}.editor-pending{padding:18px 20px;border:1px dashed #b9cfc1;border-radius:9px;background:#f3f6f3;font-size:13px;line-height:1.8}.editor-pending p{margin-bottom:0}.draft-summary,.evidence{margin:24px 0;font-size:13px;line-height:1.8}h3{font-size:14px}h4{margin:8px 0;font-size:14px}article{padding:14px 0;border-bottom:1px solid #e5ece7}dl{margin:8px 0}dt{font-size:12px;color:#7b8b82}dd{margin:3px 0 10px;white-space:pre-wrap}small{display:block;color:#72877a;font-size:11px}.upstream{padding:16px;background:#f6f8f4;border-radius:8px}.upstream summary{cursor:pointer}.check-result{margin-top:18px;padding:14px 18px;border-left:3px solid #9fb174;background:#f6f8f2;font-size:13px;line-height:1.8}p[role=alert]{color:#9b542b;font-size:13px}p,dd,li{overflow-wrap:anywhere}button:focus-visible,summary:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}
</style>
