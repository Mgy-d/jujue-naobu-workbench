<!--
  第二阶段 · 选题分析 编辑组件（F 交付）

  契约来源：docs/mvp-scope-and-status.md 第 3 节「2 选题分析」验收标准
  —— 比较方向、明确研究问题/对象和可行性；用户选定方向；消费第一阶段已确认信息。

  - props：context / draft / upstream / readOnly / issues
    （upstream 是本阶段相对第一阶段新增的一个 prop，见 topic-contract.ts 顶部说明）
  - emits：update-draft（完整 draft 覆盖语义）、save-request（正式候选保存请求）
  - 本组件不 fetch、不读写 localStorage、不触碰全局 store；落盘由外壳完成。
  - 每次编辑都以「当前 props.context」+「整份 draft」回传，外壳负责 revision 递增与陈旧事件拒绝。

  视觉：沿用宿主 tokens.scss 的青绿体系，与第一阶段组件同密度、同间距。
-->
<template>
  <section class="tae" :class="{ 'tae--readonly': isReadOnly }">
    <header class="tae-head">
      <div class="tae-head__text">
        <h3 class="tae-title">选题方向</h3>
        <p class="tae-sub">
          先列出几个可比较的候选方向，把研究问题、研究对象写具体，再判断可行性。
          拟选哪个方向由你决定；这里仅保留本机选择和理由，尚未正式采用。
        </p>
      </div>
      <div class="tae-head__status">
        <span v-if="isReadOnly" class="pill pill--lock">只读</span>
        <span v-else-if="issues.length" class="pill pill--warn" :title="issues.join('；')">
          待补充 {{ issues.length }} 项
        </span>
        <span v-else class="pill pill--ok">本机完整</span>
      </div>
    </header>

    <!-- 0. 第一阶段信息（只读） -->
    <section class="tae-up">
      <div class="tae-up__bar">
        <h4 class="tae-h4">来自第一阶段</h4>
        <span v-if="!upstream" class="tae-up__warn">外壳未传入第一阶段资料，无法关联要求</span>
        <span v-else class="tae-up__src">赛事理解 · 本机参考（未正式确认，只读）</span>
      </div>

      <dl v-if="upstream" class="tae-up__grid">
        <div>
          <dt>届次／组别</dt>
          <dd>{{ upstream.edition.trim() || '未知' }} / {{ upstream.group.trim() || '未知' }}</dd>
        </div>
        <div>
          <dt>适用要求</dt>
          <dd>{{ upstream.requirements.length }} 条</dd>
        </div>
        <div>
          <dt>要求来源</dt>
          <dd>{{ upstream.sources.length }} 条</dd>
        </div>
        <div>
          <dt>影响决定的未知项</dt>
          <dd :class="{ 'tae-up__dd--warn': blockingUpstreamUnknowns > 0 }">
            {{ blockingUpstreamUnknowns }} 项
          </dd>
        </div>
      </dl>

      <p v-if="upstream && blockingUpstreamUnknowns" class="tae-up__note">
        第一阶段还有 {{ blockingUpstreamUnknowns }} 项影响决定的未知项。它们可能推翻选题结论，建议先回去解决再定方向。
      </p>
      <p v-else-if="upstream && !upstream.requirements.length" class="tae-up__note">
        第一阶段还没有记录适用要求，方向暂时无法挂回赛事要求。可以先保存本阶段草稿，但正式检查会提示缺项。
      </p>
    </section>

    <!-- 1. 候选方向 -->
    <section class="tae-block">
      <div class="tae-block__bar">
        <h4 class="tae-h4">
          候选方向
          <span class="tae-h4__count">共 {{ draft.directions.length }} 个，{{ selectedDirection ? '本机拟选 1 个' : '尚未拟选' }}</span>
        </h4>
        <button type="button" class="btn tae-btn-sm" :disabled="isReadOnly" @click="addDirection">
          新增方向
        </button>
      </div>

      <p v-if="!draft.directions.length" class="empty-hint">
        尚未记录方向。至少列两个不同人群或不同问题的方向，才有可比性。
      </p>

      <ul v-else class="tae-list">
        <li
          v-for="(item, index) in draft.directions"
          :key="item.id"
          class="tae-item"
          :class="{ 'tae-item--on': item.id === draft.selectedDirectionId }"
        >
          <div class="tae-item__head">
            <span class="tae-item__no">D{{ index + 1 }}</span>
            <span v-if="item.id === draft.selectedDirectionId" class="tae-item__flag">本机拟选</span>
            <button
              type="button"
              class="tae-remove"
              :disabled="isReadOnly"
              :aria-label="`删除方向 D${index + 1}`"
              @click="removeDirection(item.id)"
            >
              删除
            </button>
          </div>

          <label class="tae-field">
            <span class="tae-label">方向名称</span>
            <input
              class="tae-input"
              type="text"
              :value="item.title"
              :readonly="isReadOnly"
              placeholder="例如：校内自习空间的使用时段与不足"
              @input="onTitleInput(item.id, $event)"
            />
          </label>

          <label class="tae-field">
            <span class="tae-label">研究问题</span>
            <textarea
              class="tae-input tae-textarea"
              rows="2"
              :value="item.question"
              :readonly="isReadOnly"
              placeholder="一句话、能用数据回答的问题，例如：本校本科生在什么时段最缺自习座位，缺口有多大？"
              @input="onQuestionInput(item.id, $event)"
            />
            <span class="tae-note">写成「研究某某」只是主题，不是研究问题。</span>
          </label>

          <div class="tae-grid2">
            <label class="tae-field">
              <span class="tae-label">研究对象／抽样框</span>
              <input
                class="tae-input"
                type="text"
                :value="item.population"
                :readonly="isReadOnly"
                placeholder="例如：本校在读本科生，按年级分层"
                @input="onPopulationInput(item.id, $event)"
              />
            </label>

            <label class="tae-field">
              <span class="tae-label">可行性判定</span>
              <select
                class="tae-input tae-select"
                :value="item.verdict"
                :disabled="isReadOnly"
                @change="onVerdictChange(item.id, $event)"
              >
                <option v-for="option in feasibilityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="tae-note">{{ verdictHint(item.verdict) }}</span>
            </label>
          </div>

          <label class="tae-field">
            <span class="tae-label">预期价值</span>
            <textarea
              class="tae-input tae-textarea"
              rows="2"
              :value="item.value"
              :readonly="isReadOnly"
              placeholder="例如：结论可用于向学校申请延长图书馆开放时段"
              @input="onValueInput(item.id, $event)"
            />
          </label>

          <label class="tae-field">
            <span class="tae-label">可行性依据</span>
            <textarea
              class="tae-input tae-textarea"
              rows="2"
              :value="item.feasibilityNote"
              :readonly="isReadOnly"
              placeholder="数据与样本能不能拿到、时间窗够不够、成本与团队能力、主要风险"
              @input="onFeasibilityNoteInput(item.id, $event)"
            />
          </label>

          <div class="tae-chips">
            <span class="tae-chips__label">回应要求</span>
            <template v-if="upstreamRequirements.length">
              <label
                v-for="requirement in upstreamRequirements"
                :key="requirement.id"
                class="tae-chip"
                :class="{ 'tae-chip--on': item.requirementIds.includes(requirement.id) }"
              >
                <input
                  type="checkbox"
                  class="tae-chip__box"
                  :checked="item.requirementIds.includes(requirement.id)"
                  :disabled="isReadOnly"
                  @change="toggleRequirement(item.id, requirement.id)"
                />
                <span class="tae-chip__text">{{ requirementLabel(requirement) }}</span>
              </label>
            </template>
            <span v-else class="tae-note">第一阶段还没有可关联的要求。</span>
            <label v-for="(requirementId, missingIndex) in missingRequirementIds(item)" :key="'missing-'+requirementId" class="tae-chip tae-chip--on">
              <input type="checkbox" :checked="true" :disabled="isReadOnly" :aria-label="'移除失效要求关联 '+(missingIndex+1)" @change="toggleRequirement(item.id,requirementId)" />
              <span>要求已删除（取消勾选以移除关联）</span>
            </label>
          </div>

          <p v-if="directionIssue(item)" class="tae-inline-warn">{{ directionIssue(item) }}</p>
        </li>
      </ul>
    </section>

    <!-- 2. 对比与采用 -->
    <section class="tae-block">
      <div class="tae-block__bar">
        <h4 class="tae-h4">对比与本机拟选</h4>
        <span class="tae-note">在表格里点「拟选」记录本机选择；不会正式确认或推进阶段</span>
      </div>

      <div v-if="draft.directions.length" class="tae-table-wrap">
        <table class="tae-table">
          <thead>
            <tr>
              <th scope="col">方向</th>
              <th scope="col">研究问题</th>
              <th scope="col">研究对象</th>
              <th scope="col">可行性</th>
              <th scope="col">回应要求</th>
              <th scope="col">本机拟选</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in draft.directions"
              :key="item.id"
              :class="{ 'tae-row--on': item.id === draft.selectedDirectionId }"
            >
              <th scope="row">
                <span class="tae-table__no">D{{ index + 1 }}</span>
                {{ item.title.trim() || '未命名方向' }}
              </th>
              <td>{{ item.question.trim() || '—' }}</td>
              <td>{{ item.population.trim() || '—' }}</td>
              <td>
                <span class="tae-verdict" :class="`tae-verdict--${item.verdict}`">
                  {{ feasibilityLabel(item.verdict) }}
                </span>
              </td>
              <td>{{ item.requirementIds.length }} 条</td>
              <td>
                <button
                  type="button"
                  class="tae-pick"
                  :class="{ 'tae-pick--on': item.id === draft.selectedDirectionId }"
                  :disabled="isReadOnly"
                  :aria-pressed="item.id === draft.selectedDirectionId"
                  @click="selectDirection(item.id)"
                >
                  {{ item.id === draft.selectedDirectionId ? '已拟选' : '拟选' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-hint">还没有方向可以对比。</p>

      <div class="tae-decide">
        <p class="tae-decide__line">
          当前本机拟选：
          <strong v-if="selectedDirection">{{ selectedDirection.title.trim() || '未命名方向' }}</strong>
          <span v-else class="tae-decide__none">尚未选定</span>
          <button
            v-if="selectedDirection && !isReadOnly"
            type="button"
            class="tae-remove"
            @click="clearSelection"
          >
            取消拟选
          </button>
        </p>

        <label class="tae-field">
          <span class="tae-label">选择理由</span>
          <textarea
            class="tae-input tae-textarea"
            rows="3"
            :value="draft.selectionReason"
            :readonly="isReadOnly"
            placeholder="为什么选这个方向：它回应了哪条要求、为什么可行、为什么不选另外几个"
            @input="onSelectionReasonInput"
          />
          <span class="tae-note">这一段会进入正式候选，供后续方案阶段和评审回看。</span>
        </label>
      </div>
    </section>

    <!-- 3. 未知项 -->
    <section class="tae-block tae-block--last">
      <div class="tae-block__bar">
        <h4 class="tae-h4">未知项</h4>
        <button type="button" class="btn tae-btn-sm" :disabled="isReadOnly" @click="addUnknown">
          新增未知项
        </button>
      </div>

      <p v-if="!draft.unknowns.length" class="empty-hint">
        尚未整理未知项。这里为空不代表没有未知项，只代表还没列出来。
      </p>

      <ul v-else class="tae-list tae-list--compact">
        <li v-for="(item, index) in draft.unknowns" :key="item.id" class="tae-item tae-item--row">
          <span class="tae-item__no">U{{ index + 1 }}</span>

          <input
            class="tae-input tae-unknown-input"
            type="text"
            :value="item.text"
            :readonly="isReadOnly"
            placeholder="例如：学校是否愿意提供门禁数据，尚未确认。"
            @input="onUnknownTextInput(item.id, $event)"
          />

          <label class="tae-switch" :class="{ 'tae-switch--on': item.blocksDecision }">
            <input
              type="checkbox"
              class="tae-switch__box"
              :checked="item.blocksDecision"
              :disabled="isReadOnly"
              @change="toggleUnknownBlocks(item.id)"
            />
            <span class="tae-switch__text">影响当前决定</span>
          </label>

          <button
            type="button"
            class="tae-remove"
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
    <footer class="tae-foot">
      <div class="tae-foot__actions">
        <button type="button" class="btn primary" :disabled="isReadOnly" @click="requestCandidate">
          提交为正式候选
        </button>
        <span class="tae-note">
          本机草稿由页面顶部按钮保存；这里只发起正式候选保存请求，接口未接入时不会显示成功。
        </span>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import type { ContestRequirement } from '../../types/research-contracts'
import {
  FEASIBILITY_OPTIONS,
  feasibilityLabel,
  type FeasibilityVerdict,
  type TopicActionRequest,
  type TopicDirection,
  type TopicDraft,
  type TopicDraftUpdate,
  type TopicEditorProps,
} from './topic-contract'

const props = defineProps<TopicEditorProps>()

const emit = defineEmits<{
  'update-draft': [value: TopicDraftUpdate]
  'save-request': [value: TopicActionRequest]
}>()

const isReadOnly = computed(() => props.readOnly === true)
const feasibilityOptions = FEASIBILITY_OPTIONS
const upstreamRequirements = computed<ContestRequirement[]>(() => props.upstream?.requirements ?? [])
const blockingUpstreamUnknowns = computed(
  () => (props.upstream?.unknowns ?? []).filter((item) => item.blocksDecision).length,
)
const selectedDirection = computed<TopicDirection | null>(
  () => props.draft.directions.find((item) => item.id === props.draft.selectedDirectionId) ?? null,
)

/**
 * 唯一的写出口。
 *
 * 为什么要合并同一轮的多件事：外壳以 `localTaskId + revision` 判定事件是否陈旧，
 * 而 revision 要等外壳递增后经 props 回传，props 更新在下次渲染。同一轮里连发两次
 * （比如「新增方向」后立刻输入）第二次带的还是旧 revision，会被外壳当作陈旧事件丢弃。
 * 所以这里把 patch 累积成完整 draft，用微任务合并成一次 emit。
 */
let pendingDraft: TopicDraft | null = null
let flushScheduled = false

function commit(patch: Partial<TopicDraft>) {
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
 * 合并提交期间 pendingDraft 才是权威值；若读 props.draft，
 * 同一轮里第二次列表编辑会以旧数组为基准重建，把第一次的改动覆盖回去。
 */
function currentDraft(): TopicDraft {
  return pendingDraft ?? props.draft
}

function textOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

// ── 方向 ────────────────────────────────────────────────────────────────
function addDirection() {
  const next: TopicDirection = {
    id: `dir-${crypto.randomUUID()}`,
    title: '',
    question: '',
    population: '',
    value: '',
    requirementIds: [],
    verdict: 'unknown',
    feasibilityNote: '',
  }
  commit({ directions: [...currentDraft().directions, next] })
}

/** 删除方向时，如果删的正是采用方向，一并清空采用，避免留下悬空 id。 */
function removeDirection(id: string) {
  const draft = currentDraft()
  commit({
    directions: draft.directions.filter((item) => item.id !== id),
    ...(draft.selectedDirectionId === id
      ? { selectedDirectionId: null, selectionReason: draft.selectionReason }
      : {}),
  })
}

function patchDirection(id: string, patch: Partial<TopicDirection>) {
  commit({
    directions: currentDraft().directions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })
}

function onTitleInput(id: string, event: Event) {
  patchDirection(id, { title: textOf(event) })
}

function onQuestionInput(id: string, event: Event) {
  patchDirection(id, { question: textOf(event) })
}

function onPopulationInput(id: string, event: Event) {
  patchDirection(id, { population: textOf(event) })
}

function onValueInput(id: string, event: Event) {
  patchDirection(id, { value: textOf(event) })
}

function onFeasibilityNoteInput(id: string, event: Event) {
  patchDirection(id, { feasibilityNote: textOf(event) })
}

function onVerdictChange(id: string, event: Event) {
  const value = textOf(event) as FeasibilityVerdict
  const allowed = FEASIBILITY_OPTIONS.some((option) => option.value === value)
  patchDirection(id, { verdict: allowed ? value : 'unknown' })
}

function missingRequirementIds(direction: TopicDirection) { const known = new Set(upstreamRequirements.value.map(requirement => requirement.id)); return direction.requirementIds.filter(id => !known.has(id)) }

function toggleRequirement(directionId: string, requirementId: string) {
  const target = currentDraft().directions.find((item) => item.id === directionId)
  if (!target) return
  const requirementIds = target.requirementIds.includes(requirementId)
    ? target.requirementIds.filter((value) => value !== requirementId)
    : [...target.requirementIds, requirementId]
  patchDirection(directionId, { requirementIds })
}

// ── 采用 ────────────────────────────────────────────────────────────────
function selectDirection(id: string) {
  commit({ selectedDirectionId: id })
}

function clearSelection() {
  commit({ selectedDirectionId: null })
}

function onSelectionReasonInput(event: Event) {
  commit({ selectionReason: textOf(event) })
}

// ── 未知项 ──────────────────────────────────────────────────────────────
function addUnknown() {
  const next = { id: `unknown-${crypto.randomUUID()}`, text: '', blocksDecision: false }
  commit({ unknowns: [...currentDraft().unknowns, next] })
}

function removeUnknown(id: string) {
  commit({ unknowns: currentDraft().unknowns.filter((item) => item.id !== id) })
}

function patchUnknown(id: string, patch: Partial<{ text: string; blocksDecision: boolean }>) {
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

// ── 展示辅助 ────────────────────────────────────────────────────────────
function verdictHint(verdict: FeasibilityVerdict): string {
  return FEASIBILITY_OPTIONS.find((option) => option.value === verdict)?.hint ?? ''
}

/** 要求文案可能很长，chip 里截断显示，完整内容放在 title。 */
function requirementLabel(requirement: ContestRequirement): string {
  const text = requirement.text.trim() || '未填写的要求'
  return text.length > 18 ? `${text.slice(0, 18)}…` : text
}

// ── 行内提示（与 checkTopicDraft 同口径，仅用于就地定位）──────────────────
function directionIssue(item: TopicDirection): string {
  if (!item.title.trim()) return '方向名称为空，补齐后才算一条可比较的方向。'
  if (!item.question.trim()) return '缺少研究问题：只有主题名无法判断要回答什么。'
  if (!item.population.trim()) return '缺少研究对象或抽样框，方案阶段无法设计抽样。'
  if (item.verdict === 'unknown') return '可行性尚未判断，不能当作可以开展。'
  if (item.verdict === 'blocked' && item.id === props.draft.selectedDirectionId)
    return '当前不可行的方向不应被采用，请先解决限制条件或换一个方向。'
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
.tae {
  margin: 22px 0 6px;
  padding: 20px 22px 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  font-size: 13px;
  color: var(--c-ink);
}

.tae--readonly {
  background: #fbfdfd;
}

/* 头部 */
.tae-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--c-line);
}

.tae-head__text {
  min-width: 0;
}

.tae-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ink);
  letter-spacing: 0.01em;
}

.tae-sub {
  margin: 0;
  max-width: 62em;
  font-size: 12px;
  line-height: 1.75;
  color: var(--c-muted);
}

.tae-head__status {
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

/* 第一阶段信息条 */
.tae-up {
  margin: 14px 0 4px;
  padding: 12px 14px;
  background: #f7fbfa;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.tae-up__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.tae-up__src {
  font-size: 11px;
  color: var(--c-muted);
}

.tae-up__warn {
  font-size: 11px;
  color: var(--c-warn-ink);
}

.tae-up__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.tae-up__grid dt {
  font-size: 11px;
  color: var(--c-muted);
}

.tae-up__grid dd {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--c-ink-2);
  overflow-wrap: anywhere;
}

.tae-up__dd--warn {
  color: var(--c-warn-ink);
  font-weight: 600;
}

.tae-up__note {
  margin: 9px 0 0;
  padding-top: 8px;
  border-top: 1px dashed var(--c-line);
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-warn-ink);
}

