import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const b=await build({entryPoints:[fileURLToPath(new URL('../src/stores/researchRuns.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
function fixture(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map}}
const scope={ownerId:'owner',agentId:'agent',taskId:'A'}
const gate={id:'reply:call1',toolCallId:'call1',metadata:{toolName:'ui_gate',toolInput:{title:'审批'}}}
function deps(){return {verify:async()=>{},run:async()=>({status:'success',message:'',texts:{a:'你好'},interrupts:[]}),transcript:async()=>({messages:[]}),pending:async()=>[],runStatus:async()=>({running:false,pendingWork:false}),register:async()=>{},remove:async()=>{},tree:async()=>[],read:async()=>({path:'',content:''})}}
const successfulGateMessages=[{id:'call',role:'assistant',content:[{type:'tool_call',id:'call1',name:'ui_gate'}]},{id:'result',role:'assistant',content:[{type:'tool_result',id:'call1',state:'success'}]}]

test('unknown progress after refresh retains verified transcript without authorizing another submission',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true;await s.start('研究')
  d.transcript=async()=>({messages:[{id:'server-text',role:'assistant',content:[{type:'text',text:'G1 输入已接收，等待后台产物'}]}]})
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  let sends=0;d.run=async()=>{sends++;throw Error('must not resend')}
  await s.recover({readOnly:true})
  assert.equal(s.status,'uncertain');assert.equal(s.messages[0].text,'G1 输入已接收，等待后台产物')
  await s.start('继续');assert.equal(sends,0);assert.equal(s.interrupts.length,0)
})

test('background read-only refresh discovers the next gate without submitting or cleaning registrations',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  d.runStatus=async()=>({running:false,pendingWork:true})
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true;await s.start('研究')
  assert.equal(s.status,'working')
  const nextGate={...gate,id:'reply:call2',toolCallId:'call2'}
  s.identity.pendingIds=[nextGate.id];s.identity.submittedIds=[gate.id]
  d.transcript=async()=>({messages:successfulGateMessages})
  d.pending=async()=>[nextGate]
  d.runStatus=async()=>({running:false,pendingWork:false})
  let writes=0
  d.run=d.remove=d.register=async()=>{writes++;throw Error('automatic refresh must not write')}
  await s.recover({readOnly:true})
  assert.equal(s.status,'interrupt');assert.equal(s.interrupts[0].id,nextGate.id)
  assert.equal(writes,0);assert.deepEqual(s.identity.submittedIds,[gate.id])
})

test('background read-only refresh preserves working and refuses timeout conflicts',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  d.runStatus=async()=>({running:false,pendingWork:true})
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true;await s.start('研究')
  await s.recover({readOnly:true});assert.equal(s.status,'working')
  s.identity.submittedIds=[gate.id]
  d.transcript=async()=>({messages:[...successfulGateMessages,{id:'timeout',role:'assistant',content:[{type:'tool_result',id:'call1',state:'success',output:'[HITL_TIMEOUT]'}]}]})
  await s.recover({readOnly:true});assert.equal(s.halted,true);assert.equal(s.status,'uncertain')
})
async function blockedSession(){
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture();let writes=0
  d.run=async()=>{writes++;return {status:'interrupt',message:'',texts:{},interrupts:[gate]}}
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究')
  s.identity.submittedIds=[gate.id];d.pending=async()=>[gate];await s.recover()
  d.run=async()=>{writes++;throw Error('must not send')};d.remove=async()=>{writes++;throw Error('must not delete')};d.register=async()=>{writes++;throw Error('must not register')}
  d.pending=async()=>[];d.live=async()=>[];d.transcript=async()=>({messages:successfulGateMessages})
  return {s,d,storage,writes:()=>writes,ResearchRunSession}
}
test('explicit blocked recheck verifies durable success, preserves submission history and survives reload without writes',async()=>{
  const {s,d,storage,writes,ResearchRunSession}=await blockedSession();await s.recheckBlocked()
  assert.equal(s.halted,false);assert.equal(s.status,'finished');assert.deepEqual(s.identity.submittedIds,[gate.id]);assert.deepEqual(s.identity.pendingIds,[]);assert.equal(writes(),1)
  const restored=new ResearchRunSession(storage,d,()=> 'owner');await restored.select(scope);assert.equal(restored.halted,false);assert.equal(restored.identity.threadId,s.identity.threadId);assert.equal(writes(),1)
})
test('blocked recheck refuses missing, failed, running, ambiguous or reversed approval evidence',async()=>{
  for(const messages of [[],[successfulGateMessages[0]], [successfulGateMessages[0],{...successfulGateMessages[1],content:[{type:'tool_result',id:'call1',state:'error'}]}],[successfulGateMessages[0],{...successfulGateMessages[1],content:[{type:'tool_result',id:'call1',state:'running'}]}],[...successfulGateMessages,successfulGateMessages[0]],[...successfulGateMessages].reverse()]){
    const {s,d,writes}=await blockedSession();d.transcript=async()=>({messages});await s.recheckBlocked();assert.equal(s.halted,true);assert.equal(s.identity.status,'blocked');assert.equal(writes(),1)
  }
})
test('blocked recheck preserves old and new pending gates and requires live registry and idle service',async()=>{
  for(const mutate of [d=>d.pending=async()=>[gate],d=>d.pending=async()=>[{...gate,id:'new:call2',toolCallId:'call2'}],d=>d.live=async()=>[gate.id],d=>d.live=async()=>null,d=>d.runStatus=async()=>({running:true}),d=>d.transcript=async()=>{throw Error('404 session missing')},d=>d.runStatus=async()=>({running:false,pendingWork:true})]){
    const {s,d,writes}=await blockedSession();mutate(d);await s.recheckBlocked();assert.equal(s.halted,true);assert.equal(s.identity.status,'blocked');assert.equal(writes(),1);assert.equal(s.busy,false)
  }
})
test('blocked recheck does not unlock another task from a late response',async()=>{
  const {s,d}=await blockedSession();let release;d.transcript=()=>new Promise(resolve=>release=resolve);const pending=s.recheckBlocked();await s.select({...scope,taskId:'B'});release({messages:successfulGateMessages});await pending;assert.equal(s.scope.taskId,'B');assert.equal(s.identity,null)
})

test('timeout marked success and duplicate results cannot unlock a blocked gate',async()=>{
 for(const results of [[{type:'tool_result',id:'call1',state:'success',output:'[HITL_TIMEOUT] 审批超时自动取消'}],[{type:'tool_result',id:'call1',state:'success'}, {type:'tool_result',id:'call1',state:'success',output:'[HITL_TIMEOUT]'}]]){
  const {s,d,writes}=await blockedSession();d.transcript=async()=>({messages:[successfulGateMessages[0],{role:'assistant',content:results}]});await s.recheckBlocked();assert.equal(s.halted,true);assert.equal(s.identity.status,'blocked');assert.equal(writes(),1)
 }
})
test('the model probe must get an explicit successful text before real research starts',async()=>{const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);await s.start('选题');assert.match(s.error,/先测试模型/);assert.equal(s.identity,null);await s.probe();assert.equal(s.probePassed,true);await s.start('选题');assert.equal(s.status,'finished');assert.equal(s.identity.taskId,'A')})
test('switching task invalidates late events and does not write them into the new task',async()=>{const {ResearchRunSession}=await subject(),d=deps();let finish,events;d.run=async(i,r,onEvent)=>{events=onEvent;return new Promise(resolve=>finish=resolve)};const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;const active=s.start('A');await new Promise(resolve=>setTimeout(resolve,0));await s.select({...scope,taskId:'B'});events({type:'TEXT_MESSAGE_CONTENT',messageId:'late',delta:'old A'});finish({status:'success',message:'',texts:{late:'old A'},interrupts:[]});await active;assert.equal(s.identity,null);assert.equal(s.scope.taskId,'B');assert.deepEqual(s.messages,[])})
test('the original run is saved before sending and a failed submission cannot claim the form was consumed',async()=>{const {ResearchRunSession}=await subject(),d=deps(),calls=[];d.run=async(i,r)=>{calls.push({i:structuredClone(i),r:structuredClone(r)});if(calls.length===1)return {status:'interrupt',message:'',texts:{},interrupts:[gate]};throw Error('network')};d.pending=async()=>[gate];const storage=fixture(),s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');const original=s.identity.runId;assert.equal(s.status,'interrupt');await s.submit({'reply:call1':{decision:'通过',feedback:''}});assert.equal(calls[1].r.runId,original);assert.equal(calls[1].r.threadId,s.identity.threadId);assert.equal(s.status,'uncertain');assert.match(s.error,/核对/);assert.deepEqual(s.identity.submittedIds,['reply:call1']);assert.equal(calls.length,2);await s.submit({'reply:call1':{decision:'通过',feedback:''}});assert.equal(calls.length,2)})
test('a revived submitted interrupt stops recovery instead of resending it',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');s.identity.submittedIds=['reply:call1'];d.pending=async()=>[gate];await s.recover();assert.equal(s.status,'uncertain');assert.match(s.error,/已答中断/);assert.equal(s.interrupts.length,0)})

test('refresh during an active resume waits without blocking or replaying its still registered gate',async()=>{
 const {ResearchRunSession}=await subject(),d=deps(),storage=fixture();let sends=0,removes=0;d.run=async()=>{sends++;return {status:'interrupt',message:'',texts:{},interrupts:[gate]}};d.remove=async()=>{removes++};const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');s.identity.submittedIds=[gate.id];d.pending=async()=>[gate];d.runStatus=async()=>({running:true});await s.recover();assert.equal(s.halted,false);assert.equal(s.status,'working');assert.deepEqual(s.identity.submittedIds,[gate.id]);assert.deepEqual(s.interrupts,[]);assert.equal(sends,1);assert.equal(removes,0);d.runStatus=async()=>({running:false,pendingWork:false});d.pending=async()=>[];d.transcript=async()=>({messages:successfulGateMessages});await s.recover();assert.equal(s.status,'finished');assert.equal(s.halted,false);assert.equal(sends,1)
})
test('browser stop only stops receiving and does not promise that the server cancelled',async()=>{const {ResearchRunSession}=await subject(),d=deps();let finish;d.run=async()=>new Promise(resolve=>finish=resolve);const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;const p=s.start('研究');await new Promise(resolve=>setTimeout(resolve,0));s.stop();assert.equal(s.status,'uncertain');assert.match(s.error,/服务端.*可能/);finish({status:'success',message:'',texts:{},interrupts:[]});await p;assert.equal(s.status,'uncertain')})

test('submit checks all server pending IDs and refuses to cancel or omit a new sibling',async()=>{const {ResearchRunSession}=await subject(),d=deps();let calls=0;d.run=async()=>{calls++;return {status:'interrupt',message:'',texts:{},interrupts:[gate]}};const unexpected={...gate,id:'other:call2',toolCallId:'call2'};d.pending=async()=>[gate,unexpected];const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.submit({'reply:call1':{decision:'通过',feedback:''}});assert.equal(calls,1);assert.match(s.error,/待答表单.*变化/);assert.equal(s.identity.status,'interrupt')})

test('explicit server stop uses the original session and waits for authoritative recovery',async()=>{const {ResearchRunSession}=await subject(),d=deps();let finish,stopped;d.run=async()=>new Promise(resolve=>finish=resolve);d.stop=async(agent,thread)=>{stopped={agent,thread};return {session_id:thread,interrupted:true}};const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;const p=s.start('研究');await new Promise(resolve=>setTimeout(resolve,0));const thread=s.identity.threadId;await s.stopServer();assert.deepEqual(stopped,{agent:'agent',thread});assert.equal(s.status,'uncertain');assert.match(s.notice,/核对/);finish({status:'success',message:'',texts:{},interrupts:[]});await p;assert.equal(s.status,'uncertain')})

test('after resume to a new gate only the consumed old tool is cleaned; failure blocks further submission',async()=>{const {ResearchRunSession}=await subject(),d=deps(),newGate={...gate,id:'reply2:call2',toolCallId:'call2'},removed=[];let calls=0;d.run=async()=>++calls===1?{status:'interrupt',message:'',texts:{},interrupts:[gate]}:{status:'interrupt',message:'',texts:{},interrupts:[newGate]};d.pending=async()=>[gate];d.remove=async(a,t,id)=>{removed.push(id);throw Error('cleanup unavailable')};const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.submit({'reply:call1':{decision:'通过',feedback:''}});assert.deepEqual(removed,['call1']);assert.equal(s.status,'uncertain');assert.match(s.error,/清理失败/);assert.equal(s.interrupts[0].id,'reply2:call2');await s.submit({'reply2:call2':{decision:'通过',feedback:''}});assert.equal(calls,2)})

test('a delayed stop request blocks a second run until its outcome is known',async()=>{const {ResearchRunSession}=await subject(),d=deps();let finishRun,finishStop,calls=0;d.run=async()=>{calls++;return new Promise(resolve=>{if(calls===1)finishRun=resolve;else resolve({status:'success',message:'',texts:{a:'second'},interrupts:[]})})};d.stop=async(agent,thread)=>new Promise(resolve=>finishStop=()=>resolve({session_id:thread,interrupted:true}));const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;const first=s.start('A');await new Promise(resolve=>setTimeout(resolve,0));const stopping=s.stopServer();finishRun({status:'success',message:'',texts:{a:'finished'},interrupts:[]});await first;await s.start('B');assert.equal(calls,1);finishStop();await stopping;assert.equal(s.status,'uncertain')})
test('recovery obtains a background gate run ID only from a matching recorded interrupt event',async()=>{const {ResearchRunSession}=await subject(),d=deps(),bg={...gate,id:'background:call-bg',toolCallId:'call-bg'};d.pending=async()=>[bg];d.events=async()=>[{runId:'run-background',payload:{type:'RUN_FINISHED',threadId:'main-uuid',runId:'run-background',outcome:{type:'interrupt',interrupts:[bg]}}}];const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.recover();assert.equal(s.status,'interrupt');assert.equal(s.identity.runId,'run-background');assert.equal(s.interrupts[0].id,'background:call-bg')})

test('background forms with ambiguous recorded runs remain blocked',async()=>{const {ResearchRunSession}=await subject(),d=deps(),bg={...gate,id:'background:call-bg',toolCallId:'call-bg'};d.pending=async()=>[bg];d.events=async()=>['run-one','run-two'].map(runId=>({runId,payload:{type:'RUN_FINISHED',threadId:'main-uuid',runId,outcome:{type:'interrupt',interrupts:[bg]}}}));const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');const before=s.identity.runId;await s.recover();assert.equal(s.status,'uncertain');assert.equal(s.identity.runId,before);assert.match(s.error,/运行身份/);assert.deepEqual(s.interrupts,[])})
test('background form events for another session cannot supply a run identity',async()=>{const {ResearchRunSession}=await subject(),d=deps(),bg={...gate,id:'background:call-bg',toolCallId:'call-bg'};d.pending=async()=>[bg];d.events=async()=>[{runId:'other-run',payload:{type:'RUN_FINISHED',threadId:'other-session',runId:'other-run',outcome:{type:'interrupt',interrupts:[bg]}}}];const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.recover();assert.equal(s.status,'uncertain');assert.match(s.error,/运行身份/)})

test('a successful response does not claim the session finished while background work remains',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.runStatus=async()=>({running:false,pendingWork:true});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'working');assert.match(s.notice,/后台/)})
test('an unavailable status check after successful stream keeps session uncertain',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.runStatus=async()=>{throw Error('network')};const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'uncertain');assert.match(s.error,/核对/)})

test('model probe preserves the actual server error for diagnosis',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.run=async()=>({status:'error',message:'DashScope API key cannot be empty.',texts:{},interrupts:[]});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);await s.probe();assert.equal(s.probePassed,false);assert.match(s.error,/DashScope API key cannot be empty/);assert.equal(s.status,'uncertain')})

