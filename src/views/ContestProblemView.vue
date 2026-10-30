<!--
  市调大赛 · 赛题详情页（板块复现功能）。

  参考实训指导书形态复现：题面信息 + 「在平台复现这一题」「下载实训指导书」
  + 四个标签页（实训指导书 / 调研流程演示 / 问卷与分析 / 成果）。
  「在平台复现这一题」把赛题背景带入阶段 1，进入既有七阶段研究工作台；
  指导书下载为前端生成的 Markdown 文件。数据来自 src/data/contestProblems.ts
  （静态演示数据），正式保存与真实回收仍待服务端接入。
-->
<template>
  <main class="cp-view" v-if="problem">
    <header class="cp-nav">
      <div class="cp-nav-in">
        <RouterLink class="cp-brand" to="/"><span class="cp-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span><strong>市调演真</strong><small>市调大赛</small></span></RouterLink>
        <nav class="cp-navlinks" aria-label="主导航"><RouterLink to="/">首页</RouterLink><RouterLink to="/mine">我的成果</RouterLink></nav>
        <RouterLink class="cp-back" to="/">返回</RouterLink>
      </div>
    </header>

    <section class="dtop">
      <div class="dtop-in">
        <h1>{{ problem.title }}</h1>
        <p class="dmeta">
          <span>市调赛题 · 演示案例</span><i />
          <span>年份：{{ problem.year }}</span><i />
          <span>层次：{{ problem.level }}</span><i />
          <span>难度：{{ problem.difficulty }}</span><i />
          <span>建议团队：{{ problem.team }}</span><i />
          <span>{{ problem.views }}</span>
        </p>
        <div class="dacts">
          <button type="button" class="w o" @click="reproduce">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            在平台复现这一题
          </button>
          <button type="button" class="w" @click="downloadGuide">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
            下载实训指导书
          </button>
        </div>
      </div>
    </section>

    <nav class="tabs" aria-label="赛题内容">
      <div class="tabs-in">
        <button v-for="tab in TABS" :key="tab.id" type="button" class="tab" :class="{ on: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
      </div>
    </nav>

    <div class="dbody">
      <!-- 实训指导书：左侧目录 + 正文 -->
      <section v-if="activeTab === 'guide'" class="panel on">
        <div class="guide-grid">
          <aside class="toc" aria-label="实训指导书目录">
            <p class="tt">实训指导书目录</p>
            <a v-for="(chapter, index) in problem.guide" :key="chapter.id" :href="`#cp-${chapter.id}`" class="toc-item">{{ index + 1 }}. {{ chapter.title.replace(/^[一二三四五六]、/, '') }}</a>
          </aside>
          <article class="doc">
            <header class="doc-head">
              <h3>《{{ problem.title }}》实训指导书</h3>
              <p>市调赛题 · 演示案例 · 实训指导书 · {{ problem.wordCount }} · {{ problem.duration }}</p>
            </header>
            <p class="lead">{{ problem.summary }}</p>
            <section v-for="chapter in problem.guide" :key="chapter.id" :id="`cp-${chapter.id}`" class="chapter">
              <h4>{{ chapter.title }}</h4>
              <p v-for="(paragraph, index) in chapter.paragraphs" :key="index">{{ paragraph }}</p>
              <ul v-if="chapter.bullets">
                <li v-for="(bullet, index) in chapter.bullets" :key="index">{{ bullet }}</li>
              </ul>
              <aside v-if="chapter.callout" class="callout">{{ chapter.callout }}</aside>
            </section>
          </article>
        </div>
      </section>

      <!-- 调研流程演示 -->
      <section v-else-if="activeTab === 'demo'" class="panel on">
        <h3 class="ph">调研流程演示</h3>
        <p class="ph-sub">完整调研的分步示意；本页为流程演示，真实数据采集与正式保存待接入。</p>
        <ol class="demo-steps">
          <li v-for="(step, index) in problem.demo" :key="step.title">
            <span class="no">{{ index + 1 }}</span>
            <div><strong>{{ step.title }}</strong><p>{{ step.desc }}</p></div>
          </li>
        </ol>
      </section>

      <!-- 问卷与分析 -->
      <section v-else-if="activeTab === 'quiz'" class="panel on">
        <h3 class="ph">问卷与量表</h3>
        <p class="ph-sub">{{ problem.questionnaire.intro }}</p>
        <table class="dtable">
          <thead><tr><th>维度</th><th>示例题项</th><th>量表</th></tr></thead>
          <tbody>
            <tr v-for="item in problem.questionnaire.items" :key="item.dimension">
              <td>{{ item.dimension }}</td><td>{{ item.sample }}</td><td>{{ item.scale }}</td>
            </tr>
          </tbody>
        </table>
        <h3 class="ph">{{ problem.questionnaire.codeCaption }}</h3>
        <pre class="codeblock"><code>{{ problem.questionnaire.code }}</code></pre>
      </section>

      <!-- 成果 -->
      <section v-else class="panel on">
        <h3 class="ph">成果示例</h3>
        <p class="ph-sub">{{ problem.results.intro }}</p>
        <table class="dtable">
          <thead><tr><th>问题</th><th>方法</th><th>关键发现</th></tr></thead>
          <tbody>
            <tr v-for="row in problem.results.rows" :key="row.question">
              <td>{{ row.question }}</td><td>{{ row.method }}</td><td>{{ row.finding }}</td>
            </tr>
          </tbody>
        </table>
        <aside class="callout">{{ problem.results.note }}</aside>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getContestProblem } from '@/data/contestProblems'

