import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(path){const entry=fileURLToPath(new URL(path,import.meta.url));const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}

function memStorage(){const m=new Map();return {getItem:(k)=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}}

test('removeLocalTask deletes task, clears its lastByKind, keeps others',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const s=memStorage()
 const a=m.createLocalTask('full-study','a',1),b=m.createLocalTask('full-study','b',2)
 let reg=m.emptyTaskRegistry()
 reg.tasks={a,b};reg.lastByKind={'full-study':'b'}
 reg=m.saveLocalTask(s,reg,b)
 const next=m.removeLocalTask(s,reg,'b')
 assert.ok(!next.tasks.b)
 assert.ok(next.tasks.a)
 assert.ok(!next.lastByKind['full-study'])
 assert.equal(m.removeLocalTask(s,next,'b'),next)
})

test('removeLocalTask refuses overwrite when another page updated storage',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const s=memStorage()
 const a=m.createLocalTask('full-study','a',1)
 let reg=m.emptyTaskRegistry();reg.tasks={a};reg.lastByKind={}
 reg=m.saveLocalTask(s,reg,a)
 const stale={...reg}
 reg=m.saveLocalTask(s,reg,m.editLocalTask(a,{title:'x'},2))
 assert.throws(()=>m.removeLocalTask(s,stale,'a'),/另一页面/)
})

test('removeLocalTask refuses to touch corrupted storage',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const s=memStorage()
 const a=m.createLocalTask('full-study','a',1)
 let reg=m.emptyTaskRegistry();reg.tasks={a};reg.lastByKind={}
 reg=m.saveLocalTask(s,reg,a)
 s.setItem(m.TASK_STORAGE_KEY,'{broken')
 assert.throws(()=>m.removeLocalTask(s,reg,'a'),/损坏/)
})
