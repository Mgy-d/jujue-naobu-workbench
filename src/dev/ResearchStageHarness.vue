<template><main v-if="store.draft && store.context"><RouterLink to="/research/work?mode=full">返回实际工作台</RouterLink><h1>选题与方案接线验证 · 仅开发环境</h1><p>合成组件，不代表正式编辑器或后端通过；此页面使用本机任务存储，请只在测试浏览器中使用。</p><label>样例任务名称<input :value="store.draft.title" @input="store.update({title:($event.target as HTMLInputElement).value})" @change="store.save()" /></label><label>切换样例任务<select :value="store.draft.localTaskId" @change="store.open('full-study',($event.target as HTMLSelectElement).value)"><option v-for="task in tasks" :key="task.localTaskId" :value="task.localTaskId">{{task.title}}</option></select></label><button @click="store.create('full-study')">新建样例任务</button><label><input v-model="readOnly" type="checkbox" />只读样例</label><nav><button @click="view(0)">赛事理解</button><button @click="view(1)">选题分析</button><button @click="view(2)">研究方案</button><button @click="view(3)">问卷设计与预测试</button></nav><p v-if="store.storageError" role="alert">{{store.storageError}}</p><p v-else role="status">{{store.feedback}}</p><CompetitionUnderstandingHost v-if="store.draft.viewedPhase===0" :key="store.draft.localTaskId" :context="store.context" :draft="store.draft.competition" :read-only="readOnly" @update-draft="store.updateCompetition" @save-local="store.save()" /><ResearchStageHost v-else-if="store.draft.viewedPhase===1 || store.draft.viewedPhase===2" :key="store.draft.localTaskId+':'+store.draft.viewedPhase" :phase="store.draft.viewedPhase" :context="store.context" :draft="store.draft.viewedPhase===1?store.draft.topicAnalysis:store.draft.researchPlan" :competition="store.draft.competition" :topic-analysis="store.draft.topicAnalysis" :read-only="readOnly" :editor-component="sampleEditor" @update-draft="store.updateStage" @save-local="store.save()" /><ResearchQuestionnaireHost v-else-if="store.draft.viewedPhase===3" :key="store.draft.localTaskId+':questionnaire'" :context="store.context" :draft="store.draft.questionnaire" :plan="store.draft.researchPlan" :read-only="readOnly" @update-draft="store.updateQuestionnaire" @save-local="store.save()" /></main></template>
<script setup lang="ts">
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import {useResearchStore} from '../stores/research'
import CompetitionUnderstandingHost from '../views/research/CompetitionUnderstandingHost.vue'
import ResearchQuestionnaireHost from '../views/research/ResearchQuestionnaireHost.vue'
import ResearchStageHost from '../views/research/ResearchStageHost.vue'
import ResearchStageFixture from './ResearchStageFixture.vue'
const route=useRoute(),store=useResearchStore(),readOnly=ref(false)
const sampleEditor=computed(()=>route.query.editor==='delivered'?undefined:ResearchStageFixture)
store.open('full-study')
const tasks=computed(()=>Object.values(store.registry.tasks).filter(t=>t.workflowKind==='full-study'))
function view(viewedPhase:number){store.update({viewedPhase});store.save()}
</script>
<style scoped>main{max-width:1050px;margin:30px auto;padding:24px;background:white;color:#183a34}h1{font-size:23px}main>p{font-size:13px}main>label{display:block;margin:12px 0}input,select,button{font:inherit;font-size:13px;padding:7px;margin:5px}nav{display:flex;gap:10px}</style>