const TABS = [
  { id: 'guide', label: '实训指导书' },
  { id: 'demo', label: '可视化演示' },
  { id: 'quiz', label: '代码' },
  { id: 'result', label: '成果' },
] as const

const route = useRoute()
const router = useRouter()
const activeTab = ref<(typeof TABS)[number]['id']>('guide')

const problem = computed(() => getContestProblem(route.params.id as string | undefined))

watch(() => route.params.id, () => { activeTab.value = 'guide' })

watch(problem, (value) => {
  if (!value) void router.replace('/')
}, { immediate: true })

/** 复现：进入案例复现页（左 AI 对话步进 + 右产物查看，数模演易式）。 */
function reproduce(): void {
  const current = problem.value
  if (!current) return
  void router.push({ path: `/research/replay/${current.id}` })
}

/** 指导书下载：前端生成 Markdown 文件（演示功能，正式版本待服务端接入）。 */
function downloadGuide(): void {
  const current = problem.value
  if (!current) return
  const lines: string[] = [
    `# 《${current.title}》实训指导书`,
    '',
    `市调赛题 · 演示案例 · ${current.wordCount} · ${current.duration}`,
    '',
    current.summary,
    '',
  ]
  for (const chapter of current.guide) {
    lines.push(`## ${chapter.title}`, '')
    for (const paragraph of chapter.paragraphs) lines.push(paragraph, '')
    for (const bullet of chapter.bullets ?? []) lines.push(`- ${bullet}`)
    if (chapter.bullets?.length) lines.push('')
    if (chapter.callout) lines.push(`> ${chapter.callout}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${current.title}·实训指导书.md`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.cp-view{--teal-700:#0B6E68;--teal-600:#0E8F84;--teal-500:#12A594;--blue-600:#1E6FA8;--blue-800:#0E8F84;--blue-700:#12A594;--blue-100:#DFF4F1;--blue-50:#EFFAF8;--bg:#F3FAFA;--ink:#0B2E36;--ink-2:#3D6570;--ink-3:#7C99A1;--line:#DCEDEE;--line-2:#EAF5F5;--grad:linear-gradient(120deg,#12A594 0%,#1E9FC4 100%);--sh-1:0 2px 8px rgba(11,110,104,.06);min-height:100vh;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.7}
.cp-nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.cp-nav-in{max-width:1280px;margin:0 auto;padding:0 32px;height:60px;display:flex;align-items:center;gap:18px}
.cp-brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none}
.cp-brand strong{font-size:16px;font-weight:800;color:var(--teal-700)}
.cp-brand small{display:block;font-size:10px;color:var(--ink-3);margin-top:-2px}
.cp-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--grad);color:#fff}
.cp-plate{margin-left:8px;padding:5px 12px;border-radius:999px;background:var(--blue-50);border:1px solid var(--line);color:var(--blue-700);font-size:12px;font-weight:600}
.cp-navlinks{display:flex;align-items:center;gap:6px;margin-left:14px}
.cp-navlinks a{padding:8px 16px;border-radius:9px;color:var(--ink-2);font-size:13.5px;font-weight:600;text-decoration:none}
.cp-navlinks a:hover{background:var(--blue-50);color:var(--blue-700)}
.cp-back{margin-left:auto;padding:7px 14px;border-radius:9px;color:var(--ink-2);font-size:13px;font-weight:600;text-decoration:none}
.cp-back:hover{background:var(--blue-50);color:var(--blue-700)}
.dtop{background:linear-gradient(180deg,#EFFAF8 0%,#F3FAFA 100%);border-bottom:1px solid var(--line)}
.dtop-in{max-width:1280px;margin:0 auto;padding:30px 32px 22px}
.dtop h1{margin:0 0 10px;font-size:26px;line-height:1.35;color:var(--teal-700)}
.dmeta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:0 0 16px;font-size:12.5px;color:var(--ink-2)}
.dmeta i{width:1px;height:12px;background:var(--line)}
.dacts{display:flex;gap:12px;flex-wrap:wrap}
.dacts .w{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink-2);font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:var(--sh-1)}
.dacts .w.o{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 6px 16px rgba(11,110,104,.3)}
.dacts .w:hover{filter:brightness(1.04)}
.tabs{background:#fff;border-bottom:1px solid var(--line)}
.tabs-in{max-width:1280px;margin:0 auto;padding:0 32px;display:flex;gap:4px;overflow-x:auto}
.tab{padding:13px 16px;font-size:14px;font-weight:600;color:var(--ink-2);border-bottom:2px solid transparent;white-space:nowrap;cursor:pointer;background:none}
.tab:hover{color:var(--blue-700)}
.tab.on{color:var(--blue-800);border-bottom-color:var(--blue-600)}
.dbody{max-width:1280px;margin:0 auto;padding:24px 32px 56px}
.panel{animation:cp-fade .25s ease}
@keyframes cp-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.guide-grid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:28px;align-items:start}
.toc{position:sticky;top:84px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--sh-1)}
.toc .tt{margin:0 0 10px;font-size:12px;font-weight:700;color:var(--teal-700)}
.toc-item{display:block;padding:7px 8px;border-radius:8px;color:var(--ink-2);font-size:12.5px;text-decoration:none}
.toc-item:hover{background:var(--blue-50);color:var(--blue-700)}
.doc{padding:26px 30px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--sh-1)}
.doc-head h3{margin:0 0 6px;font-size:19px;color:var(--teal-700)}
.doc-head p{margin:0 0 14px;font-size:12px;color:var(--ink-3)}
.lead{margin:0 0 8px;padding:14px 16px;border-left:3px solid var(--teal-500);border-radius:0 10px 10px 0;background:var(--blue-50);font-size:13.5px;color:var(--ink-2)}
.chapter{padding:18px 0 6px;border-bottom:1px dashed var(--line)}
.chapter:last-child{border-bottom:none}
.chapter h4{margin:6px 0 10px;font-size:15.5px;color:var(--teal-700)}
.chapter p{margin:0 0 10px;font-size:13.5px;color:var(--ink-2)}
.chapter ul{margin:0 0 10px;padding-left:20px}
.chapter li{margin-bottom:4px;font-size:13.5px;color:var(--ink-2)}
.callout{margin:10px 0 14px;padding:12px 16px;border:1px solid #ecd9a8;border-radius:10px;background:#fdf6e4;color:#6b5316;font-size:13px}
.ph{margin:4px 0 6px;font-size:18px;color:var(--teal-700)}
.ph-sub{margin:0 0 18px;font-size:12.5px;color:var(--ink-3)}
.demo-steps{display:grid;gap:12px;margin:0;padding:0;list-style:none;counter-reset:none}
.demo-steps li{display:flex;gap:14px;padding:14px 18px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:var(--sh-1)}
.demo-steps .no{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--blue-100);color:var(--teal-700);font-weight:700;font-size:13px}
.demo-steps strong{display:block;margin-bottom:2px;font-size:14px;color:var(--ink)}
.demo-steps p{margin:0;font-size:12.5px;color:var(--ink-2)}
.dtable{width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.dtable th,.dtable td{padding:10px 14px;border-bottom:1px solid var(--line-2);text-align:left}
.dtable th{background:var(--blue-50);color:var(--teal-700);font-weight:700}
.dtable tbody tr:last-child td{border-bottom:none}
.dtable tbody tr:hover{background:var(--blue-50)}
.codeblock{margin:0 0 8px;padding:16px 18px;border:1px solid var(--line);border-radius:12px;background:#0d2b2b;color:#c7e8e0;font-size:12.5px;line-height:1.8;overflow:auto}
@media(max-width:820px){.guide-grid{grid-template-columns:1fr}.toc{position:static}.dtop-in,.tabs-in,.dbody,.cp-nav-in{padding-left:18px;padding-right:18px}.dtop h1{font-size:21px}}
button:focus-visible,.toc-item:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}
</style>
