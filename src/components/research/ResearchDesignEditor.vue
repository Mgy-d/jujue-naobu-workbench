<!--
  第一阶段 · 赛事理解 编辑组件（F 交付）

  契约来源：docs/research-first-stage.md / src/types/research-contracts.ts
  - props：context / draft / readOnly / issues
  - emits：update-draft（完整 draft 覆盖语义）、save-request（正式候选保存请求）
  - 本组件不 fetch、不读写 localStorage、不触碰全局 store；所有落盘由外壳完成。
  - 每次编辑都以「当前 props.context」+「整份 draft」回传，外壳负责 revision 递增与陈旧事件拒绝。

  视觉：沿用宿主 tokens.scss 的青绿体系，不引入第二套配色。
-->
<template>
  <section class="rde" :class="{ 'rde--readonly': isReadOnly }">
    <header class="rde-head">
      <div class="rde-head__text">
        <h3 class="rde-title">赛事资料</h3>
        <p class="rde-sub">
          按正式通知填写届次、组别与适用要求，并给每条要求挂上可定位来源。尚未核对的内容留在「未知项」，
          不要根据文件名或印象补成赛事事实。
        </p>
      </div>
      <div class="rde-head__status">
        <span v-if="isReadOnly" class="pill pill--lock">只读</span>
        <span v-else-if="issues.length" class="pill pill--warn" :title="issues.join('；')">
          待补充 {{ issues.length }} 项
        </span>
        <span v-else class="pill pill--ok">本机完整</span>
      </div>
    </header>

    <!-- 1. 背景与范围 -->
    <fieldset class="rde-block">
      <legend class="rde-block__legend">
        研究背景与调查范围
        <span class="rde-block__count">用于说明团队能接触谁、在哪调查</span>
      </legend>

      <label class="rde-field">
        <span class="rde-label">研究背景</span>
        <textarea
          class="rde-input rde-textarea"
          rows="4"
          :value="draft.background"
          :readonly="isReadOnly"
          placeholder="例如：本校本科生自习空间使用情况，团队可接触在校学生并在校内开展调查。"
          @input="onBackgroundInput"
        />
      </label>

      <div class="rde-grid2">
        <label class="rde-field">
          <span class="rde-label">届次</span>
          <input
            class="rde-input"
            type="text"
            :value="draft.edition"
            :readonly="isReadOnly"
            placeholder="例如：2026 年第 X 届"
            @input="onEditionInput"
          />
          <span v-if="!draft.edition.trim()" class="rde-note">未填写时保留为未知，需在正式检查中处理。</span>
        </label>

        <label class="rde-field">
          <span class="rde-label">组别</span>
          <input
            class="rde-input"
            type="text"
            :value="draft.group"
            :readonly="isReadOnly"
            placeholder="例如：本科生组"
            @input="onGroupInput"
          />
          <span v-if="!draft.group.trim()" class="rde-note">组别可能改变选题可行性，未确认前不要当作已知。</span>
        </label>
      </div>
    </fieldset>

    <!-- 2. 要求 + 来源 -->
    <div class="rde-grid2 rde-grid2--top">
      <section class="rde-block rde-block--flush">
        <div class="rde-block__bar">
          <h4 class="rde-h4">适用要求</h4>
          <button type="button" class="btn rde-btn-sm" :disabled="isReadOnly" @click="addRequirement">
            新增要求
          </button>
        </div>

        <p v-if="!draft.requirements.length" class="empty-hint">
          尚未记录要求。先新增一条，再从「来源」里勾选它依据的通知或文件。
        </p>

        <ul v-else class="rde-list">
          <li v-for="(item, index) in draft.requirements" :key="item.id" class="rde-item">
            <div class="rde-item__head">
              <span class="rde-item__no">R{{ index + 1 }}</span>
              <button
                type="button"
                class="rde-remove"
                :disabled="isReadOnly"
                :aria-label="`删除要求 R${index + 1}`"
                @click="removeRequirement(item.id)"
              >
                删除
              </button>
            </div>

            <textarea
              class="rde-input rde-textarea rde-textarea--sm"
              rows="2"
              :value="item.text"
              :readonly="isReadOnly"
              placeholder="例如：研究对象须为本校在读本科生，调查时间限定在本学期内。"
              @input="onRequirementTextInput(item.id, $event)"
            />

            <div class="rde-chips">
              <span class="rde-chips__label">依据来源</span>
              <template v-if="usableSources.length">
                <label
                  v-for="source in usableSources"
                  :key="source.sourceId"
                  class="rde-chip"
                  :class="{ 'rde-chip--on': item.sourceIds.includes(source.sourceId) }"
                >
                  <input
                    type="checkbox"
                    class="rde-chip__box"
                    :checked="item.sourceIds.includes(source.sourceId)"
                    :disabled="isReadOnly"
                    @change="toggleRequirementSource(item.id, source.sourceId)"
                  />
                  <span class="rde-chip__text">{{ source.title.trim() || '未命名来源' }}</span>
                </label>
              </template>
              <span v-else class="rde-note">右侧还没有可用来源，先补一条带定位信息的来源。</span>
            </div>

            <p v-if="requirementIssue(item)" class="rde-inline-warn">{{ requirementIssue(item) }}</p>
          </li>
        </ul>
      </section>

      <section class="rde-block rde-block--flush">
        <div class="rde-block__bar">
          <h4 class="rde-h4">要求来源</h4>
          <button type="button" class="btn rde-btn-sm" :disabled="isReadOnly" @click="addSource">
            新增来源
          </button>
        </div>

        <p v-if="!draft.sources.length" class="empty-hint">
          尚未登记来源。通知、附件、官网页面都算来源；没有定位信息就不能标为已核实。
        </p>

        <ul v-else class="rde-list">
          <li v-for="(source, index) in draft.sources" :key="source.sourceId" class="rde-item">
            <div class="rde-item__head">
              <span class="rde-item__no">S{{ index + 1 }}</span>
              <button
                type="button"
                class="rde-remove"
                :disabled="isReadOnly"
                :aria-label="`删除来源 S${index + 1}`"
                @click="removeSource(source.sourceId)"
              >
                删除
              </button>
            </div>

            <label class="rde-field rde-field--tight">
              <span class="rde-label">来源名称</span>
              <input
                class="rde-input"
                type="text"
                :value="source.title"
                :readonly="isReadOnly"
                placeholder="例如：2026 年第 X 届竞赛通知"
                @input="onSourceTitleInput(source.sourceId, $event)"
              />
            </label>

            <label class="rde-field rde-field--tight">
              <span class="rde-label">定位信息</span>
              <input
                class="rde-input"
                type="text"
                :value="source.locator"
                :readonly="isReadOnly"
                placeholder="例如：通知正文第 2 条 / 附件一 第 3 页"
                @input="onSourceLocatorInput(source.sourceId, $event)"
              />
            </label>

            <label class="rde-field rde-field--tight">
              <span class="rde-label">核对状态</span>
              <select
                class="rde-input rde-select"
                :value="source.evidenceStatus"
                :disabled="isReadOnly"
                @change="onSourceStatusChange(source.sourceId, $event)"
              >
                <option v-for="option in evidenceOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <p v-if="sourceIssue(source)" class="rde-inline-warn">{{ sourceIssue(source) }}</p>
          </li>
        </ul>
      </section>
    </div>

    <!-- 3. 未知项 -->
    <section class="rde-block rde-block--flush">
      <div class="rde-block__bar">
        <h4 class="rde-h4">未知项</h4>
        <button type="button" class="btn rde-btn-sm" :disabled="isReadOnly" @click="addUnknown">
          新增未知项
        </button>
      </div>

      <p v-if="!draft.unknowns.length" class="empty-hint">
        尚未整理未知项。这里为空不代表没有未知项，只代表还没列出来。
      </p>

      <ul v-else class="rde-list rde-list--compact">
        <li v-for="(item, index) in draft.unknowns" :key="item.id" class="rde-item rde-item--row">
          <span class="rde-item__no">U{{ index + 1 }}</span>

          <input
            class="rde-input rde-unknown-input"
            type="text"
            :value="item.text"
            :readonly="isReadOnly"
            placeholder="例如：本届是否允许跨校组队，通知尚未说明。"
            @input="onUnknownTextInput(item.id, $event)"
          />

          <label class="rde-switch" :class="{ 'rde-switch--on': item.blocksDecision }">
            <input
              type="checkbox"
              class="rde-switch__box"
              :checked="item.blocksDecision"
              :disabled="isReadOnly"
              @change="toggleUnknownBlocks(item.id)"
            />
            <span class="rde-switch__text">影响当前决定</span>
          </label>

          <button
            type="button"
            class="rde-remove"
            :disabled="isReadOnly"
            :aria-label="`删除未知项 U${index + 1}`"
            @click="removeUnknown(item.id)"
          >
            删除
          </button>
        </li>
      </ul>
    </section>

    <!-- 4. 提交动作 -->
    <footer class="rde-foot">
      <div class="rde-foot__actions">
        <button type="button" class="btn primary" :disabled="isReadOnly" @click="requestCandidate">
          提交为正式候选
        </button>
        <span class="rde-note">
          本机草稿由页面顶部按钮保存；这里只发起正式候选保存请求，接口未接入时不会显示成功。
        </span>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import type {
  CompetitionDraft,
  ContestActionRequest,
  ContestDraftUpdate,
  ContestEditorProps,
  ContestRequirement,
  ContestSource,
  ContestUnknown,
} from '../../types/research-contracts'

