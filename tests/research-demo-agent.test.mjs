import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))

function resolveAlias(spec){
  if(!spec.startsWith('@/'))return null
  const base=fileURLToPath(new URL('../src/'+spec.slice(2),import.meta.url))
  for(const ext of ['','.ts','.vue','.json']){const p=base+ext;if(existsSync(p))return p}
  return null
}
const aliasPlugin={name:'alias',setup(b){b.onResolve({filter:/^@\//},(a)=>{const p=resolveAlias(a.path);return p?{path:p}:null})}}
async function subject(path,define={}){
  const entry=fileURLToPath(new URL(path,import.meta.url))
  const out=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false,plugins:[aliasPlugin],define})
  return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))
}

function fakeStorage(){
  const map=new Map()
  return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))}
}
const signal=()=>new AbortController().signal

test('demo agent: probe replies one short sentence and does not persist',async()=>{
  const m=await subject('../src/utils/researchDemoAgent.ts',{'import.meta.env.VITE_RESEARCH_AGENT_MODE':'"demo"'})
  const storage=fakeStorage()
  const services=m.createDemoResearchServices(storage)
  const identity={agentId:'a',projectId:'sz-p',threadId:'main-probe-x',runId:'run-1'}
  const result=await services.run(identity,{threadId:identity.threadId,runId:identity.runId,messages:[{id:'u1',role:'user',content:[{type:'text',text:'你好，请只回复一句话。这是模型响应检查，不启动研究、不生成产物。'}]}]},()=>{},signal())
  assert.equal(result.status,'success')
  const text=Object.values(result.texts).join('')
  assert.ok(text.length>0&&text.length<80,'探测回复应为一句话')
  assert.equal([...storage.map.keys()].length,0,'探测不应写入会话存储')
})

test('demo agent: step-by-step next/back/QA/fallback with persistence and recovery',async()=>{
  const m=await subject('../src/utils/researchDemoAgent.ts',{'import.meta.env.VITE_RESEARCH_AGENT_MODE':'"demo"'})
  const storage=fakeStorage()
  const services=m.createDemoResearchServices(storage)
  const identity={agentId:'a',projectId:'sz-p',threadId:'main-t1',runId:'run-1'}
  const send=text=>services.run(identity,{threadId:identity.threadId,runId:identity.runId,messages:[{id:'u',role:'user',content:[{type:'text',text}]}]},()=>{},signal())
  const first=await send('请开始演示')
  assert.match(Object.values(first.texts).join(''),/演示讲解 0\/8/,'首次消息应输出开场导览')
  const s1=await send('下一步')
  assert.match(Object.values(s1.texts).join(''),/阶段 1 · 赛事理解/)
  const s2=await send('下一步')
  assert.match(Object.values(s2.texts).join(''),/阶段 2 · 选题分析/)
  const back=await send('回退上一步')
  assert.match(Object.values(back.texts).join(''),/阶段 1 · 赛事理解/)
  const qa=await send('抽样方案是怎么定的？')
  assert.match(Object.values(qa.texts).join(''),/配额抽样/)
  const unknown=await send('今天天气怎么样')
  assert.match(Object.values(unknown.texts).join(''),/换个问法|可提问主题/)
  // 步骤游标不被问答移动：再下一步应回到阶段 2
  const s2again=await send('下一步')
  assert.match(Object.values(s2again.texts).join(''),/阶段 2 · 选题分析/)
  // 刷新恢复：transcript 读回全部消息
  const {messages}=await services.transcript('a','main-t1')
  assert.ok(messages.length>=12,'对话应持久化以便刷新恢复')
  assert.equal(messages[0].role,'user')
  // 服务端状态：空闲等待输入，绝无运行/待办
  const status=await services.runStatus('a','main-t1')
  assert.equal(status.running,false)
})

test('demo artifacts: paths match the stage filter rules for phases 0-3,5,6',async()=>{
  const m=await subject('../src/utils/researchDemoAgent.ts',{'import.meta.env.VITE_RESEARCH_AGENT_MODE':'"demo"'})
  const st=await subject('../src/utils/researchStageArtifacts.ts')
  const files=m.demoArtifactFiles('sz-demo-project')
  assert.ok(files.length>=6)
  for(const phase of [0,1,2,3,5,6])assert.ok(st.stageArtifacts(files,'sz-demo-project',phase).length>0,'阶段 '+phase+' 应有演示产物')
  assert.equal(st.stageArtifacts(files,'sz-demo-project',4).length,0,'阶段 4（正式调查）无产物属预期')
  const read=await m.demoArtifactRead(files[0].path)
  assert.ok(read.content&&read.content.includes('演示'))
  const missing=await m.demoArtifactRead('sz-demo-project/不存在.md')
  assert.equal(missing.content,null)
})
