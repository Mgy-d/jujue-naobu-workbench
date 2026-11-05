<template>
 <section class="business-panel" aria-label="项目、材料与版本">
  <h2>项目、材料与版本</h2>
  <p v-if="isMock" class="mock-warning" role="status">MOCK 测试环境 · 合成服务响应<br>不代表真实服务器保存或联调通过；只使用合成资料。</p>
  <p v-else class="unavailable">正式业务服务待接入；下方操作会明确提示缺少依赖，本机编辑与保存仍可用。</p>
  <div class="business-actions"><button :disabled="session.busy || !!session.pendingProjectId || !!bindingError" @click="createProject">{{isMock?'创建项目（Mock）':'创建正式项目'}}</button><button v-if="session.pendingProjectId" :disabled="session.busy" @click="openProject">重新读取项目</button></div>
  <p v-if="bindingError" role="alert">{{bindingError}}</p>
  <p v-if="session.error" role="alert" class="business-error">{{session.error.message}} <small>{{session.error.code}}</small></p>
  <p v-if="session.message" role="status" class="business-feedback">{{session.message}}</p>
  <p v-if="session.busy" role="status">请求处理中，请勿重复提交。</p>
  <template v-if="session.project">
   <dl><div><dt>{{isMock?'Mock 项目':'正式项目'}}</dt><dd data-testid="project-id">{{session.project.projectId}}</dd></div><div><dt>服务修订</dt><dd data-testid="project-revision">{{session.project.revision}}</dd></div><div><dt>服务当前阶段</dt><dd data-testid="server-phase">{{stages[session.project.activePhase]?.title}}</dd></div><div><dt>当前页面</dt><dd>{{stages[task.viewedPhase]?.title}}（浏览不推进）</dd></div><div><dt>访问权限</dt><dd>{{session.project.permissions.write?'可写':'只读'}} · {{session.project.permissions.confirm?'可确认':'不可确认'}}</dd></div></dl>
   <p v-if="readOnly" class="locked-notice" role="status">当前阶段只读；历史锁定或权限以服务返回为准。</p>
   <details open><summary>研究材料与来源</summary>
    <label>选择研究材料<input :key="task.localTaskId" type="file" aria-label="选择研究材料" :disabled="session.busy||readOnly" @change="selectFile" /></label>
    <p data-testid="selected-file">{{selectedFile?'已选文件：'+selectedFile.name+'；尚未上传':'尚未选择新文件'}}</p>
    <button :disabled="!selectedFile||session.busy||readOnly" @click="upload">上传所选材料</button>
    <p class="help">原件与解析分别登记。上传不等于解析完成或来源已经核实；首版单文件最多 20MB。</p>
    <ul class="material-list"><li v-for="material in session.project.files" :key="material.fileId"><strong>{{material.filename}}</strong><span>{{parseLabel(material.parseStatus)}}</span><small>{{material.parseMessage}}</small><small>文件 {{material.fileId}} · 来源 {{material.sourceId}}</small><button :disabled="session.busy||downloading" @click="download(material)">下载原件：{{material.filename}}</button></li></ul>
    <p v-if="!session.project.files.length">项目尚无已上传材料。</p>
   </details>
   <details open><summary>当前阶段候选与固定版本</summary>
    <button :disabled="session.busy||readOnly||!supported" @click="saveCandidate">{{isMock?'保存候选（Mock）':'保存正式候选'}}</button>
    <p v-if="!supported" class="help">此阶段的业务编辑与成果结构尚未交付，当前不提交空候选。</p>
    <p class="help">保存固定快照，不会自动采用或推进。历史预览不会覆盖当前编辑。</p>
    <label>选择固定版本<select v-model="selectedVersion" aria-label="选择固定版本" :disabled="session.busy"><option value="">请选择</option><option v-for="item in versions" :key="item.ref.versionId" :value="item.ref.versionId">{{item.ref.versionId}}{{adoptedVersion===item.ref.versionId?' · 已采用':''}}</option></select></label>
    <button :disabled="!selectedVersion||session.busy" @click="previewVersion">读取所选固定版本</button>
    <div v-if="session.preview && session.preview.phase===task.viewedPhase" class="version-preview"><strong>固定版本 {{session.preview.ref.versionId}}</strong><pre>{{JSON.stringify(session.preview.content,null,2)}}</pre><button :disabled="readOnly||session.busy||!canRestore" @click="restorePreview">将预览版本载入本机编辑</button><p class="help">仅替换当前阶段的本机编辑；不回滚服务端、不创建新版本。</p></div>
   </details>
   <details open><summary>阶段检查与确认</summary>
    <button :disabled="session.busy||readOnly||!supported" @click="checkPhase">请求阶段检查</button>
    <div v-if="session.checkResult" class="phase-check"><strong>{{session.checkResult.canConfirm?'检查可确认，请核对风险':'检查未通过'}}</strong><ul><li v-for="issue in session.checkResult.issues" :key="issue">缺项：{{issue}}</li><li v-for="risk in session.checkResult.risks" :key="risk">风险：{{risk}}</li></ul><label v-if="session.checkResult.canConfirm"><input type="checkbox" v-model="reviewed" />我已阅读本次检查与风险</label></div>
    <button :disabled="session.busy||readOnly||!reviewed||!session.checkResult?.canConfirm||!session.project.permissions.confirm" @click="confirmPhase">{{isMock?'确认本阶段（Mock）':'确认本阶段'}}</button>
    <p class="help">服务负责校验、采用和锁定。新增编辑后必须重新保存候选并检查；只点击阶段导航不会确认。</p>
   </details>
  </template>
 </section>
