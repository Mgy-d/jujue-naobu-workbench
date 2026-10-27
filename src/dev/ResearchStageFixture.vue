<template>
  <div class="stage-fixture"><strong>合成接线样例 · 不是已交付的正式编辑器</strong><p>仅用于开发验证，样例中的调查与来源均未真实发生。</p>
    <template v-if="topic"><label>样例候选名称<input :value="topic.candidates[0]?.title || ''" :readonly="readOnly" @input="changeTopicTitle" /></label><label>样例选择理由<textarea :value="topic.selectionReason" :readonly="readOnly" @input="changeField('selectionReason',$event)" /></label></template>
    <template v-if="plan"><label v-for="field in fields" :key="field.key">样例{{ field.label }}<textarea :value="plan[field.key]" :readonly="readOnly" @input="changeField(field.key,$event)" /></label></template>
    <button :disabled="readOnly" @click="send(sample())">填入合成{{ phase===1?'选题':'方案' }}</button>
    <button :disabled="readOnly" @click="emit('save-request',{context:{...context}})">请求正式保存（应提示未接入）</button>
    <button @click="send(sample(),{localTaskId:'other-task',revision:context.revision})">发送其他任务事件</button>
    <button @click="send(sample(),{...context,revision:context.revision-1})">发送旧修订事件</button>
    <button @click="send({invalid:true})">发送格式错误事件</button>
    <button @click="delayOld">延迟发送旧修订</button>
    <button @click="send(sample())">测试只读拦截</button>
  </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import type {DraftContext,TopicAnalysisDraft,ResearchPlanDraft,ContestActionRequest} from '../types/research-contracts'
const props=defineProps<{phase:1|2;context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft;readOnly:boolean;issues:string[];upstream:unknown}>()
const emit=defineEmits<{'update-draft':[value:{context:DraftContext;draft:any}];'save-request':[value:ContestActionRequest]}>()
const topic=computed(()=>props.phase===1?props.draft as TopicAnalysisDraft:null),plan=computed(()=>props.phase===2?props.draft as ResearchPlanDraft:null)
const fields:{key:Exclude<keyof ResearchPlanDraft,'sources'|'unknowns'>;label:string}[]=[{key:'researchQuestion',label:'研究问题'},{key:'targetPopulation',label:'调查对象'},{key:'samplingPlan',label:'抽样安排'},{key:'recruitmentPlan',label:'招募安排'},{key:'measurementPlan',label:'测量安排'},{key:'evidenceNeeds',label:'证据需求'},{key:'analysisPlan',label:'分析计划'}]
function sample():TopicAnalysisDraft|ResearchPlanDraft{
 const sources=[{sourceId:'synthetic-source',title:'合成材料',locator:'仅用于接线验收，非真实来源',evidenceStatus:'unverified' as const}],unknowns=[{id:'synthetic-unknown',text:'真实调查许可与样本来源未知',blocksDecision:true}]
 return props.phase===1?{candidates:[{id:'synthetic-topic',title:'【合成】校园饮水研究',researchQuestion:'【合成】使用差异来自哪些因素',targetPopulation:'【合成】本校学生',feasibility:'【合成】可接触人群，尚未招募',sourceIds:['synthetic-source']}],selectedCandidateId:'synthetic-topic',selectionReason:'【合成】材料可取得，待核实',sources,unknowns}:{researchQuestion:'【合成】校园饮水使用差异',targetPopulation:'【合成】本校学生',samplingPlan:'【合成】便利抽样，代表性有限',recruitmentPlan:'【合成】招募尚未执行',measurementPlan:'【合成】频率和满意度，待设计题项',evidenceNeeds:'【合成】材料与答卷尚未取得',analysisPlan:'【合成】先质检再做描述统计',sources,unknowns}
}
function send(draft:any,context={...props.context}){emit('update-draft',{context,draft})}
let pending:any=null,scheduled=false
function changeField(key:string,event:Event){pending={...(pending??props.draft),[key]:(event.target as HTMLTextAreaElement).value};if(scheduled)return;scheduled=true;const context={...props.context};queueMicrotask(()=>{scheduled=false;const draft=pending;pending=null;send(draft,context)})}
function changeTopicTitle(event:Event){const draft=JSON.parse(JSON.stringify(pending??props.draft)) as TopicAnalysisDraft;if(!draft.candidates.length)draft.candidates=[{id:'synthetic-typed-topic',title:'',researchQuestion:'',targetPopulation:'',feasibility:'',sourceIds:[]}];draft.candidates[0]!.title=(event.target as HTMLInputElement).value;send(draft)}
function delayOld(){const draft=sample(),context={...props.context};setTimeout(()=>send(draft,context),180)}
</script>
<style scoped>.stage-fixture{padding:18px;border:1px solid #d7b76d;background:#fff7e3;font-size:13px}.stage-fixture label{display:grid;gap:6px;margin:12px 0}.stage-fixture input,.stage-fixture textarea{font:inherit;padding:9px;border:1px solid #b9cabb}.stage-fixture button{padding:8px;margin:4px;font:inherit}</style>
