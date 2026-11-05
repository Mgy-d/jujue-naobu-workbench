import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(path){const b=await build({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
test('full-study sandbox, collection preparation and report survive refresh without changing other stages',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts'),s=memory(),t=m.createLocalTask('full-study','a',1)
 assert.deepEqual(t.collection,{channel:'',audience:'',startNote:'',stopRule:''})
 assert.deepEqual(t.report,{body:'',defenseNotes:'',sourceNotes:''})
 const edited=m.editLocalTask(t,{collection:{...t.collection,audience:'合成对象'},report:{...t.report,body:'合成报告'},sandboxRef:{workspaceId:'wa',runId:'ra'},inputFile:{name:'test.csv',size:9,lastModified:1}},2)
 let registry=m.saveLocalTask(s,m.emptyTaskRegistry(),edited,3)
 registry=m.saveLocalTask(s,registry,m.createLocalTask('full-study','b',4),5)
 const restored=m.loadTaskRegistry(s);assert.equal(restored.error,null)
 assert.equal(restored.registry.tasks.a.report.body,'合成报告');assert.equal(restored.registry.tasks.a.collection.audience,'合成对象')
 assert.equal(restored.registry.tasks.a.sandboxRef.runId,'ra');assert.equal(restored.registry.tasks.b.sandboxRef,null)
 assert.equal(restored.registry.tasks.b.report.body,'');assert.equal(restored.registry.tasks.a.competition.background,'')
 assert.equal('published' in restored.registry.tasks.a.collection,false)
})
test('old drafts get empty later stages; malformed new stage never overwrites storage',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts'),s=memory(),t=m.createLocalTask('full-study','old',1)
 delete t.collection;delete t.report
 const r=m.saveLocalTask(s,m.emptyTaskRegistry(),t,2);assert.equal(r.tasks.old.report.body,'')
 const raw=s.getItem(m.TASK_STORAGE_KEY)
 assert.throws(()=>m.saveLocalTask(s,r,{...r.tasks.old,report:{body:42}},3),/格式/)
 assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
 assert.throws(()=>m.saveLocalTask(s,r,{...m.createLocalTask('questionnaire-review','q'),sandboxRef:{workspaceId:'bad'}}),/格式/)
})
test('stage artifact grouping requires the same project and preserves exact returned paths',async()=>{
 const {stageArtifacts}=await subject('../src/utils/researchStageArtifacts.ts')
 const files=['sub-1/artifacts/sz-a/研究简报.md','artifacts/sz-a/研究问题.md','artifacts/sz-a/调查方案.md','artifacts/sz-a/问卷/问卷结构.json','artifacts/sz-a/统计/统计报告.md','artifacts/sz-a/报告/正文.md','artifacts/sz-b/研究简报.md','artifacts/sz-a-evil/研究简报.md'].map(path=>({name:path.split('/').at(-1),path,type:'file'}))
 assert.deepEqual(stageArtifacts(files,'sz-a',0).map(f=>f.path),[files[0].path])
 assert.equal(stageArtifacts(files,'sz-a',1)[0].name,'研究问题.md')
 assert.equal(stageArtifacts(files,'sz-a',2)[0].name,'调查方案.md')
 assert.equal(stageArtifacts(files,'sz-a',3)[0].name,'问卷结构.json')
 assert.equal(stageArtifacts(files,'sz-a',5)[0].name,'统计报告.md')
 assert.equal(stageArtifacts(files,'sz-a',6)[0].name,'正文.md')
 assert.deepEqual(stageArtifacts(files,'',0),[]);assert.deepEqual(stageArtifacts(files,'sz-a',4),[])
})
