<!--
  市调演真 · 我的成果（对齐数模演易「我的成果」视图）。

  两块内容：
   1. 本机研究任务 —— 来自 researchStore 的本机草稿，可打开/删除，进度对应七阶段；
   2. 示例成果 —— 市调赛题库静态演示卡片，可跳实训指导书或案例复现。
  全部为本机/演示数据：不臆造服务端成果，分享开关仅本次访问有效。
-->
<template>
  <main class="research-home">
    <header class="nav"><div class="nav-inner">
      <RouterLink class="brand" to="/"><span class="brand-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span class="brand-txt"><strong class="brand-name">市调演真</strong><small class="brand-sub">Survey Research Studio</small></span></RouterLink>
      <nav class="nav-links" aria-label="主导航"><RouterLink to="/">首页</RouterLink><RouterLink class="on" to="/mine">我的成果</RouterLink></nav>
      <div class="nav-right">
        <span v-if="userStore.isLogged">{{userStore.displayName}}</span>
        <RouterLink v-else class="btn-login" to="/login">登录 / 注册</RouterLink>
        <button v-if="userStore.isLogged" class="btn-ghost" @click="userStore.logout()">退出</button>
      </div>
    </div></header>

    <section class="mine-body">
      <div class="mine-head">
        <div><h1>我的成果</h1><p class="mine-sub">本机研究任务保存在当前浏览器；示例成果为演示数据，不是你的真实成果。</p></div>
        <div class="grow"></div>
        <RouterLink class="btn-send" to="/">新建研究任务<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg></RouterLink>
      </div>

      <section class="section" aria-labelledby="mine-tasks-title">
        <div class="sec-head"><h2 id="mine-tasks-title">本机研究任务</h2><span class="sub">{{tasks.length}} 项 · 每项任务独立保留草稿</span></div>
        <div v-if="tasks.length" class="task-grid">
          <article v-for="item in tasks" :key="item.localTaskId" class="gcard task-card" :class="{unsaved:!item.savedAt}">
            <div class="top"><span class="tag-c">{{modeLabel(item.workflowKind)}}</span><span class="mtag">{{item.savedAt?'已存本机':'待保存'}}</span></div>
            <h4 :title="item.title||modeLabel(item.workflowKind)">{{item.title||modeLabel(item.workflowKind)}}</h4>
            <p>进度：{{stageLabel(item.workflowKind,item.viewedPhase)}} · 更新于 {{new Date(item.updatedAt).toLocaleString()}}</p>
            <div class="task-acts">
              <RouterLink class="btn-open" :to="{path:'/research/replay',query:{task:item.localTaskId}}" title="对话式复现：左 AI 讲解 + 右产物查看">打开任务 →</RouterLink>
              <RouterLink class="btn-ws" :to="{path:'/research/work',query:{mode:kindToMode(item.workflowKind),task:item.localTaskId}}" title="七阶段工作台：填写与保存草稿">工作台 →</RouterLink>
              <button type="button" class="btn-del" @click="removeTask(item)">删除</button>
            </div>
          </article>
        </div>
        <div v-else class="empty-card">
          <h3>还没有生成任何成果</h3>
          <p>去首页输入一道研究题目，或载入演示案例，七阶段工作台会带你逐步完成。</p>
          <div class="empty-acts"><RouterLink class="btn-send" to="/">去首页开始研究</RouterLink><RouterLink class="btn-ghost" to="/case-demo">载入演示案例</RouterLink></div>
        </div>
      </section>

      <section class="section" aria-labelledby="mine-demo-title">
        <div class="sec-head"><h2 id="mine-demo-title">示例成果</h2><span class="sub">预置市调赛题的演示成果；分享开关仅演示交互，不会公开文件</span></div>
        <div class="task-grid">
          <article v-for="problem in problems" :key="problem.id" class="gcard">
            <div class="top"><span class="tag-c">市调赛题 · 演示</span><span class="mtag">{{problem.difficulty}} · {{problem.team}}</span></div>
            <h4 :title="problem.title">{{problem.title}}</h4>
            <p>{{problem.summary}}</p>
            <div class="mtags"><span class="mtag">{{problem.year}}</span><span class="mtag">{{problem.level}}</span><span class="mtag">{{problem.views}}</span></div>
            <div class="task-acts">
              <button type="button" class="btn-share" :class="{on:shared[problem.id]}" @click="shared[problem.id]=!shared[problem.id]">{{shared[problem.id]?'已开启分享（演示）':'分享（演示）'}}</button>
              <RouterLink class="btn-open" :to="`/contest/problem/${problem.id}`">实训指导书 →</RouterLink>
              <RouterLink class="btn-open" :to="`/research/replay/${problem.id}`">复现 →</RouterLink>
            </div>
          </article>
        </div>
      </section>
    </section>

    <footer class="foot"><div class="foot-in"><strong>市调演真 · Survey Research Studio</strong><div class="grow"></div><span>面向市场调查的材料、分析与成果协作工作台</span></div></footer>
  </main>
