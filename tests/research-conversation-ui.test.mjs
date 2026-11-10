import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/utils/researchConversationUi.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
test('ordinary continue can be primary while gate and statistics decisions keep equal emphasis and exact payload labels',()=>{
 const labels=['请结合题目梳理研究问题和方法','继续下一步'],copy=[...labels],items=m.conversationActionItems(labels)
 assert.equal(items[0].label,'继续下一步');assert.equal(items[0].primary,true);assert.deepEqual(labels,copy)
 for(const decisions of [['确认进入 G2','先说明需要修订的内容'],['通过','不通过'],['确认执行统计','暂不执行统计'],['确认理解，进入下一步','再讲一遍全局分析']]){
  const result=m.conversationActionItems(decisions);assert.ok(result.every(item=>!item.primary));assert.deepEqual(result.map(item=>item.label),decisions)
 }
})
test('history and streamed updates never replay arrival animation; a genuinely new message arrives once',()=>{
 const tracker=m.createConversationArrivalTracker()
 assert.deepEqual(tracker.observe('A',['history-user','history-ai'],true),[])
 assert.deepEqual(tracker.observe('A',['history-user','history-ai','new-user'],true),['new-user'])
 assert.deepEqual(tracker.observe('A',['history-user','history-ai','new-user','new-ai'],true),['new-ai'])
 assert.deepEqual(tracker.observe('A',['history-user','history-ai','new-user','new-ai'],true),[])
 tracker.observe('A',['history-user'],false)
 assert.deepEqual(tracker.observe('A',['history-user','new-ai'],true),[])
})
test('late history, owner/task changes and manual recovery remain still even after a prior active request',()=>{
 const tracker=m.createConversationArrivalTracker();tracker.observe('owner:A:thread',[],false)
 assert.deepEqual(tracker.observe('owner:A:thread',['old1','old2'],false),[])
 assert.deepEqual(tracker.observe('owner:A:thread',['old1','old2'],true),[])
 assert.deepEqual(tracker.observe('owner:B:threadB',['B-history'],true),[])
 assert.deepEqual(tracker.observe('other-owner:B:threadB',['B-history','another-history'],true),[])
 assert.deepEqual(tracker.observe('other-owner:B:threadB',['B-history','another-history','reply'],true),['reply'])
})


test('receipt separates runtime end from errors, active work and pending forms',()=>{
 for(const input of [{status:'finished',error:'读取失败'},{status:'finished',halted:true},{status:'finished',timedOut:true},{status:'uncertain'}]){
  const state=m.conversationReceiptState(input);assert.equal(state.canCompose,false);assert.equal(state.tone,'attention')
 }
 for(const input of [{status:'running'},{status:'finished',busy:true},{status:'working'},{status:'interrupt'},{status:'finished',hasForms:true}]){
  const state=m.conversationReceiptState(input);assert.equal(state.canCompose,false);assert.notEqual(state.title,'本轮回复已结束')
 }
 assert.equal(m.conversationReceiptState({status:'finished'}).title,'本轮回复已结束')
 assert.equal(m.conversationReceiptState({status:'awaiting'}).canCompose,true)
})

test('only idle final phase removes generic advancement; earlier phase choices remain',()=>{
 for(const status of ['finished','awaiting'])assert.equal(m.hideGenericResearchContinuation(status,'G4'),true)
 for(const phase of ['G1','G2','G3',''])assert.equal(m.hideGenericResearchContinuation('finished',phase),false)
 for(const status of ['uncertain','working','running','interrupt'])assert.equal(m.hideGenericResearchContinuation(status,'G4'),false)
})


test('large session receipt exists only during active processing, not after failure or completion',()=>{
 for(const status of ['awaiting','finished','uncertain','interrupt','idle'])assert.equal(m.showActiveResearchReceipt({busy:false,status}),false,status)
 for(const status of ['checking','working','running'])assert.equal(m.showActiveResearchReceipt({busy:false,status}),true,status)
 assert.equal(m.showActiveResearchReceipt({busy:true,status:'uncertain'}),true)
})
