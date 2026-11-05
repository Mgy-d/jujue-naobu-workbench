import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:[fileURLToPath(new URL('../src/api/researchCollection.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}})
const {collectionApi}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
async function withEnvironment(fn){
  const old={window:globalThis.window,fetch:globalThis.fetch,localStorage:globalThis.localStorage}
  const values=new Map([['access_token','synthetic-token']])
  globalThis.window={location:{origin:'http://localhost'},setTimeout,clearTimeout}
  globalThis.localStorage={getItem:k=>values.get(k)||null}
  try{await fn(values)}finally{Object.assign(globalThis,old)}
}
test('public fill never forwards researcher token, admin requests carry it',()=>withEnvironment(async()=>{
  globalThis.fetch=async(url,options)=>{
    const isPublic=String(url).includes('/public/')
    assert.equal(options.headers.Authorization,isPublic?undefined:'Bearer synthetic-token')
    return new Response(JSON.stringify(isPublic?{code:'synthetic'}:[]))
  }
  await collectionApi.publicSurvey('synthetic');await collectionApi.receipt('synthetic','device','submission');await collectionApi.list()
}))
test('collection service 401 does not erase the platform login',()=>withEnvironment(async values=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'invalid'}),{status:401})
  await assert.rejects(collectionApi.list(),/验签/)
  assert.equal(values.get('access_token'),'synthetic-token')
}))
test('snapshot handoff preserves original CSV bytes including UTF8 BOM',()=>withEnvironment(async()=>{
  const bytes=new Uint8Array([239,187,191,81,49,10,65,10])
  globalThis.fetch=async()=>new Response(bytes)
  assert.deepEqual(new Uint8Array(await collectionApi.snapshotBytes('snapshot-A')),bytes)
}))
test('late management response from a previous account is rejected',()=>withEnvironment(async values=>{
  globalThis.fetch=async()=>{values.set('access_token','other-account');return new Response('[]')}
  await assert.rejects(collectionApi.list(),/账号已变化/)
}))
test('date filters are encoded for the server rather than filtering one local page',()=>withEnvironment(async()=>{
  globalThis.fetch=async url=>{const parsed=new URL(url);assert.equal(parsed.searchParams.get('from'),'2026-11-04T01:00:00.000Z');return new Response('{"items":[],"total":0,"totalPages":0}')}
  await collectionApi.responses('survey-A',1,undefined,'2026-11-04T01:00:00.000Z')
}))
