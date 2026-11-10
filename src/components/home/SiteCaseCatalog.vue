<template>
 <section class="case-catalog" :aria-label="featured?'精选案例':'全部案例'">
  <div class="heading"><h2>{{featured?'精选案例':'全部案例'}}</h2><span>{{READ_ONLY_CASE_CATALOG ? '数模案例 · 只读展示' : featured?'案例库中已发布的置顶案例':'按年份、赛别和题型筛选'}}</span><div v-if="featured" class="arrows"><button type="button" aria-label="上一组案例" @click="move(-1)">‹</button><button type="button" aria-label="下一组案例" @click="move(1)">›</button></div></div>
  <div v-if="!featured" class="case-filters"><label v-for="field in fields" :key="field.key">{{field.label}}<select v-model="filters[field.key]"><option value="">全部</option><option v-for="value in options(field.key)" :key="value" :value="value">{{value}}</option></select></label></div>
  <p v-if="state.error.value" class="case-error" role="alert">{{state.error.value}} <button type="button" :disabled="state.loading.value" @click="reloadOutsourcedCases()">重新读取</button></p>
  <p v-else-if="state.loading.value" role="status">正在读取案例库…</p>
  <div ref="track" class="case-list" :class="{featured}" @mouseenter="paused=true" @mouseleave="paused=false" @focusin="paused=true" @focusout="paused=false">
   <article v-for="item in visible" :key="item.id" class="case-card">
    <img v-if="caseCoverOf(item)" :src="caseCoverOf(item)" :alt="item.title+'封面'" loading="lazy"/><div v-else class="case-placeholder">研究案例</div>
    <div class="case-body"><span class="case-meta">{{[item.year,item.category,item.problemType].filter(Boolean).join(' · ')}}</span><h3>{{item.title}}</h3><p>{{item.summary || '查看实训指导与已发布成果'}}</p><div class="case-actions"><small>{{item.viewCount || 0}} 次浏览</small><RouterLink :to="'/p/'+encodeURIComponent(item.protoId)">查看案例 →</RouterLink></div></div>
   </article>
  </div>
  <p v-if="!state.loading.value && !state.error.value && !visible.length" class="case-empty">{{featured?'暂无已发布的置顶案例。':'没有符合筛选条件的已发布案例。'}}</p>
 </section>
</template>
<script setup lang="ts">
import {computed,onMounted,onUnmounted,reactive,ref} from 'vue'
import {READ_ONLY_CASE_CATALOG} from '@/api/outsourcedCases'
import {caseCoverOf} from '@/utils/caseCover'
import {loadOutsourcedCases,outsourcedCaseState,reloadOutsourcedCases} from '@/stores/outsourcedCases'
const props=defineProps<{featured?:boolean}>(),state=outsourcedCaseState(),track=ref<HTMLElement|null>(null),paused=ref(false)
const fields=[{key:'year',label:'年份'},{key:'category',label:'赛别'},{key:'problemType',label:'题型'}] as const
const filters=reactive({year:'',category:'',problemType:''})
const published=computed(()=>state.cases.value.filter(item=>item.status==='PUBLISHED'))
const visible=computed(()=>published.value.filter(item=>props.featured?item.pinned:fields.every(field=>!filters[field.key]||item[field.key]===filters[field.key])))
function options(key:typeof fields[number]['key']){return [...new Set(published.value.map(item=>item[key]).filter((s):s is string=>!!s))].sort().reverse()}
function move(direction:number){const el=track.value;if(!el)return;const end=el.scrollLeft+el.clientWidth>=el.scrollWidth-2;el.scrollTo({left:direction>0&&end?0:el.scrollLeft+direction*312,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
let timer:ReturnType<typeof setInterval>|undefined
onMounted(()=>{void loadOutsourcedCases();if(props.featured)timer=setInterval(()=>{if(!paused.value&&!document.hidden&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)move(1)},5000)})
onUnmounted(()=>clearInterval(timer))
</script>
<style scoped>
.heading{display:flex;align-items:center;gap:12px;margin:20px 0 16px}.heading h2{margin:0;color:#0B6E68;font-size:17px}.heading>span,.case-meta{font-size:12px;color:#72949C}.arrows{display:flex;gap:8px;margin-left:auto}.arrows button,.case-error button{border:1px solid #CCE4DF;background:#fff;border-radius:9px;color:#0B6E68;padding:4px 12px;font-size:20px;cursor:pointer}.case-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.case-list.featured{display:flex;overflow-x:auto;scrollbar-width:thin;scroll-snap-type:x mandatory;padding-bottom:10px}.case-card{min-width:0;border:1px solid #D5E8E4;border-radius:16px;overflow:hidden;background:#fff}.featured .case-card{flex:0 0 294px;scroll-snap-align:start}.case-card>img,.case-placeholder{display:block;width:100%;height:126px;object-fit:cover}.case-placeholder{display:grid;place-items:center;background:linear-gradient(120deg,#13A595,#29A1BC);color:#fff;font-size:16px}.case-body{padding:16px}.case-body h3{font-size:16px;line-height:1.6;margin:8px 0;color:#0B2E36}.case-body p{font-size:13px;line-height:1.7;color:#72949C;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}.case-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #E8F2EF;padding-top:12px}.case-actions small{font-size:11px;color:#8BA6AE}.case-actions a{border-radius:8px;padding:8px 12px;background:#0C9E94;color:#fff;text-decoration:none;font-size:12px}.case-filters{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0}.case-filters label{font-size:12px;color:#527D80}.case-filters select{margin-left:8px;border:1px solid #CCE4DF;border-radius:7px;padding:6px;background:#fff;color:#315E62}.case-empty{padding:24px;text-align:center;color:#7E9E9F;border:1px dashed #BDDBD3;border-radius:12px}.case-error{color:#96553E;font-size:13px}.case-error button{font-size:12px}
</style>
