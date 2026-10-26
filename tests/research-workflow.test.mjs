import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const source=new URL('../src/utils/researchDrafts.ts',import.meta.url)
async function subject(){
  assert.ok(existsSync(source),'scoped research task utility must exist')
  const built=await build({entryPoints:[fileURLToPath(source)],bundle:true,platform:'node',format:'esm',write:false})
  return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
}
function storage(){const entries=new Map();return {entries,getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}}
test('workflow entries and same-kind new tasks never share identity or analysis state',async()=>{
 const m=await subject(),s=storage()
 const full=m.createLocalTask('full-study','full',100),data=m.createLocalTask('dataset-analysis','data',101),q=m.createLocalTask('questionnaire-review','q',102)
 full.title='完整研究 A';data.inputFile={name:'synthetic.csv',size:8,lastModified:90}
 let registry=m.emptyTaskRegistry();for(const t of [full,data,q])registry=m.saveLocalTask(s,registry,t,200)
 const restored=m.loadTaskRegistry(s)
 assert.equal(restored.registry.tasks.full.workflowKind,'full-study')
 assert.equal(restored.registry.tasks.q.inputFile,null)
 assert.equal(restored.registry.tasks.full.inputFile,null)
 assert.equal(restored.registry.tasks.data.inputFile.name,'synthetic.csv')
 assert.equal(m.createLocalTask('full-study','full-2',201).title,'新的完整研究')
 assert.equal('projectId' in full,false);assert.equal('runId' in full,false)
 assert.deepEqual(m.stagesFor('full-study').map(s=>s.title),['赛事理解','选题分析','研究方案','问卷设计与预测试','正式调查','数据分析','报告与答辩'])
 assert.equal(m.stagesFor('dataset-analysis').length,2);assert.equal(m.stagesFor('questionnaire-review').length,1)
 assert.throws(()=>m.saveLocalTask(s,registry,{...full,workflowKind:'dataset-analysis'},300),/流程类型/)
})
test('legacy dataset draft and sandbox reference migrate once and remain dataset-only',async()=>{
 const m=await subject(),s=storage()
 const legacy={schemaVersion:1,draftId:'legacy-data',title:'原来的调查',workflowKind:'dataset-analysis',activePhase:0,createdAt:1,updatedAt:2,savedAt:3,inputFile:{name:'old.csv',size:2,lastModified:1}}
 s.setItem('refuse-naobu.research-intake.v1',JSON.stringify(legacy));s.setItem('research-sandbox-ref',JSON.stringify({workspaceId:'ws-old',runId:'run-old'}))
 const loaded=m.loadTaskRegistry(s);assert.equal(loaded.registry.tasks['legacy-data'].title,'原来的调查');assert.equal(loaded.registry.lastByKind['full-study'],undefined)
 assert.equal(loaded.registry.tasks['legacy-data'].sandboxRef.workspaceId,'ws-old')
 const saved=m.saveLocalTask(s,loaded.registry,m.createLocalTask('full-study','new-full'),50)
 assert.equal(m.loadTaskRegistry(s).registry.tasks['legacy-data'].inputFile.name,'old.csv')
 assert.equal(saved.tasks['new-full'].sandboxRef,null)
 assert.equal(s.getItem('refuse-naobu.research-intake.v1'),JSON.stringify(legacy))
})
test('corrupt registry is preserved and storage failures cannot be reported as saved',async()=>{
 const m=await subject(),s=storage();s.setItem(m.TASK_STORAGE_KEY,'{broken')
 const loaded=m.loadTaskRegistry(s);assert.ok(loaded.error);assert.equal(s.getItem(m.TASK_STORAGE_KEY),'{broken')
 assert.throws(()=>m.saveLocalTask(s,loaded.registry,m.createLocalTask('full-study','f')),/损坏/)
 const clean=m.emptyTaskRegistry(),draft=m.createLocalTask('full-study','unsaved')
 assert.throws(()=>m.saveLocalTask({getItem:()=>null,setItem:()=>{throw Error('quota')}},clean,draft),/quota/)
 assert.equal(draft.savedAt,null);assert.equal(clean.tasks.unsaved,undefined)
})
test('stage browsing and local completeness never manufacture formal advancement',async()=>{
 const m=await subject(),draft=m.createLocalTask('full-study','f')
 assert.equal(draft.viewedPhase,0);assert.equal('activePhase' in draft,false)
 assert.ok(m.checkContestDraft(draft.competition).length>0)
 const example=m.syntheticContestDraft();assert.ok(example.unknowns.some(u=>u.blocksDecision))
 assert.ok(m.checkContestDraft(example).some(i=>i.includes('组别')))
 const changed=m.editLocalTask(draft,{competition:example},150)
 assert.equal(changed.revision,1);assert.equal(changed.workflowKind,'full-study')
 assert.equal(m.matchesDraftContext(changed,{localTaskId:'f',revision:0}),false)
 assert.equal(m.matchesDraftContext(changed,{localTaskId:'other',revision:1}),false)
 assert.equal(m.matchesDraftContext(changed,{localTaskId:'f',revision:1}),true)
 assert.equal(m.sandboxRefKey('f'),'research-sandbox-ref:task:f')
})

