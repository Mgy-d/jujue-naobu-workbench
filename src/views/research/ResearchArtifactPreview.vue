<template>
<section class="artifact-reading" aria-label="产物内容">
  <div class="reading-tools" role="group" aria-label="内容显示方式"><button type="button" @click="mode=mode==='read'?'raw':'read'">{{mode==='read'?'查看原文':'返回预览'}}</button></div>
  <p v-if="truncated" class="notice" role="status">接口仅返回了部分文件内容，以下不是完整文件。</p>
  <p v-if="content==null" class="notice">{{reason||'此文件暂不支持文本预览。'}}</p>
  <p v-else-if="!content.trim()" class="notice">文件内容为空。</p>
  <pre v-else-if="mode==='raw'" class="raw-content">{{content}}</pre>
  <template v-else>
    <p v-if="model.error" class="notice" role="alert">{{model.error}} 可切换“查看原文”。</p>
    <div v-else-if="model.kind==='markdown'" class="document-content" v-html="model.html"></div>
    <template v-else-if="model.kind==='table' && model.table">
      <p class="table-caption">{{model.table.totalColumns}} 列 · {{model.table.totalRows}} 行数据（不含表头）<span v-if="model.table.totalRows>CSV_PREVIEW_ROWS"> · 当前仅预览前 {{CSV_PREVIEW_ROWS}} 行</span><span v-if="model.table.totalColumns>CSV_PREVIEW_COLUMNS"> · 当前仅预览前 {{CSV_PREVIEW_COLUMNS}} 列</span></p>
      <div class="data-scroll" role="region" aria-label="数据表格" tabindex="0"><table><thead><tr><th v-for="(header,index) in model.table.headers" :key="index" scope="col">{{header||'第 '+(index+1)+' 列'}}</th></tr></thead><tbody><tr v-for="(row,index) in model.table.rows" :key="index"><td v-for="(cell,column) in row" :key="column">{{cell}}</td></tr></tbody></table></div>
    </template>
    <ResearchDefenseBank v-else-if="model.kind==='defense' && model.defense" :bank="model.defense" />
    <ResearchJsonValue v-else-if="model.kind==='json' && model.json" :node="model.json" :depth="0" />
    <p v-else-if="model.kind==='text'" class="plain-content">{{content}}</p>
    <p v-else class="notice">此格式暂未提供预览，请切换“查看原文”。</p>
  </template>
</section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {renderArtifactMarkdown,parseArtifactCsv,buildArtifactJson,CSV_PREVIEW_ROWS,CSV_PREVIEW_COLUMNS,type ArtifactJsonNode} from '@/utils/researchArtifactPreview'
import ResearchJsonValue from './ResearchJsonValue.vue'
import ResearchDefenseBank from './ResearchDefenseBank.vue'
import {readDefenseBank,type DefenseBank} from '@/utils/researchDefenseBank'
const props=defineProps<{path:string;content?:string|null;truncated?:boolean;reason?:string|null}>()
const mode=ref('read')
watch(()=>[props.path,props.content],()=>{mode.value='read'})
const model=computed(()=>{
  const result:{kind:string;error?:string;html?:string;table?:ReturnType<typeof parseArtifactCsv>;json?:ArtifactJsonNode;defense?:DefenseBank}={kind:'unsupported'}
  const ext=props.path.split('.').at(-1)?.toLowerCase(),content=props.content??''
  if(!content.trim())return result
  if(content.length>2_000_000)return {...result,error:'文件较大，暂不生成预览。'}
  try{
    if(ext==='md'||ext==='markdown')return {kind:'markdown',html:renderArtifactMarkdown(content)}
    if(['json','csv','tsv'].includes(ext||'') && props.truncated)return {...result,error:'文件内容已截断，无法可靠解析完整结构。'}
    if(ext==='json'){
      const data:unknown=JSON.parse(content.replace(/^\uFEFF/,''))
      const defense=readDefenseBank(props.path,data)
      return defense?{kind:'defense',defense}:{kind:'json',json:buildArtifactJson(data)}
    }
    if(ext==='csv'||ext==='tsv')return {kind:'table',table:parseArtifactCsv(content,ext==='tsv'?'\t':',')}
    if(ext==='txt')return {kind:'text'}
  }catch(error){return {...result,error:error instanceof SyntaxError?'JSON 格式不完整，无法生成预览。':error instanceof Error?error.message:'内容解析失败。'}}
  return result
})
</script>
<style scoped>
.artifact-reading{color:#315f69;min-width:0;font-size:14px}.reading-tools{display:flex;gap:8px;margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid #d6e8e3}.reading-tools button{border:1px solid #adcfc7;border-radius:9px;background:#fff;color:#087f7b;padding:7px 14px;font:inherit;cursor:pointer}.reading-tools button[aria-pressed=true]{background:#e6f5f0;border-color:#15998b;font-weight:600}.reading-tools button:hover{background:#edf8f4;color:#08635f}.reading-tools button:focus-visible,.data-scroll:focus-visible{outline:2px solid #0b8c80;outline-offset:3px}.notice{padding:12px 14px;background:#f6faf8;border:1px solid #d8e8e2;border-radius:9px;line-height:1.8}.plain-content,.raw-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9}.raw-content{max-height:65vh;overflow:auto;padding:16px;border:1px solid #d6e8e3;border-radius:10px;background:#f6faf9;font:13px/1.8 Consolas,monospace}.data-scroll{max-height:58vh;overflow:auto;border:1px solid #c7ded8;border-radius:10px}.table-caption{color:#708b91;font-size:12px}.data-scroll table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;text-align:left}.data-scroll th{position:sticky;top:0;background:#edf7f3;color:#17554e;z-index:1}.data-scroll td,.data-scroll th{padding:10px 12px;border-bottom:1px solid #deece7;border-right:1px solid #e6f0ed;min-width:100px;max-width:380px;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:top}.data-scroll tr:nth-child(even){background:#f8fcfa}.document-content{line-height:1.95;overflow-wrap:anywhere}.document-content :deep(h1),.document-content :deep(h2),.document-content :deep(h3),.document-content :deep(h4){color:#143f47;line-height:1.5;margin:1.4em 0 .65em;font-weight:700}.document-content :deep(h1){font-size:24px}.document-content :deep(h2){font-size:20px;padding-bottom:8px;border-bottom:1px solid #d9e9e3}.document-content :deep(h3){font-size:17px}.document-content :deep(p){margin:.75em 0}.document-content :deep(ul),.document-content :deep(ol){padding-left:1.7em}.document-content :deep(li){margin:.35em 0}.document-content :deep(blockquote){margin:16px 0;padding:8px 16px;border-left:3px solid #68b6a7;background:#f1f9f6}.document-content :deep(table){display:block;max-width:100%;overflow:auto;border-collapse:collapse;margin:16px 0;font-size:13px}.document-content :deep(td),.document-content :deep(th){border:1px solid #d2e4de;padding:9px 12px;vertical-align:top}.document-content :deep(th){background:#edf7f3}.document-content :deep(code){background:#eef4f2;padding:2px 5px;border-radius:4px;font-size:.9em}.document-content :deep(pre){overflow:auto;background:#f4f8f6;border:1px solid #dae8e3;border-radius:9px;padding:14px;line-height:1.7}.document-content :deep(pre code){padding:0;background:none}.document-content :deep(a){color:#087f7b;text-decoration:underline}.document-content :deep(img){max-width:100%;height:auto}.document-content :deep(hr){border:0;border-top:1px solid #d9e9e3;margin:24px 0}
</style>
