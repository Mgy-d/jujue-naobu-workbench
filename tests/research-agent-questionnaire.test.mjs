import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchAgentQuestionnaire.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const {readAgentQuestionnaire}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
const question={id:'Q1',text:'合成测试题',required:true,questionType:'single',options:[{code:'A',label:'选项一'},{code:'B',label:'选项二'}]}
const source=questions=>JSON.stringify({schema:'sz-questionnaire/v1',projectId:'test-A',title:'合成问卷',version:'v2',questions})
test('agent questionnaire preserves question text, codes, version and source note',()=>{
  const q=readAgentQuestionnaire(source([{...question,sourceNote:'团队自编'}]),'test-A')
  assert.equal(q.version,'v2');assert.equal(q.questions[0].text,question.text)
  assert.deepEqual(q.questions[0].options.map(o=>o.code),['A','B'])
  assert.equal(q.questions[0].codingNote,'团队自编');assert.equal(q.canFill,true)
})
test('wrong project, duplicate IDs and invalid option coding cannot render as a valid questionnaire',()=>{
  assert.throws(()=>readAgentQuestionnaire(source([question]),'test-B'),/不一致/)
  assert.throws(()=>readAgentQuestionnaire(source([question,question]),'test-A'),/题号/)
  assert.throws(()=>readAgentQuestionnaire(source([{...question,options:[{code:'A',label:'一'},{code:'A',label:'二'}]}]),'test-A'),/编码/)
})
test('zero-based scale keeps every code and anchor without renumbering',()=>{
  const q=readAgentQuestionnaire(source([{...question,questionType:'scale',scale:{min:0,max:2,labels:['低','中','高']}}]),'test-A')
  assert.deepEqual(q.questions[0].options.map(o=>o.code),['0','1','2'])
  assert.equal(q.questions[0].options[1].label,'1 中')
})
test('unsupported types keep position and skip rules disable incomplete trial',()=>{
  const q=readAgentQuestionnaire(source([{...question,id:'Q0',questionType:'matrix'},question]),'test-A')
  assert.deepEqual(q.questionIds,['Q0','Q1']);assert.equal(q.canFill,false);assert.equal(q.unsupported[0].type,'matrix')
  assert.equal(readAgentQuestionnaire(source([{...question,skipLogic:[{when:{option:'A'},target:'Q2'}]}]),'test-A').canFill,false)
})