const props = defineProps<ContestEditorProps>()

const emit = defineEmits<{
  'update-draft': [value: ContestDraftUpdate]
  'save-request': [value: ContestActionRequest]
}>()

const isReadOnly = computed(() => props.readOnly === true)

const evidenceOptions: { value: ContestSource['evidenceStatus']; label: string }[] = [
  { value: 'unverified', label: '未核实' },
  { value: 'user-provided', label: '用户提供，待核对' },
  { value: 'source-cited', label: '已标注来源，仍需核对适用性' },
]

/** 只有同时具备名称与定位信息的来源才能被要求引用（与 checkContestDraft 口径一致）。 */
const usableSources = computed(() =>
  props.draft.sources.filter((source) => source.title.trim() && source.locator.trim()),
)

/**
 * 唯一的写出口。
 *
 * 为什么要把同一轮事件循环里的多次编辑合并成一次 emit：
 * 外壳以 `localTaskId + revision` 判定事件是否陈旧，而 revision 由外壳递增后
 * 经 props 回传，props 的更新要等到下一次渲染。若在同一轮里连续 emit 两次
 * （输入框一次、勾选一次、新增一条再一次），第二次带出去的仍是旧 revision，
 * 会被外壳判为陈旧事件直接丢弃——表现为「点了没反应」「填了但没保存」。
 *
 * 因此这里先把 patch 累积成一份完整 draft，再用微任务合并提交；用户输入本身
 * 已经落在 DOM 上（`:value` 在 props 未变时不会回写），不会因为延迟而丢字。
 */