test('a continued old-backend ledger blocks new runs after a segment and survives recovery',async()=>{const {ResearchRunSession}=await subject(),d=deps();let calls=0;d.run=async()=>{calls++;return {status:'success',message:'',texts:{a:'后台稍后继续'},interrupts:[]}};d.runStatus=async()=>({running:false,continuationPlanned:true});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'working');assert.match(s.notice,/待推进/);await s.start('重复');assert.equal(calls,1);await s.recover();assert.equal(s.status,'working');assert.match(s.notice,/待推进/)})
test('a newly registered gate cannot become ordinary input without verified run identity',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.pending=async()=>[gate];d.runStatus=async()=>({running:false,awaitingInput:true});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'uncertain');assert.match(s.error,/表单/);await s.recover();assert.equal(s.status,'uncertain');assert.match(s.error,/表单/)})
test('pre-send recheck blocks a newly pending continuation without issuing another model call',async()=>{const {ResearchRunSession}=await subject(),d=deps();let calls=0;d.run=async()=>{calls++;return {status:'success',message:'',texts:{a:'一段回复'},interrupts:[]}};const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');d.runStatus=async()=>({running:false,continuationPlanned:true});await s.start('重复');assert.equal(calls,1);assert.equal(s.status,'uncertain')})

test('failed recovery clears its checking notice instead of appearing to keep processing',async()=>{const {ResearchRunSession}=await subject(),d=deps();const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');d.runStatus=async()=>{throw Error('offline')};await s.recover();assert.equal(s.status,'uncertain');assert.equal(s.busy,false);assert.equal(s.notice.includes('正在核对'),false);assert.match(s.error,/offline/)})

function serverGateEvents(gate,run='srv-real',thread='main-uuid'){return [{runId:run,payload:{type:'RUN_STARTED',runId:run,threadId:thread}},{runId:run,payload:{type:'TOOL_CALL_START',runId:run,threadId:thread,toolCallId:gate.toolCallId,toolCallName:gate.metadata.toolName}},{runId:run,payload:{type:'TOOL_CALL_ARGS',runId:run,threadId:thread,toolCallId:gate.toolCallId,delta:JSON.stringify(gate.metadata.toolInput)}},{runId:run,payload:{type:'RUN_FINISHED',runId:run,threadId:thread}}]}

test('unknown progress cannot finish a session, issue another run or unlock blocked recovery',async()=>{
  const {ResearchRunSession}=await subject(),d=deps();let calls=0;d.run=async()=>{calls++;return {status:'success',message:'',texts:{a:'等待后台'},interrupts:[]}};d.runStatus=async()=>({running:false,continuationUnknown:true});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'uncertain');await s.recover();assert.equal(s.status,'uncertain');assert.match(s.error,/核对/);assert.equal(s.interrupts.length,0);s.status='awaiting';await s.start('重复');assert.equal(calls,1)
  const blocked=await blockedSession();blocked.d.runStatus=async()=>({running:false,continuationUnknown:true});await blocked.s.recheckBlocked();assert.equal(blocked.s.halted,true);assert.equal(blocked.s.identity.status,'blocked')
})
test('a verified background gate survives refresh despite an UNKNOWN progress ledger',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture(),bg={...gate,id:'bg:call-bg',toolCallId:'call-bg'};d.runStatus=async()=>({running:false,continuationUnknown:true});d.pending=async()=>[bg];d.events=async()=>serverGateEvents(bg);const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.recover();assert.equal(s.status,'interrupt');assert.equal(s.identity.runId,'srv-real');const restored=new ResearchRunSession(storage,d,()=> 'owner');await restored.select(scope);await restored.recover();assert.equal(restored.status,'interrupt');assert.equal(restored.interrupts[0].id,bg.id);assert.equal(restored.identity.runId,'srv-real')
})
test('a background gate recovers its authoritative srv run from the complete matching tool lifecycle',async()=>{const {ResearchRunSession}=await subject(),d=deps(),bg={...gate,id:'bg:call-bg',toolCallId:'call-bg'};d.pending=async()=>[bg];d.events=async()=>serverGateEvents(bg);const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.recover();assert.equal(s.status,'interrupt');assert.equal(s.identity.runId,'srv-real');assert.equal(s.interrupts[0].id,bg.id)})
test('incomplete, conflicting, mismatched or failed background tool lifecycles cannot supply a run ID',async()=>{const {ResearchRunSession}=await subject(),bg={...gate,id:'bg:call-bg',toolCallId:'call-bg'};for(const mutate of [es=>es.slice(1),es=>es.slice(0,-1),es=>{es[2].payload.delta='{}';return es},es=>serverGateEvents(bg,'srv-real','other'),es=>{es[3].payload.type='RUN_ERROR';return es},es=>[...es,...serverGateEvents(bg,'srv-other')]]){const d=deps();d.pending=async()=>[bg];d.events=async()=>mutate(serverGateEvents(bg));const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');await s.recover();assert.equal(s.status,'uncertain');assert.notEqual(s.identity.runId,'srv-real')}})

test('WAIT_HITL with no registered or unresolved gate is waiting for a user message, not failed approval',async()=>{const {ResearchRunSession}=await subject(),d=deps();let calls=0;d.run=async()=>{calls++;return {status:'success',message:'',texts:{a:'本轮G1通过，等待是否进入G2'},interrupts:[]}};d.runStatus=async()=>({running:false,awaitingInput:true});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');assert.equal(s.status,'awaiting');assert.equal(s.error,'');await s.recover();assert.equal(s.status,'awaiting');await s.start('补充说明');assert.equal(calls,2)})
test('a known unresolved gate missing from registration cannot degrade to ordinary input',async()=>{const {ResearchRunSession}=await subject(),d=deps();d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('研究');d.runStatus=async()=>({running:false,awaitingInput:true});await s.recover();assert.equal(s.status,'uncertain');assert.match(s.error,/待答表单/);assert.equal(s.identity.pendingIds[0],gate.id)})


test('submitted gate is cleaned from durable evidence before stream completion; duplicate checks share one request',async()=>{
 const {ResearchRunSession}=await subject(),d=deps(),storage=fixture();let finish,reads=0,removed=[];
 d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});d.pending=async()=>[gate];
 const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid');await s.select(scope);s.probePassed=true;await s.start('synthetic');
 d.run=()=>new Promise(resolve=>finish=resolve);const submitting=s.submit({'reply:call1':{decision:'通过'}});await new Promise(r=>setTimeout(r,0));
 d.transcript=async()=>{reads++;return {messages:successfulGateMessages}};d.remove=async(a,t,id)=>removed.push(id);
 await Promise.all([s.reconcileSubmitted(),s.reconcileSubmitted()]);assert.equal(reads,1);assert.deepEqual(removed,['call1']);assert.equal(s.identity.status,'submitting');assert.equal(s.busy,true);
 finish({status:'uncertain',message:'synthetic disconnect',texts:{},interrupts:[]});await submitting;
});
test('reconciliation never clears an unaccepted, timeout or conflicting submission, or clears another gate',async()=>{
 const {ResearchRunSession}=await subject();
 for(const messages of [[],[{...successfulGateMessages[1],content:[{type:'tool_result',id:'call1',state:'success',output:'[HITL_TIMEOUT]'}]}], [...successfulGateMessages,successfulGateMessages[1]]]){
  const d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');let removed=0;
  d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});d.pending=async()=>[gate];await s.select(scope);s.probePassed=true;await s.start('synthetic');d.run=async()=>{throw Error('synthetic network')};await s.submit({'reply:call1':{decision:'通过'}});
  d.transcript=async()=>({messages});d.remove=async()=>{removed++};await s.reconcileSubmitted();assert.equal(removed,0);assert.equal(s.status,'uncertain');
 }
});
test('late reconciliation cannot remove a gate after switching tasks',async()=>{
 const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');let complete,removed=0;
 d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});d.pending=async()=>[gate];await s.select(scope);s.probePassed=true;await s.start('synthetic');d.run=async()=>{throw Error('synthetic network')};await s.submit({'reply:call1':{decision:'通过'}});
 d.transcript=()=>new Promise(resolve=>complete=resolve);d.remove=async()=>{removed++};const checking=s.reconcileSubmitted();await s.select({...scope,taskId:'B'});complete({messages:successfulGateMessages});await checking;assert.equal(removed,0);assert.equal(s.scope.taskId,'B');
});


test('empty pending cannot hide contradictory or timed-out results during ordinary recovery',async()=>{
 const {ResearchRunSession}=await subject();
 for(const messages of [[...successfulGateMessages,successfulGateMessages[1]],[successfulGateMessages[0],{...successfulGateMessages[1],content:[{type:'tool_result',id:'call1',state:'success',output:[{type:'text',text:'[HITL_TIMEOUT]'}]}]}]]){
  const d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid');d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]});d.pending=async()=>[gate];await s.select(scope);s.probePassed=true;await s.start('synthetic');d.run=async()=>{throw Error('synthetic network')};await s.submit({'reply:call1':{decision:'通过'}});d.pending=async()=>[];d.transcript=async()=>({messages});d.runStatus=async()=>({running:false,awaitingInput:true});await s.recover();assert.equal(s.halted,true);assert.equal(s.status,'uncertain');assert.match(s.error,/冲突|超时/);assert.equal(s.busy,false);
 }
});


test('sending reports preflight, dispatch and server events separately and blocks duplicate sends',async()=>{
  const {ResearchRunSession}=await subject(),d=deps()
  let releaseVerify,finishRun,emit,runIdentity,runCalls=0
  d.verify=()=>new Promise(resolve=>{releaseVerify=resolve})
  d.run=(identity,request,onEvent)=>{
    runCalls++;emit=onEvent;runIdentity=identity
    return new Promise(resolve=>{finishRun=resolve})
  }
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true
  const sending=s.start('synthetic topic')
  assert.equal(s.busy,true);assert.equal(runCalls,0);assert.match(s.notice,/尚未发送/)
  releaseVerify();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(runCalls,1);assert.match(s.notice,/请求已发出/)
  await s.start('duplicate');assert.equal(runCalls,1)
  emit({type:'RUN_STARTED',threadId:runIdentity.threadId,runId:runIdentity.runId})
  assert.match(s.notice,/已收到服务端/)
  emit({type:'TEXT_MESSAGE_CONTENT',messageId:'answer',delta:'received'})
  assert.match(s.notice,/接收智能体回复/);assert.equal(s.messages.at(-1).text,'received')
  finishRun({status:'success',message:'',texts:{answer:'received'},interrupts:[]})
  await sending;assert.equal(s.busy,false)
})


test('replay direct send verifies the agent and uses one real run without an extra model probe',async()=>{
  const {ResearchRunSession}=await subject(),d=deps();let runs=0,verified=0
  d.verify=async()=>{verified++}
  d.run=async()=>{runs++;assert.equal(verified,1);return {status:'success',message:'',texts:{a:'response'},interrupts:[]}}
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('team input',{requireModelProbe:false})
  assert.equal(runs,1);assert.equal(s.probePassed,false);assert.equal(s.status,'finished')
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  await s.start('another input',{requireModelProbe:false});assert.equal(runs,1);assert.equal(s.status,'uncertain')
})

test('replay direct send still refuses an unavailable agent before dispatch',async()=>{
  const {ResearchRunSession}=await subject(),d=deps();let runs=0
  d.verify=async()=>{throw Error('agent unavailable')};d.run=async()=>{runs++}
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('team input',{requireModelProbe:false})
  assert.equal(runs,0);assert.equal(s.identity,null);assert.match(s.error,/agent unavailable/)
})


test('server phase follows the task, restores after refresh and clears on task switch',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  d.runStatus=async()=>({running:false,awaitingInput:true,phase:'G2'})
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('input',{requireModelProbe:false})
  assert.equal(s.serverPhase,'G2');assert.equal(s.status,'awaiting')
  const restored=new ResearchRunSession(storage,d,()=> 'owner')
  await restored.select(scope);assert.equal(restored.serverPhase,'G2')
  await restored.select({...scope,taskId:'B'});assert.equal(restored.serverPhase,'')
  restored.dispose();assert.equal(restored.serverPhase,'')
})


