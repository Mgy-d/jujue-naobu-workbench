import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const output=await build({entryPoints:['src/api/researchCloud.ts'],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':'./src'},plugins:[{name:'mock-http',setup(b){b.onResolve({filter:/^\.\/http$/},()=>({path:'http',namespace:'mock'}));b.onResolve({filter:/^@\/utils\/researchRunIdentity$/},()=>({path:new URL('../src/utils/researchRunIdentity.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:"export const getAccessToken=()=>globalThis.historyToken;export const authSnapshot=()=>globalThis.historyToken;export const sameAuth=s=>s===globalThis.historyToken;export const rawFetch=(...args)=>globalThis.historyFetch(...args)",loader:'js'}))}}]})
const m=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'))
function storage(seed={}){const s={...seed};Object.defineProperties(s,{getItem:{value:key=>s[key]??null},setItem:{value:(key,value)=>s[key]=value}});return s}
const identity={version:1,ownerId:'owner',agentId:'agent',taskId:'task',projectId:'project',threadId:'thread',runId:'run',status:'finished',pendingIds:[],submittedIds:[]}
function setup(seed={}){globalThis.localStorage=storage(seed);globalThis.historyToken='a.'+Buffer.from(JSON.stringify({sub:'owner'})).toString('base64')+'.c';const rows=new Map(),writes=[];globalThis.historyFetch=async(path,o={})=>{const key=path.split('/documents/')[1];if(o.method==='PUT'){writes.push([key,o.body]);const row={data:o.body.data,revision:(rows.get(key)?.revision||0)+1};rows.set(key,row);return new Response(JSON.stringify(row))}return rows.has(key)?new Response(JSON.stringify(rows.get(key))):new Response('{}',{status:404})};m.researchCloud.select('owner');rows.set('task/task',{data:{},revision:1});return {rows,writes}}
test('history import requires owner binding, preserves existing first record and records old messages as history',async()=>{
 const record={version:1,phase:'G1',savedAt:'old',messages:[{role:'assistant',text:'历史回复'}],files:[],gaps:[]}
 const seed={'shidiaoyanzhen.agent-run.v1:owner:agent:task':JSON.stringify(identity),'shidiaoyanzhen.record.v1:owner:agent:task':JSON.stringify(record),'shidiaoyanzhen.agent-run.v1:other:agent:foreign':JSON.stringify({...identity,ownerId:'other',taskId:'foreign'})}
 const {rows,writes}=setup(seed);rows.set('record/task',{data:{taskId:'task',record:{...record,title:'服务器首版'}},revision:1})
 assert.deepEqual(await m.syncOwnedLocalRecords('owner',localStorage),[])
 assert.equal(writes.length,1);assert.equal(writes[0][0],'session/task%3Aagent');assert.equal(writes[0][1].data.source,'local-saved-record');assert.equal(rows.get('record/task').data.record.title,'服务器首版')
})
test('missing task and malformed local records are reported without inventing a session',async()=>{
 const seed={'shidiaoyanzhen.agent-run.v1:owner:agent:task':JSON.stringify(identity),'shidiaoyanzhen.record.v1:owner:agent:task':'broken'}
 const {writes}=setup(seed);const failures=await m.syncOwnedLocalRecords('owner',localStorage);assert.equal(failures.length,1);assert.equal(writes.length,0)
})
test('handoff create uses expectedRevision zero; conflicts are not silently overwritten',async()=>{
 setup();let body;globalThis.historyFetch=async(_path,o)=>{body=o.body;return new Response(JSON.stringify({message:'版本冲突'}),{status:409})}
 await assert.rejects(m.researchCloud.create('artifact','survey-handoff:x',{taskId:'task',operationId:'new'}),/版本冲突/);assert.equal(body.expectedRevision,0)
})


test('a validated owner binding restores a missing task before record and session without overwriting server data',async()=>{
 const built=await build({entryPoints:['src/utils/researchDrafts.ts'],bundle:true,platform:'node',format:'esm',write:false})
 const {createLocalTask}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
 const draft=createLocalTask('full-study','task',123)
 const seed={'shidiaoyanzhen.agent-run.v1:owner:agent:task':JSON.stringify(identity),'shidiaoyanzhen.research-tasks.v1:owner':JSON.stringify({tasks:{task:draft}}),'shidiaoyanzhen.record.v1:owner:agent:task':JSON.stringify({version:1,messages:[],files:[],gaps:[]})}
 const {rows,writes}=setup(seed);rows.delete('task/task')
 assert.deepEqual(await m.syncOwnedLocalRecords('owner',localStorage),[])
 assert.deepEqual(writes.map(w=>w[0]),['task/task','record/task','session/task%3Aagent']);assert.equal(writes[0][1].expectedRevision,0)
 assert.equal(rows.get('task/task').data.title,draft.title)
})
test('an orphan identity without a task draft stays local and is reported, never fabricated',async()=>{
 const {rows,writes}=setup({'shidiaoyanzhen.agent-run.v1:owner:agent:task':JSON.stringify(identity)})
 rows.delete('task/task');const failures=await m.syncOwnedLocalRecords('owner',localStorage)
 assert.equal(failures.length,1);assert.match(failures[0],/未找到可核实的本机任务草稿/);assert.equal(writes.length,0)
})
