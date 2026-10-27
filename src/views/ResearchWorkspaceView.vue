<template>
  <main v-if="task" class="research-workspace">
    <header class="workspace-nav">
      <RouterLink to="/" class="brand"><span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span><strong>市调演真</strong><small>市场调查研究工作台</small></span></RouterLink>
      <RouterLink to="/" class="home-link">← 返回研究入口</RouterLink>
      <span class="draft-hint">{{businessMock?'Mock 测试环境 · 合成响应':'本机草稿 · 正式服务待接入'}}</span>
    </header>

    <section class="workspace-heading" aria-label="当前研究任务">
      <span class="workflow-tag">{{ modeLabel }}</span><h1 :title="task.title || modeLabel">{{ task.title || modeLabel }}</h1>
      <span class="local-chip" :class="{unsaved:!task.savedAt}"><i aria-hidden="true"></i>{{ task.savedAt?'草稿已存本机':'有未保存的编辑' }}</span>
    </section>

    <nav class="stage-nav" aria-label="研究阶段">
      <button v-for="stage in stages" :key="stage.phase" :aria-current="task.viewedPhase===stage.phase?'step':undefined" :class="{selected:task.viewedPhase===stage.phase}" @click="viewStage(stage.phase)">
        <span class="stage-number">{{stage.phase+1}}</span><span class="stage-name">{{stage.title}}<small>{{stageAvailability(stage.phase)}}</small></span>
      </button>
    </nav>

    <div class="workflow-content">
      <aside class="task-sidebar" aria-label="本机研究任务">
        <div class="sidebar-heading"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1" /></svg><h2>研究任务</h2><span>{{ tasks.length }}</span></div>
        <button class="new-task" @click="newTask"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg>新建{{ modeLabel }}任务</button>
        <div class="task-list">
          <button v-for="item in tasks" :key="item.localTaskId" class="task-row" :class="{selected:item.localTaskId===task.localTaskId}" :data-task-id="item.localTaskId" :aria-current="item.localTaskId===task.localTaskId?'true':undefined" :aria-label="'继续任务：'+(item.title || modeLabel)" @click="continueTask(item.localTaskId)">
            <span class="task-dot" :class="{unsaved:!item.savedAt}" aria-hidden="true"></span><span class="task-main"><strong :title="item.title || modeLabel">{{item.title || modeLabel}}</strong><small>{{stages[item.viewedPhase]?.title}} · {{item.savedAt?'已存本机':'待保存'}}</small></span>
          </button>
        </div>
        <div class="entry-picker"><h3>研究入口</h3><div class="entry-tabs"><RouterLink :class="{active:kind==='full-study'}" to="/research/work?mode=full">完整研究</RouterLink><RouterLink :class="{active:kind==='questionnaire-review'}" to="/research/work?mode=questionnaire">已有问卷核对</RouterLink><RouterLink :class="{active:kind==='dataset-analysis'}" to="/research/work?mode=analysis">已有答卷／数据分析</RouterLink></div></div>
        <p class="sidebar-note">每项任务独立保留草稿，保存在当前浏览器。</p>
      </aside>

      <section :key="task.localTaskId+':'+task.viewedPhase" class="stage-content" aria-label="阶段填写区">
        <p class="stage-notice">正在查看：{{ currentStage?.title }}。{{kind==='full-study'?'填写和本机保存不代表正式采用或阶段确认。':'此入口独立保存，不补记未发生的前期研究。'}}</p>
        <template v-if="!businessBlocked && (!historyExpected || historyVersion)">
        <p v-if="historyExpected" class="stage-notice">历史只读 · 正在显示服务已采用的固定版本 {{historyVersion?.ref.versionId}}；本机草稿未替换。</p>
        <CompetitionUnderstandingHost v-if="kind==='full-study' && task.viewedPhase===0 && store.context" :key="task.localTaskId" :context="store.context" :draft="editorTask!.competition"  :read-only="formalReadOnly" @save-candidate="businessPanel?.saveCandidate()" @update-draft="store.updateCompetition" @save-local="store.save()" />
        <ResearchStageHost v-else-if="kind==='full-study' && task.viewedPhase===1 && store.context" :key="task.localTaskId + ':topic'" :phase="1" :context="store.context" :draft="editorTask!.topicAnalysis" :competition="task.competition"  :read-only="formalReadOnly" @save-candidate="businessPanel?.saveCandidate()" @update-draft="store.updateStage" @save-local="store.save()" />
        <ResearchStageHost v-else-if="kind==='full-study' && task.viewedPhase===2 && store.context" :key="task.localTaskId + ':plan'" :phase="2" :context="store.context" :draft="editorTask!.researchPlan" :competition="task.competition" :topic-analysis="task.topicAnalysis"  :read-only="formalReadOnly" @save-candidate="businessPanel?.saveCandidate()" @update-draft="store.updateStage" @save-local="store.save()" />
        <ResearchQuestionnaireHost v-else-if="store.context && ((kind==='full-study' && task.viewedPhase===3)||(kind==='questionnaire-review' && task.viewedPhase===0))" :key="task.localTaskId+':questionnaire'" :context="store.context" :draft="editorTask!.questionnaire" :plan="kind==='full-study'?task.researchPlan:null" :independent="kind==='questionnaire-review'"  :read-only="formalReadOnly" @save-candidate="businessPanel?.saveCandidate()" @update-draft="store.updateQuestionnaire" @save-local="store.save()" />
        <ResearchSandboxView v-else-if="kind==='dataset-analysis' && task.viewedPhase===0" :key="task.localTaskId" :task-id="task.localTaskId" :task-title="task.title" :initial-sandbox-ref="task.sandboxRef" :persist-sandbox-reference="store.recordSandboxReference" :persist-input-file="store.recordInputFile" @update:task-title="updateTitle" @update:input-file="updateInputFile" @update:sandbox-ref="updateSandboxRef" />
        <div v-else class="stage-pending"><h2>{{currentStage?.title}}</h2><p>{{ stageDescription }}</p><p>业务功能待接入；没有将此任务标为完成，也没有调用旧数模智能体。</p><button v-if="task.viewedPhase>0" @click="viewStage(0)">返回{{stages[0]?.title}}</button></div>
        </template>
        <p v-else role="status" class="stage-notice">项目权限或已采用的固定历史版本尚未读取成功；请查看右侧提示并重新读取项目。本机草稿保留，不用它替代已采用的历史版本。</p>
      </section>

      <aside class="context" aria-label="任务与保存反馈">
        <h2>任务与草稿</h2>
        <label class="task-title-field">研究任务名称<input :disabled="formalReadOnly" :value="task.title" maxlength="120" @input="updateTitle(($event.target as HTMLInputElement).value)" @change="store.save()" /></label>
        <section class="save-state" :class="{error:store.storageError,unsaved:!task.savedAt}"><h3>{{store.storageError?'本机保存未成功':task.savedAt?'本机草稿已保存':'编辑尚未保存'}}</h3><p v-if="store.storageError" role="alert" class="storage-error">{{ store.storageError }}</p><p v-else role="status" class="save-feedback">{{ store.feedback }}</p></section>
        <BusinessProjectPanel ref="businessPanel" :task="task" @read-only="formalReadOnly=$event" @binding-blocked="businessBlocked=$event" @project-state="businessProject=$event" @history-version="historyVersion=$event" @restore-version="restoreVersion" />
        <dl class="task-facts"><div><dt>研究类型</dt><dd>{{ modeLabel }}</dd></div><div><dt>正在查看</dt><dd>{{ currentStage?.title }}</dd></div><div><dt>正式成果</dt><dd>{{businessProject?'Mock 候选 '+businessProject.candidates.length+' 个；非正式交付':'尚无正式候选'}}</dd></div></dl>
        <section class="stage-guide"><h3>本阶段填写</h3><p>{{ stageDescription }}</p></section>
        <section class="service-scope"><h3>保存范围</h3><p><span>浏览器本机草稿</span><strong>可用</strong></p><p><span>服务器正式保存</span><small>待接入</small></p><p><span>正式阶段确认</span><small>待接入</small></p></section>
        <details class="task-details"><summary>任务信息</summary><p>本机编号：{{task.localTaskId}}</p><p>正式项目尚未建立，待服务端接入。</p></details>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute,useRouter } from 'vue-router'