test('running parent can expose a verified unanswered G1 form and its phase',async()=>{
  const {ResearchRunSession}=await subject(),d=deps()
  const firstForm={...gate,metadata:{...gate.metadata,toolInput:{title:'G1 六要素收集'}}}
  d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[firstForm]})
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true;await s.start('topic')
  d.pending=async()=>[firstForm];d.runStatus=async()=>({running:true})
  await s.recover({readOnly:true})
  assert.equal(s.status,'interrupt');assert.equal(s.interrupts[0].id,firstForm.id);assert.equal(s.serverPhase,'G1')
  assert.equal(s.busy,false)
})

test('running parent requires the pending form to prove its run ownership',async()=>{
  const {ResearchRunSession}=await subject(),d=deps()
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);s.probePassed=true;await s.start('topic')
  d.runStatus=async()=>({running:true})
  d.pending=async()=>[{...gate,metadata:{...gate.metadata,runId:s.identity.runId}}]
  await s.recover({readOnly:true});assert.equal(s.status,'interrupt')
  d.pending=async()=>[{...gate,id:'unknown:other',toolCallId:'other',metadata:{...gate.metadata,runId:'wrong-run'}}]
  await s.recover({readOnly:true});assert.equal(s.status,'uncertain');assert.equal(s.interrupts.length,0)
})


