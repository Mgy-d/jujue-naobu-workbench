/**
 * 第三阶段 · 研究方案 的公共契约提案（F 交付，未并入 P 的 research-contracts.ts）。
 *
 * 为什么不直接改 src/types/research-contracts.ts：该文件由 P 维护，F 只新增、不修改。
 * P 并入时可整份迁入，或保留本文件并从那里 re-export，两种方式都不影响现有引用。
 *
 * 验收标准（docs/mvp-scope-and-status.md）：
 *   「抽样/招募/测量/证据/分析计划对应；预检问卷和统计可执行，用户采用固定版本」
 *
 * 拆成三条可判定的条件：
 *   C1 五块互相对应 —— 每个研究问题有变量、有分析；分析用到的变量属于该问题；变量有数据来源与定位。
 *   C2 预检可执行   —— 能判断某个统计方法在当前变量尺度与预期样本量下做不做得成。
 *   C3 固定版本     —— 采用时记录方案内容指纹，之后任何改动都让采用失效并要求重新采用。
 *
 * 与上一阶段的差异：
 *   - upstream 扩成 {competition, topic}：本阶段同时要用第一阶段的来源清单和第二阶段的采用方向。
 *   - 新增「采用」的指纹判定，不依赖 revision 语义（revision 每次编辑都涨，改错别字也会让采用失效）。
 *   - 不提供大段「方案正文」文本框，避免回到套模板文字。
 */
import type { CompetitionDraft, ContestUnknown, DraftContext } from '../../types/research-contracts'
import type { TopicDraft } from './topic-contract'

// ── 枚举 ───────────────────────────────────────────────────────────────────

/** 测量尺度决定能算什么统计，所以必须显式记录，不能只写「一道单选题」。 */
export type MeasureLevel = 'nominal' | 'ordinal' | 'interval' | 'ratio'

export type SamplingMethod =
  | 'census'
  | 'simple-random'
  | 'stratified'
  | 'cluster'
  | 'quota'
  | 'convenience'
  | 'snowball'
  | 'unknown'

export type MeasureInstrument = 'questionnaire' | 'interview' | 'observation' | 'existing'

export type AnalysisMethod =
  | 'frequency'
  | 'crosstab'
  | 'chi-square'
  | 't-test'
  | 'anova'
  | 'correlation'
  | 'regression'
  | 'content-analysis'
  | 'descriptive-only'
  | 'undecided'

// ── 数据结构 ───────────────────────────────────────────────────────────────

export interface SamplingPlan {
  /** 分析单位：一个人 / 一个宿舍 / 一条记录 */
  unit: string
  /** 抽样框：从哪份名单或哪个范围取人 */
  frame: string
  method: SamplingMethod
  /** 预期有效样本量；null = 还没估 */
  targetSize: number | null
  /** 谁被排除在外（如「只覆盖在校住宿生」） */
  coverageNote: string
  /** 结论能推广到谁、不能推广到谁 */
  inferenceScope: string
}

export interface RecruitmentPlan {
  channels: string[]
  screening: string
  incentive: string
  /** ISO 日期字符串，'' = 未定 */
  windowStart: string
  windowEnd: string
  /** 渠道带来的自选择偏差 */
  biasNote: string
}

export interface PlanQuestion {
  id: string
  /** 可用数据回答的问题，不是「研究某某」 */
  text: string
  measureIds: string[]
}

export interface PlanMeasure {
  id: string
  /** 变量名，与阶段 6 字段核对口径一致 */
  name: string
  /** 这个变量测的是什么构念 */
  construct: string
  level: MeasureLevel
  instrument: MeasureInstrument
  /** instrument='existing' 时必填：指向第一阶段 sources 的 sourceId */
  sourceIds: string[]
  /** 定位：文件第几页 / 表名 / 字段名 */
  locator: string
  /** 拟测题目的描述，供阶段 4 建题 */
  questionHint: string
  /** 阶段 4 回填的问卷题目 id；本阶段恒为 [] 且只读 */
  questionIds: string[]
}

