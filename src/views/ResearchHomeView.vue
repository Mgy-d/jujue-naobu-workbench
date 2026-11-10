<template>
  <main class="research-home">
    <SiteNav />
    <section class="hero"><div class="hero-inner">
      <div class="hero-badge"><i class="dot" aria-hidden="true"></i>市场调查研究工作台</div>
      <h1>让调查材料，成为<span class="g">有据可查的结论</span></h1>
      <p class="sub">从赛事理解、选题到研究方案，在同一份任务中逐步推进。保留来源和未知项，让每一步研究都有据可查。</p>
      <SiteCaseCatalog featured />
      <form class="composer big" @submit.prevent="startResearch"><label class="sr-only" for="research-home-prompt">研究任务与背景</label><textarea id="research-home-prompt" v-model="researchPrompt" @input="clearEntryError" rows="2" maxlength="12000" placeholder="输入真实研究问题或背景，进入复现工作台并调用市调智能体……"></textarea><div class="cbar">
        <button type="button" class="btn-ghost" disabled title="材料上传功能待接入"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h5" /></svg>上传材料</button>
        <button type="button" class="btn-ghost" title="已有答卷／数据分析：进入对话式复现流程" @click="openOrLatest('dataset-analysis')"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15v6h16v-6M12 16V3M7 8l5-5 5 5" /></svg>导入答卷</button>
        <span class="hint">真实题目会调用市调智能体；下方赛题卡片为本机材料演示</span><div class="spacer"></div><button class="btn-send" type="submit">开始完整研究<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div></form>
      <p v-if="entryError||researchStore.storageError" class="home-error" role="alert">{{entryError||researchStore.storageError}}</p>
      <div class="chips" aria-label="独立快捷入口"><button type="button" class="chip" @click="openOrLatest('full-study')">继续完整研究 →</button><button type="button" class="chip" @click="openOrLatest('questionnaire-review')">已有问卷核对 →</button><button type="button" class="chip" @click="openOrLatest('dataset-analysis')">已有答卷／数据分析 →</button><RouterLink class="chip" :to="`/research/replay/college-part-time-satisfaction-pca`">大学生兼职满意度影响因素（完整演示） →</RouterLink></div>
    </div></section>
    <section class="section"><SiteCaseCatalog /></section>
    <footer class="foot"><div class="foot-in"><strong>市调演真 · Survey Research Studio</strong><div class="grow"></div><span>面向市场调查的材料、分析与成果协作工作台</span></div></footer>
  </main>
</template>
<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {useResearchStore} from '@/stores/research'
import {researchEntryTarget} from '@/utils/researchHomeEntry'
import SiteNav from '@/components/site/SiteNav.vue'
import SiteCaseCatalog from '@/components/home/SiteCaseCatalog.vue'
const researchStore=useResearchStore(),router=useRouter(),researchPrompt=ref(''),entryError=ref('')
function clearEntryError(){entryError.value="";}function startResearch(){
  const background=researchPrompt.value.trim();if(!background){entryError.value='请先填写真实研究主题或背景；下方赛题卡可直接进入完整演示。';return}entryError.value='';const task=researchStore.create('full-study')
  if(background)researchStore.update({title:background.split('\n')[0]!.slice(0,120),competition:{...task.competition,background}})
  if(!researchStore.save())return
  const target=researchEntryTarget(background,task.localTaskId);if(target)void router.push(target)
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