test('recovery retains readable server replies when progress request fails and disables continuation',async()=>{
  const {ResearchRunSession}=await subject(),d=deps()
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  d.transcript=async()=>({messages:[{id:'reply',role:'assistant',content:[{type:'text',text:'G1 已通过，等待进入 G2'}]}]})
  d.runStatus=async()=>{throw Error('progress unavailable')}
  await s.recover({readOnly:true})
  assert.equal(s.messages.filter(m=>m.role==='assistant').at(-1).text,'G1 已通过，等待进入 G2')
  assert.ok(s.messages.some(m=>m.role==='user' && m.text==='topic'))
  assert.equal(s.status,'uncertain');assert.equal(s.nextStage,'');assert.match(s.error,/progress unavailable/)
})

test('next-stage action is available only after recovered input wait and clears on task change',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  d.runStatus=async()=>({running:false,phase:'G1',awaitingInput:true,nextStage:'G2'})
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  assert.equal(s.status,'awaiting');assert.equal(s.nextStage,'G2')
  const restored=new ResearchRunSession(storage,d,()=> 'owner')
  await restored.select(scope);assert.equal(restored.nextStage,'G2')
  await restored.select({...scope,taskId:'B'});assert.equal(restored.nextStage,'')
})


const compactChoice='[进度] 阶段=G1 完成=研究简报、研究问题、调查方案进行中=无剩余=G2、G3、G4 下步=等待确认是否进入 G2 状态=部分完成'
test('recovering compact latest transcript exposes G2 action and its click survives fresh preflight',async()=>{
  const {ResearchRunSession}=await subject(),d=deps();let sends=0
  d.run=async()=>{sends++;return {status:'success',message:'',texts:{reply:'waiting'},interrupts:[]}}
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  d.transcript=async()=>({messages:[{id:'latest',role:'assistant',content:[{type:'text',text:compactChoice}]}]})
  await s.recover({readOnly:true});assert.equal(s.status,'awaiting');assert.equal(s.nextStage,'G2');assert.equal(s.serverPhase,'G1')
  await s.start('确认进入 G2',{requireModelProbe:false});assert.equal(sends,2)
})
test('a newer user message or unconfirmed submission prevents interpreting an old stage choice as ready',async()=>{
  const {ResearchRunSession}=await subject(),d=deps()
  const s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  const text={id:'latest',role:'assistant',content:[{type:'text',text:compactChoice}]}
  d.transcript=async()=>({messages:[text,{id:'u-new',role:'user',content:[{type:'text',text:'new request'}]}]})
  await s.recover({readOnly:true});assert.equal(s.status,'uncertain');assert.equal(s.nextStage,'')
  s.identity.submittedIds=['reply:unconfirmed']
  d.transcript=async()=>({messages:[text]})
  await s.recover({readOnly:true});assert.equal(s.status,'uncertain');assert.equal(s.nextStage,'')
})