/* 区块 */
.tae-block {
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--c-line);
}

.tae-block--last {
  border-bottom: 0;
  padding-bottom: 4px;
}

.tae-block__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.tae-h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.tae-h4__count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--c-muted);
}

.tae-btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

/* 字段 */
.tae-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.tae-label {
  font-size: 12px;
  color: var(--c-ink-2);
}

.tae-input {
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

.tae-input::placeholder {
  color: #9db3b8;
}

.tae-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}

.tae-input:read-only,
.tae-input:disabled {
  background: #f7fafa;
  color: var(--c-ink-2);
  cursor: default;
}

.tae-textarea {
  resize: vertical;
  min-height: 52px;
}

.tae-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--c-muted) 50%),
    linear-gradient(135deg, var(--c-muted) 50%, transparent 50%);
  background-position: calc(100% - 15px) calc(50% + 1px), calc(100% - 10px) calc(50% + 1px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 30px;
}

.tae-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.tae-note {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

/* 列表 */
.tae-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.tae-list--compact {
  gap: 7px;
}

.tae-item {
  padding: 12px 14px;
  background: #fbfdfd;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.tae-item--on {
  background: #f6fbfa;
  border-color: var(--c-primary);
  box-shadow: inset 3px 0 0 var(--c-primary);
}

.tae-item--row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}

