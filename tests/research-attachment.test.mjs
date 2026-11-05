import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const result=await build({entryPoints:[fileURLToPath(new URL('../src/api/attachment.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}})
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))

test('attachments use the original session and preserve server reference and original filename on readback',async()=>{
  const old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch}
  try{
    globalThis.window={location:{origin:'http://localhost'},setTimeout,clearTimeout}
    globalThis.localStorage={getItem:()=>null}
    let saved
    globalThis.fetch=async(url,options)=>{
      assert.ok(String(url).endsWith('/api/agents/agent/sessions/thread-A/attachments'))
      if(options.method==='POST'){
        assert.ok(options.body instanceof FormData)
        const file=options.body.get('file');assert.equal(file.name,'合成数据.csv')
        assert.equal(await file.text(),'Q01,Q02\n1,2\n')
        saved={fileName:file.name,ref:'@uploads/synthetic.csv',size:file.size}
        return new Response(JSON.stringify(saved))
      }
      return new Response(JSON.stringify({items:[saved],total:1}))
    }
    const item=await api.uploadAttachment('agent','thread-A',new File(['Q01,Q02\n1,2\n'],'合成数据.csv'))
    assert.equal(item.ref,'@uploads/synthetic.csv');assert.equal(item.fileName,'合成数据.csv')
    assert.deepEqual(await api.listAttachments('agent','thread-A'),[item])
    globalThis.fetch=async()=>new Response(JSON.stringify({message:'upload failed'}),{status:500})
    await assert.rejects(api.uploadAttachment('agent','thread-A',new File(['x'],'retry.csv')),/upload failed/)
  }finally{Object.assign(globalThis,old)}
})
