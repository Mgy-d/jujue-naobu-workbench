import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }))
const root = path.resolve(import.meta.dirname, '..')

async function load(entry, mocks = {}) {
  const result = await build({ entryPoints: [path.join(root, entry)], bundle: true, write: false,
    platform: 'node', format: 'esm', plugins: [{ name: 'http-fixture', setup(b) {
      b.onResolve({ filter: /^@\// }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : { path: path.join(root, 'src', args.path.slice(2) + '.ts') })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }))
    } }] })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}

globalThis.window = globalThis
globalThis.__completion = { calls: [], events: [], failDelete: false }
const mod = await load('src/api/interruptRelease.ts', {
  '@/api/http': `export const http = {get: async () => [], delete: async path => {globalThis.__completion.calls.push(path); if(globalThis.__completion.failDelete) throw new Error('offline')}}`,
  '@/api/agui': `export async function runAgui(){globalThis.__completion.runs=(globalThis.__completion.runs||0)+1;return {ok:true}};
    export async function parseAguiStream(r, emit){for(const e of globalThis.__completion.events) emit(e)};
    export function runEventError(e){return e.type==='RUN_ERROR' ? e.message : ''}`,
})

async function submit(events) {
  globalThis.__completion = { calls: [], events, failDelete: false }
  const result = await mod.submitResumeCoveringAll({agentId:'agent', threadId:'main-1',runId:'run-1',answerId:'reply:tool-1',payload:{output:'{}'},onEvent(){}})
  return { result, calls: globalThis.__completion.calls }
}

test('successful resume removes only the consumed form registration', async () => {
  const got = await submit([{type:'RUN_FINISHED'}])
  assert.equal(got.result.error, '')
  assert.deepEqual(got.calls, ['/api/agents/agent/sessions/main-1/form-interrupts/tool-1'])
})

test('a rejected or unterminated resume keeps the form registration for retry', async () => {
  assert.deepEqual((await submit([{type:'RUN_ERROR',message:'model failed'}])).calls, [])
  const interrupted = await submit([{type:'TEXT_MESSAGE_CONTENT',delta:'partial'}])
  assert.deepEqual(interrupted.calls, [])
  assert.notEqual(interrupted.result.error, '')
})

test('registry cleanup failure does not replay an already successful model run', async () => {
  globalThis.__completion = {calls:[],events:[{type:'RUN_FINISHED'}],failDelete:true}
  const result = await mod.submitResumeCoveringAll({agentId:'agent',threadId:'main-1',runId:'r1',answerId:'reply:tool-1',payload:{output:'{}'},onEvent(){}})
  assert.equal(result.error, '')
  assert.equal(result.degraded, true)
  assert.equal(globalThis.__completion.calls.length, 1)
  assert.equal(globalThis.__completion.runs, 1)
})
