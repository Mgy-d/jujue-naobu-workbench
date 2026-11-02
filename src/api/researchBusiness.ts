import type {ArtifactRef} from '../types/research-contracts';
import type {BusinessGateway,BusinessMode,BusinessResult,BusinessCode,BusinessProject,Material,FixedCandidate,PhaseCheck} from '../types/research-business';
import {normalizeCompetitionDraft,normalizeTopicAnalysisDraft,normalizeResearchPlanDraft,normalizeQuestionnaireDraft,stagesFor} from '../utils/researchDrafts';

export const BUSINESS_MOCK_PREFIX='/__research_mock__/v1';
export const BUSINESS_UNAVAILABLE='正式业务协议和服务尚未交付；本机草稿仍可使用。';
type Requester=(path:string,options:RequestInit)=>Promise<Response>;
const ok=<T>(value:T):BusinessResult<T>=>({ok:true,value});
const bad=<T>(code:BusinessCode,message:string):BusinessResult<T>=>({ok:false,error:{code,message}});
const object=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:any)=>typeof v==='string'&&v.length>0&&v.length<=256;
const phase=(v:any)=>Number.isInteger(v)&&v>=0&&v<=6;
const revision=(v:any)=>Number.isSafeInteger(v)&&v>=0;
const strings=(v:any)=>Array.isArray(v)&&v.every((s:any)=>typeof s==='string');
export function sameRef(a:ArtifactRef,b:ArtifactRef){return !!a&&!!b&&a.projectId===b.projectId&&a.workflowId===b.workflowId&&a.artifactId===b.artifactId&&a.versionId===b.versionId}
export function validRef(v:any):v is ArtifactRef{return object(v)&&['projectId','workflowId','artifactId','versionId'].every(k=>id(v[k]))}
export function validMaterial(v:any):v is Material{return object(v)&&id(v.fileId)&&id(v.sourceId)&&typeof v.filename==='string'&&Number.isSafeInteger(v.size)&&v.size>=0&&['uploaded','parsing','failed','ready'].includes(v.parseStatus)&&typeof v.parseMessage==='string'&&typeof v.locator==='string'}
export function validProject(v:any):v is BusinessProject{
 if(!object(v)||!id(v.projectId)||!id(v.workflowId)||!id(v.clientTaskId)||!['full-study','questionnaire-review','dataset-analysis'].includes(v.workflowKind)||typeof v.title!=='string'||!revision(v.revision)||!phase(v.activePhase)||v.activePhase>=stagesFor(v.workflowKind).length||!object(v.permissions)||!['read','write','confirm'].every(k=>typeof v.permissions[k]==='boolean')||!Array.isArray(v.lockedPhases)||!v.lockedPhases.every((x:any)=>phase(x)&&x<stagesFor(v.workflowKind).length)||!Array.isArray(v.files)||!v.files.every(validMaterial))return false;
 const summaries=(xs:any)=>Array.isArray(xs)&&xs.every((s:any)=>object(s)&&phase(s.phase)&&s.phase<stagesFor(v.workflowKind).length&&validRef(s.ref)&&s.ref.projectId===v.projectId&&s.ref.workflowId===v.workflowId);
 return summaries(v.candidates)&&summaries(v.adopted)&&v.lockedPhases.every((p:number)=>v.adopted.some((s:any)=>s.phase===p))&&new Set(v.files.map((f:Material)=>f.fileId)).size===v.files.length&&new Set(v.files.map((f:Material)=>f.sourceId)).size===v.files.length;
}
export function validFixed(v:any):v is FixedCandidate{return object(v)&&validRef(v.ref)&&phase(v.phase)&&object(v.content)&&Array.isArray(v.inputRefs)&&v.inputRefs.every(validRef)&&Array.isArray(v.sourceRefs)&&v.sourceRefs.every((s:any)=>object(s)&&id(s.sourceId)&&typeof s.evidenceStatus==='string'&&(s.fileId===undefined||id(s.fileId))&&(s.locator===undefined||typeof s.locator==='string'))&&v.origin==='manual'&&v.evidenceStatus==='unverified'}
function validCheck(v:any):v is PhaseCheck{return object(v)&&id(v.checkId)&&id(v.projectId)&&id(v.workflowId)&&revision(v.revision)&&phase(v.phase)&&validRef(v.candidateRef)&&typeof v.canConfirm==='boolean'&&strings(v.issues)&&strings(v.risks)&&(!v.canConfirm||v.issues.length===0)}
/** Validate editor content separately because phase 0 means different content at shortcut entries. */
export function cleanPhaseContent(kind:string,p:number,value:unknown){if(kind==='questionnaire-review'&&p===0)return normalizeQuestionnaireDraft(value);if(kind!=='full-study')return null;return p===0?normalizeCompetitionDraft(value):p===1?normalizeTopicAnalysisDraft(value):p===2?normalizeResearchPlanDraft(value):p===3?normalizeQuestionnaireDraft(value):null}
export function createBusinessGateway(options:{mode:BusinessMode;request?:Requester;timeoutMs?:number}):BusinessGateway{
 const requester=options.request??((path,init)=>fetch(path,{...init,credentials:'same-origin'}));
 async function send<T>(path:string,init:RequestInit,validate:(v:any)=>boolean,blob=false):Promise<BusinessResult<T>>{
  if(options.mode!=='mock')return bad('CAPABILITY_UNAVAILABLE',BUSINESS_UNAVAILABLE);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs??15000);
  try{
   const response=await requester(BUSINESS_MOCK_PREFIX+path,{...init,signal:controller.signal});
   if(!response.ok){const codes:Record<number,BusinessCode>={401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',409:'STALE_BASELINE',423:'PHASE_LOCKED',422:'MISSING_INPUT'};const code=codes[response.status]??'UNAVAILABLE';const messages:Record<string,string>={UNAUTHORIZED:'登录已失效，请重新登录；编辑未删除。',FORBIDDEN:'当前账户无权访问或修改该项目。',NOT_FOUND:'项目、文件或版本不存在。',STALE_BASELINE:'服务器版本已变化，请重新读取并核对；编辑已保留。',PHASE_LOCKED:'此阶段已锁定，服务端拒绝写入。',MISSING_INPUT:'请求有缺项，请核对本阶段资料。',UNAVAILABLE:'服务暂时不可用，请稍后重试；编辑已保留。'};return bad(code,messages[code]);}
   if(blob)return ok(await response.blob() as T);
   const text=await response.text();if(text.length>4*1024*1024)return bad('INVALID_RESPONSE','响应超出首版读取限制。');
   const value=JSON.parse(text);return validate(value)?ok(value as T):bad('INVALID_RESPONSE','服务响应缺字段或身份/版本不匹配，未应用返回内容。');
  }catch{return bad('NETWORK_ERROR','请求失败或超时；当前编辑仍保留，不会自动重放写请求。')}finally{clearTimeout(timer)}
 }
 const e=encodeURIComponent,base=(p:string)=>'/projects/'+e(p);
 const json=(method:string,body:unknown):RequestInit=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {
  mode:options.mode,
  createProject:input=>send('/projects',json('POST',input),validProject),
  getProject:p=>send(base(p),{method:'GET'},v=>validProject(v)&&v.projectId===p),
  uploadMaterial(p,file,expectedRevision,requestId){const form=new FormData();form.append('file',file);form.append('expectedRevision',String(expectedRevision));form.append('requestId',requestId);return send(base(p)+'/materials',{method:'POST',body:form},v=>object(v)&&validProject(v.project)&&v.project.projectId===p&&validMaterial(v.material)&&v.project.files.some((f:Material)=>f.fileId===v.material.fileId&&f.sourceId===v.material.sourceId))},
  readMaterial:(p,f)=>send(base(p)+'/materials/'+e(f)+'/content',{method:'GET'},()=>true,true),
  saveVersion:(p,input)=>send(base(p)+'/candidates',json('POST',input),v=>object(v)&&validProject(v.project)&&v.project.projectId===p&&validFixed(v.version)&&v.version.ref.projectId===p&&v.version.ref.workflowId===v.project.workflowId&&v.version.phase===input.phase&&v.project.candidates.some((s:any)=>s.phase===input.phase&&sameRef(s.ref,v.version.ref))),
  readVersion:(r,p)=>send(base(r.projectId)+'/workflows/'+e(r.workflowId)+'/artifacts/'+e(r.artifactId)+'/versions/'+e(r.versionId),{method:'GET'},v=>validFixed(v)&&sameRef(v.ref,r)&&v.phase===p),
  checkPhase:(p,input)=>send(base(p)+'/checks',json('POST',input),v=>validCheck(v)&&v.projectId===p&&v.workflowId===input.candidateRef.workflowId&&v.revision===input.expectedRevision&&v.phase===input.phase&&sameRef(v.candidateRef,input.candidateRef)),
  confirmPhase:(p,input)=>send(base(p)+'/confirmations',json('POST',input),v=>validProject(v)&&v.projectId===p&&v.workflowId===input.candidateRef.workflowId&&v.revision>input.expectedRevision&&v.lockedPhases.includes(input.phase)&&v.adopted.some((s:any)=>s.phase===input.phase&&sameRef(s.ref,input.candidateRef))),
 };
}
