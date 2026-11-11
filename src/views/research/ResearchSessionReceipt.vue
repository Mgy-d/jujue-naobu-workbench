<template>
<section class="session-receipt" :class="'receipt-'+presentation.tone" aria-label="当前会话状态">
  <header class="receipt-head"><h3>{{readablePhases(presentation.title)}}</h3><span v-if="displayPhase" class="receipt-phase"><span>{{phaseName||readablePhases(displayPhase)}}</span></span></header>
  <div class="receipt-body">
    <p v-if="responseTimedOut" class="receipt-error" role="alert">本次回复超时，已执行的修改与最终结果尚待核对。请先核对原会话和已保存文件，不要重复提交。</p><p v-if="error && !providerError" class="receipt-error" role="alert">{{readablePhases(error)}}</p>
    <p v-if="timedOut" class="receipt-error" role="alert">服务端报告本次审核已超时关闭，请先核对会话中的审核状态。</p>
    <p v-if="notice && !isReadNotice && !responseTimedOut" class="receipt-notice">{{readablePhases(notice)}}</p>
    <dl v-if="progress || checkedAt" class="receipt-facts">
      <div v-if="progress"><dt>{{responseTimedOut?'上次记录状态':'记录状态'}}</dt><dd>{{readablePhases(progress.state)}}</dd></div>
      <div v-if="progress"><dt>{{responseTimedOut?'上次记录的工作':'进行中'}}</dt><dd>{{readablePhases(progress.currentWork)}}</dd></div>
      <div v-if="checkedTime" class="receipt-checked"><dt>最近核对</dt><dd>{{checkedTime}}</dd></div>
    </dl>
    <div v-if="progress?.nextStep" class="receipt-next"><span>{{responseTimedOut?'超时前记录的下一步（尚未重新确认）':'下一步'}}</span><p>{{readablePhases(progress.nextStep)}}</p></div>
    <p v-if="backgroundNotice && !responseTimedOut" class="receipt-background">{{readablePhases(backgroundNotice)}}</p>
    <div v-if="hasDiagnostic || hasQuestionnaire || presentation.canCompose || canRecover || halted || (timedOut && !halted)" class="receipt-actions">
      <button v-if="hasDiagnostic" type="button" class="receipt-button" @click="emit('diagnostic')">导出核对信息</button>
      <button v-if="hasQuestionnaire" type="button" class="receipt-button primary" :disabled="busy" @click="emit('questionnaire')">查看当前会话问卷</button>
      <button v-if="presentation.canCompose" type="button" class="receipt-button" :class="{primary:!hasQuestionnaire}" :disabled="busy" @click="emit('compose')">补充说明</button>
      <button v-if="timedOut && !halted" type="button" class="receipt-button" :disabled="busy" @click="emit('restore-review')">请求恢复审核</button>
      <button v-if="halted" type="button" class="receipt-check" :disabled="busy" @click="emit('recheck')">核对已保存的审核结果</button>
      <button v-else-if="canRecover" type="button" class="receipt-check" :disabled="busy" @click="emit('recover')">{{responseTimedOut?'核对处理结果':'核对会话状态'}}</button>
    </div>
  </div>

