import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))

function resolveAlias(spec){
  if(!spec.startsWith('@/'))return null
  const base=fileURLToPath(new URL('../src/'+spec.slice(2),import.meta.url))
  for(const ext of ['','.ts','.vue','.json']){const p=base+ext;if(existsSync(p))return p}
  return null
}
const aliasPlugin={name:'alias',setup(b){b.onResolve({filter:/^@\//},(a)=>{const p=resolveAlias(a.path);return p?{path:p}:null})}}
async function subject(path){const entry=fileURLToPath(new URL(path,import.meta.url));const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false,plugins:[aliasPlugin]});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}

test('buildDemoTask produces a valid full-study task that passes platform normalize checks',async()=>{
  const m=await subject('../src/utils/researchDemoSeed.ts')
  const t=m.buildDemoTask()
  assert.equal(t.workflowKind,'full-study')
  assert.match(t.title,/演示案例/)
  assert.ok(t.competition.background.trim() && t.competition.edition.trim())
  assert.equal(t.topicAnalysis.selectedDirectionId,'d1')
  assert.ok(t.researchPlan.adoption.signature,'方案应已采用（记录指纹）')
  assert.ok(t.questionnaire.adoption.signature,'问卷应已固定（记录指纹）')
  assert.equal(t.questionnaire.pretestRounds.length,1)
  // 四字段齐全 → 阶段 4 就绪度应为 ok（不依赖 UI 渲染）
  assert.ok(t.collection.channel.trim() && t.collection.audience.trim() && t.collection.startNote.trim() && t.collection.stopRule.trim())
  assert.ok(t.report.body.trim() && t.report.sourceNotes.trim() && t.report.defenseNotes.trim())
})

test('demo seed passes the platform own structural validators',async()=>{
  const m=await subject('../src/utils/researchDemoSeed.ts')
  const t=m.buildDemoTask()
  // 这些 normalize 函数与工作台落盘校验同口径：返回 null 表示结构非法
  const qm=await subject('../src/components/research/questionnaire-contract.ts')
  const pm=await subject('../src/components/research/plan-contract.ts')
  const tm=await subject('../src/components/research/topic-contract.ts')
  assert.ok(qm.normalizeQuestionnaireDraft(t.questionnaire),'问卷结构非法')
  assert.ok(pm.normalizePlanDraft(t.researchPlan),'方案结构非法')
  assert.ok(tm.normalizeTopicDraft(t.topicAnalysis),'选题结构非法')
  assert.equal(qm.questionnaireAdoptionState(t.questionnaire),'fixed','问卷应处于已固定状态')
})
