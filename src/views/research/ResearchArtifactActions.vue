<template>
 <div class="artifact-actions">
  <div class="artifact-action-buttons">
   <button type="button" class="artifact-action preview-action" :disabled="disabled" @click="$emit('preview')">预览</button>
   <button type="button" class="artifact-action download-action" :disabled="disabled||busy||!agentId||!threadId" :aria-busy="busy" @click="download"><span>{{busy?'读取中…':'下载'}}</span></button>
  </div>
  <p v-if="error" class="artifact-download-error" role="alert">{{error}}</p>
  <p v-else-if="notice" class="artifact-download-notice" role="status">{{notice}}</p>
 </div>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {readArtifactDownload} from '@/api/researchArtifactDownload'
const props=defineProps<{agentId:string;threadId:string;scope:string;path:string;fileName:string;disabled?:boolean}>()
defineEmits<{preview:[]}>()
const busy=ref(false),error=ref(''),notice=ref('')
let controller:AbortController|undefined,generation=0
const identity=computed(()=>JSON.stringify([props.scope,props.agentId,props.threadId,props.path]))
function reset(){generation++;controller?.abort();busy.value=false;error.value='';notice.value=''}
watch(identity,reset,{flush:'sync'})
onBeforeUnmount(reset)
async function download(){
 if(props.disabled||busy.value||!props.agentId||!props.threadId)return
 reset();const token=generation,scope=identity.value
 controller=new AbortController();busy.value=true
 const current=()=>token===generation&&scope===identity.value
 try{
  const blob=await readArtifactDownload(props.agentId,props.threadId,props.path,controller.signal)
  if(!current())return
  const url=URL.createObjectURL(blob),link=document.createElement('a')
  link.href=url;link.download=props.fileName;link.style.display='none';document.body.append(link)
  try{link.click();notice.value='已发起下载，请查看浏览器下载列表。'}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }catch(cause){if(current())error.value=cause instanceof Error?cause.message:'下载失败，请稍后重试。'}
 finally{if(current())busy.value=false}
}
</script>
<style scoped>
.artifact-actions{margin-top:auto;min-width:0}
.artifact-action-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.artifact-action{display:flex;align-items:center;justify-content:center;gap:7px;position:relative;min-width:0;min-height:36px;padding:7px 9px;border:1px solid #9DCFC7;border-radius:9px;line-height:1.4;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background-color .2s ease,color .2s ease,border-color .2s ease,box-shadow .2s ease,transform .16s ease}
.preview-action{background:#fff;color:#0B746C}
.download-action{background:#E5F5F0;color:#086D63}
.preview-action:hover:not(:disabled),.preview-action:focus-visible{background:#0B8279;color:#fff;border-color:#0B8279;box-shadow:0 3px 8px #0b827920;transform:translateY(-1px)}
.download-action:hover:not(:disabled),.download-action:focus-visible{background:#075E56;color:#fff;border-color:#075E56;box-shadow:0 3px 8px #075e5626;transform:translateY(-1px)}
.artifact-action:active:not(:disabled){transform:translateY(1px);box-shadow:none}
.artifact-action:focus-visible{outline:2px solid #34A99B;outline-offset:3px}
.artifact-action:disabled{cursor:default;opacity:.55;transform:none;box-shadow:none}
.artifact-download-error,.artifact-download-notice{margin:7px 0 0;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.artifact-download-error{color:#A13C30}.artifact-download-notice{color:#3D756B}
@media(prefers-reduced-motion:reduce){.artifact-action{transition:none}.artifact-action:hover:not(:disabled),.artifact-action:active:not(:disabled),.artifact-action:focus-visible{transform:none}}
</style>
