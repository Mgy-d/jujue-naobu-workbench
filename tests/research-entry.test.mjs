import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const routerSource = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const prototypeSource = readFileSync(new URL('../src/views/PrototypeShell.vue', import.meta.url), 'utf8')

test('research routes do not eagerly load the legacy modeling case catalog', () => {
  assert.match(routerSource, /path: '\/', name: 'home', component: \(\) => import\('@\/views\/ResearchHomeView\.vue'\)/)
  assert.match(routerSource, /path: '\/research\/work', name: 'research-workspace'/)
  assert.doesNotMatch(mainSource, /loadOutsourcedCases/)
})

test('application sandbox shell uses the research brand', () => {
  assert.match(appSource, /<strong>市调演真<\/strong>/)
  assert.doesNotMatch(appSource, /数模演易/)
  assert.match(appSource, /PROTOTYPE_ROUTE_NAMES = new Set\(\['legacy-prototype', 'mine', 'work', 'problem'\]\)/)
})

test('legacy prototype keeps its own case catalog loading path', () => {
  assert.match(prototypeSource, /import \{ loadOutsourcedCases \} from '@\/stores\/outsourcedCases'/)
  assert.match(prototypeSource, /loadOutsourcedCases\(\)/)
})
