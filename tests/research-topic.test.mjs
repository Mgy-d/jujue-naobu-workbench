import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){
 const built=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchDrafts.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
 return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
}
function storage(){const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}}
function topic(){return {candidates:[{id:'synthetic-topic-1',title:'【合成】校园饮水',researchQuestion:'【合成】哪些因素影响使用？',targetPopulation:'【合成】本校学生',feasibility:'【合成】可接触样本，尚未招募',sourceIds:['source-local']}],selectedCandidateId:'synthetic-topic-1',selectionReason:'【合成】可取得材料',sources:[{sourceId:'source-local',title:'合成材料',locator:'仅供接线测试',evidenceStatus:'unverified'}],unknowns:[{id:'unknown-topic',text:'真实样本来源待确认',blocksDecision:true}]}}
test('old task registries receive an empty topic draft without replacing contest content',async()=>{
 const m=await subject(),s=storage(),old=m.createLocalTask('full-study','legacy',10)
 old.competition=m.syntheticContestDraft();old.savedAt=20;delete old.topicAnalysis;delete old.researchPlan
 const raw=JSON.stringify({schemaVersion:1,tasks:{legacy:old},lastByKind:{'full-study':'legacy'}});s.setItem(m.TASK_STORAGE_KEY,raw)
 const restored=m.loadTaskRegistry(s)
 assert.equal(restored.error,null);assert.deepEqual(restored.registry.tasks.legacy.topicAnalysis,{directions:[],selectedDirectionId:null,selectionReason:'',unknowns:[]})
 assert.deepEqual(restored.registry.tasks.legacy.competition,old.competition);assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
})
test('topic choices and references survive storage and remain scoped to their original task',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10),b=m.createLocalTask('full-study','B',11)
 a.topicAnalysis=m.normalizeTopicAnalysisDraft(topic());a.competition=m.syntheticContestDraft()
 let registry=m.saveLocalTask(s,m.emptyTaskRegistry(),a,20);registry=m.saveLocalTask(s,registry,b,21)
 const loaded=m.loadTaskRegistry(s).registry
 assert.deepEqual(loaded.tasks.A.topicAnalysis,m.normalizeTopicAnalysisDraft(topic()));assert.deepEqual(loaded.tasks.A.competition,a.competition)
 assert.equal(loaded.tasks.B.topicAnalysis.selectedDirectionId,null);assert.equal(loaded.tasks.B.topicAnalysis.directions.length,0)
})
test('invalid saved topic data is preserved as a storage error rather than silently discarded',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10)
 a.topicAnalysis={...topic(),selectedCandidateId:'missing'}
 const raw=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,raw)
 const loaded=m.loadTaskRegistry(s);assert.ok(loaded.error);assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
 assert.throws(()=>m.saveLocalTask(s,loaded.registry,m.createLocalTask('full-study','B',20)),/损坏/)
})
test('topic updates reject other tasks, stale revisions, wrong workflows and inactive stages',async()=>{
 const m=await subject(),a=m.editLocalTask(m.createLocalTask('full-study','A',10),{viewedPhase:1},11)
 const event={phase:1,context:{localTaskId:'A',revision:a.revision},draft:topic()}
 const result=m.applyResearchStageUpdate(a,event,12)
 assert.equal(result.ok,true);assert.deepEqual(result.value.topicAnalysis,m.normalizeTopicAnalysisDraft(topic()));assert.equal(result.value.savedAt,null)
 assert.deepEqual(a.topicAnalysis,m.emptyTopicAnalysisDraft());assert.equal(result.value.revision,a.revision+1)
 assert.equal(m.applyResearchStageUpdate(a,{...event,context:{...event.context,localTaskId:'B'}}).error.code,'STALE_BASELINE')
 assert.equal(m.applyResearchStageUpdate(result.value,event).error.code,'STALE_BASELINE')
 assert.equal(m.applyResearchStageUpdate({...a,viewedPhase:0},event).error.code,'PHASE_LOCKED')
 assert.equal(m.applyResearchStageUpdate({...a,workflowKind:'dataset-analysis'},event).error.code,'PHASE_LOCKED')
 assert.equal(m.applyResearchStageUpdate(a,{...event,phase:99}).error.code,'PHASE_LOCKED')
 assert.equal(m.applyResearchStageUpdate(a,{...event,draft:{...topic(),selectedCandidateId:'missing'}}).error.code,'MISSING_INPUT')
})
test('topic normalizer rejects invalid references and clones nested lists',async()=>{
 const m=await subject(),input=topic(),clean=m.normalizeTopicAnalysisDraft(input)
 assert.deepEqual(clean,m.normalizeTopicAnalysisDraft(input));clean.legacyDraft.candidates[0].sourceIds.push('changed');assert.deepEqual(input.candidates[0].sourceIds,['source-local'])
 assert.equal(m.normalizeTopicAnalysisDraft({...topic(),candidates:[...topic().candidates,...topic().candidates]}),null)
 assert.equal(m.normalizeTopicAnalysisDraft({...topic(),candidates:[{...topic().candidates[0],sourceIds:['missing']}]}),null)
 assert.equal(m.normalizeTopicAnalysisDraft({...topic(),sources:[{...topic().sources[0],evidenceStatus:'verified'}]}),null)
})
test('incomplete topic drafts are saveable without implying confirmation',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10)
 a.topicAnalysis=m.emptyTopicAnalysisDraft();assert.ok(m.checkTopicAnalysisDraft(a.topicAnalysis).length)
 const saved=m.saveLocalTask(s,m.emptyTaskRegistry(),a,20).tasks.A
 assert.equal(saved.savedAt,20);assert.equal('activePhase' in saved,false);assert.equal('projectId' in saved,false)
 assert.equal('confirmed' in saved.topicAnalysis,false)
})
test('late topic events cannot erase earlier contest edits',async()=>{
 const m=await subject(),a=m.createLocalTask('full-study','A',10)
 a.competition=m.syntheticContestDraft();a.viewedPhase=1
 const event={phase:1,context:{localTaskId:'A',revision:0},draft:topic()}
 const updated=m.applyResearchStageUpdate(a,event,20).value
 assert.deepEqual(updated.competition,a.competition)
 const newer=m.editLocalTask(updated,{competition:{...a.competition,background:'new contest edit'}},21)
 assert.equal(m.applyResearchStageUpdate(newer,event).ok,false);assert.equal(newer.competition.background,'new contest edit')
})
