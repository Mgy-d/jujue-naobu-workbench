import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const result=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchDrafts.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))}
function storage(){const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}}
function plan(){return {researchQuestion:'【合成】饮水设施使用差异',targetPopulation:'【合成】本校学生',samplingPlan:'【合成】便利抽样，代表性有限',recruitmentPlan:'【合成】招募尚未执行',measurementPlan:'【合成】频率和满意度，题项待设计',evidenceNeeds:'【合成】设施材料和匿名答卷，尚未取得',analysisPlan:'【合成】先检查缺失值，再描述统计',sources:[{sourceId:'plan-source',title:'合成方案材料',locator:'仅用于接线验证',evidenceStatus:'user-provided'}],unknowns:[{id:'plan-unknown',text:'真实招募许可未知',blocksDecision:true}]}}
test('legacy records gain an empty plan and preserve saved topic and contest',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);delete a.researchPlan;a.competition=m.syntheticContestDraft()
 s.setItem(m.TASK_STORAGE_KEY,JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}}))
 const restored=m.loadTaskRegistry(s);assert.equal(restored.error,null);assert.deepEqual(restored.registry.tasks.A.researchPlan,{researchQuestion:'',targetPopulation:'',samplingPlan:'',recruitmentPlan:'',measurementPlan:'',evidenceNeeds:'',analysisPlan:'',sources:[],unknowns:[]})
 assert.deepEqual(restored.registry.tasks.A.competition,a.competition);assert.deepEqual(restored.registry.tasks.A.topicAnalysis,a.topicAnalysis)
})
test('plan update saves and restores only the plan for its original task',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10),b=m.createLocalTask('full-study','B',11)
 a.competition=m.syntheticContestDraft();a.topicAnalysis.selectionReason='合成选题理由';a.viewedPhase=2
 const result=m.applyResearchStageUpdate(a,{phase:2,context:{localTaskId:'A',revision:0},draft:plan()},20)
 assert.equal(result.ok,true);assert.deepEqual(result.value.competition,a.competition);assert.deepEqual(result.value.topicAnalysis,a.topicAnalysis)
 let registry=m.saveLocalTask(s,m.emptyTaskRegistry(),result.value,21);registry=m.saveLocalTask(s,registry,b,22)
 const loaded=m.loadTaskRegistry(s).registry;assert.deepEqual(loaded.tasks.A.researchPlan,plan());assert.deepEqual(loaded.tasks.B.researchPlan,m.emptyResearchPlanDraft())
 assert.equal(loaded.tasks.A.viewedPhase,2);assert.equal('confirmed' in loaded.tasks.A,false)
})
test('invalid existing plan does not disappear during migration or overwrite older storage',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);a.researchPlan={...plan(),samplingPlan:42}
 const raw=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,raw)
 const loaded=m.loadTaskRegistry(s);assert.ok(loaded.error);assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
 assert.throws(()=>m.saveLocalTask(s,loaded.registry,m.createLocalTask('full-study','B',11)),/损坏/)
})
test('plan events cannot write into a topic stage, other task or stale revision',async()=>{
 const m=await subject(),a=m.createLocalTask('full-study','A',10);a.viewedPhase=2
 const event={phase:2,context:{localTaskId:'A',revision:0},draft:plan()}
 assert.equal(m.applyResearchStageUpdate({...a,viewedPhase:1},event).error.code,'PHASE_LOCKED')
 assert.equal(m.applyResearchStageUpdate(a,{...event,context:{localTaskId:'B',revision:0}}).error.code,'STALE_BASELINE')
 assert.equal(m.applyResearchStageUpdate(a,{...event,draft:null}).error.code,'MISSING_INPUT')
 assert.equal(m.applyResearchStageUpdate(a,{...event,draft:m.emptyTopicAnalysisDraft()}).ok,false)
 const changed=m.applyResearchStageUpdate(a,event).value;assert.equal(m.applyResearchStageUpdate(changed,event).ok,false)
 assert.equal(m.applyResearchStageUpdate({...a,workflowKind:'questionnaire-review'},event).ok,false)
})
test('plan normalizer clones evidence and does not upgrade unverified sources',async()=>{
 const m=await subject(),input=plan(),clean=m.normalizeResearchPlanDraft(input)
 assert.deepEqual(clean,input);clean.unknowns[0].text='changed';assert.notEqual(clean.unknowns[0].text,input.unknowns[0].text)
 assert.equal(m.normalizeResearchPlanDraft({...plan(),sources:[{...plan().sources[0],evidenceStatus:'verified'}]}),null)
 assert.equal(m.normalizeResearchPlanDraft({...plan(),unknowns:[...plan().unknowns,...plan().unknowns]}),null)
 assert.equal(m.normalizeResearchPlanDraft(null),null)
})
test('incomplete plan is a valid local draft and completeness is separate from formal progression',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10)
 assert.ok(m.checkResearchPlanDraft(a.researchPlan).some(x=>x.includes('抽样')))
 const saved=m.saveLocalTask(s,m.emptyTaskRegistry(),a,20).tasks.A;assert.equal(saved.savedAt,20)
 assert.ok(m.checkResearchPlanDraft(plan()).some(x=>x.includes('未知')));assert.equal('activePhase' in saved,false)
})
