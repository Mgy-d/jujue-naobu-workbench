<template>
<section class="agent-questionnaire" aria-label="智能体问卷预览">
  <p class="source">当前研究会话文件 · {{model?.version || '读取格式中'}} · 待人工核对</p>
  <small>{{path}}</small>
  <p v-if="error" role="alert">{{error}}</p>
  <template v-if="model">
    <h3>{{model.title}}</h3>
    <p>共 {{model.questions.length+model.unsupported.length}} 题</p>
    <div class="actions"><button type="button" @click="mode='read'">查看问卷</button><button type="button" :disabled="!model.canFill" @click="mode='fill'">试填预览</button><button type="button" @click="mode='raw'">文件原文</button></div>
    <div class="publish-panel">
      <button type="button" :disabled="!model.canFill || publishing" @click="publishOpen=!publishOpen">发布问卷</button>
      <RouterLink to="/research/surveys">问卷与答卷管理 →</RouterLink>
      <form v-if="publishOpen" @submit.prevent="publish">
        <label>收集批次 <select v-model="batchKind" :disabled="publishing"><option value="synthetic">合成验收</option><option value="real">真实回收</option></select></label>
        <label>批次名称 <input v-model="batchName" required maxlength="200" :disabled="publishing" /></label>
        <label>卷首用途与知情说明 <textarea v-model="notice" required maxlength="2000" :disabled="publishing" /></label>
        <p>发布将固定当前文件版本。后续修改应另行发布。</p>
        <button type="submit" :disabled="publishing">{{publishing?'正在发布…':'确认发布固定版本'}}</button>
      </form>
      <p v-if="publishError" role="alert">{{publishError}}</p>
      <p v-if="published">已发布 · {{published.version}} · {{published.batchName}}<br /><a :href="fillLink" target="_blank" rel="noopener">打开填写页面</a></p>
    </div>
    <p v-for="note in model.notes" :key="note" class="notice">{{note}}</p>
    <p v-if="!model.canFill" class="notice">此问卷包含暂不支持的题型或跳转，完整试填暂不可用。</p>
    <QuestionnaireFillPreview v-if="mode==='fill' && model.canFill" :key="threadId+path+content" :questions="model.questions" :task-id="threadId+path" />
    <template v-else-if="mode==='read'">
      <article v-for="id in model.questionIds" :key="id">
        <template v-if="model.questions.some(q=>q.id===id)">
          <template v-for="q in model.questions.filter(q=>q.id===id)" :key="q.id"><h4>{{q.id}} {{q.text}} <span v-if="q.required">（必填）</span></h4><ul v-if="q.options.length"><li v-for="option in q.options" :key="option.id">{{option.label}}</li></ul><p v-else>{{q.type==='number'?'数值填写':'开放文本填写'}}</p><details v-if="q.codingNote" class="research-note"><summary>研究与编码说明</summary><p>{{q.codingNote}}</p></details></template>
        </template>
        <template v-for="q in model.unsupported.filter(q=>q.id===id)" :key="q.id"><h4>{{q.id}} {{q.text}}</h4><p class="notice">题型 {{q.type}} 暂不支持展示，请查看文件原文。</p></template>
      </article>
    </template>
  </template>
  <button v-if="error" type="button" @click="mode='raw'">查看文件原文</button>
  <pre v-if="mode==='raw'">{{content}}</pre>
