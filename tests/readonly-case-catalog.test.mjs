import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
test('shared math catalog reads anonymously and never writes views or routes admin operations to math',async()=>{
 const built=await build({entryPoints:['src/api/outsourcedCases.ts'],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':JSON.stringify({VITE_DUAL_TOKEN:'1',VITE_CASE_CATALOG_MODE:'smyy-readonly'})}})
 const api=(await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))).outsourcedCaseApi
 const old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch},calls=[]
 globalThis.window={location:{origin:'http://synthetic.test'},setTimeout,clearTimeout};globalThis.localStorage={getItem:key=>key==='access_token'?'synthetic-agent':key==='biz_access_token'?'synthetic-biz':null}
 globalThis.fetch=async(url,options)=>{calls.push({path:new URL(url).pathname,options});return new Response(JSON.stringify({items:[],total:0}),{headers:{'content-type':'application/json'}})}
 try{
  await api.list(false);await api.get('p1');await api.dicts();await api.addView('p1');await api.list(true)
  assert.deepEqual(calls.map(c=>c.path),['/case-catalog-api/cases','/case-catalog-api/cases/p1','/case-catalog-api/case-dicts','/api/tjdc/admin/cases'])
  for(const call of calls.slice(0,3)){assert.equal(call.options.method,'GET');assert.equal(call.options.headers.Authorization,undefined);assert.equal(call.options.headers['X-OAuth-Token'],undefined)}
  assert.equal(calls[3].options.headers.Authorization,'Bearer synthetic-biz')
 }finally{Object.assign(globalThis,old)}
})