export interface PlanAnalysis {
  id: string
  questionId: string
  method: AnalysisMethod
  /** 用到的变量，必须是所属问题的 measureIds 子集 */
  measureIds: string[]
  /** 预期产出：一张什么表 / 什么图 */
  expectedOutput: string
  /** 预检 blocked 时必须写：补什么数据、缩到什么范围、改用什么方法 */
  fallbackNote: string
}

export interface PlanAdoption {
  /** 采用时的方案内容指纹（8 位十六进制）；'' = 尚未采用 */
  signature: string
  /** BA 接口到位后换成 versionId，现在留空 */
  versionId?: string
  /** 采用理由 */
  note: string
}

export interface ResearchPlanDraft {
  /** 基于阶段 2 采用的哪个方向（只存 id，不存文案副本） */
  directionId: string | null
  researchQuestions: PlanQuestion[]
  sampling: SamplingPlan
  recruitment: RecruitmentPlan
  measures: PlanMeasure[]
  analyses: PlanAnalysis[]
  adoption: PlanAdoption
  /** 其他说明：不复刻原型那段大正文 */
  otherNote: string
  unknowns: ContestUnknown[]
}

export interface PlanUpstream {
  /** 第一阶段赛事信息，只读 */
  competition: CompetitionDraft | null
  /** 第二阶段选题结果，只读 */
  topic: TopicDraft | null
}

export interface ResearchPlanEditorProps {
  context: DraftContext
  draft: ResearchPlanDraft
  upstream: PlanUpstream
  readOnly: boolean
  issues: string[]
}

export interface PlanDraftUpdate {
  context: DraftContext
  draft: ResearchPlanDraft
}

export interface PlanActionRequest {
  context: DraftContext
}

// ── 选项表 ─────────────────────────────────────────────────────────────────

export const SAMPLING_OPTIONS: { value: SamplingMethod; label: string; probability: boolean; hint: string }[] = [
  { value: 'unknown', label: '尚未确定', probability: false, hint: '抽样方式未定，方案还不能执行' },
  { value: 'census', label: '普查', probability: true, hint: '总体内每个人都接触得到，逐个调查' },
  { value: 'simple-random', label: '简单随机', probability: true, hint: '有完整名单，按随机数抽取' },
  { value: 'stratified', label: '分层随机', probability: true, hint: '先按年级/专业等分层，层内随机' },
  { value: 'cluster', label: '整群抽样', probability: true, hint: '随机抽班级/宿舍，整群调查' },
  { value: 'quota', label: '配额抽样', probability: false, hint: '按比例分配名额，但抽取不随机' },
  { value: 'convenience', label: '便利抽样', probability: false, hint: '谁方便就问谁，不能推断总体' },
  { value: 'snowball', label: '滚雪球', probability: false, hint: '由受访者推荐下一位，适合难触达人群' },
]

export const MEASURE_LEVEL_OPTIONS: { value: MeasureLevel; label: string; hint: string }[] = [
  { value: 'nominal', label: '分类（名义）', hint: '性别、专业、是否使用过 —— 只能数个数' },
  { value: 'ordinal', label: '等级（顺序）', hint: '满意度 1–5、学历层次 —— 能排序，差距不等距' },
  { value: 'interval', label: '等距', hint: '量表总分 —— 差距可加减，但没有绝对零点' },
  { value: 'ratio', label: '等比', hint: '金额、时长、次数 —— 可乘除，有绝对零点' },
]

export const INSTRUMENT_OPTIONS: { value: MeasureInstrument; label: string; hint: string }[] = [
  { value: 'questionnaire', label: '问卷新采', hint: '阶段 4 据此建题' },
  { value: 'interview', label: '访谈', hint: '需要访谈提纲与记录' },
  { value: 'observation', label: '观察／计数', hint: '现场计数或记录，需要观察表' },
  { value: 'existing', label: '已有资料', hint: '必须指明来源与定位，不能凭文件名算已核实' },
]

