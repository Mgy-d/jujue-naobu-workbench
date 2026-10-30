/** Synthetic HTTP fixture only. Not an application backend, persistence layer or security implementation. */
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const prefix='/__research_mock__/v1';
const clone=v=>structuredClone(v),json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const fail=(status,message)=>json({message},status),sameRef=(a,b)=>a&&b&&['projectId','workflowId','artifactId','versionId'].every(k=>a[k]===b[k]);
export function createMockBusinessService(options={}){
 const projects=new Map(),versions=new Map(),files=new Map(),checks=new Map(),replays=new Map(),history=[];
 let actor='mock-owner',fault=null,latency=0;
 const service={history,projects,checks,setActor(value){actor=value},failNext(method,part,status){fault={method,part,status}},delayNext(ms){latency=ms},expireCheck(id){const c=checks.get(id);if(c)c.expires=0},setPermission(id,patch){Object.assign(projects.get(id).value.permissions,patch)},setParseStatus(id,status,message='合成解析状态'){for(const {value:p} of projects.values()){const f=p.files.find(f=>f.fileId===id);if(f){f.parseStatus=status;f.parseMessage=message;p.revision++}}},
 async handle(request){
  const path=new URL(request.url).pathname;if(!path.startsWith(prefix))return fail(404,'Not a fixture route');
  const parts=path.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent),method=request.method,caller=actor;
  history.push({method,path,actor:caller});
  if(latency){const wait=latency;latency=0;await new Promise(r=>setTimeout(r,wait))}
  if(fault&&fault.method===method&&path.includes(fault.part)){const status=fault.status;fault=null;return fail(status,'合成故障')}
  if(!caller)return fail(401,'合成登录失效');
  let body=null,file=null;if(method==='POST'){try{if(request.headers.get('content-type')?.includes('multipart/form-data')){const form=await request.formData();file=form.get('file');body={expectedRevision:Number(form.get('expectedRevision')),requestId:form.get('requestId')}}else body=await request.json()}catch{return fail(422,'Bad body')}}
  const replayKey=method+path+':'+caller+':'+(body?.requestId??'');
  const bodyKey=JSON.stringify(body)+(file?':'+file.name+':'+file.size:'');
  if(body?.requestId&&replays.has(replayKey)){const entry=replays.get(replayKey);return entry.bodyKey===bodyKey?json(clone(entry.response)):fail(409,'幂等键载荷不一致')}
  const reply=value=>{if(body?.requestId)replays.set(replayKey,{bodyKey,response:clone(value)});return json(clone(value))};
  if(parts.length===1&&parts[0]==='projects'&&method==='POST'){
   if(!body?.clientTaskId||!['full-study','questionnaire-review','dataset-analysis'].includes(body.workflowKind)||!body.requestId)return fail(422,'Missing identity');
   const existing=[...projects.values()].find(p=>p.owner===caller&&p.value.clientTaskId===body.clientTaskId);
   if(existing)return reply(existing.value);
   const p={projectId:'mock-project-'+randomUUID(),workflowId:'mock-workflow-'+randomUUID(),clientTaskId:body.clientTaskId,workflowKind:body.workflowKind,title:body.title,revision:1,activePhase:0,permissions:{read:true,write:true,confirm:true},lockedPhases:[],adopted:[],candidates:[],files:[]};projects.set(p.projectId,{owner:caller,value:p});return reply(p);
  }
  const record=projects.get(parts[1]);if(!record)return fail(404,'Missing project');if(record.owner!==caller||!record.value.permissions.read)return fail(403,'No permission');const p=record.value;
  if(parts.length===2&&method==='GET')return json(clone(p));
  if(parts[2]==='materials'&&parts.length===5&&parts[4]==='content'&&method==='GET'){const f=files.get(parts[3]);return f&&f.projectId===p.projectId?new Response(f.bytes,{headers:{'Content-Type':'application/octet-stream'}}):fail(404,'Missing file')}
  if(parts[2]==='workflows'&&parts.length===8&&parts[4]==='artifacts'&&parts[6]==='versions'&&method==='GET'){const v=versions.get(parts[7]);return v&&v.ref.projectId===p.projectId&&v.ref.workflowId===parts[3]&&v.ref.artifactId===parts[5]?json(clone(v)):fail(404,'Missing fixed version')}
  if(method!=='POST')return fail(404,'Missing route');
  if(!p.permissions.write)return fail(403,'Read only');if(body?.expectedRevision!==p.revision)return fail(409,'Revision changed');
  if(parts[2]==='materials'){
   if(!file||file.size<1||file.size>20*1024*1024||!body.requestId)return fail(422,'Invalid file');
   const f={fileId:'mock-file-'+randomUUID(),sourceId:'mock-source-'+randomUUID(),filename:file.name,size:file.size,parseStatus:'uploaded',parseMessage:'合成服务仅记录原件，不执行真实解析。',locator:'合成原件定位'};files.set(f.fileId,{projectId:p.projectId,bytes:await file.arrayBuffer()});p.files.push(f);p.revision++;return reply({project:p,material:f});
  }
  const phase=body?.phase;if(!Number.isInteger(phase)||phase<0||phase>6)return fail(422,'Invalid phase');
  if(p.lockedPhases.includes(phase)||phase!==p.activePhase)return fail(423,'Locked or future phase');
  if(parts[2]==='candidates'){
   const max=p.workflowKind==='full-study'?3:p.workflowKind==='questionnaire-review'?0:-1;
   if(phase>max||!body.content||!Array.isArray(body.sourceRefs)||!Array.isArray(body.inputRefs)||body.origin!=='manual'||body.evidenceStatus!=='unverified'||!body.requestId)return fail(422,'Invalid candidate');
   for(const s of body.sourceRefs)if(s.fileId&&!p.files.some(f=>f.fileId===s.fileId&&f.sourceId===s.sourceId))return fail(422,'Unknown source');
   for(const r of body.inputRefs)if(!p.adopted.some(s=>sameRef(s.ref,r)))return fail(409,'Inputs changed');
   const ref={projectId:p.projectId,workflowId:p.workflowId,artifactId:'mock-artifact-phase-'+phase,versionId:'mock-version-'+randomUUID()},version={ref,phase,content:clone(body.content),inputRefs:clone(body.inputRefs),sourceRefs:clone(body.sourceRefs),origin:body.origin,evidenceStatus:body.evidenceStatus};versions.set(ref.versionId,version);p.candidates.push({ref,phase});p.revision++;return reply({project:p,version});
  }
  if(parts[2]==='checks'){
   const latest=[...p.candidates].reverse().find(s=>s.phase===phase);if(!latest||!sameRef(latest.ref,body.candidateRef))return fail(409,'Candidate changed');
   const v=versions.get(latest.ref.versionId),issues=[];
   if(p.workflowKind==='full-study'&&phase===0){if(!v.content.background?.trim())issues.push('缺少背景');if(!v.content.edition?.trim())issues.push('缺少届次');if(!v.content.group?.trim())issues.push('缺少组别');if(!v.content.requirements?.length)issues.push('缺少要求');if(!v.content.sources?.length)issues.push('缺少来源');if(v.content.unknowns?.some(u=>u.blocksDecision))issues.push('仍有阻断未知项')}
   else if(p.workflowKind==='full-study'&&options.fullStudyChecks===true){const has=v&&v.content&&typeof v.content==='object'&&Object.values(v.content).some(x=>(typeof x==='string'&&x.trim())||(Array.isArray(x)&&x.length>0)||(x&&typeof x==='object'));if(!has)issues.push('缺少本阶段内容')}
   if(!(p.workflowKind==='full-study'&&(phase===0||options.fullStudyChecks===true)))issues.push('本阶段检查规则尚未交付，Mock 仅支持候选保存和读回，不予确认。');
   const result={checkId:'mock-check-'+randomUUID(),projectId:p.projectId,workflowId:p.workflowId,revision:p.revision,phase,candidateRef:latest.ref,canConfirm:issues.length===0,issues,risks:['这是合成检查，不核验赛事事实或真实试填。']};checks.set(result.checkId,{...clone(result),expires:Date.now()+5*60*1000});return json(result);
  }
  if(parts[2]==='confirmations'){
   if(!p.permissions.confirm)return fail(403,'Cannot confirm');const c=checks.get(body.checkId);
   if(!c||!c.canConfirm||c.projectId!==p.projectId||c.revision!==p.revision||c.phase!==phase||!sameRef(c.candidateRef,body.candidateRef)||c.expires<Date.now())return fail(409,'Expired check');
   p.adopted=p.adopted.filter(s=>s.phase!==phase);p.adopted.push({phase,ref:clone(c.candidateRef)});p.lockedPhases.push(phase);const count=p.workflowKind==='full-study'?7:p.workflowKind==='questionnaire-review'?1:2;p.activePhase=Math.min(phase+1,count-1);p.revision++;return reply(p);
  }
  return fail(404,'Missing operation');
 }};
 return service;
}
export async function startMockBusinessServer(port=0){const service=createMockBusinessService();const server=createServer(async(req,res)=>{try{const bytes=[];for await(const chunk of req)bytes.push(chunk);const body=Buffer.concat(bytes);if(body.length>21*1024*1024){res.writeHead(413);res.end();return}const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(body.length?{body,duplex:'half'}:{})});const response=await service.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('fixture error')}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return {service,server,url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const fixture=await startMockBusinessServer(Number(process.argv[2]??5186));console.log('Synthetic business fixture:',fixture.url)}
