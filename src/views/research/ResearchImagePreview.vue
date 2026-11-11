<template>
  <section class="image-preview" aria-label="图片预览">
    <div class="image-tools"><button type="button" :disabled="loading" @click="load">重新读取</button><button type="button" :disabled="!url" @click="download">下载图片</button></div>
    <p v-if="loading" role="status">正在读取图片…</p>
    <p v-else-if="error" role="alert" class="image-error">{{error}}</p>
    <div v-else-if="url" class="image-stage"><img :src="url" :alt="path.split('/').at(-1)" @error="error='图片无法显示，请下载检查原文件是否完整。'" /></div>
  </section>
</template>
<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
import {authSnapshot,sameAuth,AUTH_CHANGE_EVENT} from '@/api/http'
import {readArtifactDownload} from '@/api/researchArtifactDownload'
const props=defineProps<{agentId:string;threadId:string;path:string;readFile?:(signal:AbortSignal)=>Promise<Blob>}>()
const url=ref(''),loading=ref(false),error=ref('')
let generation=0,controller:AbortController|undefined
function clear(){generation++;controller?.abort();if(url.value)URL.revokeObjectURL(url.value);url.value='';loading.value=false}
async function load(){
 clear();const token=generation,auth=authSnapshot();controller=new AbortController();loading.value=true;error.value=''
 const valid=()=>token===generation&&sameAuth(auth)
 try{
  const blob=(props.readFile?await props.readFile(controller.signal):await readArtifactDownload(props.agentId,props.threadId,props.path,controller.signal))
  if(!valid())return
  const ext=props.path.split('.').at(-1)?.toLowerCase()||''
  const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',bmp:'image/bmp',avif:'image/avif'}
  if(!mime[ext])throw Error('此图片格式暂不支持预览。')
  url.value=URL.createObjectURL(new Blob([blob],{type:mime[ext]}))
 }catch(cause){if(valid())error.value=cause instanceof Error?cause.message:'图片读取失败，请重试。'}
 finally{if(valid())loading.value=false}
}
function download(){if(!url.value)return;const link=document.createElement('a');link.href=url.value;link.download=props.path.split('/').at(-1)||'图片';link.click()}
function authChanged(){clear();error.value='登录状态已变化，请重新打开图片。'}
window.addEventListener(AUTH_CHANGE_EVENT,authChanged)
watch(()=>[props.agentId,props.threadId,props.path],()=>void load(),{immediate:true,flush:'sync'})
onBeforeUnmount(()=>{clear();window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})
</script>
<style scoped>
.image-tools{display:flex;gap:8px;margin-bottom:12px}.image-tools button{padding:8px 14px;border:1px solid #adcfc7;border-radius:8px;background:#fff;color:#087f7b;font:inherit;cursor:pointer;transition:background-color .18s,color .18s}.image-tools button:hover:not(:disabled){background:#087f7b;color:#fff}.image-tools button:disabled{opacity:.5;cursor:default}.image-tools button:focus-visible{outline:2px solid #168b7e;outline-offset:3px}.image-stage{max-height:68vh;overflow:auto;background:#f2f7f5;border:1px solid #c9ded8;border-radius:10px;padding:12px;text-align:center}.image-stage img{display:block;max-width:100%;height:auto;margin:auto}.image-error{padding:12px;background:#fff4e8;color:#91491e;border-radius:8px;overflow-wrap:anywhere}@media(prefers-reduced-motion:reduce){button{transition:none}}
</style>
