import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:['src/api/researchWordFile.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-http',setup(b){b.onResolve({filter:/^@\/api\/http$/},()=>({path:'http',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function rawFetch(...args){return globalThis.wordTransport(...args)}',loader:'js'}))}}]})
const {fetchResearchWordFile}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
test('Word uses supported authenticated download route and exact original path, never raw',async()=>{
 const path='sub-example/artifacts/社区报告 正文.docx',signal=new AbortController().signal;let call
 globalThis.wordTransport=(...args)=>{call=args;return Promise.resolve(new Response('bytes'))}
 await fetchResearchWordFile('agent','main-session',path,signal)
 assert.equal(call[0],'/api/agents/agent/sessions/main-session/artifacts/download');assert.deepEqual(call[1].params,{path});assert.equal(call[1].signal,signal);assert.equal(call[1].method,'GET')
 assert.throws(()=>fetchResearchWordFile('','main-session',path),/不完整/)
})
test('Word transport failure is not swallowed or retried under a different identity',async()=>{
 let count=0;globalThis.wordTransport=()=>{count++;return Promise.resolve(new Response('not found',{status:404}))}
 assert.equal((await fetchResearchWordFile('a','t','report.docx')).status,404);assert.equal(count,1)
})