export const ANALYSIS_OPTIONS: { value: AnalysisMethod; label: string; need: string }[] = [
  { value: 'undecided', label: '尚未确定', need: '—' },
  { value: 'frequency', label: '频数／分布', need: '任意尺度' },
  { value: 'descriptive-only', label: '仅描述统计', need: '任意尺度' },
  { value: 'crosstab', label: '交叉表', need: '两个分类／等级变量' },
  { value: 'chi-square', label: '卡方检验', need: '两个分类／等级变量' },
  { value: 't-test', label: '均值比较（两组）', need: '一个二分类 + 一个等距／等比' },
  { value: 'anova', label: '均值比较（多组）', need: '一个多分类 + 一个等距／等比' },
  { value: 'correlation', label: '相关分析', need: '两个等距／等比（或两个等级用 Spearman）' },
  { value: 'regression', label: '回归', need: '因变量为等距／等比' },
  { value: 'content-analysis', label: '内容分析', need: '至少一个访谈／观察变量' },
]

// ── 构造与清洗 ─────────────────────────────────────────────────────────────

export function emptyPlanDraft(): ResearchPlanDraft {
  return {
    directionId: null,
    researchQuestions: [],
    sampling: {
      unit: '',
      frame: '',
      method: 'unknown',
      targetSize: null,
      coverageNote: '',
      inferenceScope: '',
    },
    recruitment: { channels: [], screening: '', incentive: '', windowStart: '', windowEnd: '', biasNote: '' },
    measures: [],
    analyses: [],
    adoption: { signature: '', note: '' },
    otherNote: '',
    unknowns: [],
  }
}

const LEVELS: MeasureLevel[] = ['nominal', 'ordinal', 'interval', 'ratio']
const INSTRUMENTS: MeasureInstrument[] = ['questionnaire', 'interview', 'observation', 'existing']
const METHODS: AnalysisMethod[] = ANALYSIS_OPTIONS.map((item) => item.value)
const SAMPLING: SamplingMethod[] = SAMPLING_OPTIONS.map((item) => item.value)

/**
 * 清洗落盘值。与 P 的 normalizeCompetitionDraft 同口径：结构不符返回 null，
 * 让公共层拒绝覆盖而不是悄悄存进半成品。
 */
export function normalizePlanDraft(value: any): ResearchPlanDraft | null {
  if (!value || typeof value !== 'object') return null
  if (!Array.isArray(value.researchQuestions) || !Array.isArray(value.measures)) return null
  if (!Array.isArray(value.analyses) || !Array.isArray(value.unknowns)) return null
  if (!(value.directionId === null || typeof value.directionId === 'string')) return null
  if (typeof value.otherNote !== 'string') return null

  const sampling = value.sampling
  if (
    !sampling ||
    typeof sampling.unit !== 'string' ||
    typeof sampling.frame !== 'string' ||
    !SAMPLING.includes(sampling.method) ||
    !(sampling.targetSize === null || typeof sampling.targetSize === 'number') ||
    typeof sampling.coverageNote !== 'string' ||
    typeof sampling.inferenceScope !== 'string'
  )
    return null

  const recruitment = value.recruitment
  if (
    !recruitment ||
    !Array.isArray(recruitment.channels) ||
    recruitment.channels.some((item: any) => typeof item !== 'string') ||
    typeof recruitment.screening !== 'string' ||
    typeof recruitment.incentive !== 'string' ||
    typeof recruitment.windowStart !== 'string' ||
    typeof recruitment.windowEnd !== 'string' ||
    typeof recruitment.biasNote !== 'string'
  )
    return null

  const adoption = value.adoption
  if (!adoption || typeof adoption.signature !== 'string' || typeof adoption.note !== 'string') return null

  if (
    value.researchQuestions.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.text !== 'string' ||
        !Array.isArray(item.measureIds) ||
        item.measureIds.some((id: any) => typeof id !== 'string'),
    )
  )
    return null

  if (
    value.measures.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.construct !== 'string' ||
        !LEVELS.includes(item.level) ||
        !INSTRUMENTS.includes(item.instrument) ||
        !Array.isArray(item.sourceIds) ||
        item.sourceIds.some((id: any) => typeof id !== 'string') ||
        typeof item.locator !== 'string' ||
        typeof item.questionHint !== 'string' ||
        !Array.isArray(item.questionIds) ||
        item.questionIds.some((id: any) => typeof id !== 'string'),
    )
  )
    return null

  if (
    value.analyses.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.questionId !== 'string' ||
        !METHODS.includes(item.method) ||
        !Array.isArray(item.measureIds) ||
        item.measureIds.some((id: any) => typeof id !== 'string') ||
        typeof item.expectedOutput !== 'string' ||
        typeof item.fallbackNote !== 'string',
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
    directionId: value.directionId,
    researchQuestions: value.researchQuestions.map((item: PlanQuestion) => ({
      id: item.id,
      text: item.text,
      measureIds: [...item.measureIds],
    })),
    sampling: {
      unit: sampling.unit,
      frame: sampling.frame,
      method: sampling.method,
      targetSize: sampling.targetSize,
      coverageNote: sampling.coverageNote,
      inferenceScope: sampling.inferenceScope,
    },
    recruitment: {
      channels: [...recruitment.channels],
      screening: recruitment.screening,
      incentive: recruitment.incentive,
      windowStart: recruitment.windowStart,
      windowEnd: recruitment.windowEnd,
      biasNote: recruitment.biasNote,
    },
    measures: value.measures.map((item: PlanMeasure) => ({
      id: item.id,
      name: item.name,
      construct: item.construct,
      level: item.level,
      instrument: item.instrument,
      sourceIds: [...item.sourceIds],
      locator: item.locator,
      questionHint: item.questionHint,
      questionIds: [...item.questionIds],
    })),
    analyses: value.analyses.map((item: PlanAnalysis) => ({
      id: item.id,
      questionId: item.questionId,
      method: item.method,
      measureIds: [...item.measureIds],
      expectedOutput: item.expectedOutput,
      fallbackNote: item.fallbackNote,
    })),
    adoption: {
      signature: adoption.signature,
      ...(typeof adoption.versionId === 'string' ? { versionId: adoption.versionId } : {}),
      note: adoption.note,
    },
    otherNote: value.otherNote,
    unknowns: value.unknowns.map((item: ContestUnknown) => ({
      id: item.id,
      text: item.text,
      blocksDecision: item.blocksDecision,
    })),
  }
}

