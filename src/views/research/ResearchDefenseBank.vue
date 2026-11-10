<template>
<section class="defense-bank" aria-label="答辩准备题库">
  <header class="bank-heading"><div><h3>答辩准备</h3><p>共 {{bank.total}} 个问题<span v-if="bank.version"> · {{bank.version}}</span> · {{bank.groups.length}} 类</p></div><span class="bank-tag">团队核对</span></header>
  <p class="bank-note">展开问题，查看已有证据提示并准备回答。关注程度沿用原文件标注，不代表问题已解决。</p>
  <p v-if="!hasAnswers" class="bank-note">这份题库尚未提供参考回答，需由团队结合研究成果准备。</p>
  <section v-for="group in bank.groups" :key="group.category" class="question-group">
    <h4>{{group.category}} <span>{{group.questions.length}} 题</span></h4>
    <details v-for="(item,index) in group.questions" :key="index" class="defense-question">
      <summary><span class="question-number">{{item.id||index+1}}</span><span class="question-title">{{item.question}}</span><span v-if="item.riskLevel" class="risk" :class="{high:item.riskLevel==='高'}">关注：{{item.riskLevel}}</span></summary>
      <div class="question-body"><div v-if="item.evidenceHint" class="evidence"><h5>核对依据</h5><p>{{item.evidenceHint}}</p></div><div><h5>参考回答</h5><p>{{item.answer||'本题尚未提供参考回答，请结合已有证据准备。'}}</p></div><p v-if="item.owner" class="owner">负责准备：{{item.owner}}</p></div>
    </details>
  </section>
  <p v-if="!bank.total" class="bank-note">题库中暂无问题。</p>
</section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import type {DefenseBank} from '@/utils/researchDefenseBank'
const props=defineProps<{bank:DefenseBank}>()
const hasAnswers=computed(()=>props.bank.groups.some(group=>group.questions.some(question=>question.answer)))
</script>
<style scoped>
.bank-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.bank-heading h3{margin:0;color:#123f46;font-size:21px}.bank-heading p{margin:8px 0;font-size:13px;color:#69828a}.bank-tag{padding:5px 10px;border-radius:8px;background:#e8f5f0;color:#167a6b;white-space:nowrap;font-size:12px}.bank-note{line-height:1.85;color:#69828a;font-size:13px}.question-group{margin-top:24px}.question-group>h4{display:flex;align-items:center;gap:10px;font-size:16px;color:#164e53;margin:0 0 12px}.question-group>h4>span{font-size:12px;font-weight:400;color:#7d9597}.defense-question{margin:10px 0;border:1px solid #bedbd3;border-radius:12px;background:#fff;overflow:hidden}.defense-question[open]{border-color:#72b7a6}.defense-question>summary{display:flex;align-items:flex-start;gap:10px;padding:15px;cursor:pointer;list-style:none}.defense-question>summary::-webkit-details-marker{display:none}.defense-question>summary:after{content:'＋';color:#168b7e;margin-left:auto;flex-shrink:0}.defense-question[open]>summary:after{content:'−'}.defense-question>summary:hover{background:#f3faf7}.defense-question>summary:focus-visible{outline:2px solid #168b7e;outline-offset:-3px}.question-number{font-size:12px;color:#377a70;background:#eaf5f0;border-radius:6px;padding:2px 6px;flex-shrink:0}.question-title{color:#174950;line-height:1.7;font-weight:600;overflow-wrap:anywhere}.risk{font-size:11px;color:#886925;background:#fbf5e6;border-radius:5px;padding:3px 6px;white-space:nowrap;margin-top:2px}.risk.high{color:#9d503e;background:#fcf0e8}.question-body{padding:2px 18px 16px 18px;border-top:1px solid #e1eee9}.question-body h5{margin:15px 0 5px;font-size:13px;color:#356a64}.question-body p{margin:0;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere}.evidence{padding:0 12px 10px;border-left:3px solid #90cabc;margin-top:12px;background:#f5faf8}.evidence h5{padding-top:8px;margin-top:0}.question-body .owner{margin-top:14px;color:#7a9295;font-size:12px}@media(max-width:540px){.defense-question>summary{flex-wrap:wrap}.question-title{flex:1 1 70%}.risk{margin-left:40px}}
</style>