</template>
<script setup lang="ts">
import {computed,markRaw,onBeforeUnmount,reactive,ref,watch} from 'vue';
import {createBusinessGateway,cleanPhaseContent} from '@/api/researchBusiness';
import {BusinessSession,phaseContent,phaseKey,readProjectLink,writeProjectLink} from '@/utils/researchBusinessSession';
import {stagesFor} from '@/utils/researchDrafts';
import type {LocalResearchTask} from '@/types/research-contracts';
import type {BusinessProject,FixedCandidate,Material} from '@/types/research-business';
const props=defineProps<{task:LocalResearchTask}>(),emit=defineEmits<{'read-only':[value:boolean];'restore-version':[value:FixedCandidate];'project-state':[value:BusinessProject|null];'history-version':[value:FixedCandidate|null];'binding-blocked':[value:boolean]}>();
// Compile-time opt-in only. A URL query or cached token cannot enable Mock in normal builds.
const isMock=import.meta.env.VITE_RESEARCH_BUSINESS_MODE==='mock';
const gateway=markRaw(createBusinessGateway({mode:isMock?'mock':'unavailable'})),session=reactive(new BusinessSession(gateway));
const selectedFile=ref<File|null>(null),selectedVersion=ref(''),bindingError=ref(''),downloading=ref(false),reviewed=ref(false);
let disposed=false,downloadEpoch=0,historyEpoch=0;
const stages=computed(()=>stagesFor(props.task.workflowKind)),readOnly=computed(()=>session.isReadOnly(props.task.viewedPhase));
const supported=computed(()=>!!phaseContent(props.task)),versions=computed(()=>session.project?.candidates.filter(s=>s.phase===props.task.viewedPhase)??[]);
const adoptedVersion=computed(()=>session.project?.adopted.find(s=>s.phase===props.task.viewedPhase)?.ref.versionId);
const canRestore=computed(()=>session.previewKey===phaseKey(props.task));
watch(readOnly,v=>emit('read-only',v),{immediate:true,flush:'sync'});
watch(()=>!!session.pendingProjectId&&!session.project,value=>emit('binding-blocked',value),{immediate:true,flush:'sync'});
watch(()=>[props.task.localTaskId,props.task.workflowKind],()=>{selectedFile.value=null;selectedVersion.value='';bindingError.value='';reviewed.value=false;downloadEpoch++;downloading.value=false;void openProject()},{immediate:true,flush:'sync'});
watch(()=>phaseKey(props.task),key=>{session.invalidate(key);reviewed.value=false;selectedVersion.value='';session.preview=null},{immediate:true,flush:'sync'});
watch(()=>session.checkResult,()=>reviewed.value=false);
watch(()=>session.project,value=>emit('project-state',value),{immediate:true,flush:'sync'});
const historyRef=computed(()=>session.project?.lockedPhases.includes(props.task.viewedPhase)?session.project.adopted.find(s=>s.phase===props.task.viewedPhase)?.ref:null);
watch(()=>[props.task.localTaskId,props.task.viewedPhase,historyRef.value?.versionId,session.project?.revision],async()=>{
 const token=++historyEpoch,p=session.project,reference=historyRef.value,phase=props.task.viewedPhase;
 emit('history-version',null);
 if(!p||!reference)return;
 const result=await gateway.readVersion(reference,phase);
 if(disposed||token!==historyEpoch||session.project?.projectId!==p.projectId)return;
 if(!result.ok){session.reportFailure(result.error);return}
 if(!cleanPhaseContent(p.workflowKind,phase,result.value.content)){session.reportFailure({code:'INVALID_RESPONSE',message:'已采用的历史版本结构无效，未使用本机草稿代替。'});return}
 emit('history-version',result.value);
},{immediate:true,flush:'sync'});

