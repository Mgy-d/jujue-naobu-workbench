<template><main><RouterLink to="/research/work?mode=full">返回业务工作台</RouterLink><h1>赛事理解接线验证 · 仅开发环境</h1><p>用于检查组件接线与错误、只读状态；?editor=delivered 使用交付组件，默认使用合成事件组件。样例不读取或覆盖业务草稿，不代表真实后端通过。</p><label><input v-model="readOnly" type="checkbox" />只读样例</label><button @click="failStorage=!failStorage">切换本机保存失败：{{failStorage?'是':'否'}}</button><CompetitionUnderstandingHost :context="context" :draft="task.competition" :read-only="readOnly" :editor-component="sampleEditor" @update-draft="update" @save-local="save" /><p role="status">{{ feedback }}</p></main></template>
<script setup lang="ts">
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import CompetitionUnderstandingHost from '../views/research/CompetitionUnderstandingHost.vue'
import ContestEditorFixture from './ContestEditorFixture.vue'
import {createLocalTask,editLocalTask,emptyTaskRegistry,matchesDraftContext,saveLocalTask} from '../utils/researchDrafts'
import type {ContestDraftUpdate} from '../types/research-contracts'
const route=useRoute()
const sampleEditor=computed(()=>route.query.editor==='delivered'?undefined:ContestEditorFixture)
const task=ref(createLocalTask('full-study','dev-fixture-only')),readOnly=ref(false),failStorage=ref(false),feedback=ref('样例仅保留在当前页内存。')
const context=computed(()=>({localTaskId:task.value.localTaskId,revision:task.value.revision}))
function update(event:ContestDraftUpdate){if(readOnly.value)return;if(!matchesDraftContext(task.value,event.context)){feedback.value='已拒绝其他任务或旧修订事件。';return}task.value=editLocalTask(task.value,{competition:event.draft});feedback.value='合成草稿已更新，尚未正式保存。'}
function save(){try{saveLocalTask({getItem:()=>null,setItem:()=>{if(failStorage.value)throw Error('simulated quota')}},emptyTaskRegistry(),task.value);feedback.value='样例内存保存通过；没有写入业务草稿或正式后端。'}catch{feedback.value='模拟本机保存失败，草稿仍保留在当前页。'}}
</script>
<style scoped>main{max-width:1050px;margin:30px auto;padding:24px;color:#183a34;background:white}h1{font-size:23px}p,label,button{font-size:13px}button{padding:9px;margin:10px}</style>
