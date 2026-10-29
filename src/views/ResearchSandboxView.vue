<template>
  <main class="sandbox-page">
    <header v-if="!taskId"><RouterLink to="/research/work?mode=analysis">← 返回研究工作台</RouterLink><span>市调演真 · 本机分析服务</span></header>
    <h1>已有数据分析</h1><p v-if="readOnly" role="status">当前阶段只读；可连接读取已有结果，不能创建、上传、运行或改写结果。</p>
    <p class="intro">上传调查数据并检查字段、描述统计或受限代码运行。结果在本机形成候选版本，正式项目与成果登记待接入。</p>
    <section aria-label="连接服务">
      <h2>连接本机服务</h2>
      <form @submit.prevent="connect"><label>访问令牌<input v-model="token" type="password" autocomplete="off" placeholder="粘贴本机服务令牌" /></label><button :disabled="busy || !token">连接</button></form>
      <p role="status" aria-live="polite">{{ feedback }}</p>
      <p class="muted">先启动本机分析服务，再使用访问令牌连接。打开网页不代表分析服务已连接；令牌仅保留在当前浏览器会话。</p>
    </section>
    <section v-if="connected" aria-label="工作区与输入">
      <h2>工作区与数据</h2>
      <div class="row"><label>工作区<select :value="workspace?.workspaceId || ''" :disabled="readOnly || busy || running || offline" @change="chooseWorkspace"><option value="" disabled>选择工作区</option><option v-for="item in workspaces" :key="item.workspaceId" :value="item.workspaceId">{{ item.title }}</option></select></label><label>研究任务<input v-model="title" maxlength="120" :readonly="taskTitle!==undefined" @input="emit('update:taskTitle',title)" /></label><button :disabled="readOnly || busy || running || offline || !title.trim()" @click="createWorkspace">创建工作区</button></div>
      <p v-if="workspace" class="muted">本机 workspaceId：{{ workspace.workspaceId }} · 业务 projectId 尚未接入</p>
      <label v-if="workspace" class="upload">选择并上传 CSV / XLSX（最多 10 MiB）<input type="file" accept=".csv,.xlsx" :disabled="readOnly || busy || running || offline" @change="upload" /></label>
      <ul class="files"><li v-for="file in workspace?.files || []" :key="file.fileId"><label><input type="checkbox" :value="file.fileId" v-model="selected" :disabled="readOnly || busy || running || offline" />{{ file.name }} · {{ file.size }} 字节</label><code>{{ file.sandboxPath }}</code><small>SHA-256 {{ file.sha256 }}</small></li></ul>
    </section>
    <section v-if="workspace && connected" aria-label="运行任务">
      <h2>运行任务</h2>
      <div class="row"><label>任务类型<select v-model="kind" :disabled="readOnly || busy || running || offline"><option value="parse">解析字段与预览</option><option value="statistics">描述统计</option><option value="python">受限 Python</option></select></label><label>超时（秒）<input type="number" v-model.number="timeout" min="1" max="120" :disabled="readOnly || busy || running || offline" /></label></div>
      <label v-if="kind==='statistics'">统计列名（逗号分隔；留空检查全部列）<input v-model="columns" :disabled="readOnly || busy || running || offline" /></label>
      <label v-if="kind==='python'">Python 代码<textarea v-model="code" rows="10" spellcheck="false" :disabled="readOnly || busy || running || offline" /></label>
      <p class="muted">输入路径见上方文件清单；结果写到 /work/output，支持 JSON、CSV、TXT、PNG。运行断网，最长 120 秒，内存 512 MiB。</p>
      <div class="row"><button :disabled="readOnly || busy || running || offline" @click="start">开始运行</button><button v-if="running" :disabled="busy || offline" @click="cancel">取消运行</button><button v-if="!readOnly && run && !running && run.executionStatus==='succeeded' && run.outputStatus==='failed'" :disabled="busy || offline" @click="retrySave">重试保存本次结果</button></div>
    </section>
    <section v-if="run" aria-label="运行结果">
      <h2>运行与保存</h2><p v-if="offline" role="alert">与服务失去连接，当前为最后一次读到的状态；请点击连接恢复核对。</p>
      <dl><dt>执行状态</dt><dd>{{ statusLabel(run.executionStatus) }}</dd><dt>结果保存</dt><dd>{{ statusLabel(run.outputStatus) }}</dd><dt>运行编号</dt><dd><code>{{ run.runId }}</code></dd></dl>
      <p v-if="run.error" role="alert">{{ run.error }}</p><details v-if="run.log"><summary>运行日志</summary><pre>{{ run.log }}</pre></details>
      <p v-if="!run.artifacts.length">{{ running ? '等待运行和保存完成。' : '本次没有可下载的已保存结果。' }}</p>
      <ul><li v-for="item in run.artifacts" :key="item.artifactId"><button :disabled="busy || offline" @click="download(item)">下载 {{ item.name }}</button><small>固定版本 {{ item.versionId }}</small></li></ul>
      <details v-if="events.length"><summary>本次运行事件</summary><ol><li v-for="event in events" :key="event.sequence">{{ event.sequence }} · {{ event.type }}</li></ol></details>
      <p class="muted">计算完成与结果保存分别显示；结果仍需人工审阅，未自动采纳。</p>
    </section>
  </main>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { sandboxClient, type SandboxWorkspace, type SandboxRun, type SandboxArtifact } from '@/api/researchSandbox'
