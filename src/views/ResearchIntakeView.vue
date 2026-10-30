<template>
  <main class="intake-page">
    <header class="intake-header">
      <RouterLink class="back-link" to="/">← 返回市调演真</RouterLink>
      <RouterLink to="/research/sandbox">进入本机沙箱 →</RouterLink>
      <span class="trial-badge">市调接入试片 · 本机模式</span>
    </header>

    <section class="intro">
      <p class="eyebrow">拒绝脑补 / 数据任务</p>
      <h1>已有数据分析</h1>
      <p>先把任务上下文和数据入口接进工作台。当前文件只在本页暂存，运行与服务端保存尚未接通。</p>
    </section>

    <section class="context-card" aria-label="任务上下文">
      <div class="context-heading">
        <div>
          <span class="section-kicker">任务上下文</span>
          <h2>{{ draft.title }}</h2>
        </div>
        <span class="phase-chip">阶段 0 · 数据准备与分析</span>
      </div>

      <label class="title-field">
        <span>本机草稿名称</span>
        <input :value="draft.title" maxlength="120" @input="updateTitle" />
      </label>

      <div class="context-grid">
        <div><span>流程类型</span><strong>dataset-analysis</strong></div>
        <div><span>本机草稿 ID</span><code>{{ draft.draftId }}</code></div>
        <div><span>服务端 projectId</span><strong class="muted">尚未创建</strong></div>
        <div><span>服务端 workflowId</span><strong class="muted">尚未创建</strong></div>
      </div>
      <p class="context-note">{{ capabilities.projectCreation.message }}</p>
    </section>

    <section class="work-grid">
      <article class="panel">
        <div class="panel-heading">
          <div><span class="section-kicker">01 / 输入材料</span><h2>选择一份数据文件</h2></div>
          <span class="state-chip" :class="{ selected: draft.inputFile }">{{ draft.inputFile ? '已选择 · 未上传' : '等待选择' }}</span>
        </div>

        <label class="file-drop">
          <input type="file" @change="selectFile" />
          <span class="file-mark" aria-hidden="true">＋</span>
          <strong>从本机选择文件</strong>
          <span>仅暂存文件名与大小，不读取正文、不做解析。</span>
        </label>

        <div v-if="draft.inputFile" class="file-card">
          <div class="file-icon" aria-hidden="true">FILE</div>
          <div class="file-details">
            <strong>{{ draft.inputFile.name }}</strong>
            <span>{{ formatBytes(draft.inputFile.size) }} · {{ fileInputState }}</span>
          </div>
          <button class="text-button" type="button" @click="clearFile">移除</button>
        </div>

        <div class="button-row">
          <button class="primary-button" type="button" @click="saveLocalDraft">保存本机草稿</button>
          <button class="secondary-button" type="button" disabled :title="capabilities.projectUpload.message">上传到项目（未接通）</button>
        </div>
        <p class="inline-feedback" role="status" aria-live="polite">{{ feedback }}</p>
        <p v-if="savedAt" class="saved-time">本机草稿保存于 {{ formatDate(savedAt) }}</p>
      </article>

      <aside class="panel status-panel" aria-label="运行与保存状态">
        <span class="section-kicker">02 / 处理与保存</span>
        <h2>能力状态</h2>

        <div class="capability">
          <span class="status-dot unavailable"></span>
          <div><strong>解析与统计运行</strong><p>{{ capabilities.analysisRun.message }}</p></div>
          <button type="button" disabled :title="capabilities.analysisRun.message">未接通</button>
        </div>

        <div class="capability">
          <span class="status-dot unavailable"></span>
          <div><strong>保存为项目成果</strong><p>{{ capabilities.serverSave.message }}</p></div>
          <button type="button" disabled :title="capabilities.serverSave.message">未接通</button>
        </div>

        <div class="local-save">
          <span class="status-dot" :class="{ saved: savedAt }"></span>
          <div>
            <strong>本机草稿</strong>
            <p>{{ savedAt ? '已保存任务名称与文件元数据；文件正文不在草稿中。' : '尚未保存。点击“保存本机草稿”后写入当前浏览器。' }}</p>
          </div>
        </div>

        <p class="scope-note">{{ capabilities.projectUpload.message }} 刷新后只恢复文件元数据，原文件需重新选择。</p>
      </aside>
    </section>

    <footer class="intake-footer">
      本页不会调用数模智能体、数学解析器或统计运行环境；真实接口接入后再启用上传、运行和项目成果保存。
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import {
  createResearchIntakeDraft,
  loadResearchIntakeDraft,
  newResearchIntakeDraftId,
  recordSelectedInput,
  RESEARCH_INTAKE_CAPABILITIES,
  saveResearchIntakeDraft,
  type ResearchIntakeDraft,
} from '@/utils/research-intake.js'