import ResearchSandboxView from '@/views/ResearchSandboxView.vue'
import CompetitionUnderstandingHost from '@/views/research/CompetitionUnderstandingHost.vue'
import ResearchStageHost from '@/views/research/ResearchStageHost.vue'
import ResearchQuestionnaireHost from '@/views/research/ResearchQuestionnaireHost.vue'
import BusinessProjectPanel from '@/views/research/BusinessProjectPanel.vue'
import type {BusinessProject,FixedCandidate} from '@/types/research-business'
import {cleanPhaseContent} from '@/api/researchBusiness'
import { useResearchStore } from '@/stores/research'
import { kindToMode,modeToKind,stagesFor,workflowLabel } from '@/utils/researchDrafts'
import type {SelectedInputMetadata,SandboxReference} from '@/types/research-contracts'
const businessBlocked=ref(false),businessProject=ref<BusinessProject|null>(null),historyVersion=ref<FixedCandidate|null>(null)
const businessPanel=ref<InstanceType<typeof BusinessProjectPanel>|null>(null),formalReadOnly=ref(false),businessMock=import.meta.env.VITE_RESEARCH_BUSINESS_MODE==='mock'
const route=useRoute(),router=useRouter(),store=useResearchStore()
const kind=computed(()=>modeToKind(route.query.mode)),task=computed(()=>store.draft),modeLabel=computed(()=>workflowLabel(kind.value))
const historyExpected=computed(()=>!!task.value && !!businessProject.value?.lockedPhases.includes(task.value.viewedPhase))
const editorTask=computed(()=>{const current=task.value,version=historyVersion.value;if(!current||!version||!historyExpected.value||version.phase!==current.viewedPhase)return current;const content=cleanPhaseContent(current.workflowKind,version.phase,version.content);if(!content)return current;const field=current.workflowKind==='questionnaire-review'?'questionnaire':version.phase===0?'competition':version.phase===1?'topicAnalysis':version.phase===2?'researchPlan':'questionnaire';return {...current,[field]:content}})
const tasks=computed(()=>Object.values(store.registry.tasks).filter(t=>t.workflowKind===kind.value).sort((a,b)=>b.updatedAt-a.updatedAt))
const stages=computed(()=>stagesFor(kind.value)),currentStage=computed(()=>stages.value[task.value?.viewedPhase??0])
watch(()=>[kind.value,route.query.task],()=>{store.open(kind.value,typeof route.query.task==='string'?route.query.task:undefined)},{immediate:true})
function restoreVersion(version:FixedCandidate){const current=task.value;if(!current||formalReadOnly.value||version.phase!==current.viewedPhase)return;const content=cleanPhaseContent(current.workflowKind,version.phase,version.content);if(!content)return;if(current.workflowKind==='questionnaire-review')store.update({questionnaire:content as typeof current.questionnaire});else if(version.phase===0)store.update({competition:content as typeof current.competition});else if(version.phase===1)store.update({topicAnalysis:content as typeof current.topicAnalysis});else if(version.phase===2)store.update({researchPlan:content as typeof current.researchPlan});else if(version.phase===3)store.update({questionnaire:content as typeof current.questionnaire})}
function newTask(){const next=store.create(kind.value);void router.push({path:'/research/work',query:{mode:kindToMode(kind.value),task:next.localTaskId}})}
function continueTask(localTaskId:string){void router.push({path:'/research/work',query:{mode:kindToMode(kind.value),task:localTaskId}})}
function updateTitle(title:string){if(!formalReadOnly.value)store.update({title})}
function updateInputFile(inputFile:SelectedInputMetadata|null){store.update({inputFile});store.save()}
function updateSandboxRef(sandboxRef:SandboxReference){if(task.value?.sandboxRef?.workspaceId===sandboxRef.workspaceId&&task.value?.sandboxRef?.runId===sandboxRef.runId)return;store.update({sandboxRef});store.save()}
function viewStage(viewedPhase:number){store.update({viewedPhase});store.save()}
function stageAvailability(phase:number){
 if(businessProject.value?.lockedPhases.includes(phase))return '历史只读'
 if(kind.value==='full-study')return phase<=3?'本机编辑':phase===4?'待采集服务':phase===5?'分析待接入本流程':'待接入'
 return kind.value==='questionnaire-review'?'本机编辑':phase===0?'本机分析':'待接入'
}
const descriptions:Record<string,string>={'赛事理解':'整理背景、届次与组别，记录适用要求、可定位来源和仍需核对的未知项。','选题分析':'比较候选方向、明确研究问题与对象，检查研究可行性。','研究方案':'确定抽样、招募、测量、证据需求与分析计划。','问卷设计与预测试':'编辑与核对题项，记录真实试填反馈，形成经确认的正式版本。','正式调查':'计划支持平台内匿名发布、手机填写、回收和停止收集；预测试与正式答卷分开。','数据分析':'接入固定调查数据，核查字段与质量，记录处理、统计与结果采用。','报告与答辩':'使用固定且已采用的结果版本，整理报告、附录、来源与交付材料。','问卷核对':'直接核对已有问卷，不补记未发生的赛事理解、选题和研究方案。'}
const stageDescription=computed(()=>descriptions[currentStage.value?.title||'']||'该阶段的业务组件与正式接口待交付。')
</script>
<style scoped lang="scss" src="../styles/research-workspace.scss"></style>