// ── 内容指纹（固定版本）────────────────────────────────────────────────────

/** FNV-1a 32 位，取 8 位十六进制。同一用户少量编辑，碰撞可忽略。 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * 方案内容指纹：只覆盖「方案实质内容」，键序固定，保证同一内容总得到同一结果。
 * 刻意排除 adoption（自身）与 unknowns（未知项不影响方案内容）。
 */
export function planSignature(draft: ResearchPlanDraft): string {
  const canonical = JSON.stringify({
    directionId: draft.directionId,
    questions: draft.researchQuestions.map((item) => ({
      id: item.id,
      text: item.text,
      measureIds: item.measureIds,
    })),
    sampling: {
      unit: draft.sampling.unit,
      frame: draft.sampling.frame,
      method: draft.sampling.method,
      targetSize: draft.sampling.targetSize,
      coverageNote: draft.sampling.coverageNote,
      inferenceScope: draft.sampling.inferenceScope,
    },
    recruitment: {
      channels: draft.recruitment.channels,
      screening: draft.recruitment.screening,
      incentive: draft.recruitment.incentive,
      windowStart: draft.recruitment.windowStart,
      windowEnd: draft.recruitment.windowEnd,
      biasNote: draft.recruitment.biasNote,
    },
    measures: draft.measures.map((item) => ({
      id: item.id,
      name: item.name,
      construct: item.construct,
      level: item.level,
      instrument: item.instrument,
      sourceIds: item.sourceIds,
      locator: item.locator,
      questionHint: item.questionHint,
      questionIds: item.questionIds,
    })),
    analyses: draft.analyses.map((item) => ({
      id: item.id,
      questionId: item.questionId,
      method: item.method,
      measureIds: item.measureIds,
      expectedOutput: item.expectedOutput,
      fallbackNote: item.fallbackNote,
    })),
    otherNote: draft.otherNote,
  })
  return fnv1a(canonical)
}

export type AdoptionState = 'none' | 'adopted' | 'drifted'

/** none = 还没采用；adopted = 已采用且内容未变；drifted = 采用后内容被改过，需要重新采用。 */
export function adoptionState(draft: ResearchPlanDraft): AdoptionState {
  if (!draft.adoption.signature) return 'none'
  return draft.adoption.signature === planSignature(draft) ? 'adopted' : 'drifted'
}

