<template>
  <main class="research-home">
    <header class="nav"><div class="nav-inner">
      <RouterLink class="brand" to="/"><span class="brand-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V6M4 19h16M8 19v-6M12 19V9M16 19v-8M20 19v-4" /></svg></span><span class="brand-txt"><strong class="brand-name">市调演真</strong><small class="brand-sub">Survey Research Studio</small></span></RouterLink>
      <nav class="nav-links" aria-label="主导航"><RouterLink class="on" to="/">首页</RouterLink><RouterLink to="/research/work?mode=full">研究工作台</RouterLink><RouterLink to="/research/work?mode=full">本机草稿</RouterLink></nav>
      <div class="nav-right"><span v-if="userStore.isLogged">{{userStore.displayName}}</span><RouterLink v-else class="btn-login" to="/login">登录 / 注册</RouterLink><button v-if="userStore.isLogged" class="btn-ghost" @click="userStore.logout()">退出</button></div>
    </div></header>
    <section class="hero"><div class="hero-inner">
      <div class="hero-badge"><i class="dot" aria-hidden="true"></i>市场调查研究工作台</div>
      <h1>让调查材料，成为<span class="g">有据可查的结论</span></h1>
      <p class="sub">从赛事理解、选题到研究方案，在同一份任务中逐步推进。保留来源和未知项，让每一步研究都有据可查。</p>
      <section class="hero-reco" aria-labelledby="research-works-title" aria-roledescription="轮播" @mouseenter="carouselHovered=true" @mouseleave="carouselHovered=false" @focusin="carouselFocused=true" @focusout="onCarouselFocusOut" @keydown="onCarouselKey">
        <div class="sec-head"><h2 id="research-works-title">研究作品</h2><span class="sub">卡片占位展示 · 真实作品后续接入</span><div class="grow"></div><div class="sec-acts">
          <button type="button" class="btn-ghost rotation-control" :aria-label="rotationEnabled?'暂停自动轮播':'开启自动轮播'" @click="rotationEnabled=!rotationEnabled">{{rotationEnabled?'暂停轮播':'继续轮播'}}</button>
          <button type="button" class="icon-btn" aria-label="上一张作品" aria-controls="research-work-track" :disabled="transitioning" @click="moveCarousel(-1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 6-6 6 6 6" /></svg></button>
          <button type="button" class="icon-btn" aria-label="下一张作品" aria-controls="research-work-track" :disabled="transitioning" @click="moveCarousel(1)"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10 6 6 6-6 6" /></svg></button>
        </div></div>
        <div ref="carouselViewport" class="car-view" tabindex="0" aria-label="作品占位卡片，可拖动或使用左右方向键切换" @pointerdown="startDrag" @pointermove="dragCarousel" @pointerup="finishDrag" @pointercancel="cancelDrag">
          <div id="research-work-track" class="car-track" :class="{ 'no-motion':!animateTrack,grabbing:dragging }" :style="{transform:`translateX(${-((cloneCount+physicalIndex)*CARD_STEP)+dragOffset}px)`}" @transitionend="onTrackTransitionEnd">
            <article v-for="(item,position) in renderedCards" :key="item.key" class="pcard work-placeholder" :data-work="item.slot" :aria-hidden="!cardVisible(position)" :inert="!cardVisible(position)">
              <div class="cover" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h5" /></svg><span class="cover-label">作品封面预留</span></div>
              <span class="ptag">作品占位</span><h3>研究作品展示位 {{item.slot}}</h3><p>这里预留作品的题目、简介与研究成果，真实内容接入后展示。</p>
              <div class="pfoot"><span>真实作品待接入</span><span class="go">详情待开放</span></div>
            </article>
          </div>
        </div>
        <div class="carousel-footer"><div class="car-dots" aria-label="选择作品位置"><button v-for="(_,index) in placeholderWorks" :key="index" type="button" :class="{on:activeIndex===index}" :aria-label="'切换到作品位置 '+(index+1)" :aria-current="activeIndex===index?'true':undefined" :disabled="transitioning" @click="goToCard(index)"><span aria-hidden="true"></span></button></div><span class="carousel-counter" role="status" :aria-live="rotationRunning?'off':'polite'">{{activeIndex+1}} / {{placeholderWorks.length}}</span></div>
      </section>
      <form class="composer big" @submit.prevent="startResearch"><label class="sr-only" for="research-home-prompt">研究任务与背景</label><textarea id="research-home-prompt" v-model="researchPrompt" rows="2" maxlength="12000" placeholder="输入研究问题或赛事背景，进入工作台后继续整理材料……"></textarea><div class="cbar">
        <button type="button" class="btn-ghost" disabled title="材料上传功能待接入"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h5" /></svg>上传材料</button>
        <RouterLink class="btn-ghost" to="/research/work?mode=analysis" title="进入已有答卷分析并上传数据"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v6h16v-6M12 16V3M7 8l5-5 5 5" /></svg>导入答卷</RouterLink>
        <span class="hint">填写背景后开始研究；材料上传待接入</span><div class="spacer"></div><button class="btn-send" type="submit">开始完整研究<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div></form>
      <p v-if="researchStore.storageError" class="home-error" role="alert">{{researchStore.storageError}}</p>
      <div class="chips" aria-label="独立快捷入口"><RouterLink class="chip" to="/research/work?mode=full">继续完整研究 →</RouterLink><RouterLink class="chip" to="/research/work?mode=questionnaire">已有问卷核对 →</RouterLink><RouterLink class="chip" to="/research/work?mode=analysis">已有答卷／数据分析 →</RouterLink></div>
    </div></section>
    <section class="section" aria-labelledby="all-works-title"><div class="sec-head"><h2 id="all-works-title">全部作品</h2><span class="sub">展示位置预留 · 真实作品接入后开放筛选与查看</span></div>
      <div class="filters" aria-label="作品筛选占位"><div class="frow"><span class="lbl">研究入口</span><div class="opts"><button v-for="label in ['全部','完整研究','已有问卷','已有答卷']" :key="label" type="button" class="chip" :class="{on:label==='全部'}" disabled>{{label}}</button></div></div><div class="frow"><span class="lbl">研究方式</span><div class="opts"><button v-for="label in ['全部','问卷调查','访谈研究','已有数据分析']" :key="label" type="button" class="chip" :class="{on:label==='全部'}" disabled>{{label}}</button></div></div><div class="frow"><span class="lbl">作品年份</span><div class="opts"><button type="button" class="chip on" disabled>全部</button><span class="filter-note">作品资料待接入</span></div></div></div>
      <div class="grid"><article v-for="index in placeholderWorks" :key="index" class="gcard work-catalog-card"><div class="top"><span class="tag-c">作品占位</span><span class="mtag">待接入</span></div><h4>研究作品展示位 {{index}}</h4><p>这里预留作品简介与研究成果，真实内容接入后展示。</p><div class="mtags"><span class="mtag">封面预留</span><span class="mtag">简介预留</span><span class="mtag">成果预留</span></div></article></div>
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
const userStore=useUserStore(),researchStore=useResearchStore(),router=useRouter(),researchPrompt=ref('')
const placeholderWorks=Array.from({length:12},(_,index)=>index+1),CARD_STEP=312
const carouselViewport=ref<HTMLElement|null>(null),viewportWidth=ref(1360),physicalIndex=ref(0),animateTrack=ref(false),transitioning=ref(false),dragOffset=ref(0),dragging=ref(false)
const cloneCount=computed(()=>Math.min(placeholderWorks.length,Math.max(1,Math.ceil((viewportWidth.value+16)/CARD_STEP))))
const activeIndex=computed(()=>((physicalIndex.value%placeholderWorks.length)+placeholderWorks.length)%placeholderWorks.length)
const renderedCards=computed(()=>[
  ...placeholderWorks.slice(-cloneCount.value).map(slot=>({slot,key:'before-'+slot})),
  ...placeholderWorks.map(slot=>({slot,key:'main-'+slot})),
  ...placeholderWorks.slice(0,cloneCount.value).map(slot=>({slot,key:'after-'+slot})),
])
const rotationEnabled=ref(true),carouselHovered=ref(false),carouselFocused=ref(false),pageHidden=ref(false)
const rotationRunning=computed(()=>rotationEnabled.value&&!carouselHovered.value&&!carouselFocused.value&&!pageHidden.value&&!dragging.value)
let carouselTimer:ReturnType<typeof setInterval>|undefined,transitionTimer:ReturnType<typeof setTimeout>|undefined
let motionPreference:MediaQueryList|undefined,resizeObserver:ResizeObserver|undefined,frame=0,disposed=false,dragStartX=0,dragPointer:number|null=null
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
  if(motionPreference?.matches){animateTrack.value=false;physicalIndex.value=((index%placeholderWorks.length)+placeholderWorks.length)%placeholderWorks.length;return}
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
  dragging.value=true;dragStartX=event.clientX;dragPointer=event.pointerId;dragOffset.value=0
  carouselViewport.value?.setPointerCapture(event.pointerId)
}
function dragCarousel(event:PointerEvent){if(dragging.value&&event.pointerId===dragPointer)dragOffset.value=Math.max(-CARD_STEP,Math.min(CARD_STEP,event.clientX-dragStartX))}
function cancelDrag(){dragging.value=false;dragOffset.value=0;dragPointer=null}
function finishDrag(event:PointerEvent){
  if(!dragging.value||event.pointerId!==dragPointer)return
  const offset=dragOffset.value;if(carouselViewport.value?.hasPointerCapture(event.pointerId))carouselViewport.value.releasePointerCapture(event.pointerId)
  cancelDrag();if(Math.abs(offset)>60)moveCarousel(offset<0?1:-1)
}
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
  void router.push({path:'/research/work',query:{mode:'full',task:task.localTaskId}})
}
</script>
<style scoped lang="scss" src="../styles/research-home.scss"></style>
