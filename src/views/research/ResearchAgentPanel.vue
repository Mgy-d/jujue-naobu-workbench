<template>
  <section class="research-agent" aria-label="市调智能体">
    <header><div><h2>市调智能体</h2><p>关联当前研究任务；运行结果需要人工核对。</p></div><span class="status">{{ statusLabel }}</span></header>
    <p class="boundary">{{ demo ? '演示模式：智能体为本机模拟脚本，不连接真实后端；讲解与数据均为演示示例。模型检查自动完成，可用快捷指令逐步推进。' : '使用真实服务；请先测试模型响应。G1 的确认不等于工作台前三阶段全部正式确认。' }}</p>
    <p v-if="configError" role="alert" class="error">{{configError}}</p>
    <p v-else-if="!owner" role="status">请先 <RouterLink to="/login">登录</RouterLink>，再使用智能体。</p>
      <details v-if="task.viewedPhase===3"><summary>准备团队问卷的 G2 输入</summary><p>保留当前题目、选项、编码、变量与来源；请粘贴到 G2 的 itemList；sourceNote 和预测试状态须人工核对填写。本机草稿不是已采用问卷，不会自动提交审核。</p><button @click="prepareG2">准备输入快照</button><p role="alert" v-if="g2Error">{{g2Error}}</p><textarea aria-label="G2 团队题项输入快照" readonly :value="g2Input" rows="8" /><p>此处为点击时的候选快照；编辑问卷后请重新准备，不会覆盖问卷或未发送消息。</p></details>
    <template v-if="!configError && owner">
      <div class="top-actions">
        <button :disabled="session.busy || session.stopping || readOnly || session.halted" @click="session.probe()">测试模型响应</button>
        <button v-if="session.identity?.runId" :disabled="session.busy || session.stopping || session.halted" class="secondary" @click="session.recover()">恢复／核对会话</button>
        <button v-if="session.busy" class="secondary" @click="session.stop()">停止本页接收</button>
        <button v-if="session.identity && (session.status==='running'||session.status==='working')" class="secondary" :disabled="session.stopping" @click="session.stopServer()">请求停止服务端运行</button>
      </div>
      <p v-if="session.probeText" class="notice">模型测试回复：{{session.probeText}}</p>
      <p v-if="session.notice" role="status" class="notice">{{session.notice}}</p>
      <p v-if="session.error" role="alert" class="error">{{session.error}}</p>
      <p v-if="readOnly" class="notice">当前阶段只读，不能从这里发起新的研究或提交确认。</p>
      <div v-if="session.messages.length" class="conversation" aria-label="研究对话">
        <article v-for="message in session.messages" :key="message.id + message.role" :class="message.role"><strong>{{message.role==='user'?'我':'智能体'}}</strong><p>{{message.text}}</p></article>
      </div>
      <div v-if="session.interrupts.length" class="forms">
        <h3>待填写或确认</h3>
        <p>请处理全部待答项后一次提交；未提交的填写只保留在本页，切换任务后需重新填写。</p>
        <p v-if="formsError" class="error" role="alert">{{formsError}}</p>
        <section v-for="form in forms" :key="form.interruptId" class="form-card">
          <h4>{{form.title}}</h4><p v-if="form.message">{{form.message}}</p>
          <div v-for="field in form.fields" :key="field.key" class="field">
            <label :for="inputId(form.interruptId,field.key)">{{field.pageTitle ? field.pageTitle+' · ' : ''}}{{field.label}}<span v-if="field.required"> *</span></label>
            <div v-if="field.kind==='checkbox-group'" class="choices"><label v-for="option in field.options" :key="option"><input type="checkbox" :disabled="readOnly||session.busy" :checked="checked(form.interruptId,field.key,option)" @change="toggle(form.interruptId,field.key,option)" /> {{option}}</label></div>
            <select v-else-if="field.kind==='select'||field.kind==='radio-group'" :id="inputId(form.interruptId,field.key)" :disabled="readOnly||session.busy" :value="String(value(form.interruptId,field.key)??'')" @change="setText(form.interruptId,field.key,$event)"><option value="">请选择</option><option v-for="option in field.options" :key="option" :value="option">{{option}}</option></select>
            <textarea v-else-if="field.kind==='textarea'" :id="inputId(form.interruptId,field.key)" :disabled="readOnly||session.busy" :value="String(value(form.interruptId,field.key)??'')" :placeholder="field.placeholder" :minlength="field.minLength" :maxlength="field.maxLength" @input="setText(form.interruptId,field.key,$event)" />
            <template v-else-if="field.kind==='other-text'"><input :id="inputId(form.interruptId,field.key)" :list="inputId(form.interruptId,field.key)+'-options'" :disabled="readOnly||session.busy" :value="String(value(form.interruptId,field.key)??'')" :placeholder="field.placeholder || '选择或填写其他内容'" :minlength="field.minLength" :maxlength="field.maxLength" @input="setText(form.interruptId,field.key,$event)" /><datalist :id="inputId(form.interruptId,field.key)+'-options'"><option v-for="option in field.options" :key="option" :value="option" /></datalist></template>
            <input v-else :id="inputId(form.interruptId,field.key)" :type="field.kind==='number'?'number':'text'" :disabled="readOnly||session.busy" :value="String(value(form.interruptId,field.key)??'')" :placeholder="field.placeholder" :min="field.min" :max="field.max" :step="field.step" :minlength="field.minLength" :maxlength="field.maxLength" @input="setField(form.interruptId,field,$event)" />
          </div>
        </section>
        <button :disabled="session.busy||session.stopping||readOnly||session.status!=='interrupt'||!!formsError" @click="submitForms">提交全部表单并继续</button>
      </div>
      <section class="stage-artifacts" aria-label="当前阶段智能体成果">
        <h3>当前阶段成果 · {{stageName}}</h3>
        <p>{{stageHint}}</p>
        <button class="secondary" :disabled="session.busy||!session.identity?.runId" @click="session.refreshArtifacts()">读取当前阶段成果</button>
        <ul><li v-for="item in phaseFiles" :key="item.path"><strong>{{item.name}}</strong><small>{{item.path}}</small><button :disabled="session.busy" @click="session.previewArtifact(item.path)">预览成果</button><button :disabled="session.busy||downloading||demo" :title="demo?'演示模式仅支持预览':''" @click="download(item.path)">下载成果</button></li></ul>
        <p v-if="!phaseFiles.length">尚未读到当前项目的本阶段文件；不会用其他研究或本机示例替代。</p>
        <div v-if="session.preview && phaseFiles.some(item=>item.path===session.preview!.path)"><h4>{{session.preview.path}}</h4><pre>{{session.preview.content??session.preview.reason}}</pre></div>
      </section>
      <div v-if="demo" class="demo-quick" role="group" aria-label="演示快捷指令">
        <button type="button" class="secondary" :disabled="session.busy||!session.probePassed||readOnly" @click="quick('下一步')">下一步 ▶</button>
        <button type="button" class="secondary" :disabled="session.busy||!session.probePassed||readOnly" @click="quick('回退上一步')">◀ 回退上一步</button>
        <button type="button" class="secondary" :disabled="session.busy||!session.probePassed||readOnly" @click="quick('我有的问题')">我有的问题</button>
      </div>
      <div class="composer">
        <label for="research-agent-message">研究问题或补充说明</label>
        <textarea id="research-agent-message" v-model="draft" rows="3" :disabled="readOnly||session.busy||session.stopping||session.status==='interrupt'||session.status==='working'||session.status==='uncertain'" placeholder="例如：请帮助梳理这项调查的研究问题。" />
        <label class="context-choice"><input v-model="includeContext" type="checkbox" :disabled="readOnly||session.busy" /> 同时发送当前阶段相关的本机草稿（未经正式采用）</label>
        <button :disabled="!draft.trim()||readOnly||session.busy||!session.probePassed||session.status==='interrupt'||session.status==='working'||session.status==='uncertain'" @click="send">发送研究消息</button>
      </div>
      <details v-if="session.identity?.runId" class="materials"><summary>会话材料</summary><p>上传到当前智能体会话；上传不代表解析或正式项目保存。</p><input type="file" :disabled="session.busy||readOnly||uploading" aria-label="选择会话材料" @change="chooseFile" /><button :disabled="!selectedFile||session.busy||readOnly||uploading" @click="upload">上传材料</button><button class="secondary" :disabled="session.busy||uploading" @click="loadAttachments">读取附件列表</button><p v-if="attachmentError" class="error" role="alert">{{attachmentError}}</p><ul><li v-for="item in attachments" :key="item.ref">{{item.fileName}} <small>{{item.ref}}</small></li></ul><p v-if="attachments.length">发送消息时会附上这些服务端返回的附件引用。</p></details>
      <details v-if="session.identity?.runId" class="outputs"><summary>会话产物</summary><p>列表包含当前会话及子会话，也可能包含历史文件；请按路径和 manifest 核对，不能直接当作本次运行结果。</p><button class="secondary" :disabled="session.busy" @click="session.refreshArtifacts()">读取产物列表</button><ul><li v-for="item in files" :key="item.path"><strong>{{item.name}}</strong><small>{{item.path}} · {{item.size??'未知'}} 字节 · {{item.updatedAt?new Date(item.updatedAt).toLocaleString():'时间未知'}}</small><button :disabled="session.busy" @click="session.previewArtifact(item.path)">预览</button><button :disabled="session.busy||downloading||demo" :title="demo?'演示模式仅支持预览':''" @click="download(item.path)">下载</button></li></ul><p v-if="!files.length">尚未读取到文件；没有文件不能说明研究已完成。</p><div v-if="session.preview"><h4>预览：{{session.preview.path}}</h4><pre v-if="session.preview.content!==null">{{session.preview.content}}</pre><p v-else>{{session.preview.reason || '该文件无法直接预览。'}}</p></div></details>
      <details v-if="session.identity"><summary>运行身份</summary><p>智能体项目编号：{{session.identity.projectId}}（不是正式项目保存编号）</p><p>会话：{{session.identity.threadId}}</p><p v-if="session.identity.runId">运行：{{session.identity.runId}}</p></details>
    </template>
  </section>
