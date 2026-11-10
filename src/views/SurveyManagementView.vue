<template>
  <main class="collection-page">
    <header class="site-header">
      <RouterLink to="/" class="brand">市调演真</RouterLink>
      <nav aria-label="主导航"><RouterLink to="/">首页</RouterLink><RouterLink to="/mine">我的成果</RouterLink><strong aria-current="page">问卷管理</strong></nav>
    </header>
    <section class="panel introduction">
      <div class="section-heading"><div><span class="eyebrow">问卷与答卷</span><h1>让每份回答，看得清楚</h1><p>查看固定版本的问卷、回收情况与具体答卷。</p></div><button :disabled="busy" @click="load">↻ 刷新数据</button></div>
      <p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p>
      <label class="survey-select">问卷版本与收集批次<select v-model="selectedId" :disabled="busy && !reading"><option value="">请选择问卷与批次</option><option v-for="s in surveys" :key="s.id" :value="s.id">{{s.title}} · {{s.version}} · {{s.batchName}} · {{s.batchKind==='synthetic'?'合成验收':'真实回收'}}</option></select></label>
      <p v-if="!busy && !error && !surveys.length" class="empty">当前账号下暂无已发布问卷。发布后可在这里查看回收情况。</p>
    </section>
    <template v-if="selected">
      <section class="panel survey-summary">
        <div class="section-heading"><div><div class="badges"><span :class="['badge',selected.batchKind]">{{selected.batchKind==='synthetic'?'合成测试资料':'真实回收'}}</span><span class="badge">{{selected.version}}</span><span class="badge">{{selected.batchName}}</span></div><h2>{{selected.title}}</h2></div><span class="status-pill">{{selected.status==='open'?'● 收集中':'收集已关闭'}}</span></div>
        <div class="actions"><button :disabled="!definition || busy" @click="questionDialog?.showModal()">查看完整问卷</button><a class="button" :href="fillLink" target="_blank" rel="noopener">打开填写链接 ↗</a><button :disabled="busy" @click="copyLink">复制链接</button><button :disabled="busy || selected.status!=='open'" @click="closeBatch">关闭收集</button><button :disabled="busy" @click="exportCsv">导出答卷 CSV</button></div>
        <label class="link-label">填写链接<input :value="fillLink" readonly /></label>
      </section>
      <div class="metrics" aria-label="回收概览">
        <article class="metric mint"><span>本批累计答卷</span><strong>{{stats ? stats.total : '—'}}<small>份</small></strong><p>当前版本 · 当前批次</p></article>
        <article class="metric aqua"><span>今日新增</span><strong>{{stats ? stats.today : '—'}}<small>份</small></strong><p>按采集服务日期统计</p></article>
        <article class="metric"><span>问卷题目</span><strong>{{definition ? definition.questions.length : '—'}}<small>题</small></strong><p>发布时固定的题面</p></article>
        <article class="metric"><span>最近读取</span><strong class="read-time">{{lastRead || '—'}}</strong><p>{{reading?'正在更新…':'手动刷新获取最新数据'}}</p></article>
      </div>
      <section class="panel">
        <div class="section-heading"><div><h2>数据概览</h2><p>当前版本、当前批次的全部答卷，含预测试 {{stats?.pretest ?? '—'}} 份。下方时间筛选仅作用于答卷明细。</p></div></div>
        <p v-if="statsError" role="alert">{{statsError}}</p><p v-else-if="reading && !stats" class="empty" role="status">正在读取数据概览…</p>
        <template v-if="stats">
          <div class="chart-heading"><h3>回收趋势</h3><span>最近 14 天 · 每日提交份数</span></div>
          <p v-if="!trend.some(day=>day.count>0)" class="empty">最近 14 天暂无答卷提交。</p>
          <div v-else class="trend-chart">
            <svg viewBox="0 0 720 160" role="img" aria-label="最近14天每日回收数量折线图"><path d="M24 20H696 M24 75H696 M24 130H696" class="chart-grid"/><polyline :points="trendPoints" class="trend-line"/><g v-for="(day,i) in trend" :key="day.day"><circle :cx="trendX(i)" :cy="trendY(day.count)" r="4"><title>{{day.day}}：{{day.count}} 份</title></circle><text :x="trendX(i)" :y="trendY(day.count)-10" text-anchor="middle">{{day.count}}</text></g></svg>
            <div class="trend-dates"><span>{{trend[0]?.day}}</span><span>{{trend.at(-1)?.day}}</span></div>
          </div>
          <details class="trend-table"><summary>查看每日数量明细</summary><table><thead><tr><th>日期</th><th>提交份数</th></tr></thead><tbody><tr v-for="day in trend" :key="day.day"><td>{{day.day}}</td><td>{{day.count}}</td></tr></tbody></table></details>
          <div class="chart-heading"><h3>题目分布</h3><label>选择题目<select v-model="questionId"><option v-for="q in stats.questions" :key="q.qid" :value="q.qid">{{q.qid}} · {{q.text}}</option></select></label></div>
          <article v-if="activeQuestion" class="question-chart">
            <h3>{{activeQuestion.qid}} · {{activeQuestion.text}}</h3><p>已作答 {{activeQuestion.answered}} 人 · 未作答 {{activeQuestion.missing}} 人</p>
            <template v-if="activeQuestion.counts.length">
              <div v-for="option in activeQuestion.counts" :key="option.code" class="bar-row"><div class="bar-label"><span>{{option.label}}</span><strong>{{option.count}} 人 · {{percentage(option.count,activeQuestion.answered)}}%</strong></div><div class="bar-track"><div :style="{width:percentage(option.count,activeQuestion.answered)+'%'}"></div></div></div>
              <p class="chart-note">比例以本题已作答人数为分母。{{activeQuestion.type==='multi'?'多选题每个选项分别计数，比例合计可能超过 100%。':''}}</p>
            </template>
            <p v-else class="empty">开放题请在下方“答卷明细”中逐份查看填写原文。</p>
          </article>
          <p v-else class="empty">暂无可展示的题目分布。</p>
        </template>
      </section>
      <section class="panel">
        <div class="section-heading"><div><h2>答卷明细</h2><p>按提交时间查找，打开答卷查看完整填写内容。</p></div></div>
        <div class="filters"><label>开始时间<input v-model="from" type="datetime-local" :disabled="busy" /></label><label>结束时间<input v-model="until" type="datetime-local" :disabled="busy" /></label><button :disabled="busy" @click="page=1;readResponses()">筛选答卷</button><button :disabled="busy" @click="from='';until='';page=1;readResponses()">清除筛选</button></div>
        <p v-if="rowsError" role="alert">{{rowsError}}</p><p v-if="definitionError" role="alert">{{definitionError}}</p>
        <p v-if="reading" role="status">正在读取答卷…</p>
        <template v-else-if="!rowsError">
          <p class="list-caption">{{from || until?'所选时间范围':'本批全部答卷'}} · {{total}} 份</p>
          <div v-if="responses.length" class="table-wrap"><table><thead><tr><th>提交时间</th><th>答卷编号</th><th>核对标记</th><th>操作</th></tr></thead><tbody><tr v-for="row in responses" :key="row.id"><td>{{formatTime(row.submittedAt)}}</td><td :title="row.id">{{row.id.slice(0,8)}}</td><td>{{row.flags?.length?'待核对 '+row.flags.join('、'):'—'}}</td><td><button :disabled="!definition" @click="openAnswer(row)">查看答卷 →</button></td></tr></tbody></table></div>
          <p v-else class="empty">{{from || until?'这个时间范围内没有答卷。':'本批次尚未收到答卷。'}}</p>
          <div v-if="totalPages>0" class="pagination"><span>第 {{page}} / {{totalPages}} 页</span><button :disabled="busy || page<=1" @click="page--;readResponses()">上一页</button><button :disabled="busy || page>=totalPages" @click="page++;readResponses()">下一页</button></div>
        </template>
      </section>
      <section class="panel analysis-panel">
        <h2>将本批数据用于分析</h2><p>确认当前版本、当前批次截至快照生成时的全部答卷数量，固定本次采用的数据。</p>
        <p v-if="snapshotError" role="alert">{{snapshotError}}</p>
        <button :disabled="busy || !selected.responseCount" @click="previewSnapshot">预览全部答卷范围</button>
        <div v-if="candidate" class="snapshot-candidate"><p>待确认 · {{selected.version}} · {{selected.batchName}} · {{candidate.rowCount}} 份答卷</p><p>生成于 {{formatTime(candidate.createdAt)}}，后续新增答卷需另建快照。</p><button :disabled="busy" @click="confirmSnapshot">确认使用这 {{candidate.rowCount}} 份答卷</button></div>
        <ul><li v-for="snapshot in snapshots" :key="snapshot.id">{{formatTime(snapshot.createdAt)}} · {{snapshot.rowCount}} 份 · {{snapshot.confirmed?'已确认':'待确认'}} <button v-if="snapshot.confirmed" :disabled="busy" @click="handoff(snapshot)">{{handoffs[snapshot.id]?'核对交付／继续':'交付原研究 G3'}}</button><small v-if="snapshot.confirmed"> · {{handoffStatus(handoffs[snapshot.id])}}</small><button v-else :disabled="busy" @click="candidate=snapshot">查看确认范围</button></li></ul>
      </section>
    </template>
    <p v-else-if="surveys.length" class="panel empty">选择问卷和批次后，查看回收概览与答卷。</p>
    <dialog ref="questionDialog" class="detail-dialog" aria-labelledby="question-title" @click="($event.target===questionDialog) && questionDialog?.close()"><header class="dialog-head"><div><span class="eyebrow">{{selected?.version}} · {{selected?.batchName}}</span><h2 id="question-title">{{selected?.title}}</h2></div><button aria-label="关闭问卷预览" @click="questionDialog?.close()">关闭</button></header><div class="dialog-body"><p v-if="definition?.notice">{{definition.notice}}</p><article v-for="(q,index) in definition?.questions" :key="q.id" class="question-card"><div class="question-number">{{index+1}}<span>{{typeLabel(q.questionType)}}{{q.required?' · 必填':''}}</span></div><h3>{{q.text}}</h3><ul v-if="q.options?.length" class="option-list"><li v-for="option in q.options" :key="option.code"><span class="option-dot" :class="{square:q.questionType==='multi'}"></span>{{option.label}}</li></ul><div v-else-if="q.scale" class="scale-options"><span v-for="value in scaleValues(q)" :key="value">{{scaleLabel(q,value)}}</span></div><p v-else class="text-placeholder">填写内容</p></article></div></dialog>
    <dialog ref="answerDialog" class="detail-dialog" aria-labelledby="answer-title" @click="($event.target===answerDialog) && answerDialog?.close()"><header class="dialog-head"><div><span class="eyebrow">{{selected?.version}} · {{selected?.batchName}}</span><h2 id="answer-title">答卷详情</h2></div><button aria-label="关闭答卷" @click="answerDialog?.close()">关闭</button></header><div class="dialog-body"><p v-if="answer">提交于 {{formatTime(answer.submittedAt)}}</p><article v-for="q in answerRows" :key="q.id" class="question-card"><h3>{{q.id}} · {{q.text}}</h3><p class="answer-value">{{answerText(q.id,answer?.answers[q.id])}}</p></article></div></dialog>
  </main>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {useUserStore} from '@/stores/user'
