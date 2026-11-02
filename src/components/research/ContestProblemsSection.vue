<!--
  首页 · 市调赛题卡片区（板块复现功能入口）。

  展示市调大赛赛题库（src/data/contestProblems.ts，静态演示数据），
  点击卡片进入赛题详情页（ContestProblemView），在详情页可「在平台复现这一题」。
  样式复用首页 .research-home 上定义的青绿色系 CSS 变量（级联生效）。
-->
<template>
  <section class="section" aria-labelledby="contest-title">
    <div class="sec-head">
      <h2 id="contest-title">市调赛题</h2>
      <span class="sub">真题演练 · 查看实训指导书，在平台复现完整调研流程</span>
    </div>
    <div class="contest-grid">
      <article v-for="problem in problems" :key="problem.id" class="contest-card">
        <div class="top">
          <span class="tag-c">市调赛题 · 演示</span>
          <span class="diff" :class="diffClass(problem.difficulty)">{{ problem.difficulty }}</span>
        </div>
        <h4>{{ problem.title }}</h4>
        <p class="brief">{{ problem.summary }}</p>
        <div class="meta">
          <span>{{ problem.year }} 年</span><i /><span>{{ problem.level }}</span><i /><span>{{ problem.team }}组队</span><i /><span>{{ problem.views }}</span>
        </div>
        <div class="foot">
          <button type="button" class="detail" @click="open(problem.id)">查看赛题详情<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          <button type="button" class="repro" @click="reproduce(problem.id)">在平台复现这一题</button>
        </div>
      </article>
    </div>
    <p class="scope-note">赛题为板块演示数据；「在平台复现这一题」进入对话式复现页（AI 逐步讲解 + 产物查看），正式保存与阶段确认仍待服务端接入。</p>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CONTEST_PROBLEMS } from '@/data/contestProblems'

const problems = CONTEST_PROBLEMS
const router = useRouter()

function open(id: string): void {
  void router.push({ path: `/contest/problem/${id}` })
}

/** 直接复现：进入对话式案例复现页（左 AI 讲解 + 右产物查看）。 */
function reproduce(id: string): void {
  void router.push({ path: `/research/replay/${id}` })
}

function diffClass(difficulty: string): string {
  if (difficulty === '较难') return 'hard'
  if (difficulty === '简单') return 'easy'
  return 'mid'
}
</script>

<style scoped>
.contest-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}
.contest-card{display:flex;flex-direction:column;gap:10px;padding:20px;border:1px solid var(--line,#DCEDEE);border-radius:16px;background:#fff;box-shadow:var(--sh-1,0 2px 8px rgba(11,110,104,.06));transition:.18s}
.contest-card:hover{box-shadow:var(--sh-2,0 10px 30px rgba(11,110,104,.09));transform:translateY(-2px)}
.contest-card .top{display:flex;align-items:center;gap:8px}
.tag-c{padding:4px 10px;border-radius:999px;background:var(--blue-100,#DFF4F1);color:var(--blue-800,#0E8F84);font-size:11.5px;font-weight:700}
.diff{margin-left:auto;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
.diff.mid{background:#fdf6e4;color:#8a6a2f}
.diff.hard{background:#fdeae5;color:#a14332}
.diff.easy{background:#e7f5ec;color:#2b7a52}
.contest-card h4{margin:0;font-size:15.5px;line-height:1.45;color:var(--ink,#0B2E36)}
.brief{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:0;font-size:12.5px;line-height:1.75;color:var(--ink-2,#3D6570)}
.meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;font-size:11.5px;color:var(--ink-3,#7C99A1)}
.meta i{width:1px;height:10px;background:var(--line,#DCEDEE)}
.foot{display:flex;gap:10px;margin-top:auto;padding-top:6px}
.foot button{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer}
.foot .detail{border:1px solid var(--line,#DCEDEE);background:#fff;color:var(--blue-700,#12A594)}
.foot .detail:hover{background:var(--blue-50,#EFFAF8)}
.foot .repro{border:none;background:var(--grad,linear-gradient(120deg,#12A594,#1E9FC4));color:#fff}
.foot .repro:hover{filter:brightness(1.05)}
.scope-note{margin:14px 0 0;font-size:12px;color:var(--ink-3,#7C99A1)}
button:focus-visible{outline:3px solid #8bbba5;outline-offset:3px}
</style>
