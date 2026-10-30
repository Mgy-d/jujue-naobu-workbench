<!--
  市调演真 · 案例复现（完全对齐数模演易原型 v2 的工作台复现形态）。

  结构：wtop（返回 + 题号 + 标题 + 编号步骤条 + 环境徽章 + 状态章 + 我有问题/回到上一步 + 收起产物）
        wbody（左：AI 对话流 + 输入台 + 快捷指令；右：产物抽屉——可视化演示/问题分析/报告初稿）。
  交互节奏与原型一致：AI「正在思考」→ 出卡片 → 产物自动弹出到右侧 → 你说一句（发送或点快捷指令）它才走一步。

  双模式数据源：
   A. 赛题复现  /research/replay/:id        —— 内容来自 src/data/contestProblems.ts（市调静态演示库）。
   B. 任务复现  /research/replay?task=xx   —— 内容来自本机研究任务（researchStore）：
        全局分析=赛事理解+任务背景，步骤=工作流阶段（选题分析/研究方案/问卷设计与预测试/正式调查/数据分析…），
        报告步=报告与答辩。工作台编辑入口保留在报告卡与快捷指令里。
  可视化演示为按步骤生成的示意图形（内联 SVG，演示口径），可导出 HTML。
-->
<template>
  <main class="replay" v-if="src">
    <!-- ===== 顶栏 ===== -->
    <div class="wtop">
      <RouterLink class="icon-btn" :to="src.backTo" title="返回">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
      </RouterLink>
      <span class="wtb">{{ src.tag }}</span>
      <div class="wt" :title="src.title">{{ src.title }}</div>
      <div class="steps" role="tablist" aria-label="复现步骤">
        <template v-for="(label,index) in stepLabels" :key="label">
          <span v-if="index" class="step-line" aria-hidden="true"></span>
          <span class="step" :class="{done:index<cur,now:index===cur,clickable:index<=maxStep}" role="tab" :aria-selected="index===cur" @click="jumpStep(index)">
            <span class="n">{{ index<cur?'✓':index+1 }}</span>{{ label }}
          </span>
        </template>
      </div>
      <span class="env-badge" :class="{inactive:!envReady}"><span>{{ envReady?'演示环境就绪':'未创建环境' }}</span></span>
      <span class="stag" :class="{done:finished}"><i aria-hidden="true"></i>{{ stagText }}</span>
      <div class="flow-tools">
        <button type="button" class="flow-tool" title="暂停当前流程，先问一个问题" @click="askPause">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1.1-1.5 2.2" /><path d="M12 17h.01" /></svg>
          我有问题
        </button>
        <button type="button" class="flow-tool" title="回到上一步重新看" :disabled="!canBack" @click="backStep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4" /><path d="M5 10h8a6 6 0 0 1 6 6v2" /></svg>
          回到上一步
        </button>
      </div>
      <div class="grow"></div>
      <button type="button" class="flow-tool" @click="drawerOpen=!drawerOpen">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path v-if="drawerOpen" d="M18 6L6 18M6 6l12 12" /><path v-else d="M9 9h6v6H9z" /><path v-if="!drawerOpen" d="M3 3h18v18H3z" /></svg>
        {{ drawerOpen?'收起产物':'展开产物' }}
      </button>
    </div>

    <!-- ===== 主体：左对话 + 右产物 ===== -->
    <div class="wbody">
      <div class="chat">
        <div ref="streamEl" class="stream">
          <div class="stream-in">
            <div v-for="m in messages" :key="m.key" class="msg" :class="m.who">
              <div class="bubble">
                <div class="txt" v-html="m.html"></div>
                <div v-if="m.arts&&m.arts.length" class="arts">
                  <button v-for="(art,ai) in m.arts" :key="ai" type="button" class="acard" :class="{open:openKey===m.key+'-'+ai}" @click="viewArt(art,m.key+'-'+ai)">
                    <span v-if="art.auto" class="auto">自动弹出</span>
                    <span class="ai" :style="{background:artGrad(art.kind)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="art.kind==='analysis'" d="M9 18h6M10 22h4" /><path v-if="art.kind==='analysis'" d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /><path v-if="art.kind==='animation'" d="M3 3v17a1 1 0 0 0 1 1h17" /><rect v-if="art.kind==='animation'" x="7" y="12" width="3" height="6" /><rect v-if="art.kind==='animation'" x="12.5" y="8" width="3" height="10" /><rect v-if="art.kind==='animation'" x="18" y="4.5" width="3" height="13.5" /><path v-if="art.kind==='paper'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path v-if="art.kind==='paper'" d="M14 2v6h6" /></svg></span>
                    <span class="at"><b>{{ art.title }}</b><span>{{ art.sub }}</span></span>
                    <span class="arrow">查看<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="thinkingOn" class="msg ai"><div class="bubble"><span class="thinking"><i></i><i></i><i></i>AI 正在思考</span></div></div>
          </div>
        </div>
        <div class="composer-bar">
          <div class="cw">
            <div class="composer">
              <label class="sr-only" for="replay-input">对话输入</label>
              <textarea id="replay-input" v-model="draft" rows="2" :placeholder="inputPlaceholder" @keydown.enter.exact.prevent="send()"></textarea>
              <div class="cbar">
                <button type="button" class="btn-ghost" @click="pickFile">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
                  上传文件
                </button>
                <span class="hint">可继续补充数据或题目要求（演示模式：仅在本机回显）</span>
                <div class="spacer"></div>
                <button type="button" class="btn-send" @click="send()">
                  发送
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
            <div class="chips-row">
              <span class="whint"><i aria-hidden="true"></i>{{ chipsHint }}</span>
              <button v-for="chip in chips" :key="chip" type="button" class="chip" @click="quickSay(chip)">{{ chip }}</button>
            </div>
          </div>
        </div>
      </div>

      <aside class="drawer" :class="{on:drawerOpen}" aria-label="产物预览">
        <div class="dh">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>
          <h3>{{ drawerTitle }}<span class="sub">{{ drawerSub }}</span></h3>
          <button type="button" class="icon-btn" title="收起产物" @click="drawerOpen=false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="db">
          <template v-if="openArt">
            <!-- 可视化演示 -->
            <template v-if="openArt.kind==='animation'">
              <div class="stage" v-html="animSvg(openArt.index)"></div>
              <div class="card">
                <div class="card-h"><h3>演示列表（按流程生成）</h3><span class="tag-c">已生成 {{ animBank.length }} / {{ totalDemos }}</span></div>
                <div class="card-b tight">
                  <button v-for="q in animBank" :key="q.k" type="button" class="acard mini" :class="{open:openArt.index===q.k}" @click="switchAnim(q.k)">
                    <span class="ai num" :style="{background:'linear-gradient(120deg,#12A594,#1E9FC4)'}">{{ q.k+1 }}</span>
                    <span class="at"><b>{{ q.title }}</b><span>{{ q.sub }} · 点击回看</span></span>
                    <span class="arrow">播放</span>
                  </button>
                </div>
              </div>
              <div class="card">
                <div class="card-h"><h3>演示说明</h3></div>
                <div class="card-b">
                  <p class="side-note">{{ src.intro }}演示由平台按步骤自动生成，用于把调研流程与统计口径"可视化表达"；正式图表待真实数据接入后替换。</p>
                  <div class="legend">
                    <div><i style="background:#2EC4B0"></i>计划 / 设计侧结果（抽样、量表、发放节奏）</div>
                    <div><i style="background:#F5A623"></i>实际 / 回收侧结果（回收率、有效率、偏差）</div>
                    <div><i style="background:#7FE0A8"></i>关键识别点（口径分界、分层节点）</div>
                  </div>
                  <div class="exp-row"><button type="button" class="dl" @click="exportAnim">导出 HTML（答辩可用）</button></div>
                </div>
              </div>
            </template>
            <!-- 问题分析 -->
            <div v-else-if="openArt.kind==='analysis'" class="card">
              <div class="card-h"><h3>{{ openArt.title }}</h3></div>
              <div class="card-b" v-html="analysisHtml(openArt.index)"></div>
            </div>
            <!-- 报告初稿 -->
            <div v-else class="card">
              <div class="card-h"><h3>报告初稿 <span class="tag-c">v1</span></h3></div>
              <div class="card-b" v-html="paperHtml()"></div>
              <div class="card-b col">
                <button type="button" class="dl" @click="downloadReport">下载报告初稿（Markdown）</button>
                <RouterLink v-if="src.workspaceLink" class="dl ghost" :to="src.workspaceLink">进入七阶段工作台编辑本任务 →</RouterLink>
              </div>
            </div>
          </template>
          <div v-else class="anim-empty">产物会随流程逐步生成：走到「全局分析」后，第一份分析产物与演示一会出现在这里；之后每走一步多一份。未走到的步骤不会提前出现。</div>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import {computed,nextTick,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {getContestProblem} from '@/data/contestProblems'
import {useResearchStore} from '@/stores/research'
import {kindToMode,stagesFor,workflowLabel} from '@/utils/researchDrafts'
import type {WorkflowKind,LocalResearchTask} from '@/types/research-contracts'

const NUMS=['一','二','三','四','五','六','七','八','九','十']
const cn=(n:number)=>NUMS[n-1]??String(n)
const route=useRoute(),router=useRouter(),researchStore=useResearchStore()

/* ---------- 归一化数据源：赛题 / 本机任务 ---------- */
/* 统一七阶段骨架：全局分析 + 六个阶段步骤 + 报告与答辩（赛题/任务两种模式共用同一节奏）。 */
const STAGE_LABELS=['赛事理解','选题分析','研究方向','问卷与测试','正式调查','数据分析'] as const
const PAPER_LABEL='报告与答辩'
const cut=(s:string,n:number)=>s.length>n?s.slice(0,n)+'…':s
interface ReplayRow{label:string;question:string;method:string;finding:string}
interface ReplaySource{
  tag:string;title:string;summary:string;intro:string;note:string;
  rows:ReplayRow[];info:string[];callout?:string;
  items:{dimension:string;sample:string;scale:string}[];
  attach:string;toc:string[];backTo:string;workspaceLink?:string;
}
const task=computed<LocalResearchTask|undefined>(()=>{
  const id=route.query.task
  return id?researchStore.registry.tasks[String(id)]:undefined
})
const problem=computed(()=>task.value?undefined:getContestProblem(route.params.id as string|undefined))
const src=computed<ReplaySource|undefined>(()=>{
  if(problem.value){
    const p=problem.value
    const R=p.results.rows
    const q0=p.questionnaire.items[0]
    const rows:ReplayRow[]=[
      {label:'赛事理解',question:'通读题目背景与要求，明确研究对象与任务边界',method:'拆出已知信息、需要回答的问题与限制条件，形成任务清单。',finding:'关键口径：'+(p.guide[0]?.bullets?.[0]??'先界定对象与总体，再定抽样方式')},
      {label:'选题分析',question:'把背景拆解成可研究的问题，论证选题价值与创新点',method:'从题目要求出发拆解研究问题清单，明确每个问题的回答口径。',finding:'共拆解出 '+R.length+' 个研究问题，首个：'+cut(R[0]?.question??'',40)},
      {label:'研究方向',question:'确定调查方式、抽样设计与分析方法',method:'比较可行的调查方式与抽样方案，选定与问题匹配的分析路线。',finding:'拟采用：'+cut(R[0]?.method??'',44)},
      {label:'问卷与测试',question:'设计量表与题项，完成小样本预测试',method:'按研究问题设计量表维度与题项，小样本预测试检验信度与题项质量。',finding:q0?'量表示例：'+q0.dimension+'（'+q0.scale+'）':'量表设计待接入真实题项。'},
      {label:'正式调查',question:'组织问卷发放与数据回收',method:'确定发布渠道、调查对象、开始条件与停止规则，组织数据回收。',finding:'演示口径：按计划渠道发放，回收后逐份核查有效性并记录回收率。'},
      {label:'数据分析',question:'清洗数据并完成统计分析，输出关键发现',method:'数据清洗 → 描述统计 → 交叉与相关分析，逐一回答研究问题。',finding:R[R.length-1]?.finding??'分析结论待真实数据接入后补充。'},
    ]
    return{
      tag:'市调赛题（演示）',title:p.title,summary:p.summary,intro:p.results.intro,note:p.results.note,
      rows,
      info:p.guide[0]?.bullets??[],callout:p.guide[0]?.callout,
      items:p.questionnaire.items.map(it=>({dimension:it.dimension,sample:it.sample,scale:it.scale})),
      attach:'附件：实训指导书（'+p.wordCount+'）、问卷量表（'+p.questionnaire.items.length+' 个维度）、示例回收数据（演示口径）',
      toc:[...STAGE_LABELS,PAPER_LABEL],
      backTo:'/contest/problem/'+p.id,
    }
  }
  const t=task.value
  if(!t)return undefined
  const kind:WorkflowKind=t.workflowKind,label=workflowLabel(kind)
  const stages=stagesFor(kind)
  const rows:ReplayRow[]=[
    {label:'赛事理解',question:'通读任务背景与要求，明确研究对象与任务边界',method:'拆出已知信息、需要回答的问题与限制条件，形成任务清单。',finding:''},
    {label:'选题分析',question:'把背景拆解成可研究的问题，论证选题价值与创新点',method:'从背景出发拆解研究问题清单，明确每个问题的回答口径。',finding:''},
    {label:'研究方向',question:'确定调查方式、抽样设计与分析方法',method:'比较可行的调查方式与抽样方案，选定与问题匹配的分析路线。',finding:''},
    {label:'问卷与测试',question:'设计量表与题项，完成小样本预测试',method:'按研究问题设计量表维度与题项，小样本预测试检验信度与题项质量。',finding:''},
    {label:'正式调查',question:'组织问卷发放与数据回收',method:'确定发布渠道、调查对象、开始条件与停止规则，组织数据回收。',finding:''},
    {label:'数据分析',question:'清洗数据并完成统计分析，输出关键发现',method:'数据清洗 → 描述统计 → 交叉与相关分析，逐一回答研究问题。',finding:''},
  ]
  for(let i=0;i<rows.length;i++){
    const phase=kind==='full-study'?i:0
    rows[i]!.finding=t.viewedPhase>=phase
      ?'该阶段对应工作台「'+(stages[Math.min(phase,stages.length-1)]?.title??'—')+'」，已浏览过；草稿内容随任务保存，可随时去工作台查看或继续完善。'
      :'尚未开始；进入工作台该阶段可填写内容并本机保存。'
  }
  const bg=(t.competition?.background??'').trim()
  const reqs=(t.competition?.requirements??[]).map(r=>String(r?.text??'')).filter(s=>s.trim())
  const body=(t.report?.body??'').trim()
  return{
    tag:'本机任务 · '+label,
    title:t.title||label+'任务',
    summary:bg?bg.slice(0,220):'研究主题：'+(t.title||label)+'。背景尚未填写，可在工作台「'+(stages[0]?.title??'赛事理解')+'」阶段补充。',
    intro:'本任务为「'+label+'」类型，共 '+stages.length+' 个阶段；复现按阶段推进，分析产物与演示随步骤生成。',
    note:body?body.slice(0,180):'报告正文尚未撰写；可在工作台「报告与答辩」阶段完成正文与答辩准备后本机保存。',
    rows,
    info:reqs.length?reqs:['先界定研究对象与总体，再选择抽样方式','量表题与行为题分开设计，便于后续统计','先定口径再动手：每一步先明确"用什么数据回答什么问题"'],
    items:[],
    attach:'附件：任务背景'+(bg?'（'+bg.length+' 字）':'（待补充）')+' · 各阶段草稿随本机任务保存',
    toc:[...STAGE_LABELS,PAPER_LABEL],
    backTo:'/mine',
    workspaceLink:'/research/work?mode='+kindToMode(kind)+'&task='+encodeURIComponent(t.localTaskId),
  }
})
watch(src,v=>{if(!v)void router.replace('/')},{immediate:true})

/* ---------- 状态 ---------- */
interface Art{kind:'analysis'|'animation'|'paper';title:string;sub:string;index:number;auto?:boolean}
interface Msg{key:number;who:'me'|'ai';html:string;arts?:Art[]}

const messages=ref<Msg[]>([])
const cur=ref(0)          /* 当前等待推进到的步骤下标（0=全局分析） */
const maxStep=ref(0)      /* 已经走到过的最大步骤 */
const envReady=ref(false)
const thinkingOn=ref(false)
const drawerOpen=ref(true)
const draft=ref('')
const openKey=ref('')
const openArt=ref<Art|null>(null)
const animBank=ref<{k:number;title:string;sub:string}[]>([])
const streamEl=ref<HTMLElement|null>(null)
let seq=0

const stepLabels=computed(()=>['全局分析',...src.value!.rows.map(r=>r.label),src.value!.toc[src.value!.toc.length-1]??PAPER_LABEL])
const totalSteps=computed(()=>stepLabels.value.length)
const totalDemos=computed(()=>totalSteps.value-1)   /* 报告不生成演示 */
const finished=computed(()=>cur.value>=totalSteps.value-1&&messages.value.length>1)
const canBack=computed(()=>maxStep.value>0)
const stagText=computed(()=>{
  if(finished.value)return '全部完成'
  if(cur.value===0)return messages.value.length? '等待：确认全局分析':'等待你的指令'
  const next=stepLabels.value[cur.value+1]
  return next?'等待：进入'+next:'等待：确认报告初稿'
})
const chipsHint=computed(()=>finished.value?'复现已完成，可重开或回看':'点一个快捷指令，或直接输入——你说一句，它走一步')
const chips=computed<string[]>(()=>{
  if(finished.value)return ['重新复现一遍','回看全局分析']
  if(cur.value===0)return ['确认理解，进入下一步','再讲一遍全局分析','这个任务的研究方法是什么？']
  if(cur.value>=totalSteps.value-1)return ['确认报告初稿，完成复现','下载报告初稿','回看全局分析']
  return ['进入下一步','把这一步的方法再展开讲讲','跳过这一步，直接进入下一问']
})
const inputPlaceholder='和 AI 对话：问它下一步、提出修改意见，或直接在下方点快捷指令——你说一句，它才走一步'
const drawerTitle=computed(()=>!openArt.value?'产物预览':openArt.value.kind==='animation'?'可视化演示':openArt.value.kind==='analysis'?'问题分析':'报告初稿')
const drawerSub=computed(()=>!openArt.value?'随流程逐步生成':openArt.value.kind==='animation'?'点击左侧卡片回看 · 可手动收起':'由本步骤讲解内容整理')

/* ---------- 消息 ---------- */
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function push(who:Msg['who'],html:string,arts?:Art[]){messages.value.push({key:++seq,who,html,arts});scrollBottom()}
function scrollBottom(){void nextTick(()=>{if(streamEl.value)streamEl.value.scrollTop=streamEl.value.scrollHeight})}
function think(cb:()=>void){thinkingOn.value=true;scrollBottom();setTimeout(()=>{thinkingOn.value=false;cb()},760)}
function artGrad(kind:Art['kind']){return kind==='analysis'?'linear-gradient(120deg,#12A594,#17A2C4)':kind==='animation'?'linear-gradient(120deg,#17A2C4,#2EC4B0)':'linear-gradient(120deg,#0B6E68,#2EC4B0)'}

/* ---------- 步骤内容（赛题数据 / 本机任务归一化后共用） ---------- */
function globalHtml():string{
  const s=src.value!
  return '<div class="lead-line">我会带你完整走一遍这道题：先<strong>全局分析</strong>，再按<strong>赛事理解 → 选题分析 → 研究方向 → 问卷与测试 → 正式调查 → 数据分析 → 报告与答辩</strong>七个阶段逐步讲解。你说一句（发送或点快捷指令），我才走一步。</div>'
    +'<h4>1. 题目背景</h4><p>'+esc(s.summary)+'</p>'
    +'<h4>2. 七阶段流程一览</h4><ul>'+s.rows.map(r=>'<li><b>'+esc(r.label)+'</b>：'+esc(r.question)+'</li>').join('')+'<li><b>'+esc(PAPER_LABEL)+'</b>：整理结论成稿，准备答辩材料</li></ul>'
    +'<h4>3. 动手前的关键判断</h4><ul>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>'
    +(s.callout?'<p>'+esc(s.callout)+'</p>':'')
    +'<p class="next">下一步：确认理解没问题，我就进入<b>'+esc(stepLabels.value[1]??'下一步')+'</b>，把目标、方法与预期产出逐步展开。</p>'
}
function comprehensionWalk():string{
  const s=src.value!
  const subs=s.info.length?s.info:['把赛题总目标拆成 3–4 个可测量、可回答的子问题']
  return '<h4>赛事理解 · 把命题翻译成可研究的调研任务</h4>'
    +'<h4>1. 还原真问题</h4><p>赛题给的是现实场景：'+esc(cut(s.summary,72))+'。先区分<b>表象问题</b>与<b>根问题</b>——前者是现象，后者才是调研该回答的；写出"谁遇到什么问题、为什么现在要研究它"。</p>'
    +'<h4>2. 拆解核心研究问题</h4><ul>'+subs.map(b=>'<li>'+esc(b)+' —— 需标注"用什么数据、什么方法回答"</li>').join('')+'</ul>'
    +'<h4>3. 关键概念操作性定义</h4><p>把"复购""满意度""下沉市场"等写成可量化口径（如复购 = 90 天内下单≥2 次），否则问卷与分析全错。'+(s.items[0]?'示例：「'+esc(s.items[0].dimension)+'」操作化为「'+esc(s.items[0].sample)+'」':'')+'</p>'
    +'<h4>4. 已知信息与数据资源盘点</h4><p>赛题通常给订单流水、问卷回收、深访记录三类材料，口径与覆盖不同，需列出"能回答什么 / 不能回答什么 / 待补什么"（见右侧产物）。</p>'
    +'<h4>5. 约束条件与边界</h4><p>明确研究对象与总体、时间/预算、伦理合规（未成年人、敏感数据）与可获取样本边界。</p>'
    +'<h4>6. 评审要点对齐</h4><p>站在评委视角：问题界定清晰度、方法严谨性、结论可核查性、数据真实性、报告完整度——写成贯穿全程的 checklist。</p>'
    +'<p class="next">右侧抽屉已生成《概念定义表》《信息清单》两份可勾选产物。确认理解后，进入<b>'+esc(s.rows[1].label)+'</b>。</p>'
}
function comprehensionProduct():string{
  const s=src.value!
  const def=(s.items.length?s.items.slice(0,3):[{dimension:'复购',sample:'90 天内平台下单≥2 次',scale:'二分类（是/否）'},{dimension:'满意度',sample:'对履约时效的满意度评分',scale:'5 级李克特'},{dimension:'信任',sample:'对平台售后保障的信任度',scale:'5 级李克特'}]) as {dimension:string;sample:string;scale:string}[]
  const infoRows=[
    ['订单 / 流水数据','脱敏抽样，覆盖已购用户','复购现状、用户分层；不含态度'],
    ['问卷回收数据','覆盖调研对象样本','意愿、顾虑、满意度；依赖自填'],
    ['深访 / 团长记录','少量定性','决策路径、真实痛点；不可量化推广'],
  ]
  return '<h4>赛事理解 · 产物（可勾选对齐）</h4>'
    +'<h4>1. 真问题还原</h4><p>'+esc(cut(s.summary,120))+'</p>'
    +'<h4>2. 核心研究问题清单</h4><ol>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ol>'
    +'<h4>3. 概念定义表（示例口径）</h4>'
      +'<table class="dtable"><thead><tr><th>概念</th><th>操作性定义（示例）</th><th>量表 / 口径</th></tr></thead><tbody>'
      +def.map(it=>'<tr><td>'+esc(it.dimension)+'</td><td>'+esc(it.sample)+'</td><td>'+esc(it.scale)+'</td></tr>').join('')
      +'</tbody></table>'
    +'<h4>4. 信息清单（能回答 / 不能回答 / 待补）</h4>'
      +'<table class="dtable"><thead><tr><th>数据来源</th><th>覆盖 / 口径</th><th>能回答 · 不能回答</th></tr></thead><tbody>'
      +infoRows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join('')
      +'</tbody></table>'
    +'<h4>5. 约束与边界</h4><ul><li>研究对象与总体：需先界定，再谈抽样</li><li>时间 / 预算：决定样本量与调查方式</li><li>伦理合规：未成年人、敏感数据脱敏</li><li>样本边界：可获取渠道与人群上限</li></ul>'
    +'<h4>6. 评审 Checklist</h4><ul><li>问题界定是否清晰、可测量</li><li>方法是否严谨、可复现</li><li>结论是否可核查、有证据链</li><li>数据是否真实、来源可追溯</li><li>报告结构是否完整、图表规范</li></ul>'
    +'<p class="dfind">'+(s.rows[0].finding?esc(s.rows[0].finding):'本步为复现讲解产物，正式内容请在七阶段工作台「赛事理解」阶段填写并本机保存。')+'</p>'
}
function questionHtml(k:number):string{
  if(k===1)return comprehensionWalk()
  const s=src.value!
  const row=s.rows[k-1]
  const last=k>=s.rows.length
  return '<h4>'+esc(row.label)+' · 解题分析</h4>'
    +'<h4>1. 本步目标</h4><p>'+esc(row.question)+'</p>'
    +'<h4>2. 方法路线</h4><p>'+esc(row.method)+'</p>'
    +'<h4>3. 当前进展（示例口径）</h4><p>'+esc(row.finding)+'</p>'
    +'<p class="next">'+(last?'下一步：进入<b>报告初稿</b>，我会给出报告目录与结论要点。':'下一步：进入<b>'+esc(s.rows[k].label)+'</b>，我会继续展开目标、方法与预期产出。')+'</p>'
}
function paperHtml():string{
  const s=src.value!
  return '<h4>报告初稿 · 收束成稿</h4>'
    +'<h4>1. 报告目录</h4><ol class="toc-mini">'+s.toc.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ol>'
    +'<h4>2. 结论要点</h4><p>'+esc(s.note)+'</p>'
    +'<p class="next">'+(s.workspaceLink?'复现到此完成。要正式撰写与保存，可点右侧「进入七阶段工作台编辑本任务」。':'复现到此完成。要正式撰写报告，可回到七阶段工作台的「报告与答辩」阶段继续完善并本机保存。')+'</p>'
}
function analysisHtml(k:number):string{
  const s=src.value!
  if(k===0){
    return '<h4>研究步骤清单</h4><ul>'+s.rows.map(r=>'<li><b>'+esc(r.label)+'</b>：'+esc(r.question.replace(/^推进「[^」]*」阶段：/,''))+'<br /><small>方法：'+esc(r.method)+'</small></li>').join('')+'</ul>'
      +'<h4>信息清单（能回答什么 / 缺什么）</h4><ul>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>'
      +(s.callout?'<p class="dnote">'+esc(s.callout)+'</p>':'')
  }
  if(k===1)return comprehensionProduct()
  if(k>=1&&k<=s.rows.length){
    const row=s.rows[k-1]
    return '<h4>本步目标</h4><p>'+esc(row.question)+'</p><h4>方法与当前进展</h4><p>'+esc(row.method)+'</p><p class="dfind">'+esc(row.finding)+'</p>'
      +(s.items.length?'<h4>涉及量表（示例）</h4><table class="dtable"><thead><tr><th>维度</th><th>示例题项</th><th>量表</th></tr></thead><tbody>'
        +s.items.slice(0,4).map(it=>'<tr><td>'+esc(it.dimension)+'</td><td>'+esc(it.sample)+'</td><td>'+esc(it.scale)+'</td></tr>').join('')
        +'</tbody></table>':'')
  }
  return paperHtml()
}

/* ---------- 推进流程 ---------- */
function stepArts(k:number):Art[]{
  const s=src.value!
  const label=k===0?'全局分析':k>=totalSteps.value-1?PAPER_LABEL:s.rows[k-1]?.label??PAPER_LABEL
  const arts:Art[]=[{kind:'analysis',title:label+' · 分析产物',sub:k===0?'研究步骤清单 + 信息清单 + 关键口径':k===1?'六板块拆解 + 概念定义表 + 信息清单':'目标 + 方法路线 + 当前进展',index:k}]
  if(k<totalSteps.value-1)arts.push({kind:'animation',title:'演示'+cn(k+1)+' · '+label+'演示',sub:(ANIM_SUBS[Math.min(k,ANIM_SUBS.length-1)]??'示意图')+' · 自动生成',index:k,auto:true})
  else arts.push({kind:'paper',title:'报告初稿 · v1',sub:'目录 + 结论要点 · 自动生成',index:k})
  return arts
}
function pushStep(k:number){
  cur.value=k;maxStep.value=Math.max(maxStep.value,k);envReady.value=true
  const html=k===0?globalHtml():k>=totalSteps.value-1?paperHtml():questionHtml(k)
  const arts=stepArts(k)
  push('ai',html,arts)
  const auto=arts.find(a=>a.auto)
  if(auto)setTimeout(()=>{openArt.value=auto;openKey.value=seq+'-auto';registerAnim(auto);drawerOpen.value=true},700)
}
function advance(){if(!finished.value)pushStep(cur.value+1)}
function registerAnim(a:Art){
  if(a.kind!=='animation')return
  if(!animBank.value.some(q=>q.k===a.index))animBank.value.push({k:a.index,title:a.title,sub:a.sub})
  animBank.value.sort((x,y)=>x.k-y.k)
}
function viewArt(art:Art,key:string){
  openArt.value=art;openKey.value=key;drawerOpen.value=true;registerAnim(art)
}
function switchAnim(k:number){const hit=animBank.value.find(q=>q.k===k);if(!hit)return;openArt.value={kind:'animation',title:hit.title,sub:hit.sub,index:k};openKey.value='anim-'+k}
function jumpStep(i:number){
  if(i>maxStep.value){quickSayToastLike('这一步还没走到，先按顺序往下推进');return}
  push('me','回到「'+esc(stepLabels.value[i])+'」，我想再看一遍')
  think(()=>pushStep(i))
}
function backStep(){if(canBack.value)jumpStep(Math.max(0,cur.value-1))}
function quickSayToastLike(text:string){push('ai','<div class="tip-line">'+esc(text)+'</div>')}
function askPause(){
  push('ai','<h4>暂停一下，听你问</h4><p>复现按固定剧本推进：左边是每一步的分析讲解，右边是对应的分析产物与演示。你可以直接在下方输入具体问题；正式智能体接入后可自由追问。</p>')
}
function pickFile(){
  push('me','上传了一份补充材料（演示）：<span class="kv">补充材料.xlsx · 已接收</span>')
  think(()=>push('ai','<p>已接收（演示回显，不会真实解析）。流程继续按剧本推进；正式环境中这里会接入本机沙箱做字段解析与质量检查。</p>'))
}
function reset(){
  messages.value=[];cur.value=0;maxStep.value=0;envReady.value=false;animBank.value=[];openArt.value=null;openKey.value='';draft.value=''
  const s=src.value
  if(!s)return
  const lead=problem.value?'（已载入赛题与实训指导书）':'（已载入本机研究任务）'
  push('me',lead+'<br><b>'+esc(s.tag)+'</b>：'+esc(s.title)+'。<br>'+esc(s.attach))
  think(()=>pushStep(0))
}
function send(){
  const text=draft.value.trim()
  if(!text){quickSayToastLike('和 AI 说一句话，它才会继续下一步');return}
  draft.value=''
  push('me',esc(text))
  respond(text)
}
function quickSay(chip:string){
  if(/重新复现|重新|再来/.test(chip)){reset();return}
  if(/下载报告/.test(chip)){downloadReport();return}
  push('me',esc(chip))
  respond(chip)
}
function respond(text:string){
  think(()=>{
    if(finished.value){
      if(/回看/.test(text)){jumpStep(0);return}
      if(/报告|下载/.test(text)){downloadReport();return}
      push('ai','<p>复现已完成。点「重新复现一遍」可从头再来'+(src.value?.workspaceLink?'，或进入工作台继续编辑本任务。':'，或回到赛题页查看实训指导书。')+'</p>')
      return
    }
    if(/再讲|再看看|再展开|什么口径|口径|方法/.test(text)&&!/跳过|下一步/.test(text)){
      const k=Math.min(cur.value,totalSteps.value-1)
      push('ai',k===0?globalHtml():k>=totalSteps.value-1?paperHtml():questionHtml(k),stepArts(k))
      return
    }
    advance()
  })
}

/* ---------- 可视化演示（内联 SVG 示意，每阶段专属图形） ---------- */
const ANIM_SUBS=['调研流程图','信息盘点矩阵','研究问题拆解树','抽样漏斗','量表结构与信度','回收进度曲线','分组对比图']
function svgHead(title:string,sub:string,h:number):string{
  return '<rect x="0" y="0" width="880" height="'+h+'" rx="14" fill="#fff"/>'
    +'<text x="30" y="38" font-size="15" font-weight="800" fill="#0B6E68">'+esc(title)+'</text>'
    +'<text x="30" y="60" font-size="11" fill="#7C99A1">'+esc(sub)+'</text>'
}
function svgFoot(h:number):string{
  return '<text x="30" y="'+(h-12)+'" font-size="10" fill="#9AB4BB">演示口径 · 示例数据，仅用于讲解流程与统计口径</text>'
}
function animSvg(k:number):string{
  const s=src.value!
  /* k=0 全局分析：七阶段流程图（深底） */
  if(k===0){
    const labels=[...STAGE_LABELS]
    const w=124,g=18,x0=Math.max(24,(880-(labels.length*w+(labels.length-1)*g))/2)
    const boxes=labels.map((n,i)=>{
      const x=x0+i*(w+g)
      return '<rect x="'+x+'" y="86" width="'+w+'" height="58" rx="12" fill="url(#g1)"/><text x="'+(x+w/2)+'" y="112" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">'+esc(n)+'</text><text x="'+(x+w/2)+'" y="130" text-anchor="middle" font-size="10.5" fill="rgba(255,255,255,.78)">阶段 '+(i+1)+'</text>'
      +(i<labels.length-1?'<path d="M'+(x+w+2)+' 115 l12 0" stroke="#7FE0A8" stroke-width="2.4" stroke-linecap="round"/><path d="M'+(x+w+9)+' 109 l9 6 -9 6" fill="none" stroke="#7FE0A8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>':'')
    }).join('')
    return '<svg viewBox="0 0 880 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="调研流程演示">'
      +'<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E8F84"/><stop offset="1" stop-color="#17A2C4"/></linearGradient></defs>'
      +'<rect x="0" y="0" width="880" height="230" rx="14" fill="#0B6E68"/>'
      +'<text x="30" y="42" font-size="16" font-weight="800" fill="#fff">演示一 · 全局分析演示：'+esc(s.title.slice(0,22))+(s.title.length>22?'…':'')+'</text>'
      +'<text x="30" y="64" font-size="11" fill="rgba(255,255,255,.72)">'+esc(s.tag)+' · 七阶段调研全流程 · 演示口径</text>'
      +boxes+'</svg>'
  }
  const row=s.rows[Math.min(k-1,s.rows.length-1)]
  const head=svgHead('演示'+cn(k+1)+' · '+row.label+'演示（示例口径）',cut(row.method,46),260)
  /* k=1 赛事理解：信息盘点矩阵 */
  if(k===1){
    const qs=(s.info.length?s.info.slice(0,3):[]).map(b=>cut(b,16))
    const pool=['复购现状如何','流失原因是什么','分层差异在哪','渠道贡献多大','行动建议是什么']
    while(qs.length<3)qs.push(pool[qs.length]!)
    const cols:[string,string[]][]=[
      ['已知信息',['背景与任务要求','订单/问卷/深访材料','往届评分关注点']],
      ['待回答问题',qs],
      ['约束边界',['时间与预算','样本可及范围','伦理与隐私']],
    ]
    const body=cols.map((c,ci)=>{
      const x=36+ci*274
      const chips=c[1].map((t,j)=>'<rect x="'+(x+14)+'" y="'+(124+j*32)+'" width="212" height="26" rx="8" fill="#F0FAF8" stroke="#DCEDEE"/><text x="'+(x+26)+'" y="'+(141+j*32)+'" font-size="11" fill="#3D6570">'+esc(t)+'</text>').join('')
      return '<rect x="'+x+'" y="78" width="240" height="140" rx="12" fill="#fff" stroke="#DCEDEE"/><rect x="'+x+'" y="78" width="240" height="30" rx="12" fill="url(#g1)"/><text x="'+(x+120)+'" y="98" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">'+esc(c[0])+'</text>'+chips
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="信息盘点矩阵">'+head+body+svgFoot(260)+'</svg>'
  }
  /* k=2 选题分析：研究问题拆解树 */
  if(k===2){
    const qs=(s.info.length?s.info:['复购现状如何','流失原因是什么','分层差异在哪','如何提升复购']).slice(0,4).map(b=>cut(b,20))
    const nodes=qs.map((q,i)=>{
      const y=52+i*50
      return '<path d="M186 138 C 262 138 272 '+(y+22)+' 348 '+(y+22)+'" fill="none" stroke="#BFE5DE" stroke-width="2"/>'
        +'<rect x="348" y="'+y+'" width="496" height="44" rx="10" fill="#F0FAF8" stroke="#DCEDEE"/><circle cx="372" cy="'+(y+22)+'" r="9" fill="#2EC4B0"/>'
        +'<text x="392" y="'+(y+27)+'" font-size="12.5" fill="#0B2E36">问题'+cn(i+1)+'：'+esc(q)+'</text>'
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="研究问题拆解树">'+head
      +'<rect x="30" y="108" width="156" height="60" rx="12" fill="url(#g1)"/><text x="108" y="134" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">选题总目标</text><text x="108" y="152" text-anchor="middle" font-size="10.5" fill="rgba(255,255,255,.78)">拆解为可回答问题</text>'
      +nodes+svgFoot(260)+'</svg>'
  }
  /* k=3 研究方向：抽样漏斗 */
  if(k===3){
    const layers:[string,number,string][]=[
      ['目标总体 · 研究范围内全部对象',560,'#DFF4F0'],
      ['抽样框 · 可触达名单',440,'#B9E7E0'],
      ['计划样本 · n = 500',320,'#63CDBC'],
      ['预计有效 · n ≥ 450',200,'#0E8F84'],
    ]
    const cx=300
    const body=layers.map((l,i)=>{
      const w=l[1],x=cx-w/2,y=74+i*44
      return (i>0?'<path d="M'+cx+' '+(y-8)+' l0 6" stroke="#7C99A1" stroke-width="2" stroke-linecap="round"/><path d="M'+(cx-4)+' '+(y-5)+' l4 5 4 -5" fill="none" stroke="#7C99A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>':'')
        +'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="34" rx="10" fill="'+l[2]+'"/>'
        +'<text x="'+cx+'" y="'+(y+22)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+(i>=2?'#fff':'#0B6E68')+'">'+esc(l[0])+'</text>'
    }).join('')
    const notes=['抽样方式：分层随机（示例）','配额：城市 × 活跃度','失效剔除：跳答 / 时长过短'].map((t,i)=>'<circle cx="622" cy="'+(104+i*30)+'" r="4" fill="#F5A623"/><text x="636" y="'+(108+i*30)+'" font-size="11.5" fill="#3D6570">'+esc(t)+'</text>').join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="抽样漏斗">'+head+body+notes+svgFoot(260)+'</svg>'
  }
  /* k=4 问卷与测试：量表结构 + 信度仪表 */
  if(k===4){
    const items=s.items.length?s.items.slice(0,4):[
      {dimension:'满意度',sample:'对履约时效的满意度',scale:'5 级李克特'},
      {dimension:'信任',sample:'对平台售后的信任',scale:'5 级李克特'},
      {dimension:'复购意愿',sample:'90 天内复购可能性',scale:'行为意向'},
      {dimension:'人群画像',sample:'使用频率与场景',scale:'单选/多选'},
    ]
    const rows=items.map((it,i)=>{
      const y=80+i*40
      return '<rect x="36" y="'+y+'" width="380" height="32" rx="9" fill="#F0FAF8" stroke="#DCEDEE"/>'
        +'<text x="52" y="'+(y+21)+'" font-size="12" font-weight="700" fill="#0B6E68">'+esc(it.dimension)+'</text>'
        +'<text x="150" y="'+(y+21)+'" font-size="11" fill="#3D6570">'+esc(cut(it.sample,15))+'</text>'
        +'<text x="402" y="'+(y+21)+'" text-anchor="end" font-size="10.5" fill="#7C99A1">'+esc(it.scale)+'</text>'
    }).join('')
    const gauge='<path d="M585 150 A70 70 0 0 1 725 150" fill="none" stroke="#E5F2F0" stroke-width="16" stroke-linecap="round"/>'
      +'<path d="M585 150 A70 70 0 0 1 725 150" fill="none" stroke="#F5A623" stroke-width="16" stroke-linecap="round" stroke-dasharray="189 240"/>'
      +'<text x="655" y="138" text-anchor="middle" font-size="20" font-weight="800" fill="#0B6E68">α = 0.86</text>'
      +'<text x="655" y="158" text-anchor="middle" font-size="10.5" fill="#7C99A1">预测试 Cronbach α（示例）</text>'
      +'<text x="655" y="176" text-anchor="middle" font-size="10" fill="#9AB4BB">≥0.7 可接受 · ≥0.8 良好</text>'
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="量表结构与信度">'+head+rows+gauge+svgFoot(260)+'</svg>'
  }
  /* k=5 正式调查：回收进度曲线（计划 vs 实际） */
  if(k===5){
    const N=9,x0=70,dx=74
    const plan=(i:number)=>Math.round(30+i*(470/N))
    const actual=(i:number)=>Math.round(plan(i)*(0.7+((i*37)%23)/60))
    const Y=(v:number)=>Math.round(212-v*0.26)
    const grid=[0,250,500].map(v=>'<line x1="60" y1="'+Y(v)+'" x2="846" y2="'+Y(v)+'" stroke="#E5F2F0" stroke-width="1.5"/><text x="52" y="'+(Y(v)+4)+'" text-anchor="end" font-size="10" fill="#9AB4BB">'+v+'</text>').join('')
    const pts=(f:(i:number)=>number)=>Array.from({length:N+1},(_,i)=>(x0+i*dx)+' '+Y(f(i))).join(' L')
    const line=(p:string,color:string,dash:string)=>'<path d="M'+p+'" fill="none" stroke="'+color+'" stroke-width="2.6" stroke-linecap="round" '+(dash?'stroke-dasharray="6 5"':'')+'/>'
    const dots=Array.from({length:N+1},(_,i)=>'<circle cx="'+(x0+i*dx)+'" cy="'+Y(actual(i))+'" r="3.6" fill="#F5A623"/>').join('')
    const legend='<rect x="620" y="26" width="12" height="12" rx="3" fill="#7C99A1"/><text x="638" y="36" font-size="11" fill="#3D6570">计划累计</text><rect x="716" y="26" width="12" height="12" rx="3" fill="#F5A623"/><text x="734" y="36" font-size="11" fill="#3D6570">实际累计</text>'
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="回收进度曲线">'+head+grid
      +line(pts(plan),'#7C99A1','1')+line(pts(actual),'#F5A623','')+dots+legend
      +'<text x="30" y="236" font-size="10.5" fill="#7C99A1">横轴：调查日（第 1–10 天，示例） · 纵轴：累计回收份数</text>'+svgFoot(260)+'</svg>'
  }
  /* k=6 数据分析：老/新用户分组对比 */
  if(k===6){
    const dims=['复购频次','满意度','信任度','推荐意愿']
    const oldV=[72,64,58,49],yngV=[54,61,70,63]
    const legend='<rect x="560" y="26" width="12" height="12" rx="3" fill="#2EC4B0"/><text x="578" y="36" font-size="11" fill="#3D6570">老用户</text><rect x="646" y="26" width="12" height="12" rx="3" fill="#F5A623"/><text x="664" y="36" font-size="11" fill="#3D6570">新用户</text>'
    const bars=dims.map((d,gi)=>{
      const x=96+gi*186
      const bar=(v:number,bx:number,color:string)=>{const h=Math.round(v*1.3);return '<rect x="'+bx+'" y="'+(200-h)+'" width="44" height="'+h+'" rx="7" fill="'+color+'"/><text x="'+(bx+22)+'" y="'+(194-h)+'" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0B2E36">'+v+'</text>'}
      return bar(oldV[gi]!,x,'#2EC4B0')+bar(yngV[gi]!,x+52,'#F5A623')
        +'<text x="'+(x+48)+'" y="222" text-anchor="middle" font-size="11.5" fill="#3D6570">'+esc(d)+'</text>'
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="分组对比图">'+head
      +'<line x1="60" y1="200" x2="846" y2="200" stroke="#DCEDEE" stroke-width="1.5"/>'+bars+legend
      +'<text x="850" y="60" text-anchor="end" font-size="10.5" fill="#F5A623">识别点：新用户「信任度」更高</text>'+svgFoot(260)+'</svg>'
  }
  return head+svgFoot(260)+'</svg>'
}
function exportAnim(){
  const art=openArt.value
  if(!art||art.kind!=='animation')return
  const s=src.value!
  const svg=animSvg(art.index)
  const doc='<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>'+s.title+' · '+art.title+'</title>'
    +'<style>body{font-family:system-ui,sans-serif;margin:32px auto;max-width:920px;color:#0B2E36}h1{font-size:20px;color:#0B6E68}p{color:#3D6570;font-size:13px}svg{width:100%;height:auto;border:1px solid #DCEDEE;border-radius:14px}</style></head><body>'
    +'<h1>'+s.title+' — '+art.title+'</h1><p>'+s.tag+' · 市调演真案例复现 · 演示口径（不代表真实调查结论）</p>'+svg+'</body></html>'
  const blob=new Blob([doc],{type:'text/html;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=s.title+'·'+art.title+'.html'
  a.click()
  URL.revokeObjectURL(url)
}
function downloadReport(){
  const s=src.value
  if(!s)return
  const lines:string[]=['# 《'+s.title+'》报告初稿（v1 · 演示）','',s.intro,'','## 目录','']
  for(const c of s.toc)lines.push('- '+c)
  lines.push('','## 结论要点','',s.note,'','> 本初稿为案例复现演示产物，正式报告请在七阶段工作台「报告与答辩」阶段整理并保存。')
  const blob=new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=s.title+'·报告初稿.md'
  a.click()
  URL.revokeObjectURL(url)
}

reset()
watch(()=>[route.params.id,route.query.task],()=>{if(route.name==='research-replay')reset()})
</script>

<style scoped>
.replay{
  --ink:#0B2E36;--ink2:#3D6570;--ink3:#7C99A1;--ink4:#9AB0B6;
  --teal-700:#0B6E68;--blue-800:#0E8F84;--blue-700:#0E8F84;--blue-600:#12A594;--blue-500:#12A594;--blue-400:#3DB3AC;
  --blue-300:#6EC6C0;--blue-200:#BFE3E0;--blue-100:#DFF4F1;--blue-50:#EFFAF8;
  --line:#E0EBE8;--line-2:#EAF5F5;--bg:#F3FAFA;--amber:#F5A623;
  --grad:linear-gradient(120deg,#12A594 0%,#1E9FC4 100%);
  --sh-1:0 2px 8px rgba(11,110,104,.06);--sh-2:0 6px 20px rgba(11,110,104,.1);
  height:100dvh;min-height:560px;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.7
}
.icon-btn{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink2);cursor:pointer;flex-shrink:0}
.icon-btn:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
/* ===== 顶栏 ===== */
.wtop{display:flex;align-items:center;gap:12px;padding:12px 24px;background:#fff;border-bottom:1px solid var(--line);flex-shrink:0;overflow-x:auto}
.wtop::-webkit-scrollbar{display:none}
.wtb{padding:3px 9px;border-radius:6px;background:var(--blue-100);color:var(--blue-700);font-size:11.5px;font-weight:700;flex-shrink:0;white-space:nowrap}
.wt{font-size:15px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;flex-shrink:0}
.steps{display:flex;align-items:center;gap:4px;margin-left:6px;overflow-x:auto;flex-shrink:0}
.steps::-webkit-scrollbar{display:none}
.step-line{width:14px;height:1.5px;background:var(--line);flex-shrink:0}
.step{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink4);white-space:nowrap;padding:2px 4px;border-radius:7px;transition:.15s}
.step.clickable{cursor:pointer}
.step.clickable:hover{background:var(--blue-50);color:var(--blue-700)}
.step .n{width:19px;height:19px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink4);background:#fff;flex-shrink:0}
.step.done{color:var(--blue-700)}
.step.done .n{background:var(--blue-600);border-color:var(--blue-600);color:#fff}
.step.now{color:var(--blue-800);font-weight:700}
.step.now .n{border-color:var(--blue-600);color:var(--blue-700);box-shadow:0 0 0 3px rgba(11,110,104,.16)}
.stag{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;padding:5px 10px;border-radius:999px;font-size:11.8px;font-weight:700;color:#8A5A00;background:#FFF6DC;border:1px solid #F4DFA8;white-space:nowrap}
.stag i{width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 0 3px rgba(245,166,35,.18)}
.stag.done{color:#1E7A4F;background:#E7F6EE;border-color:#BFE6CF}
.stag.done i{background:#2FA36B;box-shadow:0 0 0 3px rgba(47,163,107,.16)}
.env-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:11.8px;font-weight:600;color:#1E7A4F;background:#E7F6EE;border:1px solid #BFE6CF;flex-shrink:0}
.env-badge::before{content:"";width:7px;height:7px;border-radius:50%;background:#2BA471;box-shadow:0 0 0 3px rgba(47,163,107,.18)}
.env-badge.inactive{color:var(--ink3);background:#F1F5F6;border-color:var(--line)}
.env-badge.inactive::before{background:var(--ink4);box-shadow:none}
.flow-tools{display:flex;align-items:center;gap:7px;flex-shrink:0}
.flow-tool{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink2);font-size:12px;font-weight:700;cursor:pointer;transition:.16s;flex-shrink:0}
.flow-tool:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
.flow-tool:disabled{opacity:.45;cursor:not-allowed}
.flow-tool svg{width:14px;height:14px;flex:0 0 auto}
.grow{flex:1}
/* ===== 主体 ===== */
.wbody{display:flex;gap:0;flex:1;min-height:0}
.chat{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg)}
.stream{flex:1;overflow-y:auto;padding:22px 26px 8px;scroll-behavior:smooth}
.stream-in{max-width:860px;margin:0 auto}
.msg{display:flex;margin-bottom:20px}
.msg.me{flex-direction:row-reverse}
.bubble{max-width:88%;min-width:0}
.msg.me .bubble{margin-left:auto}
.bubble .txt{background:#fff;border:1px solid #E0EBE8;border-radius:14px;padding:14px 18px;font-size:14px;line-height:1.8;color:var(--ink2);box-shadow:0 1px 2px rgba(11,110,104,.05)}
.msg.me .bubble .txt{background:#1A7A6A;border-color:#1A7A6A;color:#fff}
.msg.me .bubble .txt *{color:#fff}
.bubble .txt h4{font-size:14.5px;font-weight:800;color:var(--ink);margin:0 0 8px}
.bubble .txt h4:not(:first-child){margin-top:16px}
.msg.me .bubble .txt h4{color:#fff}
.bubble .txt p{margin-bottom:8px}
.bubble .txt ul{margin:0 0 8px 0;list-style:none;padding:0}
.bubble .txt ol{margin:0 0 8px;padding-left:20px}
.bubble .txt li{padding-left:16px;position:relative;margin-bottom:5px}
.bubble .txt ul>li:before{content:"";position:absolute;left:3px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--blue-400)}
.msg.me .bubble .txt ul>li:before{background:rgba(255,255,255,.8)}
.bubble .txt .kv{color:var(--blue-700);font-weight:700}
.bubble .txt small{color:var(--ink3)}
.lead-line{margin:0 0 12px}
.next{margin-top:12px;padding:9px 13px;border-radius:9px;font-size:13px;line-height:1.72;color:var(--blue-800);background:var(--blue-50);border-left:3px solid var(--blue-500)}
.next b{color:var(--blue-700)}
.tip-line{margin:0;padding:9px 12px;border-radius:9px;font-size:12.4px;line-height:1.7;color:#8A5A00;background:#FFF6DC;border-left:3px solid var(--amber)}
.thinking{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink3);padding:6px 0}
.thinking i{width:6px;height:6px;border-radius:50%;background:var(--blue-400);animation:bl 1s infinite}
.thinking i:nth-child(2){animation-delay:.15s}
.thinking i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,100%{opacity:.25}50%{opacity:1}}
/* 产物卡 */
.arts{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.acard{display:flex;align-items:center;gap:13px;width:100%;background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px 16px;cursor:pointer;transition:.18s;text-align:left;box-shadow:var(--sh-1);position:relative;overflow:hidden}
.acard:hover{border-color:var(--blue-300);transform:translateY(-2px);box-shadow:var(--sh-2)}
.acard.open{border-color:var(--blue-600);box-shadow:0 0 0 3px rgba(11,110,104,.12)}
.acard .ai{width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
.acard .at{flex:1;min-width:0}
.acard .at b{display:block;font-size:14px;font-weight:700;color:var(--ink)}
.acard .at span{display:block;font-size:12px;color:var(--ink3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acard .arrow{color:var(--blue-600);flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700}
.acard .auto{position:absolute;top:0;right:0;padding:2px 8px;border-radius:0 0 0 8px;background:var(--amber);color:#fff;font-size:10.5px;font-weight:700}
.acard.mini{padding:10px 13px;border-radius:11px;margin-bottom:8px}
.acard.mini .ai{width:30px;height:30px;font-size:12.5px}
/* 输入台 */
.composer-bar{border-top:1px solid var(--line);background:#fff;padding:14px 26px 16px;flex-shrink:0}
.composer-bar .cw{max-width:860px;margin:0 auto}
.composer{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--sh-2);transition:.2s;overflow:hidden}
.composer:focus-within{border-color:var(--blue-400);box-shadow:0 8px 28px rgba(11,110,104,.14)}
.composer textarea{display:block;width:100%;padding:16px 20px 8px;min-height:64px;max-height:200px;resize:none;border:none;outline:none;background:none;font:inherit;font-size:14.5px;line-height:1.7;color:var(--ink)}
.composer textarea::placeholder{color:var(--ink4)}
.cbar{display:flex;align-items:center;gap:10px;padding:10px 14px 12px;border-top:1px solid var(--line-2);background:#F8FCFC}
.cbar .spacer{flex:1}
.hint{font-size:12px;color:var(--ink4)}
.btn-ghost{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-weight:600;font-size:13.5px;transition:.18s;cursor:pointer}
.btn-ghost:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
.btn-send{display:inline-flex;align-items:center;gap:7px;padding:9px 22px;border-radius:10px;border:none;background:var(--grad);color:#fff;font-weight:700;font-size:14px;box-shadow:0 3px 10px rgba(11,110,104,.28);transition:.18s;cursor:pointer}
.btn-send:hover{filter:brightness(1.06);transform:translateY(-1px)}
.chips-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}
.whint{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--ink4);margin-right:2px}
.whint i{width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 0 3px rgba(245,166,35,.16)}
.chip{padding:6px 13px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:12.5px;color:var(--ink2);transition:.18s;cursor:pointer}
.chip:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
/* ===== 产物抽屉 ===== */
.drawer{width:0;flex-shrink:0;border-left:1px solid var(--line);background:#fff;overflow:hidden;transition:width .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}
.drawer.on{width:480px}
.dh{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-shrink:0}
.dh h3{font-size:15px;font-weight:800;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
.dh .sub{font-size:11.5px;color:var(--ink3);display:block;font-weight:500;margin-top:1px}
.db{flex:1;overflow-y:auto;padding:18px;background:var(--bg);min-width:480px}
.stage{margin-bottom:16px;border-radius:14px;overflow:hidden;box-shadow:var(--sh-2)}
.stage :deep(svg){width:100%;height:auto;display:block}
.card{background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:var(--sh-1);margin-bottom:16px;overflow:hidden}
.card:last-child{margin-bottom:0}
.card-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-2)}
.card-h h3{margin:0;font-size:14px;font-weight:800;color:var(--ink);flex:1}
.tag-c{padding:2px 8px;border-radius:99px;background:var(--blue-100);color:var(--blue-700);font-size:11px;font-weight:700}
.card-b{padding:14px 16px;font-size:12.8px;color:var(--ink2);line-height:1.75}
.card-b.tight{padding:12px}
.card-b.col{display:grid;gap:8px}
.card-b h4{margin:12px 0 7px;font-size:13.2px;color:var(--teal-700);border-left:3px solid var(--blue-500);padding-left:8px}
.card-b h4:first-child{margin-top:0}
.card-b p{margin:0 0 9px}
.card-b ul{margin:0 0 9px;padding-left:18px}
.card-b li{margin-bottom:6px}
.card-b li b{color:var(--blue-700)}
.card-b li small{color:var(--ink3)}
.card-b ol{margin:0 0 9px;padding-left:20px}
.dnote{padding:9px 12px;border:1px solid #ECD9A8;border-radius:9px;background:#FDF6E4;color:#6B5316;font-size:12px}
.dfind{padding:9px 12px;border-left:3px solid var(--blue-500);border-radius:0 9px 9px 0;background:var(--blue-50)}
.dtable{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.dtable th,.dtable td{padding:7px 9px;border-bottom:1px solid var(--line-2);text-align:left}
.dtable th{background:var(--blue-50);color:var(--teal-700)}
.side-note{font-size:12.3px;color:var(--ink2)}
.legend{display:grid;gap:6px;margin-top:10px;font-size:12px;color:var(--ink2)}
.legend div{display:flex;align-items:center;gap:8px}
.legend i{width:12px;height:12px;border-radius:3px;flex-shrink:0}
.exp-row{margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2)}
.dl{width:100%;padding:9px 12px;border:1px solid var(--blue-200);border-radius:9px;background:var(--blue-50);color:var(--blue-700);font-size:12.8px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;display:block}
.dl:hover{background:var(--blue-100)}
.dl.ghost{background:#fff;border-style:dashed}
.anim-empty{padding:26px 20px;border:1px dashed var(--blue-200);border-radius:12px;background:#fff;font-size:12.8px;color:var(--ink3);line-height:1.8}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:960px){
  .drawer{position:fixed;top:0;right:0;bottom:0;z-index:40;box-shadow:-8px 0 24px rgba(11,46,54,.14)}
  .drawer.on{width:min(480px,94vw)}
  .db{min-width:0}
  .wt{max-width:160px}
}
button:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid #0B6E68;outline-offset:2px}
</style>
