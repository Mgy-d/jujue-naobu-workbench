import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))

function resolveAlias(spec){
  if(!spec.startsWith('@/'))return null
  const base=fileURLToPath(new URL('../src/'+spec.slice(2),import.meta.url))
  for(const ext of ['','.ts','.json']){const p=base+ext;if(existsSync(p))return p}
  return null
}
const aliasPlugin={name:'alias',setup(b){b.onResolve({filter:/^@\//},(a)=>{const p=resolveAlias(a.path);return p?{path:p}:null})}}
async function subject(){
  const out=await build({entryPoints:[fileURLToPath(new URL('../src/api/researchSandboxMock.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,plugins:[aliasPlugin],define:{'import.meta.env':'{}'}})
  return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))
}

test('mock sandbox: workspaces expose mock csv files',async()=>{
  const m=await subject()
  const c=m.mockSandboxClient('any')
  const ws=await c.workspaces()
  assert.equal(ws.length,1)
  assert.ok(ws[0].files.some(f=>f.name.endsWith('.csv')),'应暴露 mock CSV 文件')
})

test('mock sandbox: parse produces a preview artifact',async()=>{
  const m=await subject()
  const c=m.mockSandboxClient('any')
  const ws=await c.workspaces()
  const file=ws[0].files.find(f=>f.name.endsWith('.csv'))
  assert.ok(file,'mock 工作区应有 CSV')
  const run=await c.start(ws[0].workspaceId,{kind:'parse',fileIds:[file.fileId],code:'',columns:[],timeoutSeconds:30},'key1')
  assert.equal(run.executionStatus,'succeeded')
  assert.equal(run.outputStatus,'available')
  assert.equal(run.artifacts.length,1)
  const blob=await c.download(run.runId,run.artifacts[0])
  const text=await blob.text()
  assert.match(text,/行数\(不含表头\)/,'解析结果应含行数预览')
})

test('mock sandbox: statistics runs in-browser and reports mean',async()=>{
  const m=await subject()
  const c=m.mockSandboxClient('any')
  const ws=await c.workspaces()
  const file=ws[0].files.find(f=>f.name.endsWith('.csv'))
  const run=await c.start(ws[0].workspaceId,{kind:'statistics',fileIds:[file.fileId],code:'',columns:[],timeoutSeconds:30},'key2')
  assert.equal(run.executionStatus,'succeeded')
  const blob=await c.download(run.runId,run.artifacts[0])
  const text=await blob.text()
  assert.match(text,/均值=/,'描述统计应给出均值')
  assert.match(text,/标准差=/,'描述统计应给出标准差')
})
