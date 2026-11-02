<template>
  <main class="research-home">
    <header class="nav"><div class="nav-inner">
      <RouterLink class="brand" to="/"><span class="brand-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span class="brand-txt"><strong class="brand-name">市调演真</strong><small class="brand-sub">Survey Research Studio</small></span></RouterLink>
      <nav class="nav-links" aria-label="主导航"><RouterLink class="on" to="/">首页</RouterLink><RouterLink to="/mine">我的成果</RouterLink></nav>
      <div class="nav-right"><span v-if="userStore.isLogged">{{userStore.displayName}}</span><RouterLink v-else class="btn-login" to="/login">登录 / 注册</RouterLink><button v-if="userStore.isLogged" class="btn-ghost" @click="userStore.logout()">退出</button></div>
    </div></header>
    <section class="hero"><div class="hero-inner">
      <div class="hero-badge"><i class="dot" aria-hidden="true"></i>市场调查研究工作台</div>
      <h1>让调查材料，成为<span class="g">有据可查的结论</span></h1>
      <p class="sub">从赛事理解、选题到研究方案，在同一份任务中逐步推进。保留来源和未知项，让每一步研究都有据可查。</p>
      <section class="hero-reco" aria-labelledby="research-works-title" aria-roledescription="轮播" @mouseenter="carouselHovered=true" @mouseleave="carouselHovered=false" @focusin="carouselFocused=true" @focusout="onCarouselFocusOut" @keydown="onCarouselKey">
        <div class="sec-head"><h2 id="research-works-title">市调赛题</h2><span class="sub">真题赛题 · 查看实训指导书，或在平台完整复现调研流程</span><div class="grow"></div><div class="sec-acts">
          <button type="button" class="btn-ghost rotation-control" :aria-label="rotationEnabled?'暂停自动轮播':'开启自动轮播'" @click="rotationEnabled=!rotationEnabled">{{rotationEnabled?'暂停轮播':'继续轮播'}}</button>
          <button type="button" class="icon-btn" aria-label="上一张作品" aria-controls="research-work-track" :disabled="transitioning" @click="moveCarousel(-1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 6-6 6 6 6" /></svg></button>
          <button type="button" class="icon-btn" aria-label="下一张作品" aria-controls="research-work-track" :disabled="transitioning" @click="moveCarousel(1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10 6 6 6-6 6" /></svg></button>
        </div></div>
        <div ref="carouselViewport" class="car-view" tabindex="0" aria-label="市调赛题卡片，可拖动或使用左右方向键切换" @pointerdown="startDrag" @pointermove="dragCarousel" @pointerup="finishDrag" @pointercancel="cancelDrag" @click.capture="onClickCapture">
          <div id="research-work-track" class="car-track" :class="{ 'no-motion':!animateTrack,grabbing:dragging }" :style="{transform:`translateX(${-((cloneCount+physicalIndex)*CARD_STEP)+dragOffset}px)`}" @transitionend="onTrackTransitionEnd">
            <article v-for="(item,position) in renderedCards" :key="item.key" class="pcard work-problem" :data-work="item.p.id" :aria-hidden="!cardVisible(position)" :inert="!cardVisible(position)">
              <div class="cover" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h5" /></svg></div>
              <span class="ptag">{{item.p.difficulty}}</span><h3>{{item.p.title}}</h3><p>{{item.p.summary}}</p>
              <div class="pfoot"><span>{{item.p.year}} · {{item.p.level}} · {{item.p.team}}</span><span class="go">{{item.p.views}}</span></div>
              <div class="pacts"><RouterLink class="btn-ghost" :to="`/contest/problem/${item.p.id}`">查看实训指导书</RouterLink><RouterLink class="btn-send" :to="`/research/replay/${item.p.id}`">在平台复现这一题</RouterLink></div>
            </article>
          </div>
        </div>
        <div class="carousel-footer"><div class="car-dots" aria-label="选择赛题位置"><button v-for="(_,index) in workProblems" :key="index" type="button" :class="{on:activeIndex===index}" :aria-label="'切换到赛题 '+(index+1)" :aria-current="activeIndex===index?'true':undefined" :disabled="transitioning" @click="goToCard(index)"><span aria-hidden="true"></span></button></div><span class="carousel-counter" role="status" :aria-live="rotationRunning?'off':'polite'">{{activeIndex+1}} / {{workProblems.length}}</span></div>
      </section>
      <form class="composer big" @submit.prevent="startResearch"><label class="sr-only" for="research-home-prompt">研究任务与背景</label><textarea id="research-home-prompt" v-model="researchPrompt" rows="2" maxlength="12000" placeholder="输入研究问题或赛事背景，进入工作台后继续整理材料……"></textarea><div class="cbar">
        <button type="button" class="btn-ghost" disabled title="材料上传功能待接入"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h5" /></svg>上传材料</button>
        <button type="button" class="btn-ghost" title="已有答卷／数据分析：进入对话式复现流程" @click="openOrLatest('dataset-analysis')"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v6h16v-6M12 16V3M7 8l5-5 5 5" /></svg>导入答卷</button>
        <span class="hint">填写背景后开始研究；材料上传待接入</span><div class="spacer"></div><button class="btn-send" type="submit">开始完整研究<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div></form>
      <p v-if="researchStore.storageError" class="home-error" role="alert">{{researchStore.storageError}}</p>
      <div class="chips" aria-label="独立快捷入口"><button type="button" class="chip" @click="openOrLatest('full-study')">继续完整研究 →</button><button type="button" class="chip" @click="openOrLatest('questionnaire-review')">已有问卷核对 →</button><button type="button" class="chip" @click="openOrLatest('dataset-analysis')">已有答卷／数据分析 →</button><RouterLink class="chip" to="/case-demo">案例演示专区 →</RouterLink></div>
    </div></section>
    <section class="section" aria-labelledby="all-works-title"><div class="sec-head"><h2 id="all-works-title">全部作品</h2><span class="sub">展示位置预留 · 真实作品接入后开放筛选与查看</span></div>
      <div class="filters" aria-label="作品筛选占位"><div class="frow"><span class="lbl">研究入口</span><div class="opts"><button v-for="label in ['全部','完整研究','已有问卷','已有答卷']" :key="label" type="button" class="chip" :class="{on:label==='全部'}" disabled>{{label}}</button></div></div><div class="frow"><span class="lbl">研究方式</span><div class="opts"><button v-for="label in ['全部','问卷调查','访谈研究','已有数据分析']" :key="label" type="button" class="chip" :class="{on:label==='全部'}" disabled>{{label}}</button></div></div><div class="frow"><span class="lbl">作品年份</span><div class="opts"><button type="button" class="chip on" disabled>全部</button><span class="filter-note">作品资料待接入</span></div></div></div>
      <div class="grid"><article v-for="index in 8" :key="index" class="gcard work-catalog-card"><div class="top"><span class="tag-c">作品占位</span><span class="mtag">待接入</span></div><h4>研究作品展示位 {{index}}</h4><p>这里预留作品简介与研究成果，真实内容接入后展示。</p><div class="mtags"><span class="mtag">封面预留</span><span class="mtag">简介预留</span><span class="mtag">成果预留</span></div></article></div>
      <p class="scope-note">作品卡片为占位展示。当前前四阶段支持本机填写和保存；真实 AI、正式保存与阶段确认仍待接入。</p>
    </section>
    <footer class="foot"><div class="foot-in"><strong>市调演真 · Survey Research Studio</strong><div class="grow"></div><span>面向市场调查的材料、分析与成果协作工作台</span></div></footer>
  </main>