let pendingDraft: CompetitionDraft | null = null
let flushScheduled = false

function commit(patch: Partial<CompetitionDraft>) {
  if (isReadOnly.value) return
  pendingDraft = { ...(pendingDraft ?? props.draft), ...patch }
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(flushDraft)
}

function flushDraft() {
  flushScheduled = false
  const draft = pendingDraft
  pendingDraft = null
  if (!draft) return
  emit('update-draft', { context: { ...props.context }, draft })
}

/**
 * 读「当前应该被编辑的那份草稿」。
 *
 * 合并提交期间 pendingDraft 才是权威值；若这里继续读 props.draft，
 * 同一轮里的第二次列表编辑会以旧数组为基准重建，把第一次的改动覆盖回旧值
 * （典型现象：同时填写来源名称和定位，只有后填的那个留下）。
 */
function currentDraft(): CompetitionDraft {
  return pendingDraft ?? props.draft
}

function textOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function onBackgroundInput(event: Event) {
  commit({ background: textOf(event) })
}

function onEditionInput(event: Event) {
  commit({ edition: textOf(event) })
}

function onGroupInput(event: Event) {
  commit({ group: textOf(event) })
}

// ── 要求 ────────────────────────────────────────────────────────────────
function addRequirement() {
  const next: ContestRequirement = { id: `req-${crypto.randomUUID()}`, text: '', sourceIds: [] }
  commit({ requirements: [...currentDraft().requirements, next] })
}

function removeRequirement(id: string) {
  commit({ requirements: currentDraft().requirements.filter((item) => item.id !== id) })
}

function patchRequirement(id: string, patch: Partial<ContestRequirement>) {
  commit({
    requirements: currentDraft().requirements.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  })
}

function onRequirementTextInput(id: string, event: Event) {
  patchRequirement(id, { text: textOf(event) })
}

function toggleRequirementSource(requirementId: string, sourceId: string) {
  const target = currentDraft().requirements.find((item) => item.id === requirementId)
  if (!target) return
  const sourceIds = target.sourceIds.includes(sourceId)
    ? target.sourceIds.filter((value) => value !== sourceId)
    : [...target.sourceIds, sourceId]
  patchRequirement(requirementId, { sourceIds })
}

