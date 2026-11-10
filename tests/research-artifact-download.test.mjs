import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:['src/api/researchArtifactDownload.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-http',setup(b){b.onResolve({filter:/^@\/api\/http$/},()=>({path:'http',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function rawFetch(...args){return globalThis.artifactTransport(...args)}',loader:'js'}))}}]})
const {readArtifactDownload}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
test('download preserves Word/PDF/PPT/CSV/JSON bytes, original path, identity and abort signal',async()=>{
 for(const name of ['报告.docx','报告.pdf','答辩.pptx','答卷.csv','问卷结构.json']){
  const bytes=new Uint8Array([80,75,3,4,0,255,254,10]);let call
  globalThis.artifactTransport=(...args)=>{call=args;return Promise.resolve(new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}))}
  const signal=new AbortController().signal,path='sub/artifacts/含 空格/'+name
  const blob=await readArtifactDownload('a','t',path,signal)
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes)
  assert.equal(call[0],'/api/agents/a/sessions/t/artifacts/download');assert.deepEqual(call[1].params,{path});assert.equal(call[1].signal,signal)
 }
})
test('HTTP errors, empty files, login HTML and 200 JSON errors never become downloadable blobs',async()=>{
 const cases=[()=>new Response('{"message":"文件不存在"}',{status:404}),()=>new Response(''),()=>new Response('<html>登录</html>',{headers:{'Content-Type':'text/html'}}),()=>new Response('<!doctype html>登录'),()=>new Response('{"code":"NOT_FOUND","message":"无权访问"}',{headers:{'Content-Type':'application/json'}})]
 for(const response of cases){let calls=0;globalThis.artifactTransport=()=>{calls++;return Promise.resolve(response())};await assert.rejects(()=>readArtifactDownload('a','t','report.pdf'));assert.equal(calls,1)}
})
test('real JSON and HTML artifacts remain downloadable; unknown network result never retries',async()=>{
 for(const [name,text] of [['问卷.json','{"title":"问卷","questions":[]}'],['报告.html','<html>报告</html>']]){
 globalThis.artifactTransport=()=>Promise.resolve(new Response(text));assert.equal(await (await readArtifactDownload('a','t',name)).text(),text)
 }
 let calls=0;globalThis.artifactTransport=()=>{calls++;throw Error('timeout')};await assert.rejects(()=>readArtifactDownload('a','t','r.pdf'),/timeout/);assert.equal(calls,1)
 await assert.rejects(()=>readArtifactDownload('','t','r.pdf'),/不完整/)
})
