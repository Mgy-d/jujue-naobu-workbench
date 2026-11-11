<template>
<section class="word-preview" aria-label="Word 文档预览" :aria-busy="loading">
  <div class="word-tools"><button type="button" :disabled="!downloadUrl" @click="download">下载 Word</button><button v-if="error" type="button" @click="load">重新读取</button><span>预览正文、标题和表格；完整排版请下载查看。</span></div>
  <p v-if="loading" role="status">正在读取 Word 文档…</p>
  <p v-else-if="error" role="alert">{{error}}</p>
  <div v-else-if="html" class="word-content" v-html="html"></div>
  <p v-else>文档中没有可预览的正文，可下载查看原文件。</p>
</section>
</template>
<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
import {authSnapshot,sameAuth,AUTH_CHANGE_EVENT} from '@/api/http'
import {renderResearchWord,WORD_MAX_BYTES} from '@/utils/researchWordPreview'
import {fetchResearchWordFile} from '@/api/researchWordFile'
const props=defineProps<{agentId:string;threadId:string;path:string;readFile?:(signal:AbortSignal)=>Promise<Blob>}>()
const loading=ref(false),error=ref(''),html=ref(''),downloadUrl=ref('')
let controller:AbortController|undefined,ticket=0
function clear(){controller?.abort();ticket++;html.value='';if(downloadUrl.value)URL.revokeObjectURL(downloadUrl.value);downloadUrl.value=''}
async function load(){
 clear();const current=++ticket,auth=authSnapshot();controller=new AbortController();loading.value=true;error.value=''
 const valid=()=>current===ticket&&sameAuth(auth)
 try{
  const response=props.readFile?new Response(await props.readFile(controller.signal)):await fetchResearchWordFile(props.agentId,props.threadId,props.path,controller.signal)
  if(!valid())return
  if(!response.ok){const detail=await response.json().catch(()=>null);throw Error('Word 原文件下载失败（HTTP '+response.status+'）'+(typeof detail?.message==='string'?'：'+detail.message:'，请核对文件路径、会话归属及平台下载接口。'))}
  if(Number(response.headers.get('content-length'))>WORD_MAX_BYTES)throw Error('Word 文件超过20MB，暂不能在页面预览。')
  const bytes=await response.arrayBuffer();if(!valid())return
  if(bytes.byteLength>WORD_MAX_BYTES)throw Error('Word 文件超过20MB，暂不能在页面预览。')
  downloadUrl.value=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}))
  try{const result=await renderResearchWord(bytes);if(valid())html.value=result}catch{if(valid())error.value='文件已读取，但无法解析为 Word 正文。可下载原文件检查文件内容。'}
 }catch(e){if(valid())error.value=e instanceof Error?e.message:'Word 读取失败。'}
 finally{if(current===ticket){loading.value=false;if(!sameAuth(auth)){clear();error.value='登录状态已变化，请重新打开文件。'}}}
}
function download(){if(!downloadUrl.value)return;const link=document.createElement('a');link.href=downloadUrl.value;link.download=props.path.split(/[/\\]/).at(-1)||'报告正文.docx';link.click()}
function authChanged(){clear();loading.value=false;error.value='登录状态已变化，请重新打开文件。'}
window.addEventListener(AUTH_CHANGE_EVENT,authChanged)
watch(()=>[props.agentId,props.threadId,props.path],()=>void load(),{immediate:true})
onBeforeUnmount(()=>{clear();window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})
</script>
<style scoped>
.word-preview{color:#315f69;font-size:14px;line-height:1.8}.word-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #d6e8e3}.word-tools button{padding:7px 14px;border:1px solid #adcfc7;border-radius:9px;background:#fff;color:#087f7b;font:inherit;cursor:pointer}.word-tools button:hover:not(:disabled){background:#edf8f4}.word-tools button:disabled{opacity:.45;cursor:not-allowed}.word-tools span{font-size:12px;color:#678488}.word-content{overflow-wrap:anywhere}.word-content :deep(p){margin:0 0 12px}.word-content :deep(h1),.word-content :deep(h2),.word-content :deep(h3){color:#143e44;line-height:1.5;margin:22px 0 12px}.word-content :deep(table){display:block;overflow-x:auto;border-collapse:collapse;margin:14px 0;max-width:100%}.word-content :deep(td),.word-content :deep(th){border:1px solid #c6dbd5;padding:8px 12px;min-width:60px}[role=alert]{color:#8c5422;background:#fff7eb;padding:12px;border-radius:8px}button:focus-visible{outline:2px solid #168b7e;outline-offset:3px}
</style>
