import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function moduleOf(path){const r=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))}
const {completeResearchArchive}=await moduleOf('src/utils/researchArchiveCompletion.ts')
const {handoffProof,handoffStatus}=await moduleOf('src/utils/researchHandoff.ts')
const bytes=new TextEncoder().encode('原始正文').buffer
function input(overrides={}){return {taskId:'A',threadId:'threadA',baseSavedAt:'first',paths:[{path:'artifacts/report.md',name:'report.md'}],valid:()=>true,read:async path=>({bytes,ref:{path,id:'id',fileName:'report.md',contentHash:'hash',size:bytes.byteLength}}),...overrides}}
test('archive enumerates more than 30 files, deduplicating only exact paths and preserving original snapshot',async()=>{
 const prior=[{path:'artifacts/report.md',content:'首版正文'}],copy=JSON.stringify(prior),paths=Array.from({length:35},(_,i)=>({path:'artifacts/'+i+'/同名.md',name:'同名.md'}))
 const result=await completeResearchArchive(input({paths:[...paths,paths[0]],priorFiles:prior}))
 assert.equal(result.fileRefs.length,36);assert.equal(result.gaps.length,0);assert.equal(result.files.length,36);assert.equal(JSON.stringify(prior),copy)
})
test('read failure retains prior text and reports exact path; unrelated files never fill a gap',async()=>{
 const result=await completeResearchArchive(input({priorFiles:[{path:'artifacts/report.md',content:'旧正文'}],read:async()=>{throw Error('HTTP 404')}}))
 assert.deepEqual(result.files,[{path:'artifacts/report.md',content:'旧正文'}]);assert.equal(result.fileRefs.length,0);assert.match(result.gaps[0],/artifacts\/report.md：HTTP 404/)
})
test('task or account switch aborts completion rather than returning a savable partial record',async()=>{
 let active=true
 await assert.rejects(completeResearchArchive(input({valid:()=>active,read:async path=>{active=false;return {bytes,ref:{path,id:'x'}}}})),/已变化/)
})
test('large and binary originals keep downloadable references without overflowing text snapshot',async()=>{
 const result=await completeResearchArchive(input({paths:[{path:'large.md',name:'large.md'},{path:'report.docx',name:'report.docx'}],read:async path=>({bytes:new Uint8Array(3_100_000).buffer,ref:{path,id:path,fileName:path,contentHash:'hash',size:3_100_000}})}))
 assert.equal(result.fileRefs.length,2);assert.equal(result.files.length,0);assert.equal(result.gaps.length,0)
})
test('an empty file tree never claims all files are archived',async()=>{assert.equal((await completeResearchArchive(input({paths:[]}))).gaps.length,1)})
test('handoff proof requires exact snapshot marker on a server user turn, then a later reply',()=>{
 assert.deepEqual(handoffProof([{role:'assistant',text:'已人工确认采用数据快照 x。'}],'x'),{sent:false,replyObserved:false})
 assert.deepEqual(handoffProof([{role:'user',text:'已人工确认采用数据快照 xy。'}],'x'),{sent:false,replyObserved:false})
 assert.deepEqual(handoffProof([{role:'assistant',text:'旧回复'},{role:'user',text:'已人工确认采用数据快照 x。'}],'x'),{sent:true,replyObserved:false})
 assert.deepEqual(handoffProof([{role:'user',text:'已人工确认采用数据快照 x。'},{role:'assistant',text:'已收到，请核对材料'}],'x'),{sent:true,replyObserved:true})
 assert.match(handoffStatus({state:'reply-observed'}),/不代表审核通过/)
})