async function openProject(){let id:string|null=null;try{if(isMock)id=readProjectLink(localStorage,props.task.localTaskId)}catch(e){bindingError.value=e instanceof Error?e.message:'项目关联读取失败';session.dispose();return}await session.open({localTaskId:props.task.localTaskId,workflowKind:props.task.workflowKind},id)}
async function createProject(){if(bindingError.value)return;await session.create(props.task.title,'create-'+props.task.localTaskId);if(disposed||!session.project)return;try{writeProjectLink(localStorage,session.project.clientTaskId,session.project.projectId)}catch{bindingError.value='项目可能已经创建，但本机关联未保存。请勿重复创建；请保留上方项目编号。'}}
function selectFile(e:Event){selectedFile.value=(e.target as HTMLInputElement).files?.[0]??null}
async function upload(){const file=selectedFile.value,taskId=props.task.localTaskId;if(!file)return;await session.upload(file,crypto.randomUUID());if(disposed||props.task.localTaskId!==taskId)return;if(!session.error)selectedFile.value=null}
async function saveCandidate(){if(!session.project){session.error={code:'CAPABILITY_UNAVAILABLE',message:isMock?'请先创建或继续项目。':'正式项目、候选保存和阶段确认接口尚未接入。'};return}await session.save(props.task,crypto.randomUUID())}
async function previewVersion(){const item=versions.value.find(s=>s.ref.versionId===selectedVersion.value);if(item)await session.read(item.ref,item.phase,phaseKey(props.task))}
function restorePreview(){const version=session.preview;if(!version||!canRestore.value||readOnly.value||version.phase!==props.task.viewedPhase||!cleanPhaseContent(props.task.workflowKind,version.phase,version.content))return;emit('restore-version',JSON.parse(JSON.stringify(version)))}
async function checkPhase(){await session.check(props.task.viewedPhase,phaseKey(props.task))}
async function confirmPhase(){if(reviewed.value)await session.confirm(props.task.viewedPhase,phaseKey(props.task))}
const parseLabel=(value:string)=>({uploaded:'已上传，待解析',parsing:'解析中',failed:'解析失败，原件保留',ready:'可使用（未核实来源）'}[value]??'未知状态');
async function download(material:Material){const p=session.project;if(!p||downloading.value)return;const token=++downloadEpoch;downloading.value=true;try{const result=await gateway.readMaterial(p.projectId,material.fileId);if(disposed||token!==downloadEpoch||session.project?.projectId!==p.projectId)return;if(!result.ok){session.reportFailure(result.error);return}const url=URL.createObjectURL(result.value),a=document.createElement('a');a.href=url;a.download=material.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}finally{if(token===downloadEpoch)downloading.value=false}}
onBeforeUnmount(()=>{disposed=true;downloadEpoch++;historyEpoch++;session.dispose()});
defineExpose({saveCandidate});
</script>
<style scoped>
.business-panel{margin-top:24px;padding-top:18px;border-top:1px solid #dcedee;font-size:13px;line-height:1.7;color:#234b3e}.business-panel h2{font-size:16px;margin:0 0 10px}.business-panel p{margin:8px 0;overflow-wrap:anywhere}.mock-warning{padding:10px;background:#fff4d9;border:1px solid #dfc57e;border-radius:6px;color:#674c17;font-weight:600}.unavailable,.help{color:#637c77;font-size:12px}.business-actions{display:flex;gap:6px;flex-wrap:wrap}button,select,input{font:inherit;max-width:100%;box-sizing:border-box}button{padding:7px 9px;border:1px solid #176f5b;border-radius:5px;background:#176f5b;color:white;cursor:pointer;margin:5px 4px 5px 0;line-height:1.5}button:disabled{background:#eef1ee;color:#76857d;border-color:#dce5df;cursor:default}.business-error{color:#9b392a;background:#fff2ed;padding:8px}.business-error small{display:block}.business-feedback{background:#eef7f2;padding:8px}.locked-notice{background:#fff4d9;padding:8px}dl{margin:12px 0}dl>div{display:block;margin:6px 0}dt{font-size:12px;color:#637c77}dd{margin:0;overflow-wrap:anywhere}details{border-top:1px solid #dcedee;padding:12px 0}summary{font-weight:600;cursor:pointer;margin-bottom:9px}label{display:block;margin:8px 0}input[type=file]{display:block;width:100%;font-size:12px}select{width:100%;padding:6px;border:1px solid #bfd3cb;border-radius:4px;background:white}.material-list{list-style:none;margin:10px 0;padding:0}.material-list li{padding:9px 0;border-top:1px dashed #dcedee}.material-list strong,.material-list span,.material-list small{display:block;overflow-wrap:anywhere}.material-list small{color:#637c77;font-size:11px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:220px;overflow:auto;padding:8px;background:#f4f7f5}.phase-check{padding:8px;background:#f3f7ed}.phase-check ul{padding-left:16px}.phase-check input[type=checkbox]{vertical-align:middle}button:focus-visible,summary:focus-visible{outline:2px solid #0b6e68;outline-offset:2px}
</style>
