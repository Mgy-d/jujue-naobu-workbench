<template>
  <section class="questionnaire-host">
    <header><p>{{ independent ? '独立快捷入口 · 已有问卷核对' : '第 4 阶段 · 完整研究' }}</p><h2>{{ independent ? '问卷核对' : '问卷设计与预测试' }}</h2><span>本机草稿 · 尚未正式确认</span></header>
    <p class="boundary">试填内容由用户录入，本机检查只判断字段、关联与内容指纹是否一致，不核验试填真实性。本机标记不是正式问卷版本；匿名发布、答卷回收和服务器确认尚未接入。</p>
    <div class="actions"><button :disabled="readOnly" @click="emit('save-local')">保存本机草稿</button><button class="secondary" @click="checked=true">检查草稿完整性</button><button disabled>确认本阶段（待接入）</button></div>
    <ResearchQuestionnaireEditor :context="context" :draft="editorDraft" :upstream="upstream" :read-only="readOnly===true" :issues="issues" @update-draft="forwardUpdate" @save-request="requestCandidate" />
    <div v-if="checked" class="check-result" role="status"><strong>本机完整性提示</strong><ul v-if="issues.length"><li v-for="issue in issues" :key="issue">{{issue}}</li></ul><p v-else>未发现录入缺项；仍需核对真实试填依据并接入正式服务。</p></div>
    <p v-if="feedback" role="alert">{{feedback}}</p>
  </section>
</template>
<script setup lang="ts">
import {computed,readonly,ref,watch} from 'vue'
import ResearchQuestionnaireEditor from '@/components/research/ResearchQuestionnaireEditor.vue'
import type {DraftContext,QuestionnaireDraft,QuestionnaireDraftUpdate,ResearchPlanDraft,ContestActionRequest} from '@/types/research-contracts'
import {normalizeQuestionnaireDraft,checkQuestionnaireDraft} from '@/utils/researchDrafts'
import {BUSINESS_API_STATUS} from '@/api/research'
const props=defineProps<{context:DraftContext;draft:QuestionnaireDraft;plan:ResearchPlanDraft|null;independent?:boolean;readOnly?:boolean}>()
const emit=defineEmits<{'update-draft':[value:QuestionnaireDraftUpdate];'save-local':[]}>()
// F contract declares mutable arrays; preserve its event interface while enforcing readonly at runtime.
const editorDraft=computed(()=>readonly(props.draft) as QuestionnaireDraft),upstream=computed(()=>({plan:props.plan?readonly(props.plan) as ResearchPlanDraft:null}))
const issues=computed(()=>checkQuestionnaireDraft(props.draft,{plan:props.plan})),checked=ref(false),feedback=ref('')
watch(()=>[props.context.localTaskId,props.context.revision],()=>{checked.value=false;feedback.value=''})
function current(event:ContestActionRequest){return event?.context?.localTaskId===props.context.localTaskId&&event.context.revision===props.context.revision}
function forwardUpdate(event:QuestionnaireDraftUpdate){
 if(props.readOnly){feedback.value='当前问卷只读，编辑请求未应用。';return}
 if(!current(event)){feedback.value='忽略了其他任务或旧修订的问卷事件。';return}
 const draft=normalizeQuestionnaireDraft(event.draft)
 if(!draft){feedback.value='问卷草稿格式无效，当前编辑未替换。';return}
 emit('update-draft',{context:event.context,draft})
}
function requestCandidate(event:ContestActionRequest){feedback.value=props.readOnly?'当前问卷只读，保存请求未执行。':current(event)?BUSINESS_API_STATUS.message:'忽略了其他任务或旧修订的保存请求。'}
</script>
<style scoped>
.questionnaire-host{padding:28px;color:#234b3e}.questionnaire-host header p,.questionnaire-host header span{font-size:11px;color:#658274}h2{margin:8px 0;font-size:23px}.boundary{font-size:13px;color:#6a7f75;line-height:1.9}.actions{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0}button{font:inherit;font-size:12px;background:#176f5b;color:white;border:1px solid #176f5b;border-radius:7px;padding:10px 13px;cursor:pointer}button.secondary{background:white;color:#28624f}button:disabled{background:#eef1ee;color:#8b9890;border-color:#e1e7e2;cursor:default}.check-result{padding:16px;background:#f6f8f2;border-left:3px solid #9fb174;font-size:13px;line-height:1.8}p[role=alert]{color:#9b542b;font-size:13px}p,li{overflow-wrap:anywhere}button:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}
</style>