</template>

<script setup lang="ts">
import {reactive,computed} from 'vue'
import {useUserStore} from '@/stores/user'
import {useResearchStore} from '@/stores/research'
import {CONTEST_PROBLEMS} from '@/data/contestProblems'
import {kindToMode,stagesFor,workflowLabel} from '@/utils/researchDrafts'
import type {WorkflowKind} from '@/types/research-contracts'

const userStore=useUserStore(),researchStore=useResearchStore()
const problems=CONTEST_PROBLEMS
const shared=reactive<Record<string,boolean>>({})
const tasks=computed(()=>Object.values(researchStore.registry.tasks).sort((a,b)=>b.updatedAt-a.updatedAt))
function modeLabel(kind:WorkflowKind){return workflowLabel(kind)}
function stageLabel(kind:WorkflowKind,phase:number){return stagesFor(kind)[phase]?.title??'—'}
function removeTask(item:{localTaskId:string;title:string}){
  const label=item.title||'未命名任务'
  if(!window.confirm(`删除研究任务「${label}」及其本机草稿？此操作不可恢复。`))return
  researchStore.remove(item.localTaskId)
}
</script>

<style scoped lang="scss" src="../styles/research-home.scss"></style>
<style scoped>
.mine-body{max-width:1280px;margin:0 auto;padding:36px 32px 64px}
.mine-head{display:flex;align-items:flex-end;gap:16px;margin-bottom:26px}
.mine-head h1{margin:0 0 6px;font-size:26px;color:#0b6e68}
.mine-sub{margin:0;font-size:13px;color:#57727c}
.task-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.task-card h4{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.task-card p{font-size:12.5px;color:#57727c}
.task-card.unsaved{border-color:#e4c98d}
.task-acts{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.btn-open,.btn-del,.btn-share,.btn-ws{padding:7px 12px;border-radius:8px;border:1px solid #d5e8e4;background:#fff;color:#0b6e68;font-size:12.5px;font-weight:600;text-decoration:none;cursor:pointer}
.btn-open:hover,.btn-ws:hover{background:#effaf8}
.btn-ws{color:#57727c;border-color:#e0ebe8}
.btn-del{border-color:#e8d5d5;color:#a04b4b}
.btn-del:hover{background:#fbf2f2}
.btn-share{border-color:#d5e8e4;color:#57727c}
.btn-share.on{background:#dff4f1;border-color:#9fd8cf;color:#0b6e68}
.empty-card{padding:44px 32px;border:1px dashed #b8d4cf;border-radius:16px;background:#fff;text-align:center}
.empty-card h3{margin:0 0 8px;font-size:17px;color:#0b2e36}
.empty-card p{margin:0 0 18px;font-size:13px;color:#57727c}
.empty-acts{display:flex;justify-content:center;gap:12px}
@media(max-width:820px){.mine-body{padding:24px 18px 48px}.mine-head{flex-direction:column;align-items:flex-start}}
</style>
