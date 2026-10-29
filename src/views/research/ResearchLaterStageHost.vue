<template>
 <section class="later-stage" :aria-label="collectionMode?'正式调查准备':'报告与答辩编辑'">
  <template v-if="collectionMode">
   <h2>正式调查 · 发布准备</h2><p role="status">采集服务待接入：目前不能生成公开链接、收集答卷或停止真实调查。</p>
   <p>当前问卷：{{task.questionnaire.meta.title||'未命名'}} · {{task.questionnaire.questions.length}} 题。预览使用当前草稿，不是正式发布版本。</p>
   <label v-for="(label,key) in collectionLabels" :key="key">{{label}}<textarea :value="task.collection[key]" :disabled="readOnly" @input="collection(key,$event)" /></label>
   <button :disabled="readOnly" @click="emit('save-local')">保存调查准备到本机</button>
   <button disabled>发布问卷（待采集服务）</button><button disabled>停止收集（待采集服务）</button>
   <p>回收量：未连接采集服务，暂无可核对数据。</p>
   <details><summary>问卷填写预览 · 不提交、不保存答卷</summary><p>{{task.questionnaire.meta.intro}}</p>
    <fieldset v-for="q in task.questionnaire.questions" :key="q.id"><legend>{{q.text||'未填写题干'}}{{q.required?' *':''}}</legend>
     <template v-if="q.type==='single'||q.type==='multi'"><label v-for="o in q.options" :key="o.id" class="option"><input :type="q.type==='single'?'radio':'checkbox'" :name="q.id" />{{o.label}}</label></template>
     <label v-else-if="q.type==='scale'">{{q.scale?.minLabel}} — {{q.scale?.maxLabel}}<select><option value="">请选择</option><option v-for="n in q.scale?.points||0" :key="n">{{n}}</option><option v-if="q.scale?.hasDontKnow">不知道／不适用</option></select></label>
     <input v-else-if="q.type==='number'" type="number" :aria-label="q.text" /><textarea v-else :aria-label="q.text" />
     <p>{{q.codingNote}}</p>
    </fieldset><button disabled>预览不提交答卷</button>
   </details>
  </template>
  <template v-else>
   <h2>报告与答辩 · 人工草稿</h2><p>对照本任务的已核对结果编辑。这里不会自动生成事实或结论；本机保存不等于正式成果登记。</p>
   <p v-if="task.sandboxRef">本任务本机分析引用：{{task.sandboxRef.workspaceId}} / {{task.sandboxRef.runId||'暂无运行'}}。引用本身不代表结果已采用。</p>
   <p v-else>当前任务尚未关联本机分析结果；不能把未执行的统计写成已验证结论。</p>
   <label v-for="(label,key) in reportLabels" :key="key">{{label}}<textarea :value="task.report[key]" :disabled="readOnly" rows="7" @input="report(key,$event)" /></label>
   <button :disabled="readOnly" @click="emit('save-local')">保存报告草稿到本机</button>
   <details><summary>报告文本预览</summary><h3>报告正文</h3><pre>{{task.report.body||'尚未填写'}}</pre><h3>来源与结果引用</h3><pre>{{task.report.sourceNotes||'尚未填写'}}</pre><h3>答辩准备</h3><pre>{{task.report.defenseNotes||'尚未填写'}}</pre></details>
  </template>
 </section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import type {LocalResearchTask,CollectionDraft,ReportDraft} from '@/types/research-contracts'
const props=defineProps<{task:LocalResearchTask;readOnly?:boolean}>()
const emit=defineEmits<{'update-collection':[value:CollectionDraft];'update-report':[value:ReportDraft];'save-local':[]}>()
const collectionMode=computed(()=>props.task.workflowKind==='full-study'&&props.task.viewedPhase===4)
const collectionLabels={channel:'计划发布渠道',audience:'调查对象与招募说明',startNote:'计划开始时间与发布条件',stopRule:'停止收集条件'}
const reportLabels={body:'报告正文草稿',sourceNotes:'来源与结果引用',defenseNotes:'答辩准备笔记'}
function collection(key:keyof CollectionDraft,event:Event){if(!props.readOnly)emit('update-collection',{...props.task.collection,[key]:(event.target as HTMLTextAreaElement).value})}
function report(key:keyof ReportDraft,event:Event){if(!props.readOnly)emit('update-report',{...props.task.report,[key]:(event.target as HTMLTextAreaElement).value})}
</script>
<style scoped>
.later-stage{padding:26px;color:#234b3e;font-size:15px;line-height:1.8}h2{font-size:24px}label{display:grid;gap:6px;margin:16px 0}textarea,select,input{font:inherit;border:1px solid #b8cec5;border-radius:6px;padding:10px;box-sizing:border-box}textarea{width:100%;resize:vertical}button{font:inherit;background:#176f5b;color:white;padding:10px 14px;border:0;border-radius:6px;margin:6px;cursor:pointer}button:disabled{background:#e5eae7;color:#697b72;cursor:default}details{margin:22px 0;padding:16px;background:#f5f8f5}summary{cursor:pointer}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}fieldset{margin:16px 0;border:1px solid #cddbd3}.option{display:flex;align-items:center;gap:9px}
</style>
