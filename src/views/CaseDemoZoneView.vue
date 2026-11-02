<template>
  <main class="research-home">
    <header class="nav"><div class="nav-inner">
      <RouterLink class="brand" to="/"><span class="brand-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span class="brand-txt"><strong class="brand-name">市调演真</strong><small class="brand-sub">Survey Research Studio</small></span></RouterLink>
      <nav class="nav-links" aria-label="主导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/mine">我的成果</RouterLink>
      </nav>
      <div class="nav-right">
        <span v-if="userStore.isLogged">{{userStore.displayName}}</span>
        <RouterLink v-else class="btn-login" to="/login">登录 / 注册</RouterLink>
        <button v-if="userStore.isLogged" class="btn-ghost" @click="userStore.logout()">退出</button>
      </div>
    </div></header>

    <section class="hero"><div class="hero-inner">
      <div class="hero-badge"><i class="dot" aria-hidden="true"></i>案例演示专区</div>
      <h1>看一套市调研究，如何在一站式工作台里<span class="g">从想法走到可交付结论</span></h1>
      <p class="sub">本专区用一份完整的演示案例，带你走通市调大赛的七个阶段：从赛事理解、选题、研究方案，到问卷、正式调查、数据分析与报告答辩。</p>
      <div class="chips" aria-label="快速体验">
        <RouterLink class="chip" to="/research/work?mode=full">进入七阶段工作台 →</RouterLink>
        <RouterLink class="chip" to="/contest/problem/c2026-community-group-buying">浏览市调赛题 →</RouterLink>
        <RouterLink class="chip" to="/research/sandbox">打开本机沙箱 →</RouterLink>
      </div>
      <div class="hero-demo"><RouterLink class="btn-send" to="/research/replay/c2026-genz-cultural-creative">在平台复现一遍<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></RouterLink><button class="btn-ghost" type="button" @click="loadDemo">一键载入演示案例并进入工作台</button><span class="hero-demo__hint">「在平台复现一遍」进入对话式复现页：左边 AI 逐步讲解，右边同步展示分析产物；也可载入演示案例进七阶段工作台亲手操作。</span></div>
    </div></section>

    <section class="section" aria-labelledby="cap-title">
      <div class="sec-head"><h2 id="cap-title">平台能力</h2><span class="sub">一个工作台，覆盖市调研究的全流程</span></div>
      <div class="grid">
        <RouterLink v-for="cap in capabilities" :key="cap.title" class="gcard demo-cap" :to="cap.to">
          <div class="top"><span class="tag-c">{{cap.tag}}</span></div>
          <h4>{{cap.title}}</h4>
          <p>{{cap.desc}}</p>
          <div class="mtags"><span class="mtag">查看 →</span></div>
        </RouterLink>
      </div>
    </section>

    <section class="section" aria-labelledby="walk-title">
      <div class="sec-head"><h2 id="walk-title">演示案例走查</h2><span class="sub">{{demoStudy.title}}</span></div>
      <p class="demo-note">{{demoStudy.note}}</p>
      <ol class="demo-timeline">
        <li v-for="stage in demoStudy.stages" :key="stage.phase" class="demo-stage">
          <div class="demo-stage__no" aria-hidden="true">{{stage.phase}}</div>
          <div class="demo-stage__body">
            <h3>{{stage.title}}</h3>
            <p>{{stage.sample}}</p>
            <RouterLink v-if="stage.link" class="demo-stage__go" :to="stage.link">在平台中打开此阶段 →</RouterLink>
          </div>
        </li>
      </ol>
    </section>

    <ContestProblemsSection />

    <section class="section demo-cta" aria-labelledby="cta-title">
      <div class="sec-head"><h2 id="cta-title">想自己跑一遍？</h2><span class="sub">从真题复现或空白工作台开始</span></div>
      <div class="demo-cta__acts">
        <RouterLink class="btn-send" to="/research/work?mode=full">开始完整研究<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></RouterLink>
        <RouterLink class="btn-ghost" to="/contest/problem/c2026-community-group-buying">选一道市调赛题复现</RouterLink>
      </div>
    </section>

    <footer class="foot"><div class="foot-in"><strong>市调演真 · Survey Research Studio</strong><div class="grow"></div><span>面向市场调查的材料、分析与成果协作工作台</span></div></footer>
  </main>
</template>

