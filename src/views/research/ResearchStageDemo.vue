<template>
 <section class="result-showcase">
  <header><div><small>{{phase || '待确认阶段'}} · 成果演示</small><h4>{{title}}</h4></div><button type="button" :disabled="loading" @click="loadList">{{loading?'读取中…':'刷新成果'}}</button></header>
  <p v-if="error" class="error" role="alert">{{error}}</p>
  <template v-if="sources.length">
   <label class="source-picker">本步骤成果<select :value="selected" :disabled="loading" @change="selectSource(($event.target as HTMLSelectElement).value)"><option v-for="file in sources" :key="file.path" :value="file.path">{{file.name}}</option></select></label>
   <p class="source-caption">{{source?.name}} <span v-if="readAt">· 读取于 {{readAt}}</span></p>
   <template v-if="slide">
    <div class="result-outline" aria-label="成果内容结构"><button v-for="(item,index) in slides" :key="index" type="button" :class="{active:index===frame}" :aria-pressed="index===frame" @click="frame=index;playing=false"><span>{{index+1}}</span>{{item.heading}}</button></div>
    <Transition name="result-frame" mode="out-in">
     <article :key="selected+':'+frame" class="result-scene">
      <div class="scene-heading"><span>{{frame+1}} / {{slides.length}}</span><h5>{{slide.heading}}</h5></div>
      <div v-if="slide.chart" class="chart" role="img" :aria-label="slide.chart.heading+'，数值来自当前成果原表'">
       <strong>{{slide.chart.heading}}</strong><div v-for="row in slide.chart.rows" :key="row.label" class="chart-row"><span>{{row.label}}</span><div class="bar-track"><i :style="{width:(row.value/Math.max(1,...slide.chart.rows.map(r=>r.value))*100)+'%'}"></i></div><b>{{row.display}}</b></div><small>按成果原表绘制，原表见下方内容。</small>
      </div>
      <pre v-if="isJson" class="result-content">{{slide.body}}</pre><div v-else class="result-content result-markdown" v-html="renderResearchMessage(slide.body,'assistant')"></div>
      <p v-if="slide.excerpt" class="note">本幕展示节选，可打开原文件查看完整内容。</p>
     </article>
    </Transition>
    <nav class="controls" aria-label="成果演示播放控制"><button type="button" :disabled="frame===0" @click="frame--;playing=false">← 上一幕</button><button type="button" :disabled="slides.length<2" :aria-pressed="playing" @click="playing=!playing">{{playing?'Ⅱ 暂停':'▶ 播放'}}</button><button type="button" :disabled="slides.length<2" @click="frame=(frame+1)%slides.length;playing=false">下一幕 →</button></nav>
    <button type="button" class="open-source" @click="$emit('preview',selected)">查看成果原文件 ↗</button>
   </template>
   <p v-else-if="!loading && !error" class="note">该文件没有可展示的内容，请选择其他成果。</p>
  </template>
  <p v-else-if="!loading && !error" class="empty">{{phase==='G4'?'当前会话尚未读取到报告正文、报告骨架或答辩成果。':'当前会话尚未读取到本步骤对应成果。'}}生成并保存后，点击“刷新成果”读取。</p>
  <p class="note">展示内容来自当前会话文件；文件中标注的草稿、未完成及待确认事项仍然有效。</p>
 </section>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {fetchArtifactTree,fetchArtifactContent} from '@/api/artifact'
