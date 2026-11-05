import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchMessageRender.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const {renderResearchMessage}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))

test('empty and whitespace-only streamed messages do not create bubbles',()=>{
  for(const text of ['', ' \n\n\t ', '\u200B\uFEFF'])assert.equal(renderResearchMessage(text,'assistant'),'')
})
test('agent Markdown renders headings, lists, tables and inline code',()=>{
  const html=renderResearchMessage('## G1\n\n**已通过**\n\n- 第一项\n\n| 项 | 状态 |\n|---|---|\n| G1 | `approved` |','assistant')
  for(const marker of ['<h2>','<strong>','<ul>','<table>','<code>approved</code>'])assert.ok(html.includes(marker))
  assert.equal(html.includes('**已通过**'),false)
})
test('agent HTML is escaped and executable links are not rendered',()=>{
  const html=renderResearchMessage('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[x](javascript:alert(1))','assistant')
  assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img'),false);assert.equal(html.includes('href="javascript:'),false)
})
test('code whitespace and user supplied literal text are preserved',()=>{
  const html=renderResearchMessage('```python\nif True:\n    print(1)\n\n\n    print(2)\n```','assistant')
  assert.ok(html.includes('    print(1)\n\n\n    print(2)'))
  assert.equal(renderResearchMessage('**原文**\n<x>','user'),'**原文**<br />&lt;x&gt;')
})


test('tagged reasoning and observed malformed thinkingUser opening stay out of assistant bubbles',()=>{
  const raw='<thinkingUser says "继续下一步" — internal reasoning.</think>\n<thinking>More internal reasoning</think>\n请确认进入 G2。'
  const html=renderResearchMessage(raw,'assistant')
  assert.ok(html.includes('请确认进入 G2'))
  assert.equal(html.includes('internal reasoning'),false)
  assert.equal(html.includes('thinking'),false)
})
test('unfinished streaming reasoning is hidden and visible text survives around closed blocks',()=>{
  assert.equal(renderResearchMessage('<thinking>Still thinking','assistant'),'')
  assert.equal(renderResearchMessage('<think','assistant'),'')
  const html=renderResearchMessage('已收到。<think>internal</think>请补充材料。','assistant')
  assert.ok(html.includes('已收到。请补充材料。'))
})
test('reasoning tag examples inside fenced code and user text remain literal',()=>{
  assert.ok(renderResearchMessage('```xml\n<think>example</think>\n```','assistant').includes('&lt;think&gt;example&lt;/think&gt;'))
  assert.ok(renderResearchMessage('<think>用户原文</think>','user').includes('用户原文'))
})

test('malformed thinkingG1 blocks are hidden through a thinking closing tag',()=>{
  assert.equal(renderResearchMessage('<thinkingG1 internal plan.</thinking>正常回复','assistant').includes('internal plan'),false)
})


test('generated research context envelope is hidden in user bubbles while answer text remains',()=>{
  const text='【项目ID】sz-6822f146-1018-4071-9c01-3f320f943911\n研究主题：社区团购平台用户复购行为调研\n\n我的问题或补充说明：\n继续下一步'
  assert.equal(renderResearchMessage(text,'user'),'继续下一步')
  assert.equal(renderResearchMessage(text.split('\n').slice(1).join('\n'),'user'),'继续下一步')
  assert.equal(renderResearchMessage('请核对项目 ID sz-abc。','user'),'请核对项目 ID sz-abc。')
  assert.ok(renderResearchMessage('```\n【项目ID】sz-abc\n```','user').includes('【项目ID】'))
})


test('assistant prose hides project transport UUID but preserves subject and content',()=>{
  const html=renderResearchMessage('收到项目 sz-7fef1aa7-3783-41da-8868-639af9da81c6，选题方向「新能源汽车」已记录。','assistant')
  assert.equal(html.includes('sz-7fef'),false)
  assert.ok(html.includes('收到项目'))
  assert.ok(html.includes('新能源汽车'))
})
test('project paths and fenced identifiers remain readable',()=>{
  const id='sz-7fef1aa7-3783-41da-8868-639af9da81c6'
  assert.ok(renderResearchMessage('```text\n项目 '+id+'\n```','assistant').includes(id))
  assert.ok(renderResearchMessage('artifacts/'+id+'/问卷.md','assistant').includes(id))
})
test('observed standalone filler creates no bubble but ordinary English is retained',()=>{
  assert.equal(renderResearchMessage('Let your light shine bright.','assistant'),'')
  assert.ok(renderResearchMessage('Please upload the CSV file.','assistant').includes('CSV'))
  assert.ok(renderResearchMessage('Let your light shine bright.','user').includes('bright'))
})


test('Markdown emphasis and inline code around project UUID are hidden without formatting debris',()=>{
  const id='sz-7fef1aa7-3783-41da-8868-639af9da81c6'
  for(const wrapper of ['**','__','*','_','`','']){
    const html=renderResearchMessage('收到项目 '+wrapper+id+wrapper+'，选题方向「新能源汽车下沉市场购买意愿调查」已记录。','assistant')
    assert.equal(html.includes(id),false,wrapper)
    assert.ok(html.includes('收到项目，选题方向'),wrapper)
    assert.ok(html.includes('新能源汽车下沉市场购买意愿调查'),wrapper)
    assert.equal(html.includes('<strong>'),false,wrapper)
    assert.equal(html.includes('<code>'),false,wrapper)
  }
})
