import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:['src/utils/researchArtifactDisplay.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {artifactPresentation,isPrimaryResearchArtifact,artifactSourceLabel}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
const file=(name,dir='报告')=>({name,path:'artifacts/sz-test/'+dir+'/'+name})
test('primary list retains usable deliveries and hides intermediate data without altering source',()=>{
 const names=['答辩题库.json','社区团购平台用户复购行为调研-报告正文.docx','社区团购平台用户复购行为调研-报告正文.pdf','社区团购平台用户复购行为调研-答辩PPT.pptx','图表清单.json','数据字典.json','清洗后数据.csv','统计报告.md','统计结果.json','问卷结构.json','研究简报.md','研究问题.md','调查方案.md']
 const files=names.map(name=>file(name)),before=JSON.stringify(files)
 assert.deepEqual(files.filter(isPrimaryResearchArtifact).map(item=>item.name),names.filter(name=>['答辩题库.json','社区团购平台用户复购行为调研-报告正文.docx','社区团购平台用户复购行为调研-报告正文.pdf','社区团购平台用户复购行为调研-答辩PPT.pptx','统计报告.md','问卷结构.json','调查方案.md'].includes(name)))
 assert.equal(JSON.stringify(files),before)
 assert.equal(isPrimaryResearchArtifact(file('统计报告.md','分析代码')),false)
 assert.equal(isPrimaryResearchArtifact(file('图1.png','图表')),true)
 assert.equal(isPrimaryResearchArtifact(file('核验结果.pdf')),false)
})
test('report cards distinguish full format independently of long topic, preserve actual path',()=>{
 for(const [ext,title,format] of [['docx','报告正文','Word'],['pdf','报告正文','PDF'],['pptx','答辩演示','PPT']]){
  const f=file('社区团购平台用户复购行为调研-'+(ext==='pptx'?'答辩PPT':'报告正文')+'.'+ext)
  assert.deepEqual(artifactPresentation(f),{title,subject:'社区团购平台用户复购行为调研',format})
  assert.ok(f.path.endsWith('.'+ext))
 }
 assert.equal(artifactPresentation(file('问卷结构.json')).title,'调查问卷')
 assert.equal(artifactPresentation(file('答辩题库.json')).title,'答辩题库')
})
test('same-name artifacts stay separate and never select a final version by size or timestamp',()=>{
 const files=[{...file('统计报告.md','数据'),size:840,updatedAt:200},{...file('统计报告.md','数据/分析代码'),size:5266,updatedAt:100}]
 assert.equal(files.filter(isPrimaryResearchArtifact).length,1)
 const duplicate=[file('统计报告.md','数据'),file('统计报告.md','统计')]
 assert.equal(duplicate.filter(isPrimaryResearchArtifact).length,2)
 assert.notEqual(artifactSourceLabel(duplicate[0],duplicate),artifactSourceLabel(duplicate[1],duplicate))
 const nested=[file('统计报告.md','数据'),{name:'统计报告.md',path:'sub-x/artifacts/sz-test/数据/统计报告.md'}]
 assert.notEqual(artifactSourceLabel(nested[0],nested),artifactSourceLabel(nested[1],nested))
 assert.equal(artifactSourceLabel(file('调查方案.md'),[file('调查方案.md')]),'')
})
