<template><section aria-label="试填预览"><p>仅在此页面试填；不会保存或提交正式答卷。题目或任务变化会清空试填值。</p>
<fieldset v-for="q in questions" :key="q.id"><legend>{{q.text||'题干待填写'}}{{q.required?'（必填）':''}}</legend>
<template v-if="q.type==='single'||q.type==='multi'"><label v-for="o in q.options" :key="o.id"><input :type="q.type==='single'?'radio':'checkbox'" :name="q.id" :checked="selected(q.id,o.id)" @change="choose(q,o.id)" />{{o.label}}<input v-if="o.openEnded&&selected(q.id,o.id)" :aria-label="q.text+'：'+o.label+'补充说明'" :value="answers[q.id]?.other?.[o.id]||''" @input="other(q.id,o.id,$event)" /></label></template>
<select v-else-if="q.type==='scale'" :aria-label="q.text" :value="answers[q.id]?.value||''" @change="set(q.id,$event)"><option value="">请选择</option><option v-for="n in q.scale?.points||0" :key="n" :value="String(n)">{{n}} {{n===1?q.scale?.minLabel:n===q.scale?.points?q.scale?.maxLabel:''}}</option><option v-if="q.scale?.hasDontKnow" value="dontknow">不知道／不适用</option></select>
<input v-else-if="q.type==='number'" type="text" inputmode="decimal" :aria-label="q.text" :value="answers[q.id]?.value||''" @input="set(q.id,$event)" />
<textarea v-else-if="q.type==='text'" :aria-label="q.text" :value="answers[q.id]?.value||''" @input="set(q.id,$event)" /><p v-else>此题型不支持试填</p>
<p>{{q.codingNote}}</p><p v-if="checked&&answerIssue(q,answers[q.id])" role="alert">{{answerIssue(q,answers[q.id])}}</p></fieldset>
<button @click="checked=true">检查试填</button><button @click="clear">清空试填</button><p v-if="checked" role="status">{{!questions.length?'当前问卷没有题目':questions.some(q=>answerIssue(q,answers[q.id]))?'请按题目提示修正':'试填校验通过；没有提交或保存答卷。'}}</p></section></template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import type {SurveyQuestion} from '@/components/research/questionnaire-contract'
import {answerIssue,type PreviewAnswer} from '@/utils/researchPreviewInput'
const props=defineProps<{questions:SurveyQuestion[];taskId:string}>(),answers=ref<Record<string,PreviewAnswer>>({}),checked=ref(false)
function clear(){answers.value={};checked.value=false}
watch(()=>[props.taskId,JSON.stringify(props.questions)],clear)
function selected(id:string,o:string){const v=answers.value[id]?.value;return Array.isArray(v)?v.includes(o):v===o}
function choose(q:SurveyQuestion,o:string){const a=answers.value[q.id]||{},v=Array.isArray(a.value)?[...a.value]:[];answers.value[q.id]={...a,value:q.type==='single'?o:v.includes(o)?v.filter(x=>x!==o):[...v,o]}}
function set(id:string,e:Event){answers.value[id]={...answers.value[id],value:(e.target as HTMLInputElement).value}}
function other(id:string,o:string,e:Event){const a=answers.value[id]||{};answers.value[id]={...a,other:{...a.other,[o]:(e.target as HTMLInputElement).value}}}
</script>
<style scoped>section{min-width:0}fieldset{min-width:0;margin:16px 0;padding:12px;border:1px solid #b8cec5}legend{overflow-wrap:anywhere}label{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}input:not([type=checkbox]):not([type=radio]),textarea,select{box-sizing:border-box;max-width:100%;width:100%;font:inherit;padding:10px}button{margin:8px;padding:10px}p[role=alert]{color:#9b392a}</style>