</template>
<script setup lang="ts">
import {computed,nextTick,onMounted,onUnmounted,ref} from 'vue'
import {useRouter} from 'vue-router'
import {useUserStore} from '@/stores/user'
import {useResearchStore} from '@/stores/research'
import { CONTEST_PROBLEMS } from '@/data/contestProblems'
const userStore=useUserStore(),researchStore=useResearchStore(),router=useRouter(),researchPrompt=ref('')
const workProblems=CONTEST_PROBLEMS,CARD_STEP=312
const carouselViewport=ref<HTMLElement|null>(null),viewportWidth=ref(1360),physicalIndex=ref(0),animateTrack=ref(false),transitioning=ref(false),dragOffset=ref(0),dragging=ref(false)
const cloneCount=computed(()=>Math.min(workProblems.length,Math.max(1,Math.ceil((viewportWidth.value+16)/CARD_STEP))))
const activeIndex=computed(()=>((physicalIndex.value%workProblems.length)+workProblems.length)%workProblems.length)
const renderedCards=computed(()=>[
  ...workProblems.slice(-cloneCount.value).map(p=>({p,key:'before-'+p.id})),
  ...workProblems.map(p=>({p,key:'main-'+p.id})),
  ...workProblems.slice(0,cloneCount.value).map(p=>({p,key:'after-'+p.id})),
])
const rotationEnabled=ref(true),carouselHovered=ref(false),carouselFocused=ref(false),pageHidden=ref(false)
const rotationRunning=computed(()=>rotationEnabled.value&&!carouselHovered.value&&!carouselFocused.value&&!pageHidden.value&&!dragging.value)
let carouselTimer:ReturnType<typeof setInterval>|undefined,transitionTimer:ReturnType<typeof setTimeout>|undefined
let motionPreference:MediaQueryList|undefined,resizeObserver:ResizeObserver|undefined,frame=0,disposed=false,dragStartX=0,dragPointer:number|null=null
let dragPending=false,justDragged=false
function cardVisible(position:number){const start=cloneCount.value+physicalIndex.value;return position>=start&&position<start+cloneCount.value}
function enableTrackAnimation(){cancelAnimationFrame(frame);void nextTick(()=>{if(disposed)return;frame=requestAnimationFrame(()=>{if(!disposed)animateTrack.value=true})})}
function finishTransition(){
  if(transitionTimer!==undefined)clearTimeout(transitionTimer)
  transitionTimer=undefined
  if(physicalIndex.value!==activeIndex.value){animateTrack.value=false;physicalIndex.value=activeIndex.value;enableTrackAnimation()}
  transitioning.value=false
}
function onTrackTransitionEnd(event:TransitionEvent){if(event.target===event.currentTarget&&event.propertyName==='transform')finishTransition()}
function moveTo(index:number){
  if(transitioning.value||index===physicalIndex.value)return
  if(motionPreference?.matches){animateTrack.value=false;physicalIndex.value=((index%workProblems.length)+workProblems.length)%workProblems.length;return}
  animateTrack.value=true;transitioning.value=true;physicalIndex.value=index
  transitionTimer=setTimeout(finishTransition,720)
}
function moveCarousel(direction:number){moveTo(activeIndex.value+direction)}
function goToCard(index:number){moveTo(index)}
function onCarouselFocusOut(event:FocusEvent){carouselFocused.value=event.relatedTarget instanceof Node&&(event.currentTarget as HTMLElement).contains(event.relatedTarget)}
function onCarouselKey(event:KeyboardEvent){if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();moveCarousel(event.key==='ArrowLeft'?-1:1)}
function syncVisibility(){pageHidden.value=document.hidden}
function syncMotion(){if(motionPreference?.matches){rotationEnabled.value=false;finishTransition()}}
function measureCarousel(){
  const width=carouselViewport.value?.clientWidth;if(!width)return
  const current=activeIndex.value;animateTrack.value=false;finishTransition();physicalIndex.value=current;viewportWidth.value=width;dragOffset.value=0;enableTrackAnimation()
}
function startDrag(event:PointerEvent){
  if(event.button!==0||transitioning.value)return
  /* 按下只登记，不捕获指针：纯点击要让 click 正常落到卡内链接上 */
  dragPending=true;dragStartX=event.clientX;dragPointer=event.pointerId;dragOffset.value=0
}
function dragCarousel(event:PointerEvent){
  if(!dragPending||event.pointerId!==dragPointer)return
  const dx=event.clientX-dragStartX
  if(!dragging.value&&Math.abs(dx)>6){dragging.value=true;carouselViewport.value?.setPointerCapture(event.pointerId)}
  if(dragging.value)dragOffset.value=Math.max(-CARD_STEP,Math.min(CARD_STEP,dx))
}
function cancelDrag(){dragging.value=false;dragPending=false;dragOffset.value=0;dragPointer=null}
function finishDrag(event:PointerEvent){
  if(!dragPending||event.pointerId!==dragPointer)return
  const wasDragging=dragging.value,offset=dragOffset.value
  if(wasDragging&&carouselViewport.value?.hasPointerCapture(event.pointerId))carouselViewport.value.releasePointerCapture(event.pointerId)
  cancelDrag()
  if(wasDragging){justDragged=true;setTimeout(()=>{justDragged=false},0);if(Math.abs(offset)>60)moveCarousel(offset<0?1:-1)}
}
/** 拖拽结束后的 click 是误触，吞掉以免触发卡内链接跳转。 */
function onClickCapture(event:MouseEvent){if(justDragged){event.preventDefault();event.stopPropagation();justDragged=false}}
onMounted(()=>{
  motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');syncMotion();syncVisibility()
  motionPreference.addEventListener('change',syncMotion);document.addEventListener('visibilitychange',syncVisibility)
  measureCarousel();resizeObserver=new ResizeObserver(measureCarousel);resizeObserver.observe(carouselViewport.value!)
  carouselTimer=setInterval(()=>{if(rotationRunning.value&&!transitioning.value)moveCarousel(1)},3000)
})
onUnmounted(()=>{
  disposed=true;cancelAnimationFrame(frame);resizeObserver?.disconnect()
  if(carouselTimer!==undefined)clearInterval(carouselTimer)
  if(transitionTimer!==undefined)clearTimeout(transitionTimer)
  motionPreference?.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',syncVisibility)
})
function startResearch(){
  const background=researchPrompt.value.trim(),task=researchStore.create('full-study')
  if(background)researchStore.update({title:background.split('\n')[0]!.slice(0,120),competition:{...task.competition,background}})
  if(!researchStore.save())return
  void router.push({path:'/research/replay',query:{task:task.localTaskId}})
}
/** 快捷入口：已有同类任务直接进复现页打开，否则新建后进入（复现页内可跳工作台编辑）。 */
function openOrLatest(kind:'full-study'|'questionnaire-review'|'dataset-analysis'){
  const existing=Object.values(researchStore.registry.tasks).filter(t=>t.workflowKind===kind).sort((a,b)=>b.updatedAt-a.updatedAt)[0]
  if(existing){void router.push({path:'/research/replay',query:{task:existing.localTaskId}});return}
  const task=researchStore.create(kind)
  if(!researchStore.save())return
  void router.push({path:'/research/replay',query:{task:task.localTaskId}})
}
</script>
<style scoped lang="scss" src="../styles/research-home.scss"></style>
<style scoped>
.car-view{touch-action:pan-y}
.pcard.work-problem{min-height:286px;cursor:grab;user-select:none}
.pcard.work-problem:hover{transform:none;box-shadow:var(--sh-1)}
.pcard.work-problem .pacts a{cursor:pointer}
.pacts{display:flex;gap:8px;margin-top:10px}
.pacts .btn-ghost,.pacts .btn-send{padding:7px 11px;font-size:12.5px;border-radius:8px;white-space:nowrap}
</style>