test('refresh restores the latest reported G2 phase even when runtime remains running with no form',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  const text='[进度] 阶段=G2 完成=G1三件进行中=等待团队题项清单剩余=G2、G3、G4 下步=团队提交题项原文 状态=等待人工'
  d.transcript=async()=>({messages:[{id:'latest',role:'assistant',content:[{type:'text',text}]}]})
  d.runStatus=async()=>({running:true});d.pending=async()=>[]
  const restored=new ResearchRunSession(storage,d,()=> 'owner')
  await restored.select(scope)
  assert.equal(restored.serverPhase,'G2');assert.equal(restored.reportedProgress.currentWork,'等待团队题项清单')
  assert.equal(restored.status,'working');assert.equal(restored.nextStage,'');assert.ok(restored.lastStatusCheckAt)
  await restored.select({...scope,taskId:'B'})
  assert.equal(restored.reportedProgress,null);assert.equal(restored.serverPhase,'');assert.equal(restored.lastStatusCheckAt,'')
})


test('runtime running does not prevent reading the current structured progress snapshot',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),storage=fixture()
  const s=new ResearchRunSession(storage,d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('topic',{requireModelProbe:false})
  d.runStatus=async()=>({running:true})
  d.progress=async()=>({sessionId:s.identity.threadId,phase:'G2',progressLine:'[进度] 阶段=G2 完成=G1进行中=题项校验剩余=G2、G3、G4 下步=等待校验结果 状态=执行中'})
  await s.recover({readOnly:true})
  assert.equal(s.status,'working');assert.equal(s.serverPhase,'G2');assert.equal(s.reportedProgress.currentWork,'题项校验')
  d.progress=async()=>({sessionId:'another-thread',phase:'G4'})
  await s.recover({readOnly:true});assert.equal(s.serverPhase,'G2')
})


