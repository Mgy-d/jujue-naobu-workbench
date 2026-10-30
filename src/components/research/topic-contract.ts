/**
 * 第二阶段 · 选题分析 的公共契约提案（F 交付，未并入 P 的 research-contracts.ts）。
 *
 * 为什么不直接改 src/types/research-contracts.ts：该文件由 P 维护，F 只新增、不修改，
 * 避免两人同时改同一个已跟踪文件产生冲突。P 并入时可整份迁入 research-contracts.ts，
 * 或保留本文件并从那里 re-export，两种方式都不影响现有引用。
 *
 * 与第一阶段的差异：draft 不再是「赛事事实」，而是「候选方向 + 采用决定」；
 * 另外多一个 upstream（第一阶段已确认信息），因为本阶段的验收标准明确要求
 * 「消费第一阶段已确认信息」——方向必须能挂回第一阶段的要求，而不是另起一套。
 */
import type { CompetitionDraft, ContestUnknown, DraftContext } from '../../types/research-contracts'

/** 可行性判定：不设「可行/不可行」二元，避免把没查过的事说成查过了。 */
export type FeasibilityVerdict = 'unknown' | 'workable' | 'at-risk' | 'blocked'

export interface TopicDirection {
  id: string
  /** 方向名称，短句，便于在对比表里横向比较 */
  title: string
  /** 研究问题：一句话、可用数据回答的问题，不是「研究某某」这种主题名 */
  question: string
  /** 研究对象／抽样框：能接触到的具体人群与范围 */
  population: string
  /** 预期价值：这个方向回答出来对谁有用 */
  value: string
  /** 回应第一阶段的哪些要求（存 requirementId，不存文案副本） */
  requirementIds: string[]
  verdict: FeasibilityVerdict
  /** 可行性判断依据：数据可及性、时间窗、成本、团队能力、主要风险 */
  feasibilityNote: string
}

export interface TopicDraft {
  directions: TopicDirection[]
  /** 采用的方向；null 表示还没决定。不默认选中第一个——没选就是没选。 */
  selectedDirectionId: string | null
  /** 为什么选它、为什么不选其他 */
  selectionReason: string
  /** 未知项沿用第一阶段结构，便于公共层统一清洗与提示 */
  unknowns: ContestUnknown[]
}

export interface TopicEditorProps {
  context: DraftContext
  draft: TopicDraft
  /** 第一阶段已确认信息，只读；null 表示外壳没接上第一阶段 */
  upstream: CompetitionDraft | null
  readOnly: boolean
  issues: string[]
}

export interface TopicDraftUpdate {
  context: DraftContext
  draft: TopicDraft
}

export interface TopicActionRequest {
  context: DraftContext
}

export const FEASIBILITY_OPTIONS: { value: FeasibilityVerdict; label: string; hint: string }[] = [
  { value: 'unknown', label: '尚未判断', hint: '还没核实数据与样本可及性，不能当作可行' },
  { value: 'workable', label: '可以开展', hint: '数据与样本可及、时间窗够、团队能执行' },
  { value: 'at-risk', label: '有风险', hint: '某一项受限，需要先解决或缩小范围' },
  { value: 'blocked', label: '当前不可行', hint: '关键条件不成立，先不要采用这个方向' },
]

export function feasibilityLabel(value: FeasibilityVerdict): string {
  return FEASIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? '尚未判断'
}

export function emptyTopicDraft(): TopicDraft {
  return { directions: [], selectedDirectionId: null, selectionReason: '', unknowns: [] }
}

const verdicts: FeasibilityVerdict[] = ['unknown', 'workable', 'at-risk', 'blocked']

/**
 * 清洗落盘值。与 P 的 normalizeCompetitionDraft 同口径：结构不符返回 null，
 * 让公共层拒绝覆盖而不是悄悄存进半成品。
 */
export function normalizeTopicDraft(value: any): TopicDraft | null {
  if (!value || !Array.isArray(value.directions) || !Array.isArray(value.unknowns)) return null
  if (!(value.selectedDirectionId === null || typeof value.selectedDirectionId === 'string')) return null
  if (typeof value.selectionReason !== 'string') return null
  if (
    value.directions.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.question !== 'string' ||
        typeof item.population !== 'string' ||
        typeof item.value !== 'string' ||
        typeof item.feasibilityNote !== 'string' ||
        !verdicts.includes(item.verdict) ||
        !Array.isArray(item.requirementIds) ||
        item.requirementIds.some((id: any) => typeof id !== 'string'),
    )
  )
    return null
  if (
    value.unknowns.some(
      (item: any) =>
        !item || typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.blocksDecision !== 'boolean',
    )
  )
    return null
  return {
    directions: value.directions.map((item: TopicDirection) => ({
      id: item.id,
      title: item.title,
      question: item.question,
      population: item.population,
      value: item.value,
      requirementIds: [...item.requirementIds],
      verdict: item.verdict,
      feasibilityNote: item.feasibilityNote,
    })),
    selectedDirectionId: value.selectedDirectionId,
    selectionReason: value.selectionReason,
    unknowns: value.unknowns.map((item: ContestUnknown) => ({
      id: item.id,
      text: item.text,
      blocksDecision: item.blocksDecision,
    })),
  }
}

/**
 * 本机完整性提示。与 checkContestDraft 一样只做「缺什么」的判断，
 * 不判断选题好不好——那是评委和用户的事，不是代码能替用户下的结论。
 */
export function checkTopicDraft(draft: TopicDraft, upstream: CompetitionDraft | null): string[] {
  const issues: string[] = []

  if (!draft.directions.some((item) => item.title.trim()))
    issues.push('尚未记录候选方向，至少需要一个可比较的方向。')
  else if (draft.directions.length < 2)
    issues.push('只有 1 个候选方向，无法体现「比较」；建议再补一个不同人群或不同问题的方向。')

  for (const item of draft.directions) {
    const name = item.title.trim() || '未命名方向'
    if (!item.question.trim()) issues.push(`方向「${name}」缺少研究问题。`)
    if (!item.population.trim()) issues.push(`方向「${name}」缺少研究对象或抽样框。`)
    if (item.verdict === 'unknown') issues.push(`方向「${name}」的可行性尚未判断。`)
    if (item.verdict === 'blocked' && draft.selectedDirectionId === item.id)
      issues.push(`已采用的方向「${name}」当前不可行，需先解决限制条件。`)
  }

  if (!draft.selectedDirectionId) issues.push('尚未选定采用的方向。')
  else {
    const selected = draft.directions.find((item) => item.id === draft.selectedDirectionId)
    if (!selected) issues.push('采用的方向已被删除，请重新选择。')
    else {
      if (!draft.selectionReason.trim()) issues.push('采用方向缺少选择理由：为什么不选其他方向。')
      if (upstream?.requirements.length && !selected.requirementIds.length)
        issues.push(`采用方向未关联第一阶段要求，无法说明它回应了哪条赛事要求。`)
    }
  }

  for (const unknown of upstream?.unknowns ?? []) {
    if (unknown.blocksDecision) issues.push('第一阶段仍有影响决定的未知项：' + unknown.text)
  }
  for (const unknown of draft.unknowns) {
    if (unknown.blocksDecision) issues.push('阻碍当前决定的未知项：' + unknown.text)
  }

  return issues
}