.tae-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.tae-item__no {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary-ink);
  letter-spacing: 0.04em;
}

.tae-item__flag {
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  border-radius: 999px;
}

.tae-item__head .tae-remove {
  margin-left: auto;
}

.tae-remove {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--c-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.tae-remove:hover:not(:disabled) {
  color: var(--c-error);
  background: var(--c-error-soft);
  border-color: #f2c7c1;
}

.tae-remove:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 要求勾选 */
.tae-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tae-chips__label {
  font-size: 11px;
  color: var(--c-muted);
  margin-right: 2px;
}

.tae-chip {
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

.tae-chip:hover {
  border-color: var(--c-primary);
}

.tae-chip--on {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.tae-chip__box {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--c-primary);
}

.tae-chip__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 对比表 */
.tae-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.tae-table {
  width: 100%;
  min-width: 660px;
  border-collapse: collapse;
  font-size: 12px;
}

.tae-table th,
.tae-table td {
  padding: 9px 10px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--c-line);
  font-weight: 400;
}

.tae-table thead th {
  font-size: 11px;
  color: var(--c-muted);
  background: #f4f9f8;
  white-space: nowrap;
}

.tae-table tbody tr:last-child th,
.tae-table tbody tr:last-child td {
  border-bottom: 0;
}

.tae-table tbody th {
  max-width: 170px;
  font-weight: 600;
  color: var(--c-ink);
  overflow-wrap: anywhere;
}

.tae-table td {
  max-width: 260px;
  color: var(--c-ink-2);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.tae-table__no {
  margin-right: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--c-muted);
}

.tae-row--on {
  background: #f2faf8;
}

.tae-verdict {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}

.tae-verdict--unknown {
  color: var(--c-muted);
  background: #eef1f4;
}

.tae-verdict--workable {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
}

.tae-verdict--at-risk {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
}

.tae-verdict--blocked {
  color: var(--c-error);
  background: var(--c-error-soft);
}

.tae-pick {
  padding: 3px 10px;
  font-size: 11px;
  color: var(--c-ink-2);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: 999px;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tae-pick:hover:not(:disabled) {
  border-color: var(--c-primary);
  color: var(--c-primary-ink);
}

.tae-pick--on {
  color: #fff;
  background: var(--c-primary);
  border-color: var(--c-primary);
}

.tae-pick:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 采用区 */
.tae-decide {
  margin-top: 14px;
}

.tae-decide__line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--c-ink-2);
}

