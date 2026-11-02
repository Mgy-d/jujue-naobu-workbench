import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const built=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchDrafts.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))}
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}}
function content(m){const q=m.emptyQuestionnaireDraft();q.meta.title='【合成】问卷';q.questions=[{id:'Q1',text:'【合成】使用频率',type:'single',required:true,options:[{id:'O1',label:'每天',code:'1',exclusive:false,openEnded:false},{id:'O2',label:'其他',code:'2',exclusive:false,openEnded:true}],scale:null,measureId:'M1',codingNote:'单选',screening:false}];return q}
test('questionnaire missing from old task defaults without rewriting disk; explicit corruption stays protected',async()=>{
 const m=await subject(),s=storage(),a=m.createLocalTask('full-study','A',10);assert.deepEqual(a.questionnaire,m.emptyQuestionnaireDraft());delete a.questionnaire;
 const raw=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,raw);const loaded=m.loadTaskRegistry(s);assert.equal(loaded.error,null);assert.deepEqual(loaded.registry.tasks.A.questionnaire,m.emptyQuestionnaireDraft());assert.equal(s.getItem(m.TASK_STORAGE_KEY),raw);
 a.questionnaire={broken:true};const bad=JSON.stringify({schemaVersion:1,tasks:{A:a},lastByKind:{'full-study':'A'}});s.setItem(m.TASK_STORAGE_KEY,bad);assert.ok(m.loadTaskRegistry(s).error);assert.equal(s.getItem(m.TASK_STORAGE_KEY),bad);
})
test('questionnaire full-study and independent task edits save, restore, and preserve earlier stages',async()=>{
 const m=await subject();for(const kind of ['full-study','questionnaire-review']){const s=storage(),a=m.createLocalTask(kind,'A',10);a.viewedPhase=kind==='full-study'?3:0;const plan=structuredClone(a.researchPlan),q=content(m);
 const result=m.applyQuestionnaireUpdate(a,{context:{localTaskId:'A',revision:0},draft:q},20);assert.equal(result.ok,true);assert.deepEqual(result.value.researchPlan,plan);assert.deepEqual(result.value.competition,a.competition);m.saveLocalTask(s,m.emptyTaskRegistry(),result.value,21);assert.deepEqual(m.loadTaskRegistry(s).registry.tasks.A.questionnaire,q);assert.equal(result.value.revision,1);assert.equal('versionId' in result.value.questionnaire.adoption,false);assert.equal('activePhase' in result.value,false)}
})
test('questionnaire rejects wrong task, revision, phase, workflow and invalid structure',async()=>{
 const m=await subject(),a=m.createLocalTask('full-study','A',10),q=content(m);a.viewedPhase=3;const valid={context:{localTaskId:'A',revision:0},draft:q};
 for(const event of [{...valid,context:{localTaskId:'B',revision:0}},{...valid,context:{localTaskId:'A',revision:1}},{...valid,draft:{...q,questions:[q.questions[0],q.questions[0]]}}])assert.equal(m.applyQuestionnaireUpdate(a,event).ok,false);
 a.viewedPhase=2;assert.equal(m.applyQuestionnaireUpdate(a,valid).ok,false);const analysis=m.createLocalTask('dataset-analysis','A',10);assert.equal(m.applyQuestionnaireUpdate(analysis,valid).ok,false);
 assert.equal(m.normalizeQuestionnaireDraft({...q,meta:{...q.meta,estimatedMinutes:Infinity}}),null);assert.equal(m.normalizeQuestionnaireDraft({...q,questions:[{...q.questions[0],scale:{points:5,minLabel:2,maxLabel:'高',midLabel:'',hasDontKnow:false}}]}),null);
})
test('questionnaire completeness preserves and explains deleted variable and finding references',async()=>{
 const m=await subject(),q=content(m),plan=m.emptyResearchPlanDraft();q.pretestRounds=[{id:'R1',date:'2026-10-27',respondentCount:5,channel:'【合成】本机',completionRate:100,medianMinutes:2,findings:[{id:'F1',questionId:'removed-question',kind:'wording',text:'合成现象',action:'合成修改'}],verdict:'no-change',revisionNote:'',signature:''}];
 const issues=m.checkQuestionnaireDraft(q,{plan});assert.ok(issues.some(x=>x.includes('变量已不在')));assert.ok(issues.some(x=>x.includes('试填发现引用的题目已不存在')));assert.equal(m.normalizeQuestionnaireDraft(q).questions[0].measureId,'M1');
})
test('self-reported pretest cannot pass local checks with zero people, missing findings, or unexplained revisions',async()=>{
 const m=await subject(),q=content(m);q.pretestRounds=[{id:'R1',date:'2026-10-27',respondentCount:0,channel:'合成',completionRate:100,medianMinutes:2,findings:[],verdict:'no-change',revisionNote:'',signature:m.questionnaireSignature(q)}];assert.notEqual(m.questionnairePretestState(q).state,'passed');
 q.pretestRounds[0].respondentCount=5;q.pretestRounds[0].findings=[{id:'F1',questionId:'Q1',kind:'wording',text:'',action:'已改'}];assert.notEqual(m.questionnairePretestState(q).state,'passed');q.pretestRounds[0].findings=[];q.pretestRounds[0].verdict='revised';assert.notEqual(m.questionnairePretestState(q).state,'passed');
 q.pretestRounds[0].revisionNote='合成修改';assert.equal(m.questionnairePretestState(q).state,'passed');q.questions[0].text+='变化';assert.equal(m.questionnairePretestState(q).state,'needs-revision');
})

test('questionnaire local mark loses validity when its feedback round disappears, and never claims a formal version',async()=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('../src/components/research/questionnaire-contract.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});const c=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64')),m=await subject(),q=content(m),signature=c.questionnaireSignature(q);
 q.pretestRounds=[{id:'R2',date:'2026-10-27',respondentCount:5,channel:'合成',completionRate:100,medianMinutes:2,findings:[],verdict:'no-change',revisionNote:'',signature}];q.adoption={signature,roundId:'deleted-R1',note:'本机'};
 assert.equal(c.pretestState(q).state,'passed');assert.equal(c.questionnaireAdoptionState(q),'drifted');assert.ok(c.checkQuestionnaire(q,{plan:null}).all.some(x=>x.includes('依据')));
 q.adoption.roundId='R2';assert.equal(c.questionnaireAdoptionState(q),'fixed');q.questions[0].text+='变化';const issues=c.checkQuestionnaire(q,{plan:null}).all;assert.ok(issues.some(x=>x.includes('本机标记')));assert.ok(issues.every(x=>!x.includes('固定为正式版本')&&!x.includes('已固定正式问卷')));
})