test('explicit chat can send after UNKNOWN only with idle runtime and resolved forms',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  await s.recover({readOnly:true});assert.equal(s.status,'uncertain')
  let sends=0;d.run=async()=>{sends++;return {status:'success',message:'',texts:{a:'收到选项'},interrupts:[]}}
  await s.start('选择第二项',{requireModelProbe:false,allowIdleMessage:true})
  assert.equal(sends,1)
})
test('explicit chat still blocks running, live interrupts and unresolved prior submissions',async()=>{
  for(const mode of ['running','live','unresolved']){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false});s.status='uncertain'
    d.runStatus=async()=>({running:mode==='running',continuationUnknown:true})
    d.live=async()=>mode==='live'?['reply:other']:[]
    if(mode==='unresolved')s.identity.submittedIds=[gate.id]
    let sends=0;d.run=async()=>{sends++;throw Error('must not send')}
    await s.start('选择第二项',{requireModelProbe:false,allowIdleMessage:true})
    assert.equal(sends,0,mode)
  }
})


test('optional live-interrupt endpoint unavailable falls back to pending runtime and transcript checks',async()=>{
  for(const unresolved of [false,true]){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false});s.status='uncertain'
    d.live=async()=>null;d.runStatus=async()=>({running:false,continuationUnknown:true})
    if(unresolved)s.identity.submittedIds=[gate.id]
    let sends=0;d.run=async()=>{sends++;return {status:'success',message:'',texts:{a:'收到'},interrupts:[]}}
    await s.start('演练模式',{requireModelProbe:false,allowIdleMessage:true})
    assert.equal(sends,unresolved?0:1)
    if(unresolved){assert.match(s.notice,/尚未发送/);assert.equal(s.error.includes('当前运行结果需核对'),false)}
  }
})