import {collectionApi,type CollectionSurvey,type CollectionResponse,type CollectionSnapshot,type CollectionStats} from '@/api/researchCollection'
import {researchCloud} from '@/api/researchCloud'
import {loadResearchIdentity,saveResearchIdentity,type StoredResearchIdentity} from '@/utils/researchRunIdentity'
import {fetchSessionTranscript} from '@/api/session'
import {handoffProof,handoffStatus,type ResearchHandoff} from '@/utils/researchHandoff'
import {fetchResearchWordFile} from '@/api/researchWordFile'
import {uploadAttachment,listAttachments} from '@/api/attachment'
import {configuredResearchAgent} from '@/config/researchAgent'
import {currentResearchOwner,useResearchRuns} from '@/stores/researchRuns'
interface Question {id:string;text:string;questionType:string;required?:boolean;options?:{code:string;label:string}[];scale?:{min:number;max:number;labels?:string[]}}
interface Definition {questions:Question[];notice?:string}
const router=useRouter(),user=useUserStore()
const handoffs=ref<Record<string,ResearchHandoff>>({})
const surveys=ref<CollectionSurvey[]>([]),selectedId=ref(''),responses=ref<CollectionResponse[]>([]),snapshots=ref<CollectionSnapshot[]>([]),candidate=ref<CollectionSnapshot|null>(null)
const busy=ref(false),reading=ref(false),error=ref(''),message=ref(''),page=ref(1),total=ref(0),totalPages=ref(0),from=ref(''),until=ref('')
const answer=ref<CollectionResponse|null>(null),answerDialog=ref<HTMLDialogElement|null>(null),questionDialog=ref<HTMLDialogElement|null>(null)
const definition=ref<Definition|null>(null),stats=ref<CollectionStats|null>(null),questionId=ref(''),lastRead=ref('')
const statsError=ref(''),rowsError=ref(''),definitionError=ref(''),snapshotError=ref('')
const selected=computed(()=>surveys.value.find(s=>s.id===selectedId.value))
const fillLink=computed(()=>selected.value?location.origin+router.resolve('/survey/'+selected.value.code).href:'')
const activeQuestion=computed(()=>stats.value?.questions.find(q=>q.qid===questionId.value))
const trend=computed(()=>stats.value?.byDay || [])
const trendMaximum=computed(()=>Math.max(1,...trend.value.map(day=>day.count)))
const trendPoints=computed(()=>trend.value.map((day,index)=>trendX(index)+','+trendY(day.count)).join(' '))
const answerRows=computed(()=>{
  if(!answer.value)return []
  const questions=definition.value?.questions || []
  const extra=Object.keys(answer.value.answers).filter(id=>!questions.some(q=>q.id===id)).map(id=>({id,text:'未匹配到题面，保留原始答案'}))
  return [...questions,...extra]
})
let epoch=0,controller:AbortController|undefined
function formatTime(value:string){return new Date(value).toLocaleString('zh-CN')}
function trendX(index:number){return 24+index*672/Math.max(1,trend.value.length-1)}
function trendY(count:number){return 130-count*100/trendMaximum.value}
function percentage(count:number,answered:number){return answered>0?Math.round(count/answered*1000)/10:0}
function typeLabel(type:string){return ({single:'单选题',multi:'多选题',scale:'量表题',open:'开放题'} as Record<string,string>)[type] || type}
function scaleValues(q:Question){return q.scale?Array.from({length:Math.min(100,Math.max(0,q.scale.max-q.scale.min+1))},(_,i)=>q.scale!.min+i):[]}
function scaleLabel(q:Question,value:number){return q.scale?.labels?.[value-q.scale.min] || String(value)}
function answerText(id:string,value:unknown){
  if(value===undefined || value===null || value==='' || (Array.isArray(value)&&!value.length))return '未作答'
  const q=definition.value?.questions.find(item=>item.id===id)
  const label=(v:unknown)=>q?.options?.find(o=>o.code===String(v))?.label || (q?.scale?scaleLabel(q,Number(v)):String(v))
  return Array.isArray(value)?value.map(label).join('、'):label(value)
}
function openAnswer(row:CollectionResponse){answer.value=row;answerDialog.value?.showModal()}
function reset(){
  epoch++;controller?.abort();controller=new AbortController()
  responses.value=[];snapshots.value=[];handoffs.value={};candidate.value=null;definition.value=null;stats.value=null;answer.value=null
  answerDialog.value?.close();questionDialog.value?.close();questionId.value='';lastRead.value=''
  error.value='';message.value='';statsError.value='';rowsError.value='';definitionError.value='';snapshotError.value='';busy.value=false;reading.value=false
}
function failure(reason:unknown,fallback:string){return reason instanceof Error?reason.message:fallback}
async function load(){
  reset();const generation=epoch;busy.value=true;reading.value=true
  try{const items=await collectionApi.list(controller?.signal);if(generation!==epoch)return;surveys.value=items;if(selectedId.value&&!items.some(s=>s.id===selectedId.value))selectedId.value=''}
  catch(e){if(generation===epoch){surveys.value=[];error.value=failure(e,'问卷列表读取失败。')}}
  finally{if(generation===epoch){busy.value=false;reading.value=false}}
  if(generation===epoch && selected.value)await readResponses()
}
watch(()=>user.token,()=>{selectedId.value='';surveys.value=[];void load()},{immediate:true})
watch(selectedId,()=>{reset();page.value=1;from.value='';until.value='';if(selected.value)void readResponses()})
async function readResponses(){
  const survey=selected.value
  if(!survey || busy.value)return
  const generation=epoch;busy.value=true;reading.value=true;error.value='';rowsError.value='';statsError.value='';definitionError.value='';snapshotError.value=''
  responses.value=[];total.value=0;totalPages.value=0;stats.value=null;definition.value=null;snapshots.value=[];lastRead.value=''
  try{
    const start=from.value?new Date(from.value).toISOString():'',end=until.value?new Date(until.value).toISOString():''
    if(start && end && start>end)throw Error('开始时间应早于结束时间。')
    const [rows,versions,source,summary]=await Promise.allSettled([collectionApi.responses(survey.id,page.value,controller?.signal,start,end),collectionApi.snapshots(survey.id,controller?.signal),collectionApi.definition(survey.id,controller?.signal),collectionApi.stats(survey.id,controller?.signal)])
    if(generation!==epoch || selectedId.value!==survey.id)return
    if(rows.status==='fulfilled'){responses.value=rows.value.items;total.value=rows.value.total;totalPages.value=rows.value.totalPages}else rowsError.value=failure(rows.reason,'答卷读取失败。')
    if(versions.status==='fulfilled'){snapshots.value=versions.value;handoffs.value={};for(const snap of versions.value){try{const row=await researchCloud.get<ResearchHandoff>('artifact','survey-handoff:'+snap.id);if(generation!==epoch)return;if(row?.data.surveyId===survey.id&&row.data.snapshotId===snap.id)handoffs.value[snap.id]=row.data}catch(e){if(generation===epoch)snapshotError.value=failure(e,'交付记录读取失败。')}}}else snapshotError.value=failure(versions.reason,'分析快照读取失败。')
    if(source.status==='fulfilled' && Array.isArray((source.value as Definition)?.questions))definition.value=source.value as Definition;else definitionError.value=source.status==='rejected'?failure(source.reason,'题面读取失败。'):'问卷题面格式不完整。'
    if(summary.status==='fulfilled' && summary.value.surveyId===survey.id && summary.value.version===survey.version){
      stats.value=summary.value
      if(!summary.value.questions.some(q=>q.qid===questionId.value))questionId.value=summary.value.questions[0]?.qid || ''
      surveys.value=surveys.value.map(s=>s.id===survey.id?{...s,responseCount:summary.value.total}:s)
      lastRead.value=new Date().toLocaleTimeString('zh-CN')
    }else statsError.value=summary.status==='rejected'?failure(summary.reason,'概览读取失败。'):'概览所属问卷或版本不匹配。'
  }catch(e){if(generation===epoch)rowsError.value=failure(e,'答卷读取失败。')}
  finally{if(generation===epoch){busy.value=false;reading.value=false}}
}
async function act(action:(survey:CollectionSurvey)=>Promise<void>){const survey=selected.value;if(!survey||busy.value)return;const generation=epoch;busy.value=true;error.value='';message.value='';try{await action(survey)}catch(e){if(generation===epoch)error.value=e instanceof Error?e.message:'操作失败。'}finally{if(generation===epoch)busy.value=false}}
async function copyLink(){try{await navigator.clipboard.writeText(fillLink.value);message.value='填写链接已复制。'}catch{error.value='无法自动复制，请选择上方链接手动复制。'}}
function download(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportCsv(){await act(async survey=>{const generation=epoch;const csv=await collectionApi.exportCsv(survey.id);if(generation===epoch)download(csv,survey.code+'-raw.csv')})}
async function closeBatch(){await act(async survey=>{const generation=epoch;const result=await collectionApi.close(survey.id);if(generation===epoch){surveys.value=surveys.value.map(s=>s.id===result.id?result:s);message.value='本批次已关闭。'}})}
async function previewSnapshot(){await act(async survey=>{const generation=epoch;const result=await collectionApi.previewSnapshot(survey.id);if(generation===epoch){if(result.surveyId!==survey.id)throw Error('快照所属批次不一致。');candidate.value=result}})}
async function confirmSnapshot(){const preview=candidate.value;if(!preview)return;await act(async survey=>{const generation=epoch;const result=await collectionApi.confirmSnapshot(preview.id);if(generation===epoch){if(result.surveyId!==survey.id || result.id!==preview.id || !result.confirmed)throw Error('快照确认结果不一致。');candidate.value=null;snapshots.value=[result,...snapshots.value.filter(s=>s.id!==result.id)];message.value='数据快照已固定，可交付原研究 G3。'}})}
async function handoff(snapshot:CollectionSnapshot){
 await act(async survey=>{
  const generation=epoch,owner=currentResearchOwner(),agent=configuredResearchAgent().id,session=useResearchRuns().session
  const valid=()=>generation===epoch&&owner===currentResearchOwner()&&selectedId.value===survey.id
  if(!snapshot.confirmed||snapshot.surveyId!==survey.id||!survey.sourceTaskId||!survey.sourceThreadId)throw Error('快照未确认或缺少原研究绑定，未交付。')
  const scope={ownerId:owner,agentId:agent,taskId:survey.sourceTaskId},loaded=loadResearchIdentity(localStorage,scope)
  if(!loaded.identity){
   const archived=await researchCloud.get<{taskId:string;identity:StoredResearchIdentity}>('session',scope.taskId+':'+agent)
   if(!valid())return
   const identity=archived?.data.identity
   if(archived?.data.taskId!==scope.taskId||identity?.ownerId!==owner||identity.agentId!==agent||identity.taskId!==scope.taskId||identity.threadId!==survey.sourceThreadId||identity.projectId!==survey.projectId)throw Error('数据库中没有与本问卷一致的原会话绑定，未创建替代研究。')
   saveResearchIdentity(localStorage,scope,null,identity)
  }
  await session.select(scope);if(!valid())return
  if(session.identity?.threadId!==survey.sourceThreadId||session.identity.projectId!==survey.projectId)throw Error('原研究绑定不一致，未交付。')
  const id='survey-handoff:'+snapshot.id
  let record=(await researchCloud.get<ResearchHandoff>('artifact',id))?.data
  if(!valid())return
  const persist=async()=>{if(!valid())throw Error('账号或批次已变化');record!.updatedAt=new Date().toISOString();await researchCloud.save('artifact',id,record);if(valid())handoffs.value[snapshot.id]={...record!}}
  const check=async()=>{
   const transcript=await fetchSessionTranscript(agent,survey.sourceThreadId);if(!valid())return
   const proof=handoffProof(transcript.messages.map(m=>({role:m.role,text:m.content.filter(b=>b.type==='text').map(b=>b.text||'').join('')})),snapshot.id)
   if(proof.sent){record!.state=proof.replyObserved?'reply-observed':'sent';record!.error='';await persist()}
   message.value=handoffStatus(record)
  }
  if(record){
   if(record.taskId!==scope.taskId||record.threadId!==survey.sourceThreadId||record.projectId!==survey.projectId||record.contentHash!==snapshot.contentHash||record.surveyId!==survey.id)throw Error('历史交付绑定不一致，已阻止重复交付。')
   if(record.state==='uploading'){
    const attachments=await listAttachments(agent,survey.sourceThreadId,controller?.signal);if(!valid())return
    const csv=attachments.filter(f=>f.fileName==='snapshot-'+snapshot.id+'.csv'),manifest=attachments.filter(f=>f.fileName==='snapshot-'+snapshot.id+'-manifest.json')
    if(csv.length!==1||manifest.length!==1)throw Error('附件上传结果不完整或存在重名，未自动重传；请核对原会话附件。')
    const csvResponse=await fetchResearchWordFile(agent,survey.sourceThreadId,csv[0]!.ref.replace(/^@/,''),controller?.signal)
    if(!csvResponse.ok)throw Error('已上传CSV无法读取核验，未重传或发送。')
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await csvResponse.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')
    const manifestResponse=await fetchResearchWordFile(agent,survey.sourceThreadId,manifest[0]!.ref.replace(/^@/,''),controller?.signal)
    if(!manifestResponse.ok)throw Error('已上传清单无法读取核验，未重传或发送。')
    const data=await manifestResponse.json();if(!valid())return
    if(digest!==snapshot.contentHash||data.id!==snapshot.id||data.projectId!==survey.projectId||data.surveyId!==survey.id||data.contentHash!==snapshot.contentHash||data.version!==survey.version)throw Error('上传附件与快照不一致，已阻止继续。')
    record.csvRef=csv[0]!.ref;record.manifestRef=manifest[0]!.ref;record.state='attachments-ready';record.error='';await persist()
    message.value='附件已逐项核验并登记。再次点击可继续交付，不会重复上传。';return
   }
   if(['dispatching','sent','reply-observed'].includes(record.state)){await check();if(valid())message.value=handoffStatus(record)+'；本次仅核对，没有重发。';return}
  }else{
   const transcript=await fetchSessionTranscript(agent,survey.sourceThreadId);if(!valid())return
   const priorProof=handoffProof(transcript.messages.map(m=>({role:m.role,text:m.content.filter(b=>b.type==='text').map(b=>b.text||'').join('')})),snapshot.id)
   record={taskId:scope.taskId,threadId:survey.sourceThreadId,projectId:survey.projectId,agentId:agent,surveyId:survey.id,snapshotId:snapshot.id,version:survey.version,batchName:survey.batchName,batchKind:survey.batchKind,contentHash:snapshot.contentHash,rowCount:snapshot.rowCount,operationId:crypto.randomUUID(),state:priorProof.replyObserved?'reply-observed':priorProof.sent?'sent':'preparing',updatedAt:new Date().toISOString()}
   await researchCloud.create('artifact',id,record);if(!valid())return;handoffs.value[snapshot.id]={...record}
   if(priorProof.sent){message.value=handoffStatus(record)+'；已补登记历史交付，没有重复发送。';return}
  }
  try{
   if(session.busy||session.halted||session.interrupts.length||['running','working','interrupt','uncertain'].includes(session.status))throw Error('原会话仍有运行或待核对事项，请先在研究页面处理；未发送快照消息。')
   if(record.state==='preparing'){
    const csv=await collectionApi.snapshotBytes(snapshot.id);if(!valid())return
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',csv)),b=>b.toString(16).padStart(2,'0')).join('')
    if(hash!==snapshot.contentHash)throw Error('快照内容校验失败，未上传。')
    record.state='uploading';await persist();if(!valid())return
    const file=await uploadAttachment(agent,survey.sourceThreadId,new File([csv],'snapshot-'+snapshot.id+'.csv',{type:'text/csv'}),controller?.signal)
    if(!valid())return
    record.csvRef=file.ref;await persist();if(!valid())return
    const manifest=await uploadAttachment(agent,survey.sourceThreadId,new File([JSON.stringify({projectId:survey.projectId,version:survey.version,batchName:survey.batchName,batchKind:survey.batchKind,...snapshot},null,2)],'snapshot-'+snapshot.id+'-manifest.json',{type:'application/json'}),controller?.signal)
    if(!valid())return
    record.manifestRef=manifest.ref;record.state='attachments-ready';await persist()
   }
   if(!valid()||!record.csvRef||!record.manifestRef)throw Error('附件上传未完整确认，消息未发送。')
   record.state='dispatching';record.error='';await persist();if(!valid())return
   await session.start('已人工确认采用数据快照 '+snapshot.id+'。版本 '+survey.version+'，批次 '+survey.batchName+'（'+survey.batchKind+'），共 '+snapshot.rowCount+' 份。请读取并核对材料完整性，统计执行等待另行确认。\n'+record.csvRef+'\n'+record.manifestRef,{requireModelProbe:false,allowIdleMessage:true})
   if(!valid())return
   await check()
   if(valid()&&session.error){record.error=session.error;await persist()}
  }catch(e){if(valid()){record.error=e instanceof Error?e.message:'交付中断';await persist()}throw e}
 })
}
onBeforeUnmount(()=>{reset()})
</script>
<style scoped>
.collection-page{--line:#cce2dd;--green:#087c74;min-height:100dvh;background:#f2faf9;color:#0b2e36;font:14px/1.7 system-ui,sans-serif;padding:0 24px 36px;box-sizing:border-box}
.site-header{display:flex;gap:40px;align-items:center;padding:20px;max-width:1160px;margin:auto}.brand{font-weight:800;font-size:22px;color:var(--green)}nav{display:flex;gap:24px}nav strong{color:var(--green);border-bottom:2px solid var(--green)}a{color:var(--green);text-decoration:none}
.panel,.metrics{max-width:1100px;margin:18px auto}.panel{padding:24px;background:#fff;border:1px solid #afd1c8;border-radius:16px;box-shadow:0 3px 12px #0b6e6808}.introduction{background:linear-gradient(115deg,#fff,#eefaf5);border-top:3px solid #24a99a}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.eyebrow{font-size:12px;letter-spacing:1px;color:var(--green);font-weight:700}h1,h2,h3{margin:8px 0 12px}h1{font-size:26px}h2{font-size:20px}h3{font-size:15px}p{margin:8px 0;color:#537580}.section-heading p{font-size:12px}
button,.button{display:inline-flex;align-items:center;justify-content:center;padding:8px 13px;border:1px solid #aad0c7;border-radius:9px;background:#effaf7;color:var(--green);font:inherit;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s;box-sizing:border-box}button:hover:not(:disabled),.button:hover{background:#e0f4ee;border-color:#59b2a3;box-shadow:0 3px 8px #0b6e6810}button:disabled{opacity:.5;cursor:default}button:focus-visible,a:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--green);outline-offset:3px}
label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#537580}input,select{padding:10px;border:1px solid var(--line);border-radius:9px;max-width:100%;box-sizing:border-box;font:inherit;background:#fff;color:#0b2e36}.survey-select{margin-top:20px}.survey-select select{font-size:14px}.link-label{margin-top:14px}.link-label input{width:100%;color:#537580}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.badges{display:flex;gap:7px;flex-wrap:wrap}.badge,.status-pill{display:inline-block;padding:3px 9px;border-radius:7px;background:#edf6f4;font-size:11px;color:var(--green)}.badge.synthetic{background:#fff2d9;color:#926409}.badge.real{background:#e1f5e7;color:#28733d}.status-pill{white-space:nowrap}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric{padding:20px;border:1px solid #afd1c8;border-radius:14px;background:#fff;box-shadow:0 3px 10px #0b6e6806}.metric.mint{background:linear-gradient(125deg,#fff,#cef8dc)}.metric.aqua{background:linear-gradient(125deg,#fff,#cef4f5)}.metric>span{font-size:12px;color:#537580}.metric strong{display:block;font-size:32px;line-height:1.5;color:var(--green);font-variant-numeric:tabular-nums}.metric small{font-size:12px;margin-left:6px;font-weight:400}.metric p{font-size:11px;margin:3px 0 0}.metric .read-time{font-size:24px;padding:6px 0}
.chart-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:22px 0 12px}.chart-heading>span{font-size:12px;color:#537580}.chart-heading label{max-width:70%}.chart-heading select{width:420px}.trend-chart{padding:14px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(#f3fbf8,#fff)}.trend-chart svg{width:100%;height:180px;overflow:visible}.chart-grid{stroke:#dcebe6;stroke-width:1;fill:none}.trend-line{stroke:#16a394;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.trend-chart circle{fill:#fff;stroke:#16a394;stroke-width:2}.trend-chart text{fill:#537580;font-size:11px}.trend-dates{display:flex;justify-content:space-between;font-size:11px;color:#537580}.trend-table{margin-top:10px;font-size:12px}.trend-table summary{cursor:pointer;color:var(--green)}.question-chart{border:1px solid var(--line);border-radius:12px;padding:18px}.bar-row{margin-top:16px}.bar-label{display:flex;justify-content:space-between;gap:16px;font-size:12px}.bar-label strong{white-space:nowrap;font-weight:500;color:var(--green)}.bar-track{height:10px;border-radius:8px;background:#edf5f2;margin-top:6px;overflow:hidden}.bar-track>div{height:100%;max-width:100%;background:linear-gradient(90deg,#49c3ad,#8ad4d9);border-radius:8px}.chart-note{font-size:11px;margin-top:18px}
.filters{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:18px 0}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:12px;border-bottom:1px solid var(--line)}th{background:#f1f9f6;font-weight:600}tbody tr:hover{background:#f6fbf9}.list-caption{font-size:12px}.pagination{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:16px;font-size:12px}.empty{text-align:center;padding:20px;color:#6c8b92}.snapshot-candidate{padding:14px;border:1px solid #9fcfc2;border-radius:10px;background:#eef9f4;margin-top:14px}.analysis-panel li{margin:12px 0}.analysis-panel li button{margin-left:8px}[role=alert]{padding:10px 12px;border-radius:8px;background:#fff3ed;color:#984528;overflow-wrap:anywhere}[role=status]{color:var(--green)}
.detail-dialog{box-sizing:border-box;width:min(760px,calc(100vw - 32px));max-height:85dvh;border:1px solid #afd1c8;border-radius:16px;padding:0;color:#0b2e36;background:#f3faf7}.detail-dialog::backdrop{background:#0b2e3655}.dialog-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:16px 22px;position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);z-index:1}.dialog-head h2{font-size:18px;margin:4px 0}.dialog-body{padding:20px}.question-card{padding:18px;border:1px solid var(--line);border-radius:12px;margin:12px 0;background:#fff}.question-number{font-weight:700;color:var(--green)}.question-number span{font-size:11px;font-weight:400;color:#6c8b92;margin-left:12px}.option-list{list-style:none;padding:0;margin:12px 0 0}.option-list li{display:flex;align-items:center;gap:10px;padding:8px 0}.option-dot{width:14px;height:14px;border-radius:50%;border:1px solid #a7c9c0;flex-shrink:0}.option-dot.square{border-radius:3px}.scale-options{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.scale-options span{padding:7px 12px;border:1px solid var(--line);border-radius:8px}.text-placeholder{padding:12px;border:1px dashed var(--line);border-radius:8px;color:#94aaa9}.answer-value{white-space:pre-wrap;overflow-wrap:anywhere;color:#16695d;background:#eef8f4;padding:12px;border-radius:8px}
@media(max-width:800px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.collection-page{padding:0 12px 24px}.site-header{padding:16px 0;gap:20px}nav{gap:12px}.panel{padding:18px}.section-heading{flex-wrap:wrap}.chart-heading{align-items:flex-start;flex-wrap:wrap}.chart-heading label{max-width:100%;width:100%}.chart-heading select{width:100%}.brand{font-size:19px}.trend-chart svg{height:auto}.dialog-body{padding:12px}}
</style>
