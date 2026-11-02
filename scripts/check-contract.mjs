/**
 * 契约自检：core.ts 里 $('id') 引用的元素，模板里到底存不存在
 *
 * 为什么需要：core.ts 是逐字搬运的原型逻辑，全部靠 id 找 DOM；模板改了 id
 * 不会报错，只会「点了没反应」。两个人同时改的时候，这是最容易互相踩到的坑。
 *
 * 用法：node scripts/check-contract.mjs [--verbose]
 * 退出码：0 = 无断链；1 = 存在断链（可直接挂到 pre-push / CI）
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const LOGIC_FILES = [
  'src/legacy/prototype/core.ts',
  'src/legacy/prototype/hooks.ts',
  'src/legacy/bridge/analysisHooks.ts',
  'src/legacy/bridge/animationHooks.ts',
  'src/legacy/bridge/codegenHooks.ts',
]
const VIEW_FILES = [
  'src/views/PrototypeShell.vue',
  'src/views/WorkbenchView.vue',
  'src/views/ArtifactView.vue',
  'src/views/FileEditorView.vue',
  'src/views/LoginView.vue',
  'src/views/CaseManagementView.vue',
]

const read = (rel) => {
  const p = path.join(ROOT, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

const uniq = (arr) => [...new Set(arr)]

// 1) 被引用：$('xxx') / getElementById('xxx') / querySelector('[id="xxx"]')
const referenced = new Map()
for (const rel of LOGIC_FILES) {
  const src = read(rel)
  const patterns = [
    /\$\(\s*'([A-Za-z0-9_-]+)'\s*\)/g,
    /\$\(\s*"([A-Za-z0-9_-]+)"\s*\)/g,
    /getElementById\(\s*'([A-Za-z0-9_-]+)'\s*\)/g,
    /getElementById\(\s*"([A-Za-z0-9_-]+)"\s*\)/g,
    /\[id=["']([A-Za-z0-9_-]+)["']\]/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(src))) {
      const id = m[1]
      if (!referenced.has(id)) referenced.set(id, new Set())
      referenced.get(id).add(rel)
    }
  }
}

// 2) 已定义：模板里的静态 id + 逻辑层自己 innerHTML 出来的动态 id
const defined = new Set()
for (const rel of [...VIEW_FILES, ...LOGIC_FILES]) {
  const src = read(rel)
  const re = /id=["']([A-Za-z0-9_-]+)["']/g
  let m
  while ((m = re.exec(src))) defined.add(m[1])
}

const broken = [...referenced.keys()].filter((id) => !defined.has(id)).sort()
const orphan = [...defined].filter((id) => !referenced.has(id)).sort()

console.log(`引用 id ${referenced.size} 个 / 已定义 id ${defined.size} 个`)
console.log(`断链 ${broken.length} 个 · 未被逻辑引用的 id ${orphan.length} 个`)

if (broken.length) {
  console.error('\n断链（逻辑层在找、模板里没有）：')
  for (const id of broken) {
    const files = [...referenced.get(id)].join(', ')
    console.error(`  - ${id}   <- ${files}`)
  }
}

if (process.argv.includes('--verbose')) {
  console.log('\n未被逻辑引用的 id（可能只是锚点，逐个人工确认）：')
  console.log(orphan.join(', ') || '  （无）')
}

process.exit(broken.length ? 1 : 0)