test('polling a delayed transcript preserves sent user text and later merges by request message ID',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  let request
  d.run=async(_,body)=>{request=body;return {status:'success',message:'',texts:{a:'已收到'},interrupts:[]}}
  await s.select(scope);await s.start('演练模式',{requireModelProbe:false})
  const sentId=request.messages[0].id
  d.runStatus=async()=>({running:true})
  d.transcript=async()=>({messages:[]})
  await s.recover({readOnly:true})
  assert.equal(s.messages.find(m=>m.id===sentId).text,'演练模式')
  assert.equal(s.status,'working')
  d.transcript=async()=>({messages:[{id:sentId,role:'user',content:request.messages[0].content}]})
  await s.recover({readOnly:true})
  assert.equal(s.messages.filter(m=>m.id===sentId).length,1)
  assert.equal(s.messages.find(m=>m.id===sentId).local,undefined)
})


test('expired gate recovery requires explicit request and verified idle registrations',async()=>{
  for(const mode of ['recover','ordinary','running','pending','live','submitted','unavailable']){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false})
    s.status='uncertain';s.identity.pendingIds=[gate.id]
    d.runStatus=async()=>({running:mode==='running',continuationUnknown:true})
    d.pending=async()=>mode==='pending'?[gate]:[]
    d.live=async()=>mode==='unavailable'?null:mode==='live'?['call1']:[]
    if(mode==='submitted')s.identity.submittedIds=[gate.id]
    d.transcript=async()=>({messages:[{id:'expired',role:'user',content:[{type:'text',text:'[平台留痕] 等待用户审核超时，表单/闸门已自动关闭。'}]}]})
    let sends=0;d.run=async()=>{sends++;return {status:'success',message:'',texts:{a:'收到恢复核对请求'},interrupts:[]}}
    await s.start('请核对已超时审核并重新提供入口',{requireModelProbe:false,allowIdleMessage:true,recoverExpiredGate:mode!=='ordinary'})
    assert.equal(sends,mode==='recover'?1:0,mode)
    assert.equal(s.identity.projectId,'sz-uuid')
    assert.equal(s.identity.threadId,'main-uuid')
  }
})


test('recovery distinguishes a unique expired gate from duplicate timeout results',async()=>{
  for(const mode of ['terminal','terminal-without-live','duplicate','unrelated-timeout']){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false})
    s.status='uncertain';s.identity.pendingIds=[gate.id]
    d.runStatus=async()=>({running:false,continuationUnknown:true})
    d.live=async()=>mode==='terminal'?[]:null
    const result={type:'tool_result',id:mode==='unrelated-timeout'?'other':'call1',state:'error',output:'[HITL_TIMEOUT]'}
    d.transcript=async()=>({messages:[{id:'tool',role:'assistant',content:mode==='duplicate'?[result,result]:[result]},{id:'expired',role:'user',content:[{type:'text',text:'[平台留痕] 等待用户审核超时，表单/闸门已自动关闭。'}]}]})
    let sends=0;d.run=async()=>{sends++;return {status:'success',message:'',texts:{a:'收到核对请求'},interrupts:[]}}
    await s.start('请核对已超时审核',{requireModelProbe:false,allowIdleMessage:true,recoverExpiredGate:true})
    assert.equal(sends,['terminal','terminal-without-live'].includes(mode)?1:0,mode)
  }
})


test('recovery accepts the platform system-role expiry notice without display prefix',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('研究',{requireModelProbe:false});s.status='uncertain'
  d.live=async()=>[];d.runStatus=async()=>({running:false,continuationUnknown:true})
  d.transcript=async()=>({messages:[{id:'expired',role:'system',content:[{type:'text',text:'等待用户审核超时，表单/闸门「G1 研究问题确认」已自动关闭。'}]}]})
  let sends=0;d.run=async()=>{sends++;return {status:'success',message:'',texts:{a:'已收到核对请求'},interrupts:[]}}
  await s.start('请核对原审核',{requireModelProbe:false,allowIdleMessage:true,recoverExpiredGate:true})
  assert.equal(sends,1)
})


test('idle UNKNOWN with latest own user envelope restores chat without sending or approving',async()=>{
  for(const mode of ['idle','live','unresolved','timeout']){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false})
    d.runStatus=async()=>({running:false,continuationUnknown:true})
    d.live=async()=>mode==='live'?['reply:other']:[]
    const messages=[{id:'user-last',role:'user',content:[{type:'text',text:'【项目ID】'+s.identity.projectId+'\n研究主题：新能源汽车\n\n我的问题或补充说明：\n继续下一步'}]}]
    if(mode==='unresolved')messages.unshift({id:'call',role:'assistant',content:[{type:'tool_call',id:'pending',name:'task'}]})
    if(mode==='timeout')s.identity.pendingIds=['reply:pending']
    d.transcript=async()=>({messages})
    let writes=0;d.run=d.register=d.remove=async()=>{writes++;throw Error('must not write')}
    await s.recover({readOnly:true})
    assert.equal(s.status,mode==='idle'?'awaiting':'uncertain',mode)
    assert.equal(writes,0)
    if(mode==='idle'){
      assert.equal(s.serverPhase,'')
      assert.equal(s.nextStage,'')
      assert.match(s.notice,/最近记录是你发送的消息/)
    }
  }
})


test('form feedback follows server events, prevents duplicate sends and clears when switching task',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]})
  d.pending=async()=>[gate]
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  let emit,finish,sends=0
  d.run=async(i,r,onEvent)=>{sends++;emit=onEvent;return new Promise(resolve=>{finish=resolve})}
  const submitting=s.submit({'reply:call1':{decision:'通过',feedback:''}})
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(s.formSubmission.issued,true)
  assert.equal(s.formSubmission.runStartedAt,null)
  assert.equal(s.formSubmission.replyAt,null)
  assert.equal(s.formSubmission.settledAt,null)
  await s.submit({'reply:call1':{decision:'通过',feedback:''}})
  assert.equal(sends,1)
  emit({type:'RUN_STARTED',threadId:'other',runId:s.identity.runId})
  assert.equal(s.formSubmission.runStartedAt,null)
  emit({type:'RUN_STARTED',threadId:s.identity.threadId,runId:s.identity.runId})
  assert.ok(s.formSubmission.runStartedAt)
  emit({type:'TEXT_MESSAGE_CONTENT',messageId:'answer',delta:'已收到，开始核对。'})
  assert.ok(s.formSubmission.replyAt)
  finish({status:'success',message:'',texts:{answer:'已收到，开始核对。'},interrupts:[]})
  await submitting
  assert.ok(s.formSubmission.settledAt)
  assert.equal(s.status,'finished')
  await s.select({...scope,taskId:'B'})
  assert.equal(s.formSubmission,null)
})