</template>
<script setup lang="ts">
import {g2DraftInput} from '@/utils/researchPreviewInput'
import {computed,onBeforeUnmount,onMounted,reactive,ref,watch} from 'vue'
import {AUTH_CHANGE_EVENT} from '@/api/http'
import {useUserStore} from '@/stores/user'
import {configuredResearchAgent} from '@/config/researchAgent'
import {currentResearchOwner,useResearchRuns} from '@/stores/researchRuns'
import {normalizeResearchInterrupt,type ResearchField,type ResearchForm} from '@/api/szRun'
import {researchDownloadUrl} from '@/api/szArtifacts'
import {stageArtifacts} from '@/utils/researchStageArtifacts'
import {RESEARCH_AGENT_DEMO} from '@/utils/researchDemoAgent'
import {uploadAttachment,listAttachments,precheckFile} from '@/api/attachment'
import type {ArtifactNode,AttachmentItem} from '@/types/sandbox'
import type {LocalResearchTask} from '@/types/research-contracts'
const props=defineProps<{task:LocalResearchTask;readOnly?:boolean}>(),user=useUserStore(),session=useResearchRuns().session
const demo=RESEARCH_AGENT_DEMO
const draft=ref(''),includeContext=ref(true),answers=reactive<Record<string,Record<string,unknown>>>({}),formsError=ref(''),selectedFile=ref<File|null>(null),attachments=ref<AttachmentItem[]>([]),attachmentError=ref(''),uploading=ref(false),downloading=ref(false)
const owner=ref(''),configError=ref('')
let generation=0
async function syncIdentity(){const current=++generation;const subject=currentResearchOwner();owner.value=subject;attachments.value=[];selectedFile.value=null;attachmentError.value='';configError.value='';if(!subject){session.dispose();return}try{const agent=configuredResearchAgent();await session.select({ownerId:subject,agentId:agent.id,taskId:props.task.localTaskId});if(current!==generation)return;if(demo)void session.probe()}catch(e){configError.value=e instanceof Error?e.message:'智能体配置错误。';session.dispose()}}
watch(()=>[props.task.localTaskId,user.token],()=>{void syncIdentity()},{immediate:true})
function storageChanged(event:StorageEvent){if(event.key==='access_token'||event.key==='user_id')void syncIdentity()}
function authChanged(){void syncIdentity()}
onMounted(()=>{window.addEventListener('storage',storageChanged);window.addEventListener(AUTH_CHANGE_EVENT,authChanged)})
onBeforeUnmount(()=>{generation++;window.removeEventListener('storage',storageChanged);window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})
const statusLabel=computed(()=>({idle:'等待操作',checking:'检查模型',running:'运行中',interrupt:'等待确认',uncertain:'需核对',finished:'本轮已结束',working:'待推进／核对',awaiting:'等待后续输入'}[session.status]))
const forms=ref<ResearchForm[]>([])
watch(()=>session.interrupts,items=>{try{const next=items.map(normalizeResearchInterrupt);formsError.value='';for(const form of next){if(!answers[form.interruptId]){answers[form.interruptId]={};for(const field of form.fields)if(field.initialValue!==undefined)answers[form.interruptId]![field.key]=field.initialValue}}forms.value=next}catch(e){formsError.value=e instanceof Error?e.message:'无法解析表单。';forms.value=[]}},{immediate:true,deep:true})
function inputId(id:string,key:string){return 'sz-field-'+encodeURIComponent(id)+'-'+encodeURIComponent(key)}
function value(id:string,key:string){return answers[id]?.[key]}
function setText(id:string,key:string,event:Event){answers[id]![key]=(event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement).value}
function setField(id:string,field:ResearchField,event:Event){const text=(event.target as HTMLInputElement).value;answers[id]![field.key]=field.kind==='number'&&text!==''?Number(text):text}
function checked(id:string,key:string,option:string){const current=value(id,key);return Array.isArray(current)&&current.includes(option)}
function toggle(id:string,key:string,option:string){const current=value(id,key),next=Array.isArray(current)?[...current]:[],index=next.indexOf(option);if(index>=0)next.splice(index,1);else next.push(option);answers[id]![key]=next}
async function submitForms(){await session.submit(answers)}
const stageName=computed(()=>['赛事理解','选题分析','研究方案','问卷设计与预测试','正式调查','数据分析','报告与答辩'][props.task.viewedPhase])
const stageHint=computed(()=>props.task.viewedPhase<=2?'G1 建议供人工对照，不覆盖当前编辑，也不代表正式阶段确认。':props.task.viewedPhase===3?'G2 结构化团队题项；请明确请求进入 G2，并按服务端题项表单提交，不自动代填或通过审核。':props.task.viewedPhase===5?'G3 需要 G2 已通过及团队分析计划；接收 CSV/TSV，不接收 XLSX/XLS。本机沙箱另支持 XLSX。':'G4 需要 G3 已通过；产出报告骨架、结果索引和答辩辅助，不代表完整正文。')
const phaseFiles=computed(()=>stageArtifacts(files.value,session.identity?.projectId||'',props.task.viewedPhase))
async function send(){const text=draft.value.trim();if(!text)return;const source=includeContext.value?'\n\n以下为用户提供的本机草稿，未经正式采用或事实核验：\n'+JSON.stringify({赛事理解:props.task.competition,选题分析:props.task.topicAnalysis,研究方案:props.task.researchPlan,...(props.task.viewedPhase===3?{团队问卷草稿:props.task.questionnaire}:{}),...(props.task.viewedPhase===5?{本机数据文件元信息:props.task.inputFile,说明:"文件元信息不是上传引用，智能体不可直接读取本机沙箱文件"}:{}),...(props.task.viewedPhase===6?{报告人工草稿:props.task.report}:{})}):'';const refs=attachments.value.length?'\n\n本会话已上传材料引用：\n'+attachments.value.map(item=>item.ref).join('\n'):'';await session.start(text+source+refs);if((session.status==='finished'||session.status==='interrupt'||session.status==='awaiting')&&draft.value.trim()===text)draft.value=''}
const g2Input=ref(''),g2Error=ref('')
watch(()=>props.task.localTaskId,()=>{g2Input.value='';g2Error.value=''})
function prepareG2(){try{g2Input.value=g2DraftInput(props.task.questionnaire);g2Error.value=''}catch(e){g2Input.value='';g2Error.value=e instanceof Error?e.message:'输入准备失败'}}
function quick(text:string){draft.value=text;void send()}
function chooseFile(event:Event){selectedFile.value=(event.target as HTMLInputElement).files?.[0]??null;attachmentError.value=''}
function currentContext(){return {owner:owner.value,task:props.task.localTaskId,thread:session.identity?.threadId,agent:session.scope?.agentId}}
function sameContext(c:ReturnType<typeof currentContext>){return owner.value===currentResearchOwner()&&owner.value===c.owner&&props.task.localTaskId===c.task&&session.identity?.threadId===c.thread&&session.scope?.agentId===c.agent}
async function upload(){const file=selectedFile.value,c=currentContext();if(!file||!c.agent||!c.thread)return;const check=precheckFile(file);if(!check.ok){attachmentError.value=check.message||'文件未通过检查。';return}uploading.value=true;attachmentError.value='';try{const item=await uploadAttachment(c.agent,c.thread,file);if(!sameContext(c))return;if(!item.ref)throw Error('上传返回缺少可定位的附件引用。');attachments.value=[...attachments.value.filter(a=>a.ref!==item.ref),item];selectedFile.value=null}catch(e){if(sameContext(c))attachmentError.value=e instanceof Error?e.message:'上传失败，所选文件仍保留。'}finally{uploading.value=false}}
async function loadAttachments(){const c=currentContext();if(!c.agent||!c.thread)return;uploading.value=true;attachmentError.value='';try{const items=await listAttachments(c.agent,c.thread);if(sameContext(c))attachments.value=items}catch(e){if(sameContext(c))attachmentError.value=e instanceof Error?e.message:'附件读取失败。'}finally{uploading.value=false}}
const files=computed(()=>{const flatten=(nodes:ArtifactNode[]):ArtifactNode[]=>nodes.flatMap(n=>n.type==='file'?[n]:n.children?flatten(n.children):[]);return flatten(session.artifacts)})
async function download(path:string){const c=currentContext();if(!c.agent||!c.thread||!files.value.some(item=>item.path===path))return;downloading.value=true;try{const ticket=await researchDownloadUrl(c.agent,c.thread,path);if(!sameContext(c)||!files.value.some(item=>item.path===path))return;const anchor=document.createElement('a');anchor.href=ticket.url;anchor.download=ticket.fileName;anchor.click()}catch(e){if(sameContext(c))session.error=e instanceof Error?e.message:'下载失败。'}finally{downloading.value=false}}
</script>
<style scoped>
.research-agent{padding:20px;margin:0 0 22px;background:white;border:1px solid #cce4df;border-radius:12px;color:#173d3c;font-size:14px;line-height:1.7}.research-agent header{display:flex;justify-content:space-between;gap:16px}.research-agent h2{font-size:19px;margin:0}.research-agent h3,.research-agent h4{margin:10px 0}.research-agent p{margin:7px 0;overflow-wrap:anywhere}.research-agent header p,.boundary,small{font-size:12px;color:#587773}.status{height:max-content;padding:3px 8px;border-radius:5px;background:#e8f5f2;color:#136d5f}.top-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{font:inherit;border:1px solid #148c7d;border-radius:7px;background:#148c7d;color:white;padding:8px 12px;cursor:pointer;margin:4px 6px 4px 0}button.secondary{background:white;color:#136d5f}button:disabled{background:#edf2f0;color:#82928c;border-color:#dae4df;cursor:not-allowed}.notice{padding:8px;background:#eef8f5}.error{padding:8px;color:#9b392a;background:#fff0ec}.conversation{max-height:330px;overflow:auto;margin:16px 0}.conversation article{margin:8px 0;padding:10px;border-radius:8px;background:#f0f8f7}.conversation article.user{background:#eef4fa}.conversation p,pre{white-space:pre-wrap;overflow-wrap:anywhere}.forms,.composer,.materials,.outputs{margin-top:16px;padding-top:12px;border-top:1px solid #dcedea}.form-card{margin:10px 0;padding:12px;background:#f6faf8;border:1px solid #dcedea;border-radius:8px}.field{display:grid;gap:4px;margin:12px 0}.field input:not([type=checkbox]),.field select,.field textarea,.composer textarea{width:100%;box-sizing:border-box;padding:8px;font:inherit;border:1px solid #bad4ca;border-radius:6px;background:white}.choices{display:flex;gap:10px;flex-wrap:wrap}.choices label{font-weight:400}.composer>label:first-child{display:block}.context-choice{display:block;font-size:12px;color:#587773}.materials small,.outputs small{display:block;overflow-wrap:anywhere}.outputs ul,.materials ul{padding-left:20px}.outputs li{margin:10px 0}.outputs pre{max-height:320px;overflow:auto;padding:10px;background:#f5f8f6;font-size:12px}.research-agent summary{cursor:pointer;font-weight:600}.demo-quick{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.demo-quick button{margin:0}
</style>
