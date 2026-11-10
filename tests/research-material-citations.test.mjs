import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:['src/utils/researchMaterialCitations.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {pendingMaterialCitations,referencedMaterialRefs,materialCitationKey}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
const a={fileName:'答卷.csv',ref:'@uploads/a.csv'},b={fileName:'答卷.csv',ref:'@uploads/b.csv'}
test('first message includes new file, follow-up messages never append the already referenced file',()=>{
 assert.deepEqual(pendingMaterialCitations([a],[],[]),[a])
 const messages=[{role:'user',text:'请读取材料\n答卷.csv @uploads/a.csv'}]
 assert.deepEqual(pendingMaterialCitations([a],messages,[]),[])
 assert.deepEqual(pendingMaterialCitations([a,b],messages,[]),[b])
})
test('unknown send result remains attempted across reloads, only explicit rereference includes it again',()=>{
 const attempted=JSON.parse(JSON.stringify([a.ref]))
 assert.deepEqual(pendingMaterialCitations([a],[],attempted),[])
 assert.deepEqual(pendingMaterialCitations([a],[],attempted,[a.ref]),[a])
 assert.deepEqual(pendingMaterialCitations([a,b],[],[a.ref],[a.ref]),[a,b])
})
test('assistant references and filename substrings are never mistaken for a user file submission',()=>{
 assert.deepEqual(referencedMaterialRefs([a],[{role:'assistant',text:'@uploads/a.csv'}]),[])
 assert.deepEqual(referencedMaterialRefs([a],[{role:'user',text:'@uploads/a.csv.backup'}]),[])
})
test('material citation identities are isolated across owner, task and thread',()=>{
 const base=materialCitationKey('owner','agent','task','thread')
 for(const args of [['other','agent','task','thread'],['owner','agent','taskB','thread'],['owner','agent','task','threadB']])assert.notEqual(materialCitationKey(...args),base)
})