<script setup lang="ts">
import {useRouter} from 'vue-router'
import {useUserStore} from '@/stores/user'
import {useResearchStore} from '@/stores/research'
import ContestProblemsSection from '@/components/research/ContestProblemsSection.vue'
import {buildDemoTask} from '@/utils/researchDemoSeed'
import type {RouteLocationRaw} from 'vue-router'
const router=useRouter()
const userStore=useUserStore()
const researchStore=useResearchStore()
function loadDemo(){const id=researchStore.applySeed(buildDemoTask());void router.push({path:'/research/work',query:{mode:'full',task:id}})}
interface Capability{title:string;desc:string;tag:string;to:RouteLocationRaw}
const capabilities:Capability[]=[
  {title:'七阶段研究工作台',desc:'同一份任务里从赛事理解走到报告答辩，保留来源与未知项。',tag:'核心',to:{path:'/research/work',query:{mode:'full'}}},
  {title:'市调赛题库与实训指导书',desc:'真题 + 四 Tab 指导书（指导书／流程／问卷／成果）+ 一键在平台复现。',tag:'赛题',to:{path:'/contest/problem/c2026-community-group-buying'}},
  {title:'本机沙箱数据分析',desc:'上传数据、跑描述／相关／回归统计，结果回写结论。',tag:'数据',to:{path:'/research/sandbox'}},
  {title:'报告与答辩草稿',desc:'人工起草，关联本机分析结果，避免把未执行的统计写成已验证。',tag:'成果',to:{path:'/research/work',query:{mode:'full'}}},
  {title:'阶段就绪度三档',desc:'阶段 4/6 自动给出 未开始／待补充／准备就绪 提示。',tag:'质量',to:{path:'/research/work',query:{mode:'full'}}},
  {title:'案例管理',desc:'归集演示案例与作品（需登录后查看）。',tag:'管理',to:{path:'/case-admin'}},
]
interface DemoStage{phase:number;title:string;sample:string;link?:RouteLocationRaw}
const demoStudy={
  title:'Z 世代国潮文创消费意愿调研（演示示例）',
  note:'以下为平台演示用示例数据，非真实赛事结论；正式赛题与数据以赛题库与沙箱为准。',
  stages:[
    {phase:1,title:'赛事理解',sample:'届次：2026 市调大赛 · 本科组。要求：明确研究对象与时间范围。未知项：正式通知尚未取得（阻碍当前决定）。'},
    {phase:2,title:'选题分析',sample:'核心问题：国潮文创的“文化认同”是否显著提升购买意愿？自变量：文化认同量表；因变量：购买意愿量表；控制：月可支配、城市层级。'},
    {phase:3,title:'研究方案',sample:'方法：线上问卷 + 便利抽样；目标 400 份有效问卷；周期：赛前两周；伦理：匿名、自愿。'},
    {phase:4,title:'正式调查 · 发布准备',sample:'发布渠道：校园社群 + 平台内匿名发布；对象：18–25 岁在校大学生；开始：问卷预测试通过后；停止：回收满 400 份或到期。',link:{path:'/research/work',query:{mode:'full'}}},
    {phase:5,title:'数据分析',sample:'沙箱跑：描述统计、信度（Cronbach α）、相关、分层回归。所有数字须来自已执行的统计，未跑的不写。',link:{path:'/research/sandbox'}},
    {phase:6,title:'报告与答辩',sample:'正文草稿：结论 + 局限；来源与结果引用：逐条对应沙箱输出；答辩笔记：可能的质疑与回应。须关联本机分析结果。',link:{path:'/research/work',query:{mode:'full'}}},
    {phase:7,title:'成果交付',sample:'可交付物：研究简报、问卷结构、统计报告、报告正文。状态：准备就绪（演示示例）。'},
  ] as DemoStage[],
}
</script>

<style scoped lang="scss" src="../styles/research-home.scss"></style>
<style scoped lang="scss">
.demo-note{margin:0 0 22px;padding:10px 14px;border:1px dashed var(--line);border-radius:10px;background:var(--blue-50);color:var(--ink-2);font-size:13px;line-height:1.7}
.demo-timeline{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.demo-stage{display:flex;gap:16px;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;transition:.2s}
.demo-stage:hover{border-color:var(--blue-200);box-shadow:var(--sh-2)}
.demo-stage__no{flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
.demo-stage__body{flex:1;min-width:0}
.demo-stage__body h3{font-size:16px;font-weight:700;color:var(--ink);margin-bottom:6px}
.demo-stage__body p{font-size:13.5px;color:var(--ink-2);line-height:1.8}
.demo-stage__go{display:inline-block;margin-top:8px;color:var(--blue-600);font-weight:700;font-size:13px}
.demo-cap{text-decoration:none;display:block}
.demo-cap .mtags{margin-top:14px}
.demo-cta{text-align:center}
.demo-cta__acts{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.demo-cta__acts .btn-ghost{text-decoration:none}
.hero-demo{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:22px}
.hero-demo .btn-send{white-space:nowrap}
.hero-demo__hint{font-size:13px;color:var(--ink-2);max-width:540px;line-height:1.6}
@media (max-width:640px){.hero-demo{margin-top:16px}.hero-demo__hint{max-width:none}}
</style>