.tae-decide__line strong {
  color: var(--c-ink);
  font-size: 13px;
}

.tae-decide__none {
  color: var(--c-warn-ink);
}

/* 未知项 */
.tae-unknown-input {
  min-width: 0;
}

.tae-switch {
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

.tae-switch--on {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border-color: var(--c-warn-line);
}

.tae-switch__box {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--c-warn);
}

/* 行内提示 */
.tae-inline-warn {
  margin: 9px 0 0;
  padding: 4px 8px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border-left: 2px solid var(--c-warn);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* 底部 */
.tae-foot {
  padding-top: 14px;
}

.tae-foot__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tae-foot__actions .btn {
  font-size: 12px;
  padding: 7px 14px;
}

/* 窄屏 */
@media (max-width: 900px) {
  .tae {
    padding: 16px 14px 12px;
  }

  .tae-up__grid {
    grid-template-columns: 1fr 1fr;
  }

  .tae-grid2 {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .tae-item--row {
    grid-template-columns: 30px minmax(0, 1fr);
    row-gap: 6px;
  }

  .tae-item--row .tae-switch,
  .tae-item--row .tae-remove {
    justify-self: start;
  }

  .tae-block__bar {
    flex-wrap: wrap;
  }

  /* 窄屏 6 列挤成一团：研究对象在上方卡片里已有同字段，对比表里可以省掉 */
  .tae-table {
    min-width: 0;
  }

  .tae-table th:nth-child(3),
  .tae-table td:nth-child(3) {
    display: none;
  }
}
</style>
