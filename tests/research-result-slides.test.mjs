import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('../src/utils/researchResultSlides.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {resultSlides}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
test('result scenes retain source headings and original values',()=>{
 const text='# 实际结果\n| 渠道 | 占比 |\n| --- | --- |\n| 线下 | 23.5% |\n| 线上 | 76.5% |\n\n## 限制\n仅限当前样本。'
 const scenes=resultSlides(text,'统计报告.md')
 assert.equal(scenes[0].heading,'实际结果');assert.equal(scenes[1].body,'仅限当前样本。')
 assert.deepEqual(scenes[0].chart.rows.map(r=>[r.value,r.display]),[[23.5,'23.5%'],[76.5,'76.5%']])
})
test('descriptive and identifier tables never produce made up charts',()=>{
 for(const table of ['|维度|说明|\n|---|---|\n|动机|待确认|\n|场景|待补充|','|名称|编号|\n|---|---|\n|甲|1|\n|乙|2|','|类型|数值|\n|---|---|\n|甲|12%|\n|乙|24|'])assert.equal(resultSlides(table,'报告.md')[0].chart,null)
})
test('JSON scenes retain actual fields without inferred statistics',()=>{
 const slides=resultSlides('{"status":"not_started","sampleSize":null}','统计结果.json')
 assert.equal(slides[0].heading,'status');assert.equal(slides[0].body,'"not_started"');assert.equal(slides[1].body,'null');assert.ok(slides.every(s=>s.chart===null))
})
test('empty sources produce no result scenes and excerpting is explicit',()=>{
 assert.deepEqual(resultSlides('','报告.md'),[])
 assert.equal(resultSlides('A'.repeat(9000),'报告.md')[0].excerpt,true)
})
