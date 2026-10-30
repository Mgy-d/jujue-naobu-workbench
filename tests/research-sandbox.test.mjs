import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptsEvent, isRunning } from '../src/utils/research-sandbox-state.js'
test('sandbox rejects stale identity and out of order events', () => {
  const run = {workspaceId:'w',runId:'r',inputFingerprint:'f'}
  assert.equal(acceptsEvent(run, 2, {...run,sequence:3}),true)
  for (const change of [{runId:'old'},{workspaceId:'other'},{inputFingerprint:'old'},{sequence:2}])
    assert.equal(acceptsEvent(run,2,{...run,sequence:3,...change}),false)
})
test('execution success is terminal even when saving failed', () => {
  assert.equal(isRunning({executionStatus:'succeeded',outputStatus:'failed'}),false)
  assert.equal(isRunning({executionStatus:'queued'}),true)
  assert.equal(isRunning({executionStatus:'running'}),true)
  assert.equal(isRunning({executionStatus:'interrupted'}),false)
})