async function apiSubject(){
 const src=new URL('../src/api/research.ts',import.meta.url)
 const built=await build({entryPoints:[fileURLToPath(src)],bundle:true,platform:'node',format:'esm',write:false})
 return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
}
test('official candidate save requires server context and preserves draft on failure or stale response',async()=>{
 const m=await subject(),api=await apiSubject(),draft=m.createLocalTask('full-study','local-f')
 draft.competition=m.syntheticContestDraft();let calls=0
 const ref={projectId:'fixture-project',workflowId:'fixture-workflow',artifactId:'fixture-artifact',versionId:'fixture-version'}
 const context={projectId:ref.projectId,workflowId:ref.workflowId,workflowKind:'full-study',phase:0}
 const gateway={async saveCandidate(c,candidate,revision){calls++;assert.equal(revision,5);assert.equal('runId' in c,false);assert.equal(candidate.evidenceStatus,'unverified');return {ok:true,value:ref}}}
 assert.equal((await api.saveContestCandidate(draft,null,null,gateway)).error.code,'CAPABILITY_UNAVAILABLE');assert.equal(calls,0)
 assert.equal((await api.saveContestCandidate(draft,context,5,gateway,()=>false)).error.code,'STALE_BASELINE')
 const before=JSON.stringify(draft)
 const failed=await api.saveContestCandidate(draft,context,5,{saveCandidate:async()=>{throw Error('offline')}})
 assert.equal(failed.error.code,'PERSIST_FAILED');assert.equal(JSON.stringify(draft),before)
 const successful=await api.saveContestCandidate(draft,context,5,gateway)
 assert.equal(successful.ok,true);assert.equal('activePhase' in draft,false);assert.equal('confirmed' in draft,false)
})

test('stale browser tabs cannot overwrite another tab task registry',async()=>{
 const m=await subject(),s=storage()
 const tabA=m.loadTaskRegistry(s).registry,tabB=m.loadTaskRegistry(s).registry
 const savedA=m.saveLocalTask(s,tabA,m.createLocalTask('full-study','A'),100)
 assert.throws(()=>m.saveLocalTask(s,tabB,m.createLocalTask('dataset-analysis','B'),200),/另一页面/)
 assert.equal(m.loadTaskRegistry(s).registry.tasks.A.localTaskId,'A')
 const tabC=m.loadTaskRegistry(s).registry
 const revised=m.editLocalTask(savedA.tasks.A,{title:'更新标题'},300)
 m.saveLocalTask(s,savedA,revised,301)
 assert.throws(()=>m.saveLocalTask(s,tabC,{...tabC.tasks.A,title:'陈旧标题'},400),/另一页面/)
 assert.equal(m.loadTaskRegistry(s).registry.tasks.A.title,'更新标题')
})

test('background registration does not change the user selected task',async()=>{
 const m=await subject(),s=storage();let registry=m.emptyTaskRegistry()
 registry=m.saveLocalTask(s,registry,m.createLocalTask('dataset-analysis','A'),100)
 registry=m.saveLocalTask(s,registry,m.createLocalTask('dataset-analysis','B'),200)
 registry.lastByKind['dataset-analysis']='B'
 const updated=m.editLocalTask(registry.tasks.A,{sandboxRef:{workspaceId:'wA',runId:'late-A'}},300)
 registry=m.saveLocalTask(s,registry,updated,301)
 assert.equal(registry.lastByKind['dataset-analysis'],'B')
 assert.equal(registry.tasks.A.sandboxRef.runId,'late-A')
})

test('local contest completeness catches an empty extra requirement with a valid source',async()=>{
 const m=await subject(),draft=m.syntheticContestDraft()
 draft.edition='synthetic edition';draft.group='synthetic group';draft.unknowns=[]
 draft.requirements.push({id:'empty-extra',text:' ',sourceIds:[draft.sources[0].sourceId]})
 assert.ok(m.checkContestDraft(draft).some(issue=>issue.includes('正文为空')))
})