</section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {readablePhases} from '@/utils/researchMessageRender'
import {researchResponseTimeout} from '@/utils/researchResponseDisplay'
import {conversationReceiptState} from '@/utils/researchConversationUi'
import type {ResearchProgressHint} from '@/utils/researchProgress'
const props=defineProps<{status:string;phase?:string;notice?:string;error?:string;progress?:ResearchProgressHint|null;checkedAt?:string;busy?:boolean;halted?:boolean;timedOut?:boolean;hasForms?:boolean;hasQuestionnaire?:boolean;canRecover?:boolean;backgroundNotice?:string;responseTimedOut?:boolean;hasDiagnostic?:boolean}>()
const emit=defineEmits<{questionnaire:[];compose:[];recover:[];recheck:[];'restore-review':[];diagnostic:[]}>()
const providerError=computed(()=>!!researchResponseTimeout(props.error||''))
const presentation=computed(()=>conversationReceiptState(props))
const displayPhase=computed(()=>props.progress?.phase||props.phase||'')
const phaseName=computed(()=>({G1:'研究设计',G2:'问卷与测试',G3:'数据分析',G4:'报告与答辩'}[displayPhase.value]||''))
const isReadNotice=computed(()=>/^产物列表已读取[，,；;]/.test(props.notice||''))
const checkedTime=computed(()=>{if(!props.checkedAt)return '';const date=new Date(props.checkedAt);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('zh-CN')})
</script>
<style scoped>
.session-receipt{min-width:0;width:100%;border-radius:12px;background:#fff;box-shadow:0 9px 25px #0b493708;overflow:hidden;color:#315f66}
.receipt-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;background:#0b625b;color:#fff}
.receipt-head h3{margin:0;font-size:22px;font-weight:650;line-height:1.45;letter-spacing:-.3px}
.receipt-phase{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;border:1px solid #76a298;border-radius:6px;padding:4px 8px;font-size:11px;color:#e0eee8}.receipt-phase b{color:inherit;font-size:12px}
.receipt-attention .receipt-head{background:#fdf0d8;color:#704d13}.receipt-attention .receipt-phase{color:#765b2a;border-color:#d9c291}
.receipt-active .receipt-head,.receipt-waiting .receipt-head{background:#e1f0eb;color:#165e55}.receipt-active .receipt-phase,.receipt-waiting .receipt-phase{color:#3d7569;border-color:#a8cbbf}
.receipt-body{padding:15px 20px 0}.receipt-notice,.receipt-background{margin:0 0 13px;font-size:13px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;color:#496d74}
.receipt-error{margin:0 0 13px;border:1px solid #ecd8b7;background:#fff8ec;color:#865a17;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.8;overflow-wrap:anywhere;white-space:pre-wrap}
.receipt-facts{display:flex;align-items:flex-start;gap:14px 28px;flex-wrap:wrap;margin:0;padding:0 0 13px;border-bottom:1px solid #e2eeea}.receipt-facts>div{min-width:80px;min-height:37px;max-width:100%}.receipt-facts dt{font-size:11px;color:#617f83;line-height:1.7}.receipt-facts dd{margin:3px 0 0;font-size:13px;font-weight:600;color:#28575a;overflow-wrap:anywhere;white-space:pre-wrap}.receipt-facts .receipt-checked{margin-left:auto;text-align:right}.receipt-checked dd{font-size:12px;font-weight:500;font-variant-numeric:tabular-nums}
.receipt-next{margin:12px 0}.receipt-next>span{font-size:11px;color:#617f83}.receipt-next p{margin:3px 0 0;font-size:15px;font-weight:600;line-height:1.8;color:#27554e;white-space:pre-wrap;overflow-wrap:anywhere}
.receipt-background{font-size:12px}.receipt-actions{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;padding:13px 0 15px;border-top:1px solid #e2eeea}
.receipt-button{min-height:37px;padding:8px 12px;border:1px solid #bfd5cd;border-radius:7px;background:#fff;color:#165e54;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .16s,border-color .16s,transform .12s}
.receipt-button:hover:not(:disabled){background:#eff7f2;border-color:#78ac98}.receipt-button.primary{position:relative;isolation:isolate;background:#0b6e68;border-color:transparent;color:#fff}.receipt-button.primary:before{content:'';position:absolute;inset:-2px;border-radius:9px;border:1px solid transparent;background:linear-gradient(110deg,#61cbb9,#278b9c,#b4dfc6) border-box;mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);mask-composite:exclude;opacity:0;pointer-events:none;transition:opacity .16s}.receipt-button.primary:hover:not(:disabled):before,.receipt-button.primary:focus-visible:before{opacity:1}.receipt-button.primary:hover:not(:disabled){background:#095c54;color:#fff}.receipt-button:active:not(:disabled){transform:translateY(1px)}
.receipt-check{margin-left:auto;background:transparent;border:0;color:#537a79;font:inherit;font-size:12px;padding:8px 0;min-height:37px;cursor:pointer;transition:color .16s}.receipt-check:hover:not(:disabled){color:#0b6e68;text-decoration:underline;text-underline-offset:4px}.receipt-check:disabled,.receipt-button:disabled{opacity:.45;cursor:not-allowed;transform:none}.receipt-details{border-top:1px solid #edf3f0;padding:9px 20px 11px;font-size:11px;color:#678488;line-height:1.8}.receipt-details summary{cursor:pointer;width:fit-content}.receipt-details p{margin:7px 0 0;font-size:12px;overflow-wrap:anywhere}.receipt-button:focus-visible,.receipt-check:focus-visible,.receipt-details summary:focus-visible{outline:2px solid #268f7c;outline-offset:3px}
@media(max-width:600px){.receipt-head{padding:14px 15px;align-items:flex-start;flex-wrap:wrap;gap:8px}.receipt-head h3{font-size:19px}.receipt-body{padding:13px 15px 0}.receipt-facts{gap:12px 18px}.receipt-facts .receipt-checked{margin-left:0;text-align:left}.receipt-actions{gap:8px}.receipt-check{margin-left:0}.receipt-details{padding:9px 15px}}
@media(prefers-reduced-motion:reduce){.receipt-button,.receipt-button.primary:before,.receipt-check{transition:none}.receipt-button:active:not(:disabled){transform:none}}
</style>
