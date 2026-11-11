<template>
<section class="binary-preview" aria-label="PPT 预览">
 <div class="binary-tools"><button type="button" :disabled="loading||rendering||!total||page<=1" @click="turn(-1)">上一页</button><span v-if="total" class="page-counter">{{page}} / {{total}} 页</span><button type="button" :disabled="loading||rendering||!total||page>=total" @click="turn(1)">下一页</button><button type="button" :disabled="!downloadUrl" @click="download">下载 PPT</button><button v-if="error" type="button" @click="load">重新读取</button></div>
 <p v-if="loading||rendering" role="status">{{loading?'正在读取并绘制幻灯片…':'正在绘制幻灯片…'}}</p>
 <p v-if="error" class="preview-error" role="alert">{{error}}</p>
 <div ref="stage" class="ppt-stage" aria-label="幻灯片画面" @click.capture="blockLink" @keydown.capture="blockLink"></div>
 <p class="preview-note">预览保留常用文字、图片和形状；动画、特殊效果及字体排版请以下载后的原文件为准。</p>
 <p v-if="partial" class="preview-error" role="status">部分元素未能完整绘制，请下载原文件查看。</p>
</section>
</template>
<script setup lang="ts">
import {ref,watch,onBeforeUnmount,nextTick} from 'vue'
import {authSnapshot,sameAuth,AUTH_CHANGE_EVENT} from '@/api/http'
import {readArtifactDownload} from '@/api/researchArtifactDownload'
import {checkBinaryPreview} from '@/utils/researchBinaryPreview'
import type {PptxViewer} from '@aiden0z/pptx-renderer'
const props=defineProps<{agentId:string;threadId:string;path:string;readFile?:(signal:AbortSignal)=>Promise<Blob>}>()
const stage=ref<HTMLElement|null>(null),loading=ref(false),rendering=ref(false),error=ref(''),partial=ref(false),page=ref(1),total=ref(0),downloadUrl=ref('')
let generation=0,controller:AbortController|undefined,viewer:PptxViewer|undefined
function clear(){generation++;controller?.abort();viewer?.destroy();viewer=undefined;stage.value?.replaceChildren();loading.value=false;rendering.value=false;total.value=0;partial.value=false;if(downloadUrl.value)URL.revokeObjectURL(downloadUrl.value);downloadUrl.value=''}
async function load(){
 clear();const token=generation,auth=authSnapshot();controller=new AbortController();loading.value=true;error.value='';page.value=1
 const valid=()=>token===generation&&sameAuth(auth)
 try{
  const blob=(props.readFile?await props.readFile(controller.signal):await readArtifactDownload(props.agentId,props.threadId,props.path,controller.signal));if(!valid())return
  const bytes=new Uint8Array(await blob.arrayBuffer());if(!valid())return
  checkBinaryPreview(bytes,'pptx');downloadUrl.value=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}))
  const {PptxViewer,RECOMMENDED_ZIP_LIMITS}=await import('@aiden0z/pptx-renderer');await nextTick();if(!valid()||!stage.value)return
  const host=window.document.createElement('div');stage.value.replaceChildren(host)
  const local=new PptxViewer(host,{fitMode:'contain',externalMedia:'block',pdfjs:false,zipLimits:RECOMMENDED_ZIP_LIMITS,onNodeError:()=>{if(valid())partial.value=true},onSlideError:()=>{if(valid())error.value='这一页未能完整绘制，请下载原文件查看。'}})
  viewer=local
  await local.open(bytes.buffer,{renderMode:'slide',signal:controller.signal});if(!valid()){local.destroy();return}
  total.value=local.slideCount;if(!total.value)throw Error('PPT 中没有可预览的幻灯片。')
 }catch(cause){if(valid())error.value=cause instanceof Error?cause.message:'幻灯片绘制失败，请下载原文件查看。'}
 finally{if(valid())loading.value=false}
}
async function turn(delta:number){
 if(!viewer||loading.value||rendering.value)return
 const token=generation,auth=authSnapshot(),next=Math.max(1,Math.min(total.value,page.value+delta));rendering.value=true;error.value=''
 try{await viewer.goToSlide(next-1);if(token===generation&&sameAuth(auth))page.value=next}
 catch(cause){if(token===generation&&sameAuth(auth))error.value=cause instanceof Error?cause.message:'幻灯片绘制失败。'}
 finally{if(token===generation)rendering.value=false}
}
function blockLink(event:Event){if((event.target as Element)?.closest?.('a')){event.preventDefault();event.stopImmediatePropagation()}}
function download(){if(!downloadUrl.value)return;const link=window.document.createElement('a');link.href=downloadUrl.value;link.download=props.path.split(/[/\\]/).at(-1)||'答辩.pptx';link.click()}
function authChanged(){clear();error.value='登录状态已变化，请重新打开文件。'}
window.addEventListener(AUTH_CHANGE_EVENT,authChanged)
watch(()=>[props.agentId,props.threadId,props.path],()=>void load(),{immediate:true,flush:'sync'})
onBeforeUnmount(()=>{clear();window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})
</script>
<style scoped>
.binary-preview{color:#315f69;font-size:14px}.binary-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:12px;border-bottom:1px solid #d6e8e3;margin-bottom:12px}.binary-tools button{padding:7px 11px;border:1px solid #adcfc7;border-radius:8px;background:#fff;color:#087f7b;font:inherit;cursor:pointer;transition:background-color .2s,color .2s}.binary-tools button:hover:not(:disabled){background:#087f7b;color:white}.binary-tools button:disabled{opacity:.45;cursor:default}.page-counter{font-variant-numeric:tabular-nums}.ppt-stage{max-height:65vh;min-height:220px;overflow:auto;padding:12px;border:1px solid #c9ded8;border-radius:9px;background:#eaf1ef}.ppt-stage :deep(a){pointer-events:none}.preview-note{font-size:12px;color:#678488;line-height:1.7}.preview-error{padding:12px;background:#fff4e8;color:#91491e;border-radius:8px;overflow-wrap:anywhere}button:focus-visible{outline:2px solid #168b7e;outline-offset:3px}@media(prefers-reduced-motion:reduce){button{transition:none}}
</style>
