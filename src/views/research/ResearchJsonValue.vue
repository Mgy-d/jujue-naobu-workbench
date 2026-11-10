<template>
  <p v-if="node.kind==='value' || node.kind==='limit'" class="json-value" :class="{muted:node.kind==='limit'}">{{node.text===''?'（空文本）':node.text}}</p>
  <div v-else class="json-group">
    <p v-if="!node.total" class="muted">{{node.kind==='array'?'暂无条目':'暂无字段'}}</p>
    <div v-for="(entry,index) in node.entries" :key="index" class="json-entry">
      <template v-if="entry.node.kind==='value' || entry.node.kind==='limit'"><div class="json-label">{{entry.label}}</div><ResearchJsonValue :node="entry.node" :depth="depth+1" /></template>
      <details v-else :open="depth===0"><summary>{{entry.label}} <span>{{entry.node.total}} {{entry.node.kind==='array'?'项':'个字段'}}</span></summary><ResearchJsonValue :node="entry.node" :depth="depth+1" /></details>
    </div>
    <p v-if="(node.total||0)>(node.entries?.length||0)" class="muted">仅展示前 {{node.entries?.length}} 项，完整内容可在“查看原文”中阅读。</p>
  </div>
</template>
<script setup lang="ts">
import type {ArtifactJsonNode} from '@/utils/researchArtifactPreview'
defineProps<{node:ArtifactJsonNode;depth:number}>()
</script>
<style scoped>
.json-group{min-width:0}.json-entry{padding:12px 0;border-bottom:1px solid #e1eeeb}.json-entry:last-child{border-bottom:0}.json-label,summary{font-weight:600;color:#174e54}.json-value{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.json-entry details>.json-group{margin:8px 0 0 12px;padding-left:12px;border-left:2px solid #d8ebe5}summary{cursor:pointer;line-height:1.8}summary span,.muted{font-size:12px;color:#718b90;font-weight:400}
</style>
