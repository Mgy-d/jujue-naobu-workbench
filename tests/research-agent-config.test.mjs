import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function load(path) {
  const result=await build({entryPoints:[fileURLToPath(new URL('../src/'+path,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
test('市调默认智能体由目录名推导，不沿用数学建模名称或 ID',async()=>{
  const m=await load('config/researchAgent.ts'), c=m.resolveResearchAgent({})
  assert.equal(c.name,'市调演真');assert.equal(c.id,'a9818fe7-19e2-38f2-8cf2-045f46edb6da')
  assert.notEqual(c.id,'14ef7e16-06c8-34ff-8845-c19866cb2689')
})
test('配置只接受清晰且有效的市调名称与 UUID，覆盖不会污染旧配置',async()=>{
  const m=await load('config/researchAgent.ts')
  assert.equal(m.resolveResearchAgent({name:'  市调演真  '}).name,'市调演真')
  assert.equal(m.resolveResearchAgent({name:'市调演真',id:'  a9818fe7-19e2-38f2-8cf2-045f46edb6da  '}).id,'a9818fe7-19e2-38f2-8cf2-045f46edb6da')
  assert.throws(()=>m.resolveResearchAgent({id:'not-uuid'}),/智能体编号/)
})
