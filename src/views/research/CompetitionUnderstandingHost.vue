<template>
  <section class="contest-host" aria-labelledby="contest-title">
    <div class="section-title"><div><p class="eyebrow">第 1 阶段 · 完整研究</p><h2 id="contest-title">赛事理解</h2></div><span>本机草稿 · 尚未正式确认</span></div>
    <p class="description">先整理研究背景、适用届次和组别、要求与来源，明确会影响当前决定的未知项。来源未核对时保留未知，不自动补成赛事事实。</p>
    <div class="actions"><button :disabled="readOnly" @click="emit('save-local')">保存本机草稿</button><button class="secondary" @click="checkLocal">检查草稿完整性</button><button v-if="!editor" disabled>保存正式候选（待接入）</button><button disabled>确认本阶段（待接入）</button></div>
    <component v-if="editor" :is="editor" :context="context" :draft="draft" :read-only="readOnly" :issues="issues" @update-draft="forwardUpdate" @save-request="requestCandidate" />
    <div v-else class="editor-pending" role="status"><strong>赛事资料编辑功能待接入</strong><p>当前可建立和继续任务、查看流程与已保存资料。资料编辑组件交付后将在这里接入。</p></div>
    <dl class="contest-summary"><div><dt>研究背景</dt><dd>{{ draft.background || '尚未填写' }}</dd></div><div><dt>届次／组别</dt><dd>{{ draft.edition || '未知' }} / {{ draft.group || '未知' }}</dd></div></dl>
    <div class="evidence-grid"><section><h3>要求与来源</h3><p v-if="!draft.requirements.length" class="muted">尚未记录要求。</p><ul><li v-for="item in draft.requirements" :key="item.id">{{ item.text }}<small>关联来源：{{ sourceNames(item.sourceIds) }}</small></li></ul><ul><li v-for="source in draft.sources" :key="source.sourceId">{{ source.title }}<small>{{ source.locator }} · {{ evidenceLabel(source.evidenceStatus) }}</small></li></ul></section><section><h3>未知项</h3><p v-if="!draft.unknowns.length" class="muted">尚未整理；这不代表没有未知项。</p><ul><li v-for="item in draft.unknowns" :key="item.id">{{ item.text }}<small>{{ item.blocksDecision ? '影响当前决定，需先解决' : '保留待核对' }}</small></li></ul></section></div>
    <p class="muted">本机保存、正式候选保存与确认推进分别处理。查看下一阶段不会完成本阶段，也不会锁定历史资料。</p>
    <div v-if="checked" class="check-result" role="status"><strong>本机完整性提示</strong><ul v-if="issues.length"><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul><p v-else>未发现必填缺项，仍需核对真实来源并由服务端完成正式检查。</p><p>这不是正式阶段完成检查（G0），不会推进阶段。</p></div>
    <p v-if="actionFeedback" role="alert">{{ actionFeedback }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type Component } from 'vue'
import type { CompetitionDraft, DraftContext, ContestDraftUpdate, ContestActionRequest } from '../../types/research-contracts'
import { checkContestDraft } from '../../utils/researchDrafts'
import { BUSINESS_API_STATUS } from '../../api/research'
const props=defineProps<{context:DraftContext;draft:CompetitionDraft;readOnly?:boolean;editorComponent?:Component}>()
const emit=defineEmits<{'update-draft':[value:ContestDraftUpdate];'save-local':[]}>()
// Optional F delivery: no duplicate editor is created in P-owned code.
const delivered=import.meta.glob('../../components/research/ResearchDesignEditor.vue')
const loadEditor=Object.values(delivered)[0]
const deliveredEditor=loadEditor?defineAsyncComponent(loadEditor as ()=>Promise<{default:Component}>):null
const editor=computed(()=>props.editorComponent||deliveredEditor)
const issues=computed(()=>checkContestDraft(props.draft)),checked=ref(false),actionFeedback=ref('')
watch(()=>[props.context.localTaskId,props.context.revision],()=>{checked.value=false;actionFeedback.value=''})
function checkLocal(){checked.value=true}
function sourceNames(ids:string[]){return ids.length?ids.map(id=>props.draft.sources.find(source=>source.sourceId===id)?.title.trim()||'来源缺失或未命名（待核对）').join('、'):'尚未关联'}
function forwardUpdate(event:ContestDraftUpdate){if(props.readOnly){actionFeedback.value='当前为只读资料，编辑请求未应用。';return}emit('update-draft',event)}
function requestCandidate(event:ContestActionRequest){if(props.readOnly){actionFeedback.value='当前为只读资料，保存请求未执行。';return}actionFeedback.value=event?.context?.localTaskId===props.context.localTaskId&&event.context.revision===props.context.revision?BUSINESS_API_STATUS.message:'忽略了其他任务或旧修订的保存请求。'}
const evidenceLabel=(value:string)=>({'unverified':'未核实','user-provided':'用户提供，待核对','source-cited':'已标注来源，仍需核对适用性'}[value]||'未核实')
</script>
<style scoped>
.contest-host{padding:28px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:20px}.section-title h2{margin:6px 0 0;font-size:23px}.section-title>span{font-size:12px;color:#657c71}.eyebrow{font-size:11px;color:#4b806b;margin:0}.description,.muted{color:#6a7f75;line-height:1.8;font-size:13px}.editor-pending{padding:18px 20px;background:#f3f6f3;border:1px dashed #b9cfc1;border-radius:9px;margin:22px 0}.editor-pending strong{font-size:14px}.editor-pending p{font-size:13px;margin-bottom:0;color:#6a7f75}.contest-summary{display:grid;grid-template-columns:1.3fr 1fr;gap:24px;padding:15px 0;border-bottom:1px solid #e5ece7}.contest-summary dt{font-size:12px;color:#7b8b82}.contest-summary dd{margin:8px 0;font-size:14px;white-space:pre-wrap}.evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}.evidence-grid h3{font-size:14px}.evidence-grid ul{padding-left:20px;font-size:13px;line-height:1.8}.evidence-grid small{display:block;color:#7b8b82;font-size:11px}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:24px}button{font:inherit;font-size:12px;background:#176f5b;color:white;border:1px solid #176f5b;border-radius:7px;padding:10px 13px;cursor:pointer}.secondary{color:#28624f;background:white}button:disabled{background:#eef1ee;color:#8b9890;border-color:#e1e7e2;cursor:default}.check-result{background:#f6f8f2;border-left:3px solid #9fb174;padding:14px 18px;font-size:13px;line-height:1.8}p[role=alert]{font-size:13px;color:#9b542b}button:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}li,dd{overflow-wrap:anywhere}
</style>