const capabilities = RESEARCH_INTAKE_CAPABILITIES
const draft = ref<ResearchIntakeDraft>(createResearchIntakeDraft(newResearchIntakeDraftId()))
const selectedFile = ref<File | null>(null)
const savedAt = ref<number | null>(null)
const feedback = ref('文件尚未上传；选择文件只会暂存本机元数据。')
const fileInputState = computed(() =>
  selectedFile.value ? '仅在当前页面内存中' : '上次已选文件的元数据，需重新选择',
)

onMounted(() => {
  try {
    const restored = loadResearchIntakeDraft(window.localStorage)
    if (!restored) return
    draft.value = restored
    savedAt.value = restored.savedAt
    feedback.value = restored.inputFile
      ? '已恢复本机草稿元数据；原文件正文未保存，请重新选择文件。'
      : '已恢复本机草稿。'
  } catch {
    feedback.value = '无法读取本机草稿存储；当前内容尚未保存。'
  }
})

function updateTitle(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  draft.value = { ...draft.value, title: value, updatedAt: Date.now() }
  savedAt.value = null
  feedback.value = '名称已修改，尚未保存到本机草稿。'
}

function selectFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    draft.value = recordSelectedInput(draft.value, file)
    selectedFile.value = file
    savedAt.value = null
    feedback.value = '文件已在本页暂存，尚未上传或解析。'
  } catch {
    feedback.value = '无法读取该文件的基本元数据，请重新选择。'
  }
}

function clearFile(): void {
  draft.value = { ...draft.value, inputFile: null, updatedAt: Date.now() }
  selectedFile.value = null
  savedAt.value = null
  feedback.value = '文件已从本机草稿中移除；服务端未发生变更。'
}