/** 生成一份「以当前内容为准」的采用记录。 */
export function adoptPlan(draft: ResearchPlanDraft, note: string): PlanAdoption {
  return { signature: planSignature(draft), note }
}

// ── 统计可执行性预检 ───────────────────────────────────────────────────────

export type PrecheckStatus = 'ok' | 'risky' | 'blocked'

export interface AnalysisPrecheck {
  status: PrecheckStatus
  messages: string[]
}

const NUMERIC: MeasureLevel[] = ['interval', 'ratio']
const CATEGORICAL: MeasureLevel[] = ['nominal', 'ordinal']

function isNumeric(measure: PlanMeasure): boolean {
  return NUMERIC.includes(measure.level)
}

function isCategorical(measure: PlanMeasure): boolean {
  return CATEGORICAL.includes(measure.level)
}

/**
 * 单个分析的可执行性判定。
 *
 * 用三档而不是布尔：真实数据还没采到，没人能保证统计一定做得成。
 * blocked = 尺度根本不满足（改了方法才对）；risky = 能做但有前提；ok = 尺度齐备。
 */
export function precheckAnalysis(
  analysis: PlanAnalysis,
  measures: PlanMeasure[],
  targetSize: number | null,
): AnalysisPrecheck {
  const used = measures.filter((item) => analysis.measureIds.includes(item.id))
  const messages: string[] = []

  if (analysis.method === 'undecided') {
    return { status: 'blocked', messages: ['尚未选择分析方法，等于还没有分析计划。'] }
  }
  if (!used.length) {
    return { status: 'blocked', messages: ['没有指定要分析的变量。'] }
  }

  let status: PrecheckStatus = 'ok'
  const block = (message: string) => {
    status = 'blocked'
    messages.push(message)
  }
  const risk = (message: string) => {
    if (status !== 'blocked') status = 'risky'
    messages.push(message)
  }

  switch (analysis.method) {
    case 'frequency':
    case 'descriptive-only':
      break

    case 'crosstab':
    case 'chi-square': {
      const categorical = used.filter(isCategorical)
      if (categorical.length < 2) block('交叉表／卡方需要两个分类或等级变量，当前不满足。')
      else risk('卡方需要每格期望频数不小于 5；样本不足时合并类别或改用精确检验。')
      break
    }

    case 't-test': {
      const groups = used.filter(isCategorical)
      const numeric = used.filter(isNumeric)
      if (!groups.length) block('均值比较需要一个分组变量（分类）。')
      else if (!numeric.length) block('均值比较需要一个数值变量（等距／等比）。')
      else risk('需确认分组变量只有两组；三组以上应改用方差分析。')
      break
    }

    case 'anova': {
      const groups = used.filter(isCategorical)
      const numeric = used.filter(isNumeric)
      if (!groups.length) block('方差分析需要一个分组变量（分类）。')
      else if (!numeric.length) block('方差分析需要一个数值变量（等距／等比）。')
      else risk('需确认分组变量有三组及以上，且各组方差接近。')
      break
    }

    case 'correlation': {
      const numeric = used.filter(isNumeric)
      const ordinal = used.filter((item) => item.level === 'ordinal')
      if (numeric.length >= 2) risk('相关只说明共变，不支撑因果表述。')
      else if (numeric.length === 1 && ordinal.length >= 1) risk('含等级变量，应使用 Spearman 等级相关。')
      else if (ordinal.length >= 2) risk('两个等级变量只能用 Spearman，且等级间距不等距。')
      else block('相关分析需要两个数值或等级变量。')
      break
    }

    case 'regression': {
      const numeric = used.filter(isNumeric)
      if (!numeric.length) block('回归需要等距／等比尺度的因变量，当前变量都是分类或等级。')
      else {
        const predictors = used.length - 1
        if (targetSize !== null && predictors > 0 && targetSize < predictors * 10)
          risk(`样本量 ${targetSize} 相对 ${predictors} 个自变量偏少，建议每个自变量至少 10 个样本。`)
        else risk('需说明变量进入方式与共线性检查，并报告系数与不确定性。')
      }
      break
    }

    case 'content-analysis': {
      const textual = used.filter((item) => item.instrument === 'interview' || item.instrument === 'observation')
      if (!textual.length) block('内容分析需要访谈或观察类变量（文本/记录），当前不满足。')
      else risk('需先确定编码类目与编码一致性检验方式。')
      break
    }

    default:
      break
  }

  if (targetSize !== null && targetSize < 30) {
    risk(`预期有效样本量仅 ${targetSize}，任何统计结果都不稳定。`)
  }

  return { status, messages }
}

