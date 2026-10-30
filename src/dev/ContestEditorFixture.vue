<template><div class="fixture-editor"><strong>合成组件联调样例，不是正式赛事编辑器</strong><label>样例背景<textarea :value="draft.background" :readonly="readOnly" @input="changeBackground" /></label><button :disabled="readOnly" @click="emit('update-draft',{context:{...context},draft:syntheticContestDraft()})">填入合成样例</button><button @click="emit('save-request',{context:{...context}})">请求正式保存（应提示未接入）</button><button @click="emit('update-draft',{context:{localTaskId:'other-task',revision:context.revision},draft:syntheticContestDraft()})">发送其他任务事件</button></div></template>
<script setup lang="ts">
import type {ContestEditorProps,ContestDraftUpdate,ContestActionRequest} from '../types/research-contracts'
import {syntheticContestDraft} from '../utils/researchDrafts'
const props=defineProps<ContestEditorProps>()
const emit=defineEmits<{'update-draft':[value:ContestDraftUpdate];'save-request':[value:ContestActionRequest]}>()
function changeBackground(event:Event){emit('update-draft',{context:{...props.context},draft:{...props.draft,background:(event.target as HTMLTextAreaElement).value}})}
</script>
<style scoped>.fixture-editor{padding:18px;background:#fff6df;border:1px solid #dabf7f;font-size:13px}.fixture-editor label{display:grid;gap:8px;margin:12px 0}.fixture-editor textarea{font:inherit;min-height:75px;padding:9px}.fixture-editor button{margin:4px;padding:8px;cursor:pointer}</style>