function saveLocalDraft(): void {
  try {
    const saved = saveResearchIntakeDraft(window.localStorage, draft.value)
    draft.value = saved
    savedAt.value = saved.savedAt
    feedback.value = '本机草稿已保存；这不代表已创建服务端项目或上传文件。'
  } catch {
    savedAt.value = null
    feedback.value = '本机草稿保存失败；浏览器存储不可用或空间不足。'
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}
</script>

<style scoped>
.intake-page { box-sizing: border-box; min-height: 100vh; padding: 28px clamp(18px, 5vw, 72px) 40px; color: #193544; background: #f3f7f8; }
.intake-header, .context-heading, .panel-heading, .button-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.intake-header { max-width: 1120px; margin: 0 auto 44px; }
.back-link { color: #526d79; text-decoration: none; font-size: 14px; }
.back-link:hover { color: #087b78; }
.trial-badge, .phase-chip, .state-chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 7px 12px; color: #087b78; background: #e1f2f0; font-size: 12px; font-weight: 650; }
.intro, .context-card, .work-grid, .intake-footer { max-width: 1120px; margin-left: auto; margin-right: auto; }
.intro { margin-bottom: 24px; }
.eyebrow, .section-kicker { color: #6c8993; font-size: 12px; letter-spacing: .08em; }
.eyebrow { margin: 0 0 10px; }
h1 { margin: 0; color: #153744; font-size: clamp(28px, 4vw, 42px); letter-spacing: -.035em; }
.intro > p:last-child { max-width: 680px; margin: 12px 0 0; color: #647d87; line-height: 1.65; }
.context-card, .panel { border: 1px solid #dce7e9; border-radius: 18px; background: #fff; box-shadow: 0 12px 32px rgb(33 70 82 / 5%); }
.context-card { padding: 24px 28px; margin-bottom: 18px; }
.context-heading { align-items: flex-start; }
.context-heading h2, .panel h2 { margin: 7px 0 0; font-size: 19px; }
.title-field { display: grid; gap: 7px; max-width: 460px; margin-top: 20px; color: #607984; font-size: 12px; }
.title-field input { min-height: 42px; padding: 0 12px; border: 1px solid #d2e0e3; border-radius: 9px; color: #193544; font: inherit; font-size: 14px; }
.title-field input:focus { outline: 3px solid rgb(12 133 127 / 14%); border-color: #0c8580; }
.context-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-top: 22px; }
.context-grid > div { display: grid; gap: 7px; min-width: 0; }
.context-grid span { color: #82969d; font-size: 11px; }
.context-grid strong, .context-grid code { overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
.context-grid code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.muted { color: #9aabb0; }
.context-note, .scope-note { color: #768c93; font-size: 12px; line-height: 1.55; }
.context-note { margin: 18px 0 0; }
.work-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .85fr); gap: 18px; }
.panel { padding: 24px; }
.panel-heading { align-items: flex-start; margin-bottom: 18px; }
.panel-heading h2 { margin-top: 7px; }
.state-chip { color: #899ca2; background: #eef3f4; }
.state-chip.selected { color: #a86b19; background: #fff2df; }
.file-drop { display: flex; min-height: 178px; padding: 20px; border: 1px dashed #adc7cb; border-radius: 14px; background: #f8fbfb; align-items: center; justify-content: center; flex-direction: column; gap: 8px; text-align: center; cursor: pointer; }
.file-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.file-drop:focus-within { outline: 3px solid rgb(12 133 127 / 16%); }
.file-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: #e1f2f0; color: #087b78; font-size: 22px; }
.file-drop strong { font-size: 14px; }
.file-drop span:last-child { color: #7c9198; font-size: 12px; }
.file-card { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px; border: 1px solid #e0e9eb; border-radius: 11px; }
.file-icon { display: grid; width: 38px; height: 42px; place-items: center; border-radius: 8px; background: #e9f2fa; color: #53799b; font-size: 9px; font-weight: 700; }
.file-details { display: grid; gap: 5px; min-width: 0; flex: 1; }
.file-details strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.file-details span { color: #7a9198; font-size: 11px; }
.text-button { border: 0; background: transparent; color: #71868d; cursor: pointer; }
.button-row { justify-content: flex-start; flex-wrap: wrap; margin-top: 20px; }
.primary-button, .secondary-button { min-height: 40px; padding: 0 15px; border: 1px solid #0b817d; border-radius: 9px; background: #0b817d; color: #fff; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.secondary-button { border-color: #d9e3e5; background: #f7f9fa; color: #8b9ba0; cursor: not-allowed; }
.inline-feedback { min-height: 22px; margin: 14px 0 0; color: #476c72; font-size: 12px; line-height: 1.6; }
.saved-time { margin: 0; color: #8a9ba0; font-size: 11px; }
.status-panel h2 { margin-bottom: 18px; }
.capability, .local-save { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 15px 0; border-top: 1px solid #edf1f2; }
.local-save { grid-template-columns: 10px minmax(0, 1fr); }
.capability strong, .local-save strong { font-size: 13px; }
.capability p, .local-save p { margin: 5px 0 0; color: #778d94; font-size: 11px; line-height: 1.55; }
.capability button { border: 1px solid #e1e8e9; border-radius: 999px; padding: 4px 9px; background: #f6f8f8; color: #87989d; font-size: 10px; }
.status-dot { width: 8px; height: 8px; margin-top: 4px; border-radius: 50%; background: #b2c1c4; }
.status-dot.unavailable { background: #d1a15d; }
.status-dot.saved { background: #2b9b72; }
.scope-note { margin: 14px 0 0; padding: 12px; border-radius: 9px; background: #f6f8f8; }
.intake-footer { padding: 18px 2px 0; color: #8b9da2; font-size: 11px; line-height: 1.6; }
@media (max-width: 760px) {
  .intake-header { margin-bottom: 32px; }
  .context-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .work-grid { grid-template-columns: minmax(0, 1fr); }
  .context-card, .panel { padding: 19px; }
  .context-heading { flex-direction: column; }
  .phase-chip { align-self: flex-start; }
}
@media (max-width: 420px) {
  .intake-page { padding: 18px 14px 28px; }
  .intake-header { align-items: flex-start; flex-direction: column; margin-bottom: 30px; }
  .context-grid { gap: 15px 10px; }
  .button-row { align-items: stretch; flex-direction: column; }
  .primary-button, .secondary-button { width: 100%; }
}
</style>
