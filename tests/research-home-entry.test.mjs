import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }))

async function subject(entry) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
  })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64') + '#' + Math.random())
}

test('empty homepage input does not produce a research run route', async () => {
  const { researchEntryTarget } = await subject('../src/utils/researchHomeEntry.ts')
  assert.equal(researchEntryTarget('  ', 'local-1'), null)
})

test('a real topic stays on the original replay interface without placing its text in the URL', async () => {
  const { researchEntryTarget } = await subject('../src/utils/researchHomeEntry.ts')
  assert.deepEqual(researchEntryTarget('兼职满意度研究', 'local-1'), {
    path: '/research/replay',
    query: { task: 'local-1', autoStart: '1' },
  })
})

test('the homepage demo target resolves to one complete case with source-reported sample and PCA figures', async () => {
  const { getResearchDemoCase } = await subject('../src/data/researchDemoCases.ts')
  const demo = getResearchDemoCase('college-part-time-satisfaction-pca')
  assert.equal(demo.title, '德才\u2018兼\u2019备，机深\u2018智\u2019远——大学生兼职现状调查及影响因素研究')
  assert.equal(demo.rows.length, 6)
  assert.equal(demo.metrics.pretestSamples, 78)
  assert.equal(demo.metrics.formalAcceptedResponses, 600)
  assert.equal(demo.metrics.kmo, 0.708)
  assert.equal(demo.metrics.pcaCumulativeVariance, '67.034%')
  assert.equal(getResearchDemoCase('unknown-case'), null)
})
