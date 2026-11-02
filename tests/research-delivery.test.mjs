import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const built=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchDrafts.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))}
function storage(){const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)}}
function topic(){return {directions:[{id:'direction-synthetic',title:'【合成】校园饮水',question:'【合成】使用差异',population:'【合成】本校学生',value:'【合成】改善设施',requirementIds:['requirement-synthetic'],verdict:'unknown',feasibilityNote:'【合成】需核对样本'}],selectedDirectionId:'direction-synthetic',selectionReason:'【合成】可取得材料',unknowns:[]}}
function plan(m){const p=m.emptyResearchPlanDraft();p.directionId='direction-synthetic';p.researchQuestions=[{id:'Q1',text:'【合成】使用差异',measureIds:['M1']}];p.sampling={unit:'【合成】学生',frame:'【合成】本校',method:'convenience',targetSize:120,coverageNote:'仅在校',inferenceScope:'仅样本'};p.recruitment.channels=['【合成】校内邀请'];p.measures=[{id:'M1',name:'使用频率',construct:'设施使用',level:'ordinal',instrument:'questionnaire',sourceIds:[],locator:'',questionHint:'一周使用几次',questionIds:[]}];p.analyses=[{id:'A1',questionId:'Q1',method:'descriptive-only',measureIds:['M1'],expectedOutput:'频率表',fallbackNote:''}];p.otherNote='【合成】未执行';return p}
function legacyTopic(){return {candidates:[{id:'old-topic',title:'旧方向',researchQuestion:'旧问题',targetPopulation:'旧对象',feasibility:'旧可行性',sourceIds:['old-source']}],selectedCandidateId:'old-topic',selectionReason:'旧理由',sources:[{sourceId:'old-source',title:'旧材料',locator:'旧位置',evidenceStatus:'unverified'}],unknowns:[]}}
function legacyPlan(){return {researchQuestion:'旧方案问题',targetPopulation:'旧对象',samplingPlan:'旧抽样说明',recruitmentPlan:'旧招募说明',measurementPlan:'旧测量说明',evidenceNeeds:'旧证据需求',analysisPlan:'旧分析说明',sources:[],unknowns:[]}}
test('delivered topic structure survives normalization, editing, storage and refresh',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);a.viewedPhase=1
 assert.deepEqual(m.emptyTopicAnalysisDraft(),{directions:[],selectedDirectionId:null,selectionReason:'',unknowns:[]})
 assert.deepEqual(m.normalizeTopicAnalysisDraft(topic()),topic())
 const changed=m.applyResearchStageUpdate(a,{phase:1,context:{localTaskId:'A',revision:0},draft:topic()},20);assert.equal(changed.ok,true)
 m.saveLocalTask(s,m.emptyTaskRegistry(),changed.value,21);assert.deepEqual(m.loadTaskRegistry(s).registry.tasks.A.topicAnalysis,topic())
})
test('detailed plan keeps sampling, question-variable-analysis links and local signature across storage',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);a.viewedPhase=2;const rich=plan(m)
 assert.ok(rich.sampling);assert.deepEqual(m.normalizeResearchPlanDraft(rich),rich)
 const changed=m.applyResearchStageUpdate(a,{phase:2,context:{localTaskId:'A',revision:0},draft:rich},20);assert.equal(changed.ok,true)
 m.saveLocalTask(s,m.emptyTaskRegistry(),changed.value,21);assert.deepEqual(m.loadTaskRegistry(s).registry.tasks.A.researchPlan,rich)
 assert.equal('versionId' in rich.adoption,false);assert.equal('activePhase' in changed.value,false)
})
test('earlier simplified drafts migrate without losing source references or inventing detailed plans',async()=>{
 const m=await subject(),oldTopic=legacyTopic(),oldPlan=legacyPlan(),nextTopic=m.normalizeTopicAnalysisDraft(oldTopic),nextPlan=m.normalizeResearchPlanDraft(oldPlan)
 assert.equal(nextTopic.directions[0].question,oldTopic.candidates[0].researchQuestion);assert.equal(nextTopic.selectedDirectionId,'old-topic');assert.equal(nextTopic.directions[0].verdict,'unknown');assert.deepEqual(nextTopic.directions[0].requirementIds,[])
 assert.deepEqual(nextTopic.legacyDraft,oldTopic);assert.deepEqual(nextPlan.legacyDraft,oldPlan)
 assert.equal(nextPlan.researchQuestions[0].text,'旧方案问题');assert.equal(nextPlan.sampling.frame,'旧对象');assert.equal(nextPlan.sampling.method,'unknown');assert.equal(nextPlan.sampling.targetSize,null)
 for(const field of ['samplingPlan','recruitmentPlan','measurementPlan','evidenceNeeds','analysisPlan'])assert.ok(nextPlan.otherNote.includes(oldPlan[field]))
 assert.equal(nextPlan.adoption.signature,'');assert.deepEqual(nextPlan.measures,[]);assert.deepEqual(nextPlan.analyses,[])
})
test('legacy raw drafts remain preserved after a real component sends a new complete draft',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);a.topicAnalysis=legacyTopic();a.researchPlan=legacyPlan();a.competition=m.syntheticContestDraft()
 const raw=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,raw)
 const loaded=m.loadTaskRegistry(s);assert.equal(loaded.error,null);assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
 const t={...loaded.registry.tasks.A,viewedPhase:1};const changed=m.applyResearchStageUpdate(t,{phase:1,context:{localTaskId:'A',revision:t.revision},draft:topic()},20)
 assert.equal(changed.ok,true);assert.deepEqual(changed.value.topicAnalysis.legacyDraft,legacyTopic());assert.deepEqual(changed.value.competition,a.competition)
 m.saveLocalTask(s,loaded.registry,changed.value,21);assert.deepEqual(m.loadTaskRegistry(s).registry.tasks.A.researchPlan.legacyDraft,legacyPlan())
})
test('canonical corruption and duplicate IDs are rejected without erasing saved records',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10)
 const bad={...topic(),selectedDirectionId:'missing'};assert.equal(m.normalizeTopicAnalysisDraft(bad),null)
 assert.equal(m.normalizeTopicAnalysisDraft({...topic(),directions:[...topic().directions,...topic().directions]}),null)
 const rich=plan(m);assert.equal(m.normalizeResearchPlanDraft({...rich,sampling:{...rich.sampling,targetSize:Infinity}}),null)
 a.topicAnalysis=bad;const raw=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,raw)
 assert.ok(m.loadTaskRegistry(s).error);assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw)
})

