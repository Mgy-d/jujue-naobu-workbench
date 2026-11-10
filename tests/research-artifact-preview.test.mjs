import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchArtifactPreview.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
test('artifact Markdown formats evidence without chat filtering and keeps unsafe HTML inert',()=>{
 const html=m.renderArtifactMarkdown('# 调查方案\n\n**待确认**\n\n| 指标 | 值 |\n|---|---|\n| 样本 | 0 |\n\n<script>alert(1)</script>\n\n[链接](javascript:alert(1))\n\n[进度] 阶段=G3\n\n项目 sz-7fef1aa7-3783-41da-8868-639af9da81c6')
 assert.match(html,/<h1>调查方案<\/h1>/);assert.match(html,/<table>/);assert.match(html,/<strong>待确认<\/strong>/)
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/\[进度\]/);assert.match(html,/sz-7fef1aa7/)
})
test('CSV retains quoted delimiters, escaped quotes, embedded newlines, zeroes and empty trailing cells',()=>{
 const t=m.parseArtifactCsv('\uFEFF题号,回答,备注\r\nQ1,"甲,乙","他说""好"""\r\nQ2,"两\r\n行",\r\nQ3,0,\r\n')
 assert.deepEqual(t.headers,['题号','回答','备注']);assert.equal(t.totalRows,3)
 assert.deepEqual(t.rows,[['Q1','甲,乙','他说"好"'],['Q2','两\r\n行',''],['Q3','0','']])
 assert.deepEqual(m.parseArtifactCsv('A\tB\n1\t2','\t').rows,[['1','2']])
 for(const bad of ['a,b\n"bad','a,b\n1','a,b\n"a"x,b','a,b\na"b,c'])assert.throws(()=>m.parseArtifactCsv(bad))
})
test('large CSV preview announces full row count while bounding visible rows',()=>{
 const csv='a,b\n'+Array.from({length:250},(_,i)=>i+',=1+1').join('\n'),t=m.parseArtifactCsv(csv)
 assert.equal(t.totalRows,250);assert.equal(t.rows.length,m.CSV_PREVIEW_ROWS);assert.equal(t.rows[0][1],'=1+1')
 const wide=m.parseArtifactCsv(Array.from({length:75},(_,i)=>'列'+i).join(','));assert.equal(wide.totalColumns,75);assert.equal(wide.headers.length,m.CSV_PREVIEW_COLUMNS)
 assert.deepEqual(m.parseArtifactCsv(''),{headers:[],rows:[],totalRows:0,totalColumns:0})
})
test('JSON presentation preserves values and unknown keys, labels known fields and bounds nested output',()=>{
 const node=m.buildArtifactJson({title:'质检报告',count:0,passed:false,missing:null,custom_field:'<img src=x onerror=alert(1)>'})
 assert.equal(node.entries[0].label,'标题');assert.equal(node.entries[1].node.text,'0');assert.equal(node.entries[2].node.text,'否');assert.equal(node.entries[3].node.text,'空值');assert.equal(node.entries[4].label,'custom_field')
 assert.equal(node.entries[4].node.text,'<img src=x onerror=alert(1)>')
 assert.equal(m.buildArtifactJson(JSON.parse('{"constructor":1,"__proto__":2}')).entries[0].label,'constructor')
 const many=m.buildArtifactJson(Array.from({length:1000},(_,i)=>i));assert.equal(many.total,1000);assert.equal(many.entries.length,50)
 let deep={value:1};for(let i=0;i<20;i++)deep={nested:deep};assert.match(JSON.stringify(m.buildArtifactJson(deep)),/limit/)
})
