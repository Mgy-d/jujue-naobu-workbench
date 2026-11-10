import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const b=await build({entryPoints:[fileURLToPath(new URL('../src/api/szRun.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
const form={id:'reply:call1',toolCallId:'call1',metadata:{toolName:'ui_form_advanced',toolInput:{title:'资料',pages:[{title:'第一页',items:[{key:'group',label:'组别',kind:'select',required:true,options:['本科','专科']},{key:'other',label:'其他',kind:'other-text',options:['A'],minLength:2}]}]}}}
const gate={id:'reply:call2',toolCallId:'call2',metadata:{toolName:'ui_gate',toolInput:{title:'审核'}}}
test('stream requires explicit terminal and never turns an error into success',async()=>{const m=await subject(),t=new m.ResearchRunTracker('main-1','run-1');t.accept({type:'TEXT_MESSAGE_CONTENT',messageId:'a',delta:'你好'});assert.equal(t.finish().status,'uncertain');const e=new m.ResearchRunTracker('main-1','run-1');e.accept({type:'RUN_ERROR',message:'模型失败'});e.accept({type:'RUN_FINISHED',outcome:{type:'success'}});assert.equal(e.finish().status,'error');const u=new m.ResearchRunTracker('main-1','run-1');u.accept({type:'RUN_FINISHED',outcome:{type:'success'},runId:'other'});assert.equal(u.finish().status,'error')})
test('interrupt preserves every form field and supports other-text without silently losing constraints',async()=>{const m=await subject(),f=m.normalizeResearchInterrupt(form);assert.equal(f.fields.length,2);assert.equal(f.fields[1].kind,'other-text');assert.equal(f.fields[1].minLength,2);const raw=structuredClone(form);raw.metadata.toolInput.pages[0].items.push({key:'mystery',label:'未知',kind:'unsupported'});assert.throws(()=>m.normalizeResearchInterrupt(raw),/不支持/);const duplicate=structuredClone(form);duplicate.metadata.toolInput.pages[0].items.push({key:'group',label:'重复',kind:'text'});assert.throws(()=>m.normalizeResearchInterrupt(duplicate),/重复/)})
test('resume includes all explicitly answered interrupts and the original IDs',async()=>{const m=await subject();assert.throws(()=>m.makeResearchResume([form,gate],{'reply:call1':{group:'本科',other:'额外'}}),/全部/);const r=m.makeResearchResume([form,gate],{'reply:call1':{group:'本科',other:'额外'},'reply:call2':{decision:'不通过',feedback:'请修改'}});assert.equal(r.length,2);assert.deepEqual(JSON.parse(r[0].payload.output),{group:'本科',other:'额外'});assert.equal(r[1].payload.decision,'不通过');assert.equal(r[1].payload.feedback,'请修改');assert.ok(r.every(x=>x.status==='resolved'));assert.throws(()=>m.makeResearchResume([form],{'reply:call1':{group:'没有的选项',other:'a'}}),/组别|其他/);assert.throws(()=>m.makeResearchResume([gate],{'reply:call2':{decision:'也许'}}),/审核结论/)})
test('a new run uses a fresh run ID and resumes exactly the stored thread and run',async()=>{const m=await subject();const identity={agentId:'agent',projectId:'sz-1',threadId:'main-1',runId:'run-1'};const request=m.buildResearchRequest(identity,'问题',[form,gate],{'reply:call1':{group:'本科',other:'其他'},'reply:call2':{decision:'通过',feedback:''}});assert.equal(request.threadId,'main-1');assert.equal(request.runId,'run-1');assert.deepEqual(request.messages,[]);assert.equal(request.resume.length,2);assert.equal(request.forwardedProps.web_search,'off');assert.throws(()=>m.buildResearchRequest({...identity,runId:''},'', [form],{}),/原始运行/)})
test('restoration refuses to fabricate an old run ID or resurrect answered interrupts',async()=>{const m=await subject();const resolved=new Set(['call1']);assert.deepEqual(m.reconcileResearchPending([form,gate],resolved,{runId:'run-1',pendingIds:['reply:call1','reply:call2'],submittedIds:[]}).map(x=>x.id),['reply:call2']);assert.throws(()=>m.reconcileResearchPending([gate],new Set(),{runId:'',pendingIds:[],submittedIds:[]}),/运行编号/);assert.throws(()=>m.reconcileResearchPending([gate],new Set(),{runId:'run-1',pendingIds:['reply:call2'],submittedIds:['reply:call2']}),/已答中断/);const unknown={...gate,id:'reply:call3',toolCallId:'call3'};assert.throws(()=>m.reconcileResearchPending([unknown],new Set(),{runId:'run-1',pendingIds:['reply:call2'],submittedIds:[]}),/身份/);})

test('mismatched or post-terminal SSE events are not forwarded to the visible task',async()=>{const m=await subject(),old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};try{globalThis.window={location:{origin:'http://127.0.0.1'}};globalThis.localStorage={getItem:()=>null};const events=[{type:'TEXT_MESSAGE_CONTENT',messageId:'a',delta:'ok'},{type:'TEXT_MESSAGE_CONTENT',messageId:'b',runId:'other',delta:'wrong task'},{type:'RUN_FINISHED',outcome:{type:'success'}}];globalThis.fetch=async()=>new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n').join(''),{status:200});const seen=[];const r=await m.streamResearchRun({agentId:'a',projectId:'p',threadId:'t',runId:'r'},{threadId:'t',runId:'r',messages:[]},e=>seen.push(e));assert.equal(r.status,'error');assert.ok(!seen.some(e=>e.delta==='wrong task'));assert.ok(!seen.some(e=>e.type==='RUN_FINISHED'))}finally{Object.assign(globalThis,old)}})
test('required research form fields cannot be answered with spaces alone',async()=>{const m=await subject();const form={id:'reply:required',toolCallId:'required',metadata:{toolName:'ui_form_advanced',toolInput:{title:'资料',pages:[{items:[{key:'topic',label:'选题',kind:'text',required:true}]}]}}};assert.throws(()=>m.makeResearchResume([form],{'reply:required':{topic:'   '}}),/选题/)})

test('a submitted interrupt appearing in the registry is reported even if transcript has its tool result',async()=>{const m=await subject();assert.throws(()=>m.reconcileResearchPending([gate],new Set(['call2']),{runId:'run-1',pendingIds:['reply:call2'],submittedIds:['reply:call2']}),/已答中断/)})

test('actual backend normal terminal without outcome requires a matching started lifecycle',async()=>{const m=await subject();const t=new m.ResearchRunTracker('t','r');t.accept({type:'RUN_STARTED',threadId:'t',runId:'r'});t.accept({type:'TEXT_MESSAGE_CONTENT',messageId:'a',delta:'你好'});t.accept({type:'RUN_FINISHED',threadId:'t',runId:'r'});assert.equal(t.finish().status,'success');const incomplete=new m.ResearchRunTracker('t','r');incomplete.accept({type:'RUN_FINISHED',threadId:'t',runId:'r'});assert.equal(incomplete.finish().status,'uncertain');const failed=new m.ResearchRunTracker('t','r');failed.accept({type:'RUN_STARTED',threadId:'t',runId:'r'});failed.accept({type:'RAW',event:{error:'failure'}});failed.accept({type:'RUN_FINISHED',threadId:'t',runId:'r'});assert.equal(failed.finish().status,'error')})
test('unknown or unbound terminals never count as successful segment completion',async()=>{const m=await subject();for(const finish of [{type:'RUN_FINISHED'},{type:'RUN_FINISHED',threadId:'t',runId:'r',outcome:{}},{type:'RUN_FINISHED',threadId:'other',runId:'r'}]){const t=new m.ResearchRunTracker('t','r');t.accept({type:'RUN_STARTED',threadId:'t',runId:'r'});t.accept(finish);assert.notEqual(t.finish().status,'success')}})


test('chat choice matches explicit option text and preserves original interrupt identity',async()=>{
  const m=await subject(),f=m.normalizeResearchInterrupt(form)
  assert.deepEqual(m.researchChoiceAnswer([f],'我选本科'),{interruptId:f.interruptId,key:'group',value:'本科'})
  assert.equal(m.researchChoiceAnswer([f],'本科还是专科'),null)
  assert.equal(m.researchChoiceAnswer([f,f],'本科'),null)
  const g=m.normalizeResearchInterrupt(gate)
  assert.equal(m.researchChoiceAnswer([g],'不通过').value,'不通过')
})

const planning={id:'reply-plan:call-plan',toolCallId:'call-plan',metadata:{toolName:'plan_exit',toolInput:{summary:'仅整理G1三份材料，之后等待人工审核；不执行统计。'}}}
test('plan_exit displays its full plan and resumes only an explicit human decision using the native approval payload',async()=>{
 const m=await subject(),form=m.normalizeResearchInterrupt(planning)
 assert.match(form.title,/计划/);assert.equal(form.message,planning.metadata.toolInput.summary)
 assert.throws(()=>m.makeResearchResume([planning],{}),/全部/)
 const yes=m.makeResearchResume([planning],{[planning.id]:{decision:'同意按此计划执行'}})
 assert.deepEqual(yes[0].payload,{approved:true,editedArgs:planning.metadata.toolInput})
 const no=m.makeResearchResume([planning],{[planning.id]:{decision:'不同意执行'}})
 assert.deepEqual(no[0].payload,{approved:false});assert.equal(no[0].status,'resolved')
 assert.throws(()=>m.makeResearchResume([planning],{[planning.id]:{decision:'继续下一步'}}),/选项/)
})
test('a missing registry plan is reconstructed only from an exact asking tool and unambiguous same-session interrupt event',async()=>{
 const m=await subject(),messages=[{id:'reply-plan',role:'assistant',content:[{type:'tool_call',id:'call-plan',name:'plan_exit',state:'asking',input:JSON.stringify(planning.metadata.toolInput)}]}]
 const event={runId:'plan-run',payload:{type:'RUN_FINISHED',threadId:'plan-thread',runId:'plan-run',outcome:{type:'interrupt',interrupts:[planning]}}}
 const proof=m.recoverResearchPlan(messages,[event],'plan-thread')
 assert.equal(proof.runId,'plan-run');assert.equal(proof.interrupts[0].id,planning.id)
 assert.equal(m.recoverResearchPlan(messages,[{...event,payload:{...event.payload,threadId:'other'}}],'plan-thread'),null)
 assert.equal(m.recoverResearchPlan([...messages,{role:'assistant',content:[{type:'tool_result',id:'call-plan',state:'success'}]}],[event],'plan-thread'),null)
 const changed=structuredClone(event);changed.payload.outcome.interrupts[0].metadata.toolInput.summary='不同计划'
 assert.equal(m.recoverResearchPlan(messages,[changed],'plan-thread'),null)
 const sibling=structuredClone(messages);sibling[0].content.push({type:'tool_call',id:'another',name:'execute',state:'asking',input:'{}'})
 assert.equal(m.recoverResearchPlan(sibling,[event],'plan-thread'),null)
})

test('native plan interrupts without metadata keep their real identity and obtain plan content from the same stream tool call',async()=>{
 const m=await subject(),tracker=new m.ResearchRunTracker('plan-thread','plan-run')
 tracker.accept({type:'RUN_STARTED',threadId:'plan-thread',runId:'plan-run'})
 tracker.accept({type:'TOOL_CALL_START',threadId:'plan-thread',runId:'plan-run',toolCallId:'call-plan',toolCallName:'plan_exit'})
 tracker.accept({type:'TOOL_CALL_ARGS',threadId:'plan-thread',runId:'plan-run',toolCallId:'call-plan',delta:JSON.stringify(planning.metadata.toolInput)})
 tracker.accept({type:'RUN_FINISHED',threadId:'plan-thread',runId:'plan-run',outcome:{type:'interrupt',interrupts:[{id:planning.id,toolCallId:'call-plan'}]}})
 const result=tracker.finish();assert.equal(result.status,'interrupt');assert.equal(result.interrupts[0].id,planning.id)
 assert.equal(m.normalizeResearchInterrupt(result.interrupts[0]).message,planning.metadata.toolInput.summary)
})
