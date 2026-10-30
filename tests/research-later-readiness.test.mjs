import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(path){const entry=fileURLToPath(new URL(path,import.meta.url));const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))}

test('phase 4 readiness: blocked when empty, risky when partial, ok when full',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const t=m.createLocalTask('full-study','a',1)
 assert.equal(m.precheckLaterStageReadiness(t,4).level,'blocked')
 const partial=m.editLocalTask(t,{collection:{...t.collection,channel:'平台内匿名发布'}},2)
 const r1=m.precheckLaterStageReadiness(partial,4)
 assert.equal(r1.level,'risky')
 assert.ok(r1.reasons.includes('待补充：调查对象与招募说明'))
 const full=m.editLocalTask(t,{collection:{channel:'平台内匿名发布',audience:'在校大学生',startNote:'赛前两周',stopRule:'回收 400 份'}},3)
 assert.equal(m.precheckLaterStageReadiness(full,4).level,'ok')
})

test('phase 6 readiness: requires body+source+defense and sandbox link for ok',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const t=m.createLocalTask('full-study','b',1)
 assert.equal(m.precheckLaterStageReadiness(t,6).level,'blocked')
 const draftOnly=m.editLocalTask(t,{report:{body:'正文',sourceNotes:'来源',defenseNotes:'答辩'}},2)
 assert.equal(m.precheckLaterStageReadiness(draftOnly,6).level,'risky') // 未关联 sandbox 不算就绪
 const linked=m.editLocalTask(draftOnly,{sandboxRef:{workspaceId:'w1',runId:'r1'}},3)
 assert.equal(m.precheckLaterStageReadiness(linked,6).level,'ok')
 const unlinkedBody=m.editLocalTask(t,{report:{body:'正文',sourceNotes:'',defenseNotes:''}},4)
 assert.equal(m.precheckLaterStageReadiness(unlinkedBody,6).level,'risky')
})

test('non full-study returns blocked for later stages',async()=>{
 const m=await subject('../src/utils/researchDrafts.ts')
 const t=m.createLocalTask('dataset-analysis','c',1)
 assert.equal(m.precheckLaterStageReadiness(t,6).level,'blocked')
 assert.equal(m.precheckLaterStageReadiness(t,4).level,'blocked')
})