// ── 来源 ────────────────────────────────────────────────────────────────
function addSource() {
  const next: ContestSource = {
    sourceId: `src-${crypto.randomUUID()}`,
    title: '',
    locator: '',
    evidenceStatus: 'unverified',
  }
  commit({ sources: [...currentDraft().sources, next] })
}

/** 删除来源时必须同时摘掉要求里的引用，否则 checkContestDraft 会持续报「缺少可定位来源」。 */
function removeSource(sourceId: string) {
  const draft = currentDraft()
  commit({
    sources: draft.sources.filter((item) => item.sourceId !== sourceId),
    requirements: draft.requirements.map((item) => ({
      ...item,
      sourceIds: item.sourceIds.filter((value) => value !== sourceId),
    })),
  })
}

function patchSource(sourceId: string, patch: Partial<ContestSource>) {
  commit({
    sources: currentDraft().sources.map((item) =>
      item.sourceId === sourceId ? { ...item, ...patch } : item,
    ),
  })
}

function onSourceTitleInput(sourceId: string, event: Event) {
  patchSource(sourceId, { title: textOf(event) })
}

function onSourceLocatorInput(sourceId: string, event: Event) {
  patchSource(sourceId, { locator: textOf(event) })
}

function onSourceStatusChange(sourceId: string, event: Event) {
  const value = textOf(event) as ContestSource['evidenceStatus']
  const allowed = evidenceOptions.some((option) => option.value === value)
  patchSource(sourceId, { evidenceStatus: allowed ? value : 'unverified' })
}

// ── 未知项 ──────────────────────────────────────────────────────────────
function addUnknown() {
  const next: ContestUnknown = { id: `unknown-${crypto.randomUUID()}`, text: '', blocksDecision: false }
  commit({ unknowns: [...currentDraft().unknowns, next] })
}

function removeUnknown(id: string) {
  commit({ unknowns: currentDraft().unknowns.filter((item) => item.id !== id) })
}

function patchUnknown(id: string, patch: Partial<ContestUnknown>) {
  commit({
    unknowns: currentDraft().unknowns.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })
}

function onUnknownTextInput(id: string, event: Event) {
  patchUnknown(id, { text: textOf(event) })
}

function toggleUnknownBlocks(id: string) {
  const target = currentDraft().unknowns.find((item) => item.id === id)
  if (!target) return
  patchUnknown(id, { blocksDecision: !target.blocksDecision })
}

// ── 行内提示（与 checkContestDraft 同口径，仅用于就地定位）────────────────
function requirementIssue(item: ContestRequirement): string {
  if (!item.text.trim()) return '要求正文为空，补齐后才算一条有效要求。'
  if (!item.sourceIds.length) return '尚未关联来源，正式检查会判定缺少可定位来源。'
  const valid = new Set(usableSources.value.map((source) => source.sourceId))
  if (item.sourceIds.some((id) => !valid.has(id))) return '有来源已被删除或缺少定位信息，请重新勾选。'
  return ''
}

function sourceIssue(source: ContestSource): string {
  if (!source.title.trim()) return '来源名称为空。'
  if (!source.locator.trim()) return '缺少定位信息，无法核实，也不会被要求引用。'
  return ''
}

// ── 正式候选保存 ────────────────────────────────────────────────────────
/**
 * 先落盘本轮未提交的编辑，再等一次渲染把最新 revision 带回 props，然后才发保存请求。
 * 直接用旧 context 发 save-request 会被宿主判为陈旧请求而拒绝。
 */
async function requestCandidate() {
  if (isReadOnly.value) return
  flushDraft()
  await nextTick()
  emit('save-request', { context: { ...props.context } })
}
</script>

<style scoped>
.rde {
  margin: 22px 0 6px;
  padding: 20px 22px 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  font-size: 13px;
  color: var(--c-ink);
}

.rde--readonly {
  background: #fbfdfd;
}

/* 头部 */
.rde-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--c-line);
}

.rde-head__text {
  min-width: 0;
}

.rde-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ink);
  letter-spacing: 0.01em;
}

.rde-sub {
  margin: 0;
  max-width: 62em;
  font-size: 12px;
  line-height: 1.75;
  color: var(--c-muted);
}