import {researchCloudOwner} from '@/api/researchCloud'
import {renderResearchMessage} from '@/utils/researchMessageRender'
import {resultSlides,type ResultSlide} from '@/utils/researchResultSlides'
import type {ArtifactNode} from '@/types/sandbox'
const props=defineProps<{phase:string;title:string;files:{name:string;path:string}[];agentId:string;threadId:string}>()
defineEmits<{preview:[path:string]}>()
const sources=ref<{name:string;path:string}[]>([]),selected=ref(''),slides=ref<ResultSlide[]>([]),frame=ref(0),playing=ref(false),loading=ref(false),error=ref(''),readAt=ref('')
const source=computed(()=>sources.value.find(f=>f.path===selected.value)),slide=computed(()=>slides.value[frame.value]),isJson=computed(()=>/\.json$/i.test(source.value?.name || ''))
let generation=0,controller:AbortController|undefined,timer:ReturnType<typeof setInterval>|undefined
const flatten=(nodes:ArtifactNode[]):{name:string;path:string}[]=>nodes.flatMap(n=>n.type==='file'?[n]:flatten(n.children||[]))
const allowed=(name:string,path:string)=>{
 if(/(?:^|\/)(?:_proof|_state|_input|uploads|分析代码)\//.test(path)||/日志|AI使用|AI整理|manifest|校验|核验|交接|登记/.test(name))return false
 const pattern:Record<string,RegExp>={G1:/研究简报|研究问题|调查方案|研究方案/,G2:/问卷结构|问卷正文|预测试方案|审查报告/,G3:/统计报告|统计结果|分析报告|质检报告/,G4:/报告|答辩|PPT|结论/}
 return !!pattern[props.phase]?.test(name) && /\.(md|txt|json)$/i.test(name)
}
function begin(){controller?.abort();controller=new AbortController();playing.value=false;error.value='';return {id:++generation,owner:researchCloudOwner(),thread:props.threadId,signal:controller.signal}}
function valid(context:ReturnType<typeof begin>){return context.id===generation&&context.owner===researchCloudOwner()&&context.thread===props.threadId}
async function selectSource(path:string){
 const context=begin();selected.value=path;slides.value=[];frame.value=0;readAt.value='';loading.value=true
 try{const result=await fetchArtifactContent(props.agentId,props.threadId,path,context.signal);if(!valid(context))return
 if(result.path!==path || result.content===null || result.binary || result.truncated)throw Error(result.reason||'成果内容未完整读取，暂不生成演示')
 slides.value=resultSlides(result.content,sources.value.find(f=>f.path===path)?.name||path);readAt.value=new Date().toLocaleTimeString('zh-CN')
 }catch(e){if(valid(context))error.value=e instanceof Error?e.message:'成果读取失败'}finally{if(valid(context))loading.value=false}
}
async function loadList(){
 const context=begin();sources.value=[];slides.value=[];selected.value='';frame.value=0;readAt.value='';loading.value=true
 if(!props.agentId || !props.threadId || !props.phase){loading.value=false;return}
 try{const tree=await fetchArtifactTree(props.agentId,props.threadId,context.signal);if(!valid(context))return
 sources.value=flatten(tree).filter(f=>allowed(f.name,f.path)).sort((a,b)=>Number(/\.json$/i.test(a.name))-Number(/\.json$/i.test(b.name)))
 if(sources.value[0])await selectSource(sources.value[0].path)
 }catch(e){if(valid(context))error.value=e instanceof Error?e.message:'成果列表读取失败'}finally{if(valid(context))loading.value=false}
}
watch(()=>[props.agentId,props.threadId,props.phase],()=>{void loadList()},{immediate:true})
onMounted(()=>{timer=setInterval(()=>{if(playing.value&&slides.value.length)frame.value=(frame.value+1)%slides.value.length},7000)})
onBeforeUnmount(()=>{generation++;controller?.abort();clearInterval(timer)})
</script>
<style scoped>
.result-showcase{min-width:0}.result-showcase header{display:flex;align-items:center;justify-content:space-between;gap:12px}.result-showcase header small{color:#5D8B7E;font-size:11px}.result-showcase h4{margin:5px 0 12px;font-size:15px;color:#103E34;line-height:1.6}.result-showcase button{border:1px solid #AFD3C7;background:#fff;color:#16735D;border-radius:8px;padding:7px 10px;font:inherit;font-size:12px;cursor:pointer;transition:background .18s,box-shadow .18s}.result-showcase button:hover:not(:disabled){background:#E7F6EF;box-shadow:0 2px 8px #0A5E4717}.result-showcase button:disabled{opacity:.5;cursor:default}.result-showcase button:focus-visible{outline:2px solid #16896D;outline-offset:2px}.source-picker{display:grid;gap:6px;font-size:12px;color:#63877B}.source-picker select{max-width:100%;width:100%;padding:9px;border:1px solid #B8D8CC;border-radius:8px;background:white;color:#285B4E;font:inherit}.source-caption,.note{font-size:11px;color:#6B8C80;line-height:1.7;overflow-wrap:anywhere}.source-caption{margin:8px 0 12px}.result-outline{display:flex;gap:6px;overflow-x:auto;max-height:100px;margin-bottom:12px;padding-bottom:6px}.result-outline button{flex-shrink:0;max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.result-outline button span{margin-right:5px}.result-outline button.active{background:#D8F0E4;border-color:#289B78;font-weight:700}.result-scene{border:1px solid #A7D1C1;border-radius:13px;background:#FFF;overflow:hidden;box-shadow:0 4px 15px #0B6E5810}.scene-heading{padding:14px 16px;background:#EDF8F2;border-bottom:1px solid #CBE5D8}.scene-heading>span{font-size:10px;color:#76A08D}.scene-heading h5{margin:5px 0 0;font-size:16px;line-height:1.6;color:#0C5A43}.result-content{padding:16px;margin:0;max-height:440px;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap;font-size:13px;line-height:1.9;color:#355E50}.result-markdown{white-space:normal}.result-markdown :deep(p){margin:0 0 12px}.result-markdown :deep(table){border-collapse:collapse;display:block;overflow:auto;width:100%;font-size:11px}.result-markdown :deep(th),.result-markdown :deep(td){border:1px solid #D1E4DA;padding:6px 8px;text-align:left}.result-markdown :deep(th){background:#F0F8F3}.result-markdown :deep(ul),.result-markdown :deep(ol){padding-left:20px}.result-markdown :deep(pre){overflow:auto;white-space:pre;padding:10px;background:#F1F7F3}.result-scene>.note{padding:0 16px}.controls{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:12px 0}.open-source{width:100%;text-align:center}.error{padding:10px;background:#FFF2ED;border-radius:8px;color:#995333;font-size:12px;overflow-wrap:anywhere}.empty{padding:24px 12px;text-align:center;background:#F2F8F4;border-radius:10px;color:#698A7B;font-size:13px;line-height:1.8}.chart{padding:16px;border-bottom:1px solid #D7E8DF}.chart>strong{font-size:12px;color:#39745C}.chart-row{display:grid;grid-template-columns:minmax(60px,1fr) 2fr 50px;gap:8px;align-items:center;font-size:11px;margin-top:10px}.chart-row>span{overflow-wrap:anywhere}.chart-row b{font-weight:600;color:#286E54}.bar-track{height:12px;background:#EAF5EF;border-radius:4px;overflow:hidden}.bar-track i{display:block;height:100%;background:linear-gradient(90deg,#28A980,#6EC8A7);border-radius:4px;animation:bar-in .7s ease both;transform-origin:left}.chart>small{display:block;font-size:10px;color:#81A390;margin-top:10px}.result-frame-enter-active,.result-frame-leave-active{transition:opacity .22s,transform .22s}.result-frame-enter-from{opacity:0;transform:translateY(7px)}.result-frame-leave-to{opacity:0;transform:translateY(-4px)}@keyframes bar-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media(prefers-reduced-motion:reduce){.bar-track i{animation:none}.result-frame-enter-active,.result-frame-leave-active,.result-showcase button{transition:none}}
</style>