test('network failure retains form feedback without fabricating server receipt or a reply',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]})
  d.pending=async()=>[gate]
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  d.run=async()=>{throw Error('network timeout')}
  await s.submit({'reply:call1':{decision:'通过',feedback:'保留意见'}})
  assert.equal(s.status,'uncertain')
  assert.equal(s.formSubmission.runStartedAt,null)
  assert.equal(s.formSubmission.replyAt,null)
  assert.ok(s.formSubmission.settledAt)
  assert.match(s.error,/提交结果未确认/)
  const feedback=s.formSubmission
  await s.submit({'reply:call1':{decision:'通过',feedback:''}})
  assert.equal(s.formSubmission,feedback)
})


test('submission status checks stay read-only during a pending request and ignore a late result for another task',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  d.run=async()=>({status:'interrupt',message:'',texts:{},interrupts:[gate]})
  d.pending=async()=>[gate]
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  let finishRun
  d.run=async()=>new Promise(resolve=>{finishRun=resolve})
  const submitting=s.submit({'reply:call1':{decision:'通过',feedback:''}})
  await new Promise(resolve=>setTimeout(resolve,0))
  d.runStatus=async()=>({running:true})
  await s.checkFormSubmission()
  assert.ok(s.formSubmission.checkedAt)
  assert.match(s.formSubmission.checkMessage,/仍在运行/)
  assert.equal(s.formSubmission.runStartedAt,null)
  assert.equal(s.busy,true)
  d.runStatus=async()=>{throw Error('offline')}
  await s.checkFormSubmission()
  assert.equal(s.formSubmission.checkFailed,true)
  assert.equal(s.busy,true)
  let finishStatus
  d.runStatus=async()=>new Promise(resolve=>{finishStatus=resolve})
  const checking=s.checkFormSubmission()
  await s.select({...scope,taskId:'B'})
  finishStatus({running:true});await checking
  finishRun({status:'success',message:'',texts:{late:'old'},interrupts:[]});await submitting
  assert.equal(s.formSubmission,null)
  assert.equal(s.scope.taskId,'B')
  assert.deepEqual(s.messages,[])
})


test('G3 short final confirmation reply restores the plan action after the full ledger and permits its request',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  const line='[进度] 阶段=G3 完成=质检五件+完整性复验（无变化） 进行中=无 剩余=统计段、质量审核、G4 下步=等待团队确认统计执行 状态=等待人工'
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  d.transcript=async()=>({messages:[{id:'ledger',role:'assistant',content:[{type:'text',text:line}]},{id:'short',role:'assistant',content:[{type:'text',text:'复验结果：材料完整、指纹一致、无新增缺口；统计段继续等待你的确认。'}]}]})
  await s.recover({readOnly:true})
  assert.equal(s.status,'awaiting');assert.equal(s.serverPhase,'G3');assert.equal(s.error,'')
  let sent=''
  d.run=async(i,r)=>{sent=JSON.stringify(r);return {status:'success',message:'',texts:{a:'请核对计划'},interrupts:[]}}
  await s.start('请展示分析计划，暂不执行统计。',{requireModelProbe:false,allowIdleMessage:true})
  assert.match(sent,/请展示分析计划/);assert.match(sent,/暂不执行统计/)
})

test('short statistics wait cannot override newer user input, unverified gates, another phase or active tools',async()=>{
  for(const mode of ['user','gate','phase','tool','timeout','running']){
    const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
    await s.select(scope);await s.start('研究',{requireModelProbe:false})
    const line='[进度] 阶段='+(mode==='phase'?'G2':'G3')+' 完成=核验 进行中=无 剩余=后续 下步=等待团队确认统计执行 状态=等待人工'
    const messages=[{id:'ledger',role:'assistant',content:[{type:'text',text:line}]},{id:'short',role:mode==='user'?'user':'assistant',content:[{type:'text',text:'材料完整；统计段继续等待你的确认。'+(mode==='timeout'?' HITL_TIMEOUT':'')}]}]
    if(mode==='gate')s.identity.submittedIds=['reply:unverified']
    if(mode==='tool')messages.unshift({id:'call',role:'assistant',content:[{type:'tool_call',id:'pending',name:'task'}]})
    d.transcript=async()=>({messages});d.runStatus=async()=>({running:mode==='running',continuationUnknown:true})
    await s.recover({readOnly:true})
    assert.equal(s.status,mode==='running'?'working':'uncertain',mode)
  }
})


test('refresh of annotated G3 approval exposes G4 choice and only an explicit click issues a new request',async()=>{
  const {ResearchRunSession}=await subject(),d=deps(),s=new ResearchRunSession(fixture(),d,()=> 'owner',()=> 'uuid')
  await s.select(scope);await s.start('研究',{requireModelProbe:false})
  d.runStatus=async()=>({running:false,continuationUnknown:true})
  const line='[进度] 阶段=G3（已通过） 完成=G1、G2、G3全部闸门 进行中=无 剩余=团队补材料10项、G4骨架 下步=等待团队确认是否进入 G4 状态=等待人工'
  d.transcript=async()=>({messages:[{id:'g3-end',role:'assistant',content:[{type:'text',text:line}]}]})
  let sends=0
  d.run=async()=>{sends++;return {status:'success',message:'',texts:{reply:'收到G4骨架请求'},interrupts:[]}}
  await s.recover({readOnly:true})
  assert.equal(sends,0);assert.equal(s.status,'awaiting');assert.equal(s.nextStage,'G4')
  await s.start('确认进入 G4',{requireModelProbe:false,allowIdleMessage:true})
  assert.equal(sends,1)
})
