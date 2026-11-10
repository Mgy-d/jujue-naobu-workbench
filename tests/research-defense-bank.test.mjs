import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchDefenseBank.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const {readDefenseBank}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const source={schema:'sz-defense-bank/v1',projectId:'synthetic-only',version:'v1.0',questions:[{id:'D01',category:'数据口径',question:'为什么两项样本量不同？',riskLevel:'高',evidencePath:'results[0]',evidenceHint:'原结果样本量不一致，待核对',owner:'团队',anchorFindingIds:['F01']},{id:'D02',category:'方法合理性',question:'能否说明因果关系？',riskLevel:'中'},{id:'D03',category:'数据口径',question:'还缺哪些数据？'}]}
test('defense bank groups questions and surfaces only supplied user-facing evidence without inventing answers',()=>{
 const copy=JSON.stringify(source),model=readDefenseBank('答辩题库.json',source)
 assert.equal(model.total,3);assert.equal(model.groups.length,2);assert.equal(model.groups[0].questions.length,2);assert.equal(model.groups[0].questions[0].answer,'');assert.equal(model.groups[0].questions[0].riskLevel,'高')
 assert.equal(model.groups[0].questions[0].evidenceHint,source.questions[0].evidenceHint)
 for(const field of ['schema','projectId','anchorFindingIds','evidencePath'])assert.ok(!JSON.stringify(model).includes('"'+field+'"'))
 assert.equal(JSON.stringify(source),copy)
})
test('unrecognized JSON never masquerades as a defense bank, malformed recognized banks fail explicitly',()=>{
 assert.equal(readDefenseBank('其他.json',{questions:source.questions}),null)
 assert.equal(readDefenseBank('答辩题库.json',{schema:'unknown/v2',questions:source.questions}),null)
 assert.throws(()=>readDefenseBank('答辩题库.json',{questions:[{question:''}]}),/缺少/)
 assert.throws(()=>readDefenseBank('答辩题库.json',{questions:null}),/列表/)
})
test('only existing reference answers appear and unknown category or risk is not inferred',()=>{
 const model=readDefenseBank('答辩题库.json',{questions:[{question:'<img src=x onerror=alert(1)>',answer:'原文参考回答'}]})
 assert.equal(model.groups[0].category,'未分类');assert.equal(model.groups[0].questions[0].riskLevel,'');assert.equal(model.groups[0].questions[0].answer,'原文参考回答');assert.equal(model.groups[0].questions[0].question,'<img src=x onerror=alert(1)>')
})