test('plan completeness exposes removed upstream sources and dangling variable references without deleting user data',async()=>{
 const m=await subject(),rich=plan(m);rich.measures[0].instrument='existing';rich.measures[0].sourceIds=['removed-source'];rich.measures[0].locator='synthetic table';
 const upstream={competition:{...m.syntheticContestDraft(),sources:[]},topic:topic()};
 assert.ok(m.checkResearchPlanDraft(rich,upstream).some(issue=>issue.includes('来源已不存在')));
 rich.researchQuestions[0].measureIds=['removed-measure'];rich.analyses[0].measureIds=['removed-measure'];
 const issues=m.checkResearchPlanDraft(rich,upstream);
 assert.ok(issues.some(issue=>issue.includes('研究问题引用的测量变量已不存在')));
 assert.ok(issues.some(issue=>issue.includes('分析安排引用的测量变量已不存在')));
 const normalized=m.normalizeResearchPlanDraft(rich);assert.deepEqual(normalized.measures[0].sourceIds,['removed-source']);assert.deepEqual(normalized.researchQuestions[0].measureIds,['removed-measure']);
})

test('every topic direction needs a title and local plan notices retain the formal-server boundary',async()=>{
 const m=await subject(),draft=topic();draft.directions.push({...draft.directions[0],id:'empty-title',title:''});
 assert.ok(m.checkTopicAnalysisDraft(draft).some(issue=>issue.includes('方向名称')));
 assert.ok(m.checkResearchPlanDraft(m.emptyResearchPlanDraft()).some(issue=>issue.includes('正式版本仍待服务器接入')));
})
