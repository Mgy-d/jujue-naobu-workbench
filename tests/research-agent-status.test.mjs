import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(){const b=await build({entryPoints:[fileURLToPath(new URL('../src/api/researchAgent.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}
async function scenario(status,progress,check){const m=await subject(),old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch},calls=[];try{globalThis.window={location:{origin:'http://localhost'},setTimeout,clearTimeout};globalThis.localStorage={getItem:()=>null};globalThis.fetch=async(url)=>{calls.push(String(url));if(String(url).endsWith('/progress') && progress instanceof Error)throw progress;return new Response(JSON.stringify(String(url).endsWith('/progress')?progress:status),{headers:{'content-type':'application/json'}})};await check(()=>m.fetchResearchRunStatus('agent','thread'),calls)}finally{Object.assign(globalThis,old)}}
test('old backend idle parent with CONTINUE ledger remains pending, without inventing a running child',async()=>{await scenario({sessionId:'thread',running:false},{sessionId:'thread',nextAction:'CONTINUE'},async(run,calls)=>{assert.deepEqual(await run(),{running:false,continuationPlanned:true});assert.equal(calls.length,2)})})
test('explicit background-work capability is authoritative and avoids the fallback request',async()=>{for(const pendingWork of [true,false])await scenario({running:false,pendingWork},{nextAction:'CONTINUE'},async(run,calls)=>{assert.deepEqual(await run(),{running:false,pendingWork});assert.equal(calls.length,1)})})
test('an active parent does not require a progress ledger to remain active',async()=>{await scenario({running:true},new Error('offline'),async(run,calls)=>{assert.deepEqual(await run(),{running:true});assert.equal(calls.length,1)})})
test('old backend WAIT_HITL is an input requirement, not a completed study',async()=>{await scenario({running:false},{nextAction:'WAIT_HITL'},async(run)=>assert.deepEqual(await run(),{running:false,awaitingInput:true}))})
test('old backend DONE and IDLE mean segment idle only',async()=>{for(const nextAction of ['DONE','IDLE'])await scenario({running:false},{nextAction},async(run)=>assert.deepEqual(await run(),{running:false}))})
test('unknown ledger is explicit uncertainty so a separately verified gate can still recover',async()=>{await scenario({sessionId:'thread',running:false},{sessionId:'thread',nextAction:'UNKNOWN'},async(run)=>assert.deepEqual(await run(),{running:false,continuationUnknown:true}))})
test('missing or inaccessible ledger never silently becomes finished',async()=>{for(const progress of [{},new Error('offline')])await scenario({running:false},progress,async(run)=>assert.rejects(run,/核对|连接后端/))})
test('malformed status and another session ledger are rejected',async()=>{await scenario({running:'false'},{nextAction:'DONE'},async(run)=>assert.rejects(run,/状态/));await scenario({sessionId:'other',running:false},{nextAction:'DONE'},async(run)=>assert.rejects(run,/身份/));await scenario({running:false},{sessionId:'other',nextAction:'DONE'},async(run)=>assert.rejects(run,/身份/))})

test('recovery starts at the authoritative latest run watermark instead of scanning old token history',async()=>{const m=await subject(),old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch},calls=[];try{globalThis.window={location:{origin:'http://localhost'},setTimeout,clearTimeout};globalThis.localStorage={getItem:()=>null};globalThis.fetch=async(url)=>{const u=new URL(url);calls.push(u);return new Response(JSON.stringify(u.searchParams.has('latest')?{sessionId:'thread',latest:true,lastRunStartSequence:12001,nextAfterSequence:12002}:{sessionId:'thread',nextAfterSequence:12002,events:[{eventSequence:12001,runId:'srv-a',payload:{type:'RUN_STARTED'}},{eventSequence:12002,runId:'srv-a',payload:{type:'RUN_FINISHED'}}]}))};const events=await m.fetchResearchRecoveryEvents('thread');assert.equal(events.length,2);assert.equal(calls[1].searchParams.get('afterSequence'),'12000')}finally{Object.assign(globalThis,old)}})


const teamInputLine='[进度] 阶段=G2 完成=G1三件（研究简报、研究问题、调查方案）进行中=等待团队题项清单 剩余=G2问卷、G3数据统计、G4报告PPT 下步=团队提交题项原文后跑 G2 生成与校验 状态=等待人工'
const teamInputProgress={sessionId:'thread',phase:'G2',nextAction:'UNKNOWN',progressLine:teamInputLine,lastText:'请提交团队题项原文。\n'+teamInputLine,stallNow:false,hitlStuck:false}

test('company G2 UNKNOWN with matching latest ledger explicitly waiting for team items permits ordinary input',async()=>{
  await scenario({sessionId:'thread',running:false},teamInputProgress,async(run)=>assert.deepEqual(await run(),{running:false,phase:'G2',awaitingInput:true}))
})

test('company fallback refuses stale text, other phases, running work and stuck HITL',async()=>{
  for(const change of [{lastText:'older reply'},{phase:'G1'},{sessionId:undefined},{hitlStuck:true},{stallNow:true},{progressLine:teamInputLine.replace('等待人工','执行中')},{progressLine:teamInputLine.replace('等待团队题项清单','后台生成中')}]){
    await scenario({running:false},{...teamInputProgress,...change},async(run)=>assert.deepEqual(await run(),{running:false,phase:change.phase || 'G2',continuationUnknown:true}))
  }
  await scenario({running:true},teamInputProgress,async(run)=>assert.deepEqual(await run(),{running:true}))
  await scenario({running:false,pendingWork:true},teamInputProgress,async(run)=>assert.deepEqual(await run(),{running:false,pendingWork:true}))
})


test('company G1 completed segment waiting for G2 confirmation allows a user decision, not automatic advancement',async()=>{
  const line='[进度] 阶段=G1 完成=研究简报、研究问题、调查方案 进行中=无 剩余=G2、G3、G4 下步=等待确认是否进入 G2 状态=部分完成'
  const progress={sessionId:'thread',phase:'G1',nextAction:'UNKNOWN',progressLine:line,lastText:'下一步可选：确认进入G2或修订G1。\n'+line,stallNow:false,hitlStuck:false}
  await scenario({sessionId:'thread',running:false},progress,async(run)=>assert.deepEqual(await run(),{running:false,phase:'G1',awaitingInput:true,nextStage:'G2'}))
  for(const change of [{hitlStuck:true},{stallNow:true},{lastText:'stale response'},{progressLine:line.replace('进行中=无','进行中=子任务执行中')},{progressLine:line.replace('进入 G2','进入 G4')}]){
    await scenario({running:false},{...progress,...change},async(run)=>assert.deepEqual(await run(),{running:false,phase:'G1',continuationUnknown:true}))
  }
})


test('actual compact G1 ledger restores phase and next action with null phase and progressLine',async()=>{
  const text='下一步可选：①确认进入 G2；②先修订 G1。\n[进度] 阶段=G1 完成=研究简报、研究问题、调查方案进行中=无剩余=G2、G3、G4 下步=等待确认是否进入 G2 状态=部分完成'
  await scenario({sessionId:'thread',running:false},{sessionId:'thread',phase:null,nextAction:'UNKNOWN',progressLine:null,lastText:text,stallNow:false,hitlStuck:false},async(run)=>assert.deepEqual(await run(),{running:false,phase:'G1',awaitingInput:true,nextStage:'G2'}))
})


test('G3 blocked for missing team data and plan permits supplying materials without completing analysis',async()=>{
  const line='[进度] 阶段=G3 完成=G1、G2 进行中=无 剩余=G3数据质检与统计、G4 下步=等待团队提交原始数据与分析计划 状态=已阻塞'
  const progress={sessionId:'thread',phase:'G3',nextAction:'UNKNOWN',progressLine:line,lastText:'请提交CSV及分析计划。\n'+line,stallNow:false,hitlStuck:false}
  await scenario({running:false},progress,async(run)=>assert.deepEqual(await run(),{running:false,phase:'G3',awaitingInput:true}))
  await scenario({running:true},progress,async(run)=>assert.deepEqual(await run(),{running:true}))
  await scenario({running:false},{...progress,lastText:'newer unrelated reply'},async(run)=>assert.deepEqual(await run(),{running:false,phase:'G3',continuationUnknown:true}))
})


test('G3 confirmed materials waiting for statistics confirmation accepts questions without approving execution',async()=>{
  for(const next of ['等待团队确认统计执行','等待团队确认后执行统计']){
    const line='[进度] 阶段=G3 完成=材料核验 进行中=无 剩余=统计执行 下步='+next+' 状态=等待人工'
    const progress={sessionId:'thread',phase:'G3',nextAction:'UNKNOWN',progressLine:line,lastText:'材料完整，无缺失。\n'+line,stallNow:false,hitlStuck:false}
    await scenario({running:false},progress,async(run)=>assert.deepEqual(await run(),{running:false,phase:'G3',awaitingInput:true}))
    await scenario({running:true},progress,async(run)=>assert.deepEqual(await run(),{running:true}))
  }
})

test('G3 actions distinguish actual material gaps from statistics decisions and never grant execution',async()=>{
  const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchProgress.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
  const {researchG3Action}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
  const base={phase:'G3',awaitingInput:true,currentWork:'无',state:'等待人工'}
  const ready=researchG3Action({...base,nextStep:'等待团队确认统计执行'})
  assert.equal(ready.kind,'statistics');assert.equal(ready.badge,'待确认统计')
  assert.equal(ready.label,'查看分析计划与待确认事项');assert.match(ready.message,/暂不执行统计/)
  const missing=researchG3Action({...base,nextStep:'等待团队上传原始数据 CSV'})
  assert.equal(missing.kind,'materials');assert.match(missing.message,/确实缺少/)
  assert.equal(researchG3Action({...base,nextStep:'等待后续输入'}).kind,'unknown')
  assert.equal(researchG3Action({...base,currentWork:'统计执行中',nextStep:'等待团队确认统计执行'}).kind,'unknown')
  assert.equal(researchG3Action({...base,phase:'G2',nextStep:'等待团队确认统计执行'}),null)
})


test('observed approved G3 ledger exposes the G4 decision without automatically starting the report',async()=>{
  const line='[进度] 阶段=G3（已通过） 完成=G1、G2、G3 全部闸门 进行中=无 剩余=团队补材料 10 项、G4 骨架 下步=等待团队确认是否进入 G4 状态=等待人工'
  const progress={sessionId:'thread',phase:'G3',nextAction:'UNKNOWN',progressLine:line,lastText:'关于暂不执行统计：遵照执行，不会重跑统计。\n'+line,stallNow:false,hitlStuck:false}
  await scenario({running:false},progress,async(run)=>assert.deepEqual(await run(),{running:false,phase:'G3',awaitingInput:true,nextStage:'G4'}))
  await scenario({running:true},progress,async(run)=>assert.deepEqual(await run(),{running:true}))
  for(const replacement of [line.replace('进行中=无','进行中=后台生成中'),line.replace('进入 G4','进入 G2'),line.replace('状态=等待人工','状态=执行中')]){
    await scenario({running:false},{...progress,progressLine:replacement,lastText:replacement},async(run)=>assert.deepEqual(await run(),{running:false,phase:'G3',continuationUnknown:true}))
  }
})