import { acceptsEvent, isRunning } from '@/utils/research-sandbox-state.js'
import { createResearchIntakeDraft, loadResearchIntakeDraft, recordSelectedInput, saveResearchIntakeDraft } from '@/utils/research-intake'
import { sandboxRefKey } from '@/utils/researchDrafts'
import type { SandboxReference, SelectedInputMetadata } from '@/types/research-contracts'
const props=defineProps<{taskTitle?:string;taskId?:string;readOnly?:boolean;initialSandboxRef?:SandboxReference|null;persistSandboxReference?:(taskId:string,reference:SandboxReference)=>void;persistInputFile?:(taskId:string,file:SelectedInputMetadata)=>void}>()
const referenceKey=sandboxRefKey(props.taskId)
const emit=defineEmits<{ 'update:taskTitle':[value:string]; 'update:inputFile':[value:{name:string;size:number;lastModified:number}|null]; 'update:sandboxRef':[value:SandboxReference] }>()
const token=ref(sessionStorage.getItem('research-sandbox-token') || '')
const connected=ref(false), busy=ref(false), offline=ref(false), feedback=ref('请填写本机访问令牌后连接。')
const workspaces=ref<SandboxWorkspace[]>([]), workspace=ref<SandboxWorkspace|null>(null), run=ref<SandboxRun|null>(null)
const intakeDraft=ref(props.taskId?createResearchIntakeDraft(props.taskId):(loadResearchIntakeDraft(localStorage) || createResearchIntakeDraft('local-'+crypto.randomUUID())))
const title=ref(props.taskTitle || intakeDraft.value.title || '我的数据分析'), selected=ref<string[]>([])
watch(()=>props.taskTitle,value=>{if(value!==undefined)title.value=value})
const kind=ref('parse'), columns=ref(''), timeout=ref(30)
const code=ref('import json\nfrom pathlib import Path\nPath("/work/output/result.json").write_text(json.dumps({"hello": "sandbox"}))\n')
const events=ref<any[]>([]); let sequence=0, generation=0, timer:ReturnType<typeof setTimeout>|undefined
let disposed=false
const running=computed(()=>isRunning(run.value))
const api=()=>sandboxClient(token.value)
const statusLabel=(value:string)=>({queued:'排队中',running:'执行中',succeeded:'计算完成',failed:'失败',cancelled:'已取消',timed_out:'已超时',interrupted:'已中断',none:'无结果',pending:'等待保存',available:'已保存'}[value] || value)
async function action(fn:()=>Promise<void>) { busy.value=true; try{await fn()}catch(e){if(e instanceof Error && ['SandboxConnectionError','SandboxAuthenticationError'].includes(e.name)){offline.value=true;if(e.name==='SandboxAuthenticationError')connected.value=false}feedback.value=e instanceof Error?e.message:'操作失败'}finally{busy.value=false} }
function remember() { if(props.readOnly||!workspace.value)return;const reference={workspaceId:workspace.value.workspaceId,runId:run.value?.runId || null};if(props.taskId&&props.persistSandboxReference){props.persistSandboxReference(props.taskId,reference)}else if(props.taskId){emit('update:sandboxRef',reference)}else{localStorage.setItem(referenceKey,JSON.stringify(reference))} }
function clearPolling(){ generation++; if(timer)clearTimeout(timer) }
async function poll(epoch:number) {
  const current=run.value; if(disposed || !current || epoch!==generation)return
  try {
    const client=api(); const [next,batch]=await Promise.all([client.run(current.runId),client.events(current.runId,sequence)])
    if(disposed || epoch!==generation || run.value?.runId!==next.runId || workspace.value?.workspaceId!==next.workspaceId || current.inputFingerprint!==next.inputFingerprint)return
    for(const event of batch.events)if(acceptsEvent(current,sequence,event)){events.value.push(event);sequence=event.sequence}
    run.value=next;offline.value=false; remember()
    if(isRunning(next) || next.outputStatus==='pending')timer=setTimeout(()=>poll(epoch),900)
  }catch(e){if(!disposed&&epoch===generation){offline.value=true;feedback.value=e instanceof Error?e.message:'服务暂时不可达，请重新连接以核对真实状态。'}}
}
async function restoreRun(id:string){clearPolling();const restored=await api().run(id);if(restored.workspaceId!==workspace.value?.workspaceId)throw new Error('历史运行不属于当前工作区，未恢复该运行。');run.value=restored;events.value=[];sequence=0;remember();void poll(generation)}
async function connect(){await action(async()=>{
  clearPolling();connected.value=false;const list=await api().workspaces(); workspaces.value=list
  sessionStorage.setItem('research-sandbox-token',token.value);connected.value=true;offline.value=false;feedback.value='本机服务已连接。'
  let saved:any=null;try{saved=props.taskId?props.initialSandboxRef:JSON.parse(localStorage.getItem(referenceKey) || 'null')}catch{}
  workspace.value=null;run.value=null;selected.value=[]
  if(saved && list.some(w=>w.workspaceId===saved.workspaceId)){workspace.value=await api().workspace(saved.workspaceId);if(saved.runId)await restoreRun(saved.runId)}
})}
async function chooseWorkspace(event:Event){if(props.readOnly)return;await action(async()=>{clearPolling();run.value=null;events.value=[];selected.value=[];workspace.value=await api().workspace((event.target as HTMLSelectElement).value);remember()})}
async function createWorkspace(){if(props.readOnly)return;await action(async()=>{clearPolling();intakeDraft.value={...intakeDraft.value,title:title.value.trim(),updatedAt:Date.now()};if(!props.taskId)intakeDraft.value=saveResearchIntakeDraft(localStorage,intakeDraft.value);workspace.value=await api().create(title.value.trim());run.value=null;selected.value=[];remember();workspaces.value=await api().workspaces();feedback.value='本机工作区已创建。'})}
async function upload(event:Event){if(props.readOnly)return;const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file || !workspace.value)return;await action(async()=>{if(file.size>10*1024*1024)throw new Error('文件超过 10 MiB。');intakeDraft.value=recordSelectedInput({...intakeDraft.value,title:title.value},file);if(!props.taskId)intakeDraft.value=saveResearchIntakeDraft(localStorage,intakeDraft.value);const added=await api().upload(workspace.value!.workspaceId,file);workspace.value=await api().workspace(workspace.value!.workspaceId);selected.value=[added.fileId];if(props.taskId&&props.persistInputFile&&intakeDraft.value.inputFile){props.persistInputFile(props.taskId,intakeDraft.value.inputFile)}else{emit('update:inputFile',intakeDraft.value.inputFile)};feedback.value='调查数据已上传至本机沙箱，草稿仅保存文件元数据。'});input.value=''}
async function start(){if(props.readOnly)return;await action(async()=>{if(!workspace.value)return;if(kind.value!=='python' && selected.value.length!==1)throw new Error('解析或统计请只选择一份数据文件。');if(selected.value.length>10)throw new Error('一次最多选择 10 份文件。');clearPolling();run.value=await api().start(workspace.value.workspaceId,{kind:kind.value,fileIds:selected.value,code:kind.value==='python'?code.value:'',columns:kind.value==='statistics'?columns.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean):[],timeoutSeconds:timeout.value},crypto.randomUUID());events.value=[];sequence=0;offline.value=false;remember();feedback.value='任务已登记。';void poll(generation)})}
async function cancel(){if(props.readOnly)return;await action(async()=>{if(run.value){await api().cancel(run.value.runId);feedback.value='已请求取消，正在核对实际终止状态。';void poll(generation)}})}
async function retrySave(){if(props.readOnly)return;await action(async()=>{if(run.value){run.value=await api().commit(run.value.runId);feedback.value='本次结果保存状态已更新。';void poll(generation)}})}
async function download(item:SandboxArtifact){await action(async()=>{if(!run.value)return;const blob=await api().download(run.value.runId,item);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.value='固定版本已校验并下载。'})}
onMounted(()=>{if(token.value)void connect()});onUnmounted(()=>{disposed=true;clearPolling()})
</script>
<style scoped>
.sandbox-page{max-width:1100px;margin:auto;padding:32px 28px 64px;color:#24334b;font-family:inherit}header,.row,form{display:flex;gap:20px;align-items:end;flex-wrap:wrap}header{justify-content:space-between;align-items:center;margin-bottom:32px}a{color:#3265a4}h1{font-size:30px;margin:0 0 12px}h2{font-size:19px;margin:0 0 20px}.intro{max-width:72ch;line-height:1.7}section{padding:28px 0;border-bottom:1px solid #dce3ed}label{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;font-size:14px}input,select,textarea,button{font:inherit;border:1px solid #bfcbdc;border-radius:7px;padding:10px 12px;background:#fff;color:inherit}input[type=password]{min-width:280px}input[type=checkbox]{margin:0 8px 0 0}button{cursor:pointer;background:#244f88;color:#fff;min-height:42px}button:disabled{opacity:.5;cursor:default}button:hover:enabled{background:#1b3f70}input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #8fb2e6;outline-offset:3px}textarea{width:100%;box-sizing:border-box;font-family:monospace;line-height:1.6}code,small{overflow-wrap:anywhere}small{display:block;font-size:12px;color:#596a80;margin-top:8px}.muted{font-size:13px;color:#596a80;line-height:1.7}.files{padding:0;list-style:none}.files li{padding:16px 0;border-bottom:1px solid #e5eaf1}.files label{display:block}.files code{font-size:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f4f8;padding:16px;max-height:300px;overflow:auto}dl{display:grid;grid-template-columns:110px 1fr;gap:12px}dd{margin:0;overflow-wrap:anywhere}summary{cursor:pointer;padding:12px 0}ul{padding-left:20px}.upload{margin-top:18px}p[role=alert]{color:#a32f2f}::selection{background:#cadcf5}@media(max-width:600px){.sandbox-page{padding:20px 16px}header{align-items:start}input[type=password]{min-width:0}form{align-items:stretch}form label{flex:1 1 200px}.row label{width:100%}h1{font-size:25px}}
</style>
