import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const utilityUrl = new URL('../src/utils/research-intake.js', import.meta.url)
const routerSource = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')

async function loadSubject() {
  assert.ok(existsSync(utilityUrl), 'research intake draft utility must be implemented')
  return import(utilityUrl.href + '?test=' + Date.now())
}

function createMemoryStorage() {
  const entries = new Map()
  return {
    getItem(key) { return entries.has(key) ? entries.get(key) : null },
    setItem(key, value) { entries.set(key, String(value)) },
    entries,
  }
}

test('dataset intake creates a local phase-0 draft without inventing server identity', async () => {
  const { createResearchIntakeDraft } = await loadSubject()
  const draft = createResearchIntakeDraft('local-draft-1', 100)

  assert.equal(draft.draftId, 'local-draft-1')
  assert.equal(draft.workflowKind, 'dataset-analysis')
  assert.equal(draft.activePhase, 0)
  assert.equal(draft.createdAt, 100)
  assert.equal('projectId' in draft, false)
  assert.equal('workflowId' in draft, false)
  assert.equal('runId' in draft, false)
})

test('selected input stores metadata only, never file content', async () => {
  const { createResearchIntakeDraft, recordSelectedInput } = await loadSubject()
  const draft = createResearchIntakeDraft('local-draft-2', 100)
  const selected = recordSelectedInput(draft, {
    name: 'synthetic-survey.csv',
    size: 45,
    lastModified: 123,
    content: 'must not persist',
  }, 200)

  assert.deepEqual(selected.inputFile, {
    name: 'synthetic-survey.csv',
    size: 45,
    lastModified: 123,
  })
  assert.equal(selected.updatedAt, 200)
  assert.equal('content' in selected.inputFile, false)
})

test('local draft save and restore keeps the selected file explicitly metadata-only', async () => {
  const { createResearchIntakeDraft, recordSelectedInput, saveResearchIntakeDraft, loadResearchIntakeDraft } = await loadSubject()
  const storage = createMemoryStorage()
  let draft = createResearchIntakeDraft('local-draft-3', 100)
  draft = recordSelectedInput(draft, { name: 'synthetic.csv', size: 12, lastModified: 90 }, 150)

  const saved = saveResearchIntakeDraft(storage, draft, 200)
  const restored = loadResearchIntakeDraft(storage)

  assert.deepEqual(restored, saved)
  const raw = storage.entries.get('refuse-naobu.research-intake.v1')
  assert.match(raw, /synthetic[.]csv/)
  assert.doesNotMatch(raw, /fileContent|contentBytes/)
})

test('corrupt local draft is ignored without being rewritten', async () => {
  const { loadResearchIntakeDraft } = await loadSubject()
  const storage = createMemoryStorage()
  storage.setItem('refuse-naobu.research-intake.v1', '{broken')

  assert.equal(loadResearchIntakeDraft(storage), null)
  assert.equal(storage.entries.get('refuse-naobu.research-intake.v1'), '{broken')
})

test('project upload, real run, and server save remain unavailable until their APIs exist', async () => {
  const { RESEARCH_INTAKE_CAPABILITIES } = await loadSubject()

  assert.equal(RESEARCH_INTAKE_CAPABILITIES.projectCreation.available, false)
  assert.equal(RESEARCH_INTAKE_CAPABILITIES.projectUpload.available, false)
  assert.equal(RESEARCH_INTAKE_CAPABILITIES.analysisRun.available, false)
  assert.equal(RESEARCH_INTAKE_CAPABILITIES.serverSave.available, false)
})

test('former intake route opens the shared research workspace without changing the legacy prototype shell', () => {
  assert.ok(routerSource.includes("path: '/research/intake'"))
  assert.ok(routerSource.includes("name: 'research-intake'"))
  assert.ok(routerSource.includes("redirect: '/research/work?mode=analysis'"))
  assert.ok(routerSource.includes('ResearchWorkspaceView'))
})
