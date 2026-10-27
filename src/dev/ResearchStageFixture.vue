<template><div class="stage-fixture"><strong>合成事件样例 · 仅用于边界验证</strong><label>样例说明<textarea :value="phase===1?(draft as TopicAnalysisDraft).selectionReason:(draft as ResearchPlanDraft).otherNote" :readonly="readOnly" @input="updateText" /></label><button :disabled="readOnly" @click="send(sample())">填入合成草稿</button><button :disabled="readOnly" @click="emit('save-request',{context:{...context}})">请求正式保存（应提示未接入）</button><button @click="send(sample(),{localTaskId:'other-task',revision:context.revision})">发送其他任务事件</button><button @click="send(sample(),{...context,revision:context.revision-1})">发送旧修订事件</button><button @click="send({invalid:true})">发送格式错误事件</button><button @click="send(sample())">测试只读拦截</button><button @click="attemptDirectMutation">测试直接修改拦截</button></div></template>
<script setup lang="ts">
import type {DraftContext,TopicAnalysisDraft,ResearchPlanDraft,ContestActionRequest} from '../types/research-contracts'
import {emptyTopicAnalysisDraft,emptyResearchPlanDraft} from '../utils/researchDrafts'
const props=defineProps<{phase:1|2;context:DraftContext;draft:TopicAnalysisDraft|ResearchPlanDraft;readOnly:boolean}>()
const emit=defineEmits<{'update-draft':[value:{context:DraftContext;draft:any}];'save-request':[value:ContestActionRequest]}>()
function sample(){if(props.phase===1){const draft=emptyTopicAnalysisDraft();draft.directions=[{id:'synthetic-direction',title:'【合成】验证方向',question:'【合成】验证问题',population:'【合成】验证对象',value:'【合成】验证价值',requirementIds:[],verdict:'unknown',feasibilityNote:'尚未核对'}];draft.selectedDirectionId='synthetic-direction';draft.selectionReason='【合成】样例说明';return draft}const draft=emptyResearchPlanDraft();draft.otherNote='【合成】样例方案说明';return draft}
function send(draft:any,context={...props.context}){emit('update-draft',{context,draft})}
function updateText(event:Event){const text=(event.target as HTMLTextAreaElement).value;send({...props.draft,...(props.phase===1?{selectionReason:text}:{otherNote:text})})}
function attemptDirectMutation(){if(props.phase===1)(props.draft as TopicAnalysisDraft).selectionReason='不应写入';else (props.draft as ResearchPlanDraft).otherNote='不应写入'}
</script>
<style scoped>.stage-fixture{padding:18px;background:#fff7e3;border:1px solid #d7b76d;font-size:13px}label{display:grid;gap:8px;margin:12px 0}textarea,button{font:inherit;padding:8px}button{margin:4px}</style>
