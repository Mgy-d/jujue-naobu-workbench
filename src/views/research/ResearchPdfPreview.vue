<template>
<section class="binary-preview" aria-label="PDF 预览">
 <div class="binary-tools">
  <button type="button" :disabled="!document||rendering||page<=1" @click="turn(-1)">上一页</button><span v-if="total" class="page-counter">{{page}} / {{total}} 页</span>
  <button type="button" :disabled="!document||rendering||page>=total" @click="turn(1)">下一页</button>
  <label>缩放 <select v-model.number="zoom" :disabled="!document||rendering" @change="draw"><option :value=".75">75%</option><option :value="1">100%</option><option :value="1.25">125%</option><option :value="1.5">150%</option><option :value="2">200%</option></select></label>
  <button type="button" :disabled="!downloadUrl" @click="download">下载 PDF</button><button v-if="error" type="button" @click="load">重新读取</button>
 </div>
 <p v-if="loading||rendering" role="status">{{loading?'正在读取 PDF…':'正在绘制页面…'}}</p>
 <p v-if="error" class="preview-error" role="alert">{{error}}</p>
 <div class="pdf-pages" tabindex="0" aria-label="PDF 页面，可滚动查看"><canvas v-show="total&&!loading" ref="canvas" :aria-label="'PDF 第 '+page+' 页'"></canvas></div>
</section>
</template>
<script setup lang="ts">
import {ref,shallowRef,watch,onBeforeUnmount,nextTick} from 'vue'
import {authSnapshot,sameAuth,AUTH_CHANGE_EVENT} from '@/api/http'
import {readArtifactDownload} from '@/api/researchArtifactDownload'
import {checkBinaryPreview,pdfPreviewMetrics} from '@/utils/researchBinaryPreview'
import type {PDFDocumentProxy,PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist'
const props=defineProps<{agentId:string;threadId:string;path:string}>()
const document=shallowRef<PDFDocumentProxy|null>(null),canvas=ref<HTMLCanvasElement|null>(null)
const loading=ref(false),rendering=ref(false),error=ref(''),page=ref(1),total=ref(0),zoom=ref(1),downloadUrl=ref('')
let generation=0,controller:AbortController|undefined,task:PDFDocumentLoadingTask|undefined,render:RenderTask|undefined
function clear(){generation++;controller?.abort();render?.cancel();render=undefined;void task?.destroy().catch(()=>{});task=undefined;document.value=null;total.value=0;loading.value=false;rendering.value=false;if(downloadUrl.value)URL.revokeObjectURL(downloadUrl.value);downloadUrl.value='';if(canvas.value){canvas.value.width=0;canvas.value.height=0}}
async function load(){
 clear();const token=generation,auth=authSnapshot();controller=new AbortController();loading.value=true;error.value='';page.value=1;zoom.value=1
 const valid=()=>token===generation&&sameAuth(auth)
 try{
  const blob=await readArtifactDownload(props.agentId,props.threadId,props.path,controller.signal)
  if(!valid())return
  const bytes=new Uint8Array(await blob.arrayBuffer());if(!valid())return
  checkBinaryPreview(bytes,'pdf');downloadUrl.value=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}))
  const [pdf,worker]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);if(!valid())return
  pdf.GlobalWorkerOptions.workerSrc=worker.default
  const assetBase=new URL('vendor/pdfjs-6.5.438/',window.document.baseURI).href
  const localTask=pdf.getDocument({data:bytes,useSystemFonts:true,cMapUrl:assetBase+'cmaps/',cMapPacked:true,standardFontDataUrl:assetBase+'standard_fonts/',wasmUrl:assetBase+'wasm/'});task=localTask
  const loaded=await localTask.promise;if(!valid()){void localTask.destroy().catch(()=>{});return}
  document.value=loaded;total.value=loaded.numPages;loading.value=false;await nextTick();await draw()
 }catch(cause){if(valid())error.value=cause instanceof Error?cause.message:'PDF 读取失败，请重新读取或下载查看。'}
 finally{if(valid())loading.value=false}
}
async function draw(){
 if(!document.value||!canvas.value)return
 const token=generation,auth=authSnapshot();rendering.value=true;error.value=''
 try{
  const pdfPage=await document.value.getPage(page.value);if(token!==generation||!sameAuth(auth))return
  const base=pdfPage.getViewport({scale:1}),metrics=pdfPreviewMetrics(base.width,base.height,zoom.value,window.devicePixelRatio||1)
  const viewport=pdfPage.getViewport({scale:metrics.scale}),ratio=metrics.ratio,target=canvas.value
  if(!target)return
  target.width=Math.ceil(viewport.width*ratio);target.height=Math.ceil(viewport.height*ratio);target.style.width=viewport.width+'px';target.style.height=viewport.height+'px'
  const ctx=target.getContext('2d');if(!ctx)throw Error('浏览器无法绘制 PDF，请下载查看。')
  render=pdfPage.render({canvas:target,canvasContext:ctx,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});await render.promise
 }catch(cause){if(token===generation&&sameAuth(auth)&&!(cause instanceof Error&&cause.name==='RenderingCancelledException'))error.value=cause instanceof Error?cause.message:'PDF 页面绘制失败。'}
 finally{if(token===generation)rendering.value=false}
}
function turn(delta:number){if(rendering.value)return;page.value=Math.max(1,Math.min(total.value,page.value+delta));void draw()}
function download(){if(!downloadUrl.value)return;const link=window.document.createElement('a');link.href=downloadUrl.value;link.download=props.path.split(/[/\\]/).at(-1)||'报告.pdf';link.click()}
function authChanged(){clear();error.value='登录状态已变化，请重新打开文件。'}
window.addEventListener(AUTH_CHANGE_EVENT,authChanged)
watch(()=>[props.agentId,props.threadId,props.path],()=>void load(),{immediate:true,flush:'sync'})
onBeforeUnmount(()=>{clear();window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})
</script>
<style scoped>
.binary-preview{color:#315f69;font-size:14px}.binary-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:12px;border-bottom:1px solid #d6e8e3;margin-bottom:12px}.binary-tools button,.binary-tools select{padding:7px 11px;border:1px solid #adcfc7;border-radius:8px;background:#fff;color:#087f7b;font:inherit;cursor:pointer;transition:background-color .2s,color .2s}.binary-tools button:hover:not(:disabled){background:#087f7b;color:white}.binary-tools button:disabled{opacity:.45;cursor:default}.binary-tools label{display:flex;gap:6px;align-items:center}.page-counter{font-variant-numeric:tabular-nums}.pdf-pages{max-height:65vh;min-height:160px;overflow:auto;background:#eaf1ef;padding:14px;border:1px solid #c9ded8;border-radius:9px}.pdf-pages canvas{display:block;margin:0 auto;background:#fff;box-shadow:0 2px 8px #123c4520}.preview-error{padding:12px;background:#fff4e8;color:#91491e;border-radius:8px;overflow-wrap:anywhere}button:focus-visible,select:focus-visible,.pdf-pages:focus-visible{outline:2px solid #168b7e;outline-offset:3px}@media(prefers-reduced-motion:reduce){button{transition:none}}
</style>