// ── 完整性检查 ─────────────────────────────────────────────────────────────

export interface PlanCheckResult {
  /** C1 五块对应关系 */
  correspondence: string[]
  /** C2 统计可执行性 */
  statistics: string[]
  /** C3 问卷可测性（接阶段 4） */
  questionnaire: string[]
  /** 平铺后的全部问题，供 props.issues 与状态标签使用 */
  all: string[]
}

export function checkPlanDraft(draft: ResearchPlanDraft, upstream: PlanUpstream): PlanCheckResult {
  const correspondence: string[] = []
  const statistics: string[] = []
  const questionnaire: string[] = []

  const measuresById = new Map(draft.measures.map((item) => [item.id, item]))

  // 基于哪个方向
  const topicDirectionId = upstream.topic?.selectedDirectionId ?? null
  if (!upstream.topic) correspondence.push('外壳未传入第二阶段结果，无法确认本方案基于哪个采用方向。')
  else if (!topicDirectionId) correspondence.push('第二阶段尚未在本机拟选方向，本方案缺少依据。')
  else if (!draft.directionId) correspondence.push('尚未记录本方案基于哪个方向。')
  else if (draft.directionId !== topicDirectionId) correspondence.push('本方案基于的方向已不是当前本机拟选方向，请对齐或重新说明。')

  // 研究问题
  if (!draft.researchQuestions.some((item) => item.text.trim()))
    correspondence.push('尚未记录研究问题，方案没有要回答的对象。')

  for (const [index, question] of draft.researchQuestions.entries()) {
    const label = question.text.trim() || `问题 Q${index + 1}`
    const counts = draft.analyses.filter((item) => item.questionId === question.id)

    if (!question.text.trim()) correspondence.push(`Q${index + 1} 的正文为空。`)
    if (!question.measureIds.length) correspondence.push(`「${label}」没有对应的测量变量。`)
    if (!counts.length) correspondence.push(`「${label}」没有分析计划，问题无法落地。`)

    for (const analysis of counts) {
      const outside = analysis.measureIds.filter((id) => !question.measureIds.includes(id))
      if (outside.length)
        correspondence.push(`「${label}」的分析用到不属于该问题的变量：${outside.map((id) => measuresById.get(id)?.name || id).join('、')}。`)
    }
  }

  // 变量
  for (const [index, measure] of draft.measures.entries()) {
    const label = measure.name.trim() || `变量 M${index + 1}`
    if (!measure.name.trim()) correspondence.push(`变量 M${index + 1} 名称为空。`)
    if (!measure.construct.trim()) correspondence.push(`变量「${label}」未说明测量什么构念。`)
    if (measure.instrument === 'existing' && !measure.sourceIds.length)
      correspondence.push(`变量「${label}」取自已有资料，但未指明来源。`)
    if (measure.instrument === 'existing' && !measure.locator.trim())
      correspondence.push(`变量「${label}」取自已有资料，但未写明定位（页/表/字段）。`)
  }

  const orphanMeasures = draft.measures.filter(
    (item) => !draft.researchQuestions.some((question) => question.measureIds.includes(item.id)),
  )
  for (const measure of orphanMeasures)
    correspondence.push(`变量「${measure.name.trim() || '未命名'}」没有挂到任何研究问题。`)

  // 抽样
  if (!draft.sampling.unit.trim()) correspondence.push('尚未写明分析单位。')
  if (!draft.sampling.frame.trim()) correspondence.push('尚未写明抽样框：从哪份名单或范围取人。')
  if (draft.sampling.method === 'unknown') correspondence.push('抽样方式尚未确定。')
  if (draft.sampling.targetSize === null) correspondence.push('尚未估计预期有效样本量。')
  if (!draft.sampling.inferenceScope.trim()) correspondence.push('尚未写明结论能推广到谁、不能推广到谁。')

  /**
   * 非概率抽样只做就地提示（字段下方的 `.rpe-note--warn`），不进缺项列表。
   * 理由：便利／配额抽样在学生调研里是合理选择，若每填一次都报一条永不消失的缺项，
   * 方案就永远到不了「本机完整」——提示应当可解决，而「选了这个方法」本身解决不了。
   */

  // 招募
  if (!draft.recruitment.channels.filter((item) => item.trim()).length)
    correspondence.push('尚未记录招募渠道。')
  if (!draft.recruitment.windowStart.trim() || !draft.recruitment.windowEnd.trim())
    correspondence.push('招募时间窗未填完整（起止都要）。')
  else if (draft.recruitment.windowStart > draft.recruitment.windowEnd)
    correspondence.push('招募开始日期晚于结束日期。')

  // 分析预检
  for (const [index, analysis] of draft.analyses.entries()) {
    const question = draft.researchQuestions.find((item) => item.id === analysis.questionId)
    const label = question?.text.trim().slice(0, 12) || `分析 A${index + 1}`
    if (!question) {
      correspondence.push(`分析 A${index + 1} 对应的研究问题已被删除。`)
      continue
    }
    const precheck = precheckAnalysis(analysis, draft.measures, draft.sampling.targetSize)
    if (precheck.status === 'blocked' && !analysis.fallbackNote.trim()) {
      const detail = precheck.messages.filter((item) => !item.startsWith('尚未选择')).join('；')
      statistics.push(`「${label}」的分析不可执行（${detail || '方法或变量不匹配'}），请改方法或写明补救。`)
    }
  }

  // 问卷可测性
  const questionnaireMeasures = draft.measures.filter((item) => item.instrument === 'questionnaire')
  for (const measure of questionnaireMeasures) {
    if (!measure.questionHint.trim())
      questionnaire.push(`变量「${measure.name.trim() || '未命名'}」走问卷采集，但没写拟测题目，阶段 4 无法据此建题。`)
  }
  const needsQuestionnaire = draft.analyses.some((analysis) =>
    analysis.measureIds.some((id) => measuresById.get(id)?.instrument === 'questionnaire'),
  )
  if (needsQuestionnaire && !questionnaireMeasures.length)
    questionnaire.push('分析计划用到问卷数据，但没有标记为「问卷新采」的变量。')

  // 采用（固定版本）
  const state = adoptionState(draft)
  if (state === 'none') correspondence.push('尚未在本机标记本方案；正式版本仍待服务器接入。')
  else if (state === 'drifted') correspondence.push('方案内容在本机标记后已修改，需重新标记；正式版本仍待服务器接入。')
  else if (!draft.adoption.note.trim()) correspondence.push('本机已标记方案，但未写标记理由。')

  // 未知项
  for (const unknown of upstream.competition?.unknowns ?? []) {
    if (unknown.blocksDecision) correspondence.push('第一阶段仍有影响决定的未知项：' + unknown.text)
  }
  for (const unknown of upstream.topic?.unknowns ?? []) {
    if (unknown.blocksDecision) correspondence.push('第二阶段仍有影响决定的未知项：' + unknown.text)
  }
  for (const unknown of draft.unknowns) {
    if (unknown.blocksDecision) correspondence.push('阻碍当前决定的未知项：' + unknown.text)
  }

  return {
    correspondence,
    statistics,
    questionnaire,
    all: [...correspondence, ...statistics, ...questionnaire],
  }
}

/** 供界面展示的短标签。 */
export function samplingLabel(value: SamplingMethod): string {
  return SAMPLING_OPTIONS.find((item) => item.value === value)?.label ?? '尚未确定'
}

export function levelLabel(value: MeasureLevel): string {
  return MEASURE_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? '未定'
}

export function instrumentLabel(value: MeasureInstrument): string {
  return INSTRUMENT_OPTIONS.find((item) => item.value === value)?.label ?? '未定'
}

export function analysisLabel(value: AnalysisMethod): string {
  return ANALYSIS_OPTIONS.find((item) => item.value === value)?.label ?? '尚未确定'
}

export function precheckStatusLabel(value: PrecheckStatus): string {
  if (value === 'ok') return '尺度齐备'
  if (value === 'risky') return '有前提'
  return '不可执行'
}
