import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const b=await build({entryPoints:[fileURLToPath(new URL('../src/api/researchCloud.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
const token=owner=>'test.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.signature'
async function environment(fn){
  const old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch}
  const data=new Map([['access_token',token('owner-A')]])
  globalThis.window={location:{origin:'http://localhost'},setTimeout,clearTimeout}
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}
  try{await fn(data)}finally{Object.assign(globalThis,old)}
}
const row=(id,revision,data)=>({kind:'task',id,revision,data,updatedAt:'2026-11-05T00:00:00Z'})
test('database writes serialize revisions and capture each edit before later mutations',()=>environment(async()=>{
  const {ResearchCloudDocuments}=await subject(),cloud=new ResearchCloudDocuments(),writes=[]
  cloud.select('owner-A')
  globalThis.fetch=async(url,options)=>{
    if(options.method==='GET')return new Response('{}',{status:404})
    const body=JSON.parse(options.body);writes.push(body)
    return new Response(JSON.stringify(row('task',body.expectedRevision+1,body.data)))
  }
  const original={title:'first'}
  const first=cloud.save('task','task',original);original.title='second'
  const second=cloud.save('task','task',original)
  await Promise.all([first,second])
  assert.deepEqual(writes.map(w=>w.expectedRevision),[0,1])
  assert.deepEqual(writes.map(w=>w.data.title),['first','second'])
}))
test('reload preserves a pending edit baseline so a concurrent server version becomes a conflict',()=>environment(async()=>{
  const {ResearchCloudDocuments}=await subject(),cloud=new ResearchCloudDocuments();cloud.select('owner-A')
  globalThis.fetch=async()=>new Response(JSON.stringify(row('task',2,{title:'old'})))
  await cloud.get('task','task')
  const reloaded=new ResearchCloudDocuments();reloaded.select('owner-A')
  globalThis.fetch=async(url,options)=>{
    if(options.method==='GET')return new Response(JSON.stringify([row('task',3,{title:'other computer'})]))
    assert.equal(JSON.parse(options.body).expectedRevision,2)
    return new Response(JSON.stringify({message:'version conflict'}),{status:409})
  }
  await reloaded.list('task',new Set(['task']))
  await assert.rejects(reloaded.save('task','task',{title:'pending local'}),/conflict/)
}))
test('database response from a previous account cannot update the new account revision cache',()=>environment(async values=>{
  const {ResearchCloudDocuments}=await subject(),cloud=new ResearchCloudDocuments();cloud.select('owner-A')
  let finish
  globalThis.fetch=async()=>new Promise(resolve=>{finish=resolve})
  const loading=cloud.list('task')
  await new Promise(resolve=>setTimeout(resolve,0))
  values.set('access_token',token('owner-B'));cloud.select('owner-B')
  finish(new Response(JSON.stringify([row('old-task',4,{title:'private A'})])))
  await assert.rejects(loading,/账号已变化/)
  assert.equal(cloud.owner,'owner-B')
  assert.equal(JSON.parse(values.get('shidiaoyanzhen.cloud-revisions.v1:owner-B')||'{}')['task:old-task'],undefined)
}))
test('storage service rejection keeps the platform login and exposes an actionable error',()=>environment(async values=>{
  const {ResearchCloudDocuments}=await subject(),cloud=new ResearchCloudDocuments();cloud.select('owner-A')
  globalThis.fetch=async()=>new Response('{}',{status:401})
  await assert.rejects(cloud.list('task'),/认证配置/)
  assert.equal(values.get('access_token'),token('owner-A'))
}))


async function storeSubject(){
  const bundle=await build({stdin:{contents:"export {useResearchStore} from './src/stores/research.ts';export {createLocalTask} from './src/utils/researchDrafts.ts';export {createPinia,setActivePinia} from 'pinia';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}})
  return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
}
test('task registry loads the current account database and clears private tasks on account switch',()=>environment(async values=>{
  const {useResearchStore,createLocalTask,createPinia,setActivePinia}=await storeSubject()
  const taskA=createLocalTask('full-study','task-A'),taskB=createLocalTask('full-study','task-B')
  globalThis.fetch=async()=>new Response(JSON.stringify([row('task-A',1,taskA)]))
  setActivePinia(createPinia());const store=useResearchStore()
  await store.connectCloud('owner-A')
  assert.deepEqual(Object.keys(store.registry.tasks),['task-A'])
  values.set('access_token',token('owner-B'))
  globalThis.fetch=async()=>new Response(JSON.stringify([row('task-B',1,taskB)]))
  await store.connectCloud('owner-B')
  assert.deepEqual(Object.keys(store.registry.tasks),['task-B'])
  assert.equal(store.draft,null)
  await store.connectCloud('')
  assert.deepEqual(Object.keys(store.registry.tasks),[])
}))
