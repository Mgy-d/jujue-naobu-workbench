import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:['src/utils/researchBinaryPreview.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {checkBinaryPreview,BINARY_PREVIEW_MAX_BYTES,pdfPreviewMetrics}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
test('preview rejects error pages, legacy PPT, empty and oversized input',()=>{
 const enc=new TextEncoder();for(const kind of ['pdf','pptx'])for(const text of ['','<html>登录失败</html>','{"code":"NOT_FOUND"}'])assert.throws(()=>checkBinaryPreview(enc.encode(text),kind))
 assert.throws(()=>checkBinaryPreview(new Uint8Array(BINARY_PREVIEW_MAX_BYTES+1),'pdf'),/32MB/)
 assert.throws(()=>checkBinaryPreview(new Uint8Array([208,207,17,224]),'pptx'),/不是有效/)
})
test('validation recognizes PDF and PPTX signatures without modifying original bytes',()=>{
 for(const [kind,input] of [['pdf',new TextEncoder().encode('%PDF-1.4\nfixture')],['pptx',new Uint8Array([80,75,3,4,0,255])]]){const before=input.slice();checkBinaryPreview(input,kind);assert.deepEqual(input,before)}
})

test('PDF 100 percent uses physical point-to-CSS conversion and crisp CJK rasterization',()=>{
 const normal=pdfPreviewMetrics(600,780,1,1)
 assert.equal(normal.scale,96/72);assert.equal(normal.width,800);assert.equal(normal.height,1040);assert.equal(normal.ratio,2)
 assert.equal(pdfPreviewMetrics(600,780,1.5,1).width,1200)
 assert.equal(pdfPreviewMetrics(600,780,1,2.5).ratio,2.5)
})
test('high zoom and extreme display density cannot create an unbounded PDF bitmap',()=>{
 const value=pdfPreviewMetrics(3000,4000,2,4)
 assert.ok(value.width*value.height*value.ratio**2<=16_777_217)
 assert.equal(pdfPreviewMetrics(600,780,1,4).ratio,3)
})
