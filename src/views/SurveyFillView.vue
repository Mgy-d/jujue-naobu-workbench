<template>
<main class="survey-fill"><section class="survey-card">
  <p class="brand">市调演真 · 问卷填写</p>
  <p v-if="loading" role="status">正在读取问卷…</p><p v-if="error" role="alert">{{error}}</p>
  <template v-if="survey && model && !receipt">
    <h1>{{survey.title}}</h1><p>{{survey.notice}}</p><p class="note">{{survey.version}} · 同一浏览器在本批次内限提交一份</p>
    <label class="consent"><input type="checkbox" v-model="consent" :disabled="busy" />我已阅读问卷用途说明，自愿填写并同意提交答卷。</label>
    <QuestionnaireFillPreview v-if="model.canFill" :questions="model.questions" :task-id="code" collecting :disabled="busy || !!pendingBody" @submit="submit" />
    <p v-else role="alert">本问卷存在当前填写页暂不支持的题型，请联系发布者。</p>
    <button v-if="pendingBody && !busy" type="button" @click="submit({})">重试本次提交</button>
    <p v-if="busy" role="status">正在提交，请稍候…</p>
  </template>
  <div v-if="receipt" role="status"><h1>提交成功</h1><p>感谢参与，答卷已保存。</p><small>回执 {{receipt}}</small></div>
</section></main>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {collectionApi,CollectionError} from '@/api/researchCollection'
import {readAgentQuestionnaire,type AgentQuestionnaire} from '@/utils/researchAgentQuestionnaire'
import QuestionnaireFillPreview from './research/QuestionnaireFillPreview.vue'
const route=useRoute(),code=computed(()=>String(route.params.code||''))
const survey=ref<Awaited<ReturnType<typeof collectionApi.publicSurvey>>|null>(null),model=ref<AgentQuestionnaire|null>(null)
const loading=ref(false),busy=ref(false),error=ref(''),receipt=ref(''),consent=ref(false)
let generation=0,controller:AbortController|undefined,started=Date.now(),submissionId='',deviceId=''
const pendingBody=ref<unknown>(null)
watch(code,async value=>{
  const epoch=++generation;controller?.abort();controller=new AbortController()
  loading.value=true;busy.value=false;survey.value=null;model.value=null;error.value='';receipt.value='';consent.value=false;pendingBody.value=null
  try{
    const deviceKey='shidiaoyanzhen.respondent.v1'
    deviceId=localStorage.getItem(deviceKey)||crypto.randomUUID();localStorage.setItem(deviceKey,deviceId)
    const key='shidiaoyanzhen.submission.v1:'+value
    const existing=localStorage.getItem(key)
    submissionId=existing||crypto.randomUUID();localStorage.setItem(key,submissionId)
    if(existing){
      const saved=await collectionApi.receipt(value,deviceId,submissionId,controller.signal)
      if(epoch!==generation)return
      if(saved.ok && saved.responseId){receipt.value=saved.responseId;return}
    }
    const data=await collectionApi.publicSurvey(value,controller.signal)
    if(epoch!==generation)return
    if(data.code!==value)throw Error('填写链接与返回问卷不一致。')
    survey.value=data
    model.value=readAgentQuestionnaire(JSON.stringify({schema:'sz-questionnaire/v1',projectId:'public',title:data.title,version:data.version,questions:data.questions}),'public')
    started=Date.now()
  }catch(e){if(epoch===generation && e instanceof CollectionError && e.status>=400 && e.status<500 && e.status!==408)pendingBody.value=null;if(epoch===generation)error.value=e instanceof Error?e.message:'问卷读取失败。'}
  finally{if(epoch===generation)loading.value=false}
},{immediate:true})
async function submit(answers:Record<string,string|string[]>){
  if(busy.value||!survey.value)return
  if(!consent.value){error.value='请先阅读并勾选知情同意。';return}
  const epoch=generation
  busy.value=true;error.value=''
  // Retry the exact payload with the same idempotency ID after an unknown network outcome.
  pendingBody.value ??={consent:true,adultConfirmed:false,durationMs:Date.now()-started,deviceId,submissionId,pretest:false,answers,hp:''}
  try{const result=await collectionApi.submit(code.value,pendingBody.value,controller?.signal);if(epoch!==generation)return;if(!result.ok||!result.responseId)throw Error('未取得有效提交回执。');receipt.value=result.responseId}
  catch(e){if(epoch===generation && e instanceof CollectionError && e.status>=400 && e.status<500 && e.status!==408)pendingBody.value=null;if(epoch===generation)error.value=(e instanceof Error?e.message:'提交结果未知。')+' 输入已保留，重试将核对同一次提交。'}
  finally{if(epoch===generation)busy.value=false}
}
onBeforeUnmount(()=>{generation++;controller?.abort()})
</script>
<style scoped>
.survey-fill{min-height:100dvh;background:#f2faf9;color:#0b2e36;padding:32px 20px;box-sizing:border-box;font:14px/1.8 system-ui,sans-serif}.survey-card{max-width:860px;margin:auto;background:white;border:1px solid #b8d8d2;border-radius:18px;padding:28px}.brand{color:#0b7c73;font-weight:700}h1{font-size:25px}.note,small{color:#65848b}.consent{display:flex;align-items:baseline;gap:8px;margin:20px 0}p[role=alert]{color:#a44727}.survey-card :deep(fieldset){border-radius:12px;border-color:#c8dfda}.survey-card :deep(button){border:1px solid #a6cec6;border-radius:9px;background:#eefaf7;color:#0b6e68;cursor:pointer}
</style>