</section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {collectionApi,type CollectionSurvey} from '@/api/researchCollection'
import {useRouter} from 'vue-router'
import QuestionnaireFillPreview from './QuestionnaireFillPreview.vue'
import {readAgentQuestionnaire} from '@/utils/researchAgentQuestionnaire'
const props=defineProps<{content:string;projectId:string;threadId:string;path:string;taskId?:string}>()
const mode=ref('read'),router=useRouter()
const publishOpen=ref(false),publishing=ref(false),publishError=ref(''),batchKind=ref<'synthetic'|'real'>('synthetic'),batchName=ref('合成验收批次'),notice=ref('本批次用于合成软件验收。请使用虚构资料填写，答卷仅用于验证发布、收集和读取流程。')
const batchDefaults={
  synthetic:{name:'合成验收批次',notice:'本批次用于合成软件验收。请使用虚构资料填写，答卷仅用于验证发布、收集和读取流程。'},
  real:{name:'真实回收批次',notice:'本问卷匿名填写。请发布者在此补充研究用途、参与条件、数据使用范围及联系方式。'},
}
watch(batchKind,(kind,previous)=>{
  if(batchName.value===batchDefaults[previous].name)batchName.value=batchDefaults[kind].name
  if(notice.value===batchDefaults[previous].notice)notice.value=batchDefaults[kind].notice
})
const published=ref<CollectionSurvey|null>(null)
const fillLink=computed(()=>published.value?location.origin+router.resolve('/survey/'+published.value.code).href:'')
let publishCode='',publishSignature='',publishEpoch=0
async function publish(){
  if(publishing.value || !model.value?.canFill)return
  if(batchKind.value==='real' && notice.value===batchDefaults.real.notice){publishError.value='请先填写本次真实调查的用途和知情说明。';return}
  const epoch=publishEpoch
  const payload={title:model.value.title,version:model.value.version,schema:JSON.parse(props.content),projectId:props.projectId,batchKind:batchKind.value,batchName:batchName.value.trim(),notice:notice.value.trim(),sourceThreadId:props.threadId,sourcePath:props.path,sourceTaskId:props.taskId,requireInvite:false}
  const signature=JSON.stringify(payload)
  if(signature!==publishSignature){publishCode='survey-'+crypto.randomUUID();publishSignature=signature}
  publishing.value=true;publishError.value=''
  try{
    const result=await collectionApi.publish({...payload,code:publishCode})
    if(epoch!==publishEpoch)return
    if(result.projectId!==props.projectId || result.code!==publishCode || result.version!==model.value.version)throw Error('发布结果与当前问卷身份不一致。')
    published.value=result;publishOpen.value=false
  }catch(error){if(epoch===publishEpoch)publishError.value=error instanceof Error?error.message:'发布失败，请核对管理列表后重试。'}
  finally{if(epoch===publishEpoch)publishing.value=false}
}
const parsed=computed(()=>{try{return {model:readAgentQuestionnaire(props.content,props.projectId),error:''}}catch(error){return {model:null,error:error instanceof Error?error.message:'问卷解析失败。'}}})
const model=computed(()=>parsed.value.model),error=computed(()=>parsed.value.error)
watch(()=>[props.projectId,props.threadId,props.path,props.content],()=>{mode.value='read';publishEpoch++;published.value=null;publishOpen.value=false;publishError.value='';publishing.value=false;publishCode='';publishSignature=''})
</script>
<style scoped>
.research-note{margin-top:10px;font-size:12px;color:var(--ink3)}.research-note summary{cursor:pointer;color:var(--ink2)}.research-note p{margin:8px 0;white-space:pre-wrap}
.agent-questionnaire{min-width:0;overflow-wrap:anywhere;color:var(--ink2)}
h3,h4{color:var(--ink)}article{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:12px;background:white}h4{margin:0 0 12px}li{margin:8px 0}small,.source{font-size:12px;color:var(--ink3)}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{font:inherit;color:var(--teal,#098b87);background:white;border:1px solid var(--line);border-radius:9px;padding:8px 12px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.notice,[role=alert]{color:#996215}pre{white-space:pre-wrap;overflow-wrap:anywhere}.agent-questionnaire :deep(button){border-radius:9px}
.publish-panel{margin:12px 0}.publish-panel a{margin-left:12px;color:var(--teal,#098b87)}.publish-panel form{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff}.publish-panel label{display:block;margin:10px 0}.publish-panel input,.publish-panel textarea,.publish-panel select{display:block;box-sizing:border-box;width:100%;max-width:100%;margin-top:5px;padding:8px;border:1px solid var(--line);border-radius:8px;font:inherit}.publish-panel textarea{min-height:84px}
</style>