.rde-head__status {
  flex: none;
  padding-top: 2px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.pill--ok {
  background: var(--c-primary-soft);
  color: var(--c-primary-ink);
}

.pill--warn {
  background: var(--c-warn-soft);
  color: var(--c-warn-ink);
  border: 1px solid var(--c-warn-line);
}

.pill--lock {
  background: #eef1f4;
  color: var(--c-muted);
  border: 1px solid var(--c-line-strong);
}

/* 区块 */
.rde-block {
  margin: 0;
  padding: 16px 0 6px;
  border: 0;
  border-bottom: 1px solid var(--c-line);
}

.rde-block--flush {
  border-bottom: 0;
  padding-bottom: 4px;
}

.rde-block__legend {
  padding: 0;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.rde-block__count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--c-muted);
}

.rde-block__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.rde-h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.rde-btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

/* 字段 */
.rde-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.rde-field--tight {
  gap: 4px;
  margin-bottom: 8px;
}

.rde-label {
  font-size: 12px;
  color: var(--c-ink-2);
}

.rde-input {
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--c-ink);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.rde-input::placeholder {
  color: #9db3b8;
}

.rde-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}

.rde-input:read-only,
.rde-input:disabled {
  background: #f7fafa;
  color: var(--c-ink-2);
  cursor: default;
}

.rde-textarea {
  resize: vertical;
  min-height: 76px;
}

.rde-textarea--sm {
  min-height: 52px;
  margin-bottom: 8px;
}

.rde-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--c-muted) 50%),
    linear-gradient(135deg, var(--c-muted) 50%, transparent 50%);
  background-position: calc(100% - 15px) calc(50% + 1px), calc(100% - 10px) calc(50% + 1px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 30px;
}

.rde-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.rde-grid2--top {
  align-items: start;
  gap: 0;
  padding: 4px 0 0;
}

/* 左右两栏用竖线明确分隔，避免「适用要求」「要求来源」两个标题在视觉上连成一行 */
.rde-grid2--top > .rde-block:first-child {
  padding-right: 24px;
}

.rde-grid2--top > .rde-block + .rde-block {
  padding-left: 24px;
  border-left: 1px solid var(--c-line);
}

.rde-note {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

/* 列表 */
.rde-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.rde-list--compact {
  gap: 7px;
}

.rde-item {
  padding: 10px 12px;
  background: #fbfdfd;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rde-item--row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}

.rde-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.rde-item__no {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-ink);
  letter-spacing: 0.04em;
}

.rde-remove {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--c-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.rde-remove:hover:not(:disabled) {
  color: var(--c-error);
  background: var(--c-error-soft);
  border-color: #f2c7c1;
}

.rde-remove:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 来源勾选 */
.rde-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rde-chips__label {
  font-size: 11px;
  color: var(--c-muted);
  margin-right: 2px;
}

.rde-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 9px;
  font-size: 11px;
  color: var(--c-ink-2);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rde-chip:hover {
  border-color: var(--c-primary);
}

.rde-chip--on {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.rde-chip__box {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--c-primary);
}

.rde-chip__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 未知项 */
.rde-unknown-input {
  min-width: 0;
}

.rde-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  font-size: 11px;
  color: var(--c-muted);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.rde-switch--on {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border-color: var(--c-warn-line);
}

.rde-switch__box {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--c-warn);
}

/* 行内提示 */
.rde-inline-warn {
  margin: 7px 0 0;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border-left: 2px solid var(--c-warn);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* 底部 */
.rde-foot {
  padding-top: 14px;
}

.rde-foot__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rde-foot__actions .btn {
  font-size: 12px;
  padding: 7px 14px;
}

/* 窄屏 */
@media (max-width: 900px) {
  .rde {
    padding: 16px 14px 12px;
  }

  .rde-grid2 {
    grid-template-columns: 1fr;
  }

  .rde-grid2--top {
    gap: 6px;
  }

  /* 单栏时竖线改为上边框，避免悬空的分隔线 */
  .rde-grid2--top > .rde-block:first-child {
    padding-right: 0;
  }

  .rde-grid2--top > .rde-block + .rde-block {
    padding-left: 0;
    padding-top: 12px;
    border-left: 0;
    border-top: 1px solid var(--c-line);
  }

  .rde-item--row {
    grid-template-columns: 30px minmax(0, 1fr);
    row-gap: 6px;
  }

  .rde-item--row .rde-switch,
  .rde-item--row .rde-remove {
    justify-self: start;
  }
}
</style>
