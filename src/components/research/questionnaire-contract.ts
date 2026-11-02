/**
 * 第四阶段 · 问卷设计与预测试 的公共契约提案（F 交付，未并入 P 的 research-contracts.ts）。
 *
 * 为什么不直接改 src/types/research-contracts.ts：该文件由 P 维护，F 只新增、不修改。
 *
 * 验收标准（docs/mvp-scope-and-status.md）：
 *   「编辑/核对/真实试填反馈/修订；正式问卷固定版本；无真实反馈不标预测试通过」
 *
 * 拆成六条可判定的条件（详 docs/f-proposal-4-questionnaire.md）：
 *   C1 可编辑  —— 题干/题型/必填/选项/量表/编码口径都能改，每题能挂到阶段 3 的变量。
 *   C2 可核对  —— 纯前端指出具体哪一题有问题，而不是只给一句「请检查」。
 *   C3 真实反馈 —— 试填轮次由用户录入真实发生的数据；本文件不生成任何试填数据。
 *   C4 修订闭环 —— 每条发现的问题必须写「怎么改的」，未闭环不算通过。
 *   C5 固定版本 —— 固定时记录内容指纹，之后任何改动让「已固定」失效。
 *   C6 不虚报  —— 预测试状态由证据推导，不存 boolean。
 *
 * 与上一阶段的差异：
 *   - upstream 收成 {plan}：本阶段只消费阶段 3 的问卷类变量，不复制赛事与方向。
 *   - 新增预测试状态机 pretestState()：passed 要求「最近一轮试填的指纹 === 当前指纹」。
 *   - 变量映射单向：问卷存 measureId，不回写 plan.measures[].questionIds（由 P 保存时派生）。
 */
import type { ContestUnknown, DraftContext } from '../../types/research-contracts'
import type { MeasureLevel, PlanMeasure, ResearchPlanDraft } from './plan-contract'

// ── 枚举 ───────────────────────────────────────────────────────────────────

export type QuestionType = 'single' | 'multi' | 'scale' | 'number' | 'text'

export type PretestVerdict = 'no-change' | 'revised' | 'retest'

export type FindingKind = 'wording' | 'option' | 'scale' | 'skip' | 'length' | 'other'

/** 预测试状态由证据推导，落盘值里没有这个字段。 */
export type PretestState = 'draft' | 'collecting' | 'needs-revision' | 'passed'

// ── 数据结构 ───────────────────────────────────────────────────────────────

export interface QuestionOption {
  id: string
  label: string
  /** 编码值，供阶段 6 统计；'' = 用题号-序号的默认编码 */
  code: string
  /** 排他项：「以上都不」「都不需要」—— 多选时必须互斥 */
  exclusive: boolean
  /** 选「其他」时要填写文字 */
  openEnded: boolean
}

export interface ScaleSpec {
  /** 点数：5 / 7 / 10 等 */
  points: number
  minLabel: string
  maxLabel: string
  /** 中点标签，奇数点才有；'' = 不标 */
  midLabel: string
  /** 是否提供「不知道 / 不适用」出口 */
  hasDontKnow: boolean
}

export interface SurveyQuestion {
  id: string
  text: string
  type: QuestionType
  required: boolean
  /** single / multi 使用 */
  options: QuestionOption[]
  /** scale 使用，其余题型为 null */
  scale: ScaleSpec | null
  /** 对应阶段 3 的 PlanMeasure.id；'' = 还没挂变量 */
  measureId: string
  /** 填答口径：多选最多几项、数值单位与范围、文本字数上限 */
  codingNote: string
  /** 筛选/甄别题：决定样本是否进入后续题 */
  screening: boolean
}

export interface SurveyMeta {
  title: string
  /** 开场说明：目的、匿名承诺、预计时长、可随时退出 */
  intro: string
  /** 是否包含知情同意（平台内匿名调查必须先声明） */
  consent: boolean
  estimatedMinutes: number | null
  anonymityNote: string
  closeNote: string
}

export interface PretestFinding {
  id: string
  /** 具体哪一题；'' = 全卷层面（如整体太长） */
  questionId: string
  kind: FindingKind
  /** 实际观察到的现象 */
  text: string
  /** 怎么改的；'' = 尚未处理 */
  action: string
}

export interface PretestRound {
  id: string
  /** 试填日期，'' = 未记录 */
  date: string
  /** 真实参与并完成的人数；null = 未统计 */
  respondentCount: number | null
  channel: string
  /** 完成率 0–100；null = 未统计 */
  completionRate: number | null
  /** 中位填答时长（分钟）；null = 未统计 */
  medianMinutes: number | null
  findings: PretestFinding[]
  verdict: PretestVerdict
  /** 本轮反馈导致的修改说明；verdict='revised' 时必填 */
  revisionNote: string
  /** 本轮试填针对的问卷内容指纹 —— 判断「这一版是否被试填过」的唯一依据 */
  signature: string
}

export interface QuestionnaireAdoption {
  /** 固定时的问卷内容指纹；'' = 尚未固定 */
  signature: string
  /** BA 接口到位后替换 */
  versionId?: string
  /** 依据哪一轮试填固定 */
  roundId: string
  note: string
}

export interface QuestionnaireDraft {
  meta: SurveyMeta
  questions: SurveyQuestion[]
  pretestRounds: PretestRound[]
  adoption: QuestionnaireAdoption
  otherNote: string
  unknowns: ContestUnknown[]
}

export interface QuestionnaireUpstream {
  /** 第三阶段研究方案，只读；null = 已有问卷快捷入口（独立模式） */
  plan: ResearchPlanDraft | null
}

export interface ResearchQuestionnaireEditorProps {
  context: DraftContext
  draft: QuestionnaireDraft
  upstream: QuestionnaireUpstream
  readOnly: boolean
  issues: string[]
}

export interface QuestionnaireDraftUpdate {
  context: DraftContext
  draft: QuestionnaireDraft
}

export interface QuestionnaireActionRequest {
  context: DraftContext
}

// ── 选项表 ─────────────────────────────────────────────────────────────────

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'single', label: '单选', hint: '只能选一项，选项要互斥且尽量穷尽' },
  { value: 'multi', label: '多选', hint: '需要排他项（如「以上都不」），并写明最多可选几项' },
  { value: 'scale', label: '量表', hint: '一组有序等级，必须标清两端含义，中点是否标注要说明' },
  { value: 'number', label: '数值', hint: '金额／时长／次数，必须写单位与取值范围' },
  { value: 'text', label: '开放文本', hint: '文字回答，不能直接做统计，只能做内容分析或编码' },
]

export const PRETEST_VERDICT_OPTIONS: { value: PretestVerdict; label: string; hint: string }[] = [
  { value: 'no-change', label: '无需修改', hint: '仍需核对真实反馈和取得正式版本后才能发布' },
  { value: 'revised', label: '已修改', hint: '根据本轮反馈改过题，需说明改了什么' },
  { value: 'retest', label: '需重测', hint: '改动较大，改完必须再试填一轮才算通过' },
]

export const FINDING_KIND_OPTIONS: { value: FindingKind; label: string }[] = [
  { value: 'wording', label: '措辞' },
  { value: 'option', label: '选项' },
  { value: 'scale', label: '量表' },
  { value: 'skip', label: '跳题/逻辑' },
  { value: 'length', label: '长度/时长' },
  { value: 'other', label: '其他' },
]

/** 数值型测量尺度：等距／等比只能落在数值题上。 */
const NUMERIC_LEVELS: MeasureLevel[] = ['interval', 'ratio']

// ── 构造与清洗 ─────────────────────────────────────────────────────────────

export function emptyQuestionOption(label = ''): QuestionOption {
  return { id: `o-${crypto.randomUUID()}`, label, code: '', exclusive: false, openEnded: false }
}

export function emptyScaleSpec(): ScaleSpec {
  return { points: 5, minLabel: '非常不同意', maxLabel: '非常同意', midLabel: '一般', hasDontKnow: false }
}

export function emptySurveyQuestion(type: QuestionType = 'single'): SurveyQuestion {
  return {
    id: `q-${crypto.randomUUID()}`,
    text: '',
    type,
    required: true,
    options: type === 'single' || type === 'multi' ? [emptyQuestionOption(), emptyQuestionOption()] : [],
    scale: type === 'scale' ? emptyScaleSpec() : null,
    measureId: '',
    codingNote: '',
    screening: false,
  }
}

export function emptyPretestRound(signature = ''): PretestRound {
  return {
    id: `r-${crypto.randomUUID()}`,
    date: '',
    respondentCount: null,
    channel: '',
    completionRate: null,
    medianMinutes: null,
    findings: [],
    verdict: 'no-change',
    revisionNote: '',
    signature,
  }
}

export function emptyQuestionnaireDraft(): QuestionnaireDraft {
  return {
    meta: {
      title: '',
      intro: '',
      consent: false,
      estimatedMinutes: null,
      anonymityNote: '',
      closeNote: '',
    },
    questions: [],
    pretestRounds: [],
    adoption: { signature: '', roundId: '', note: '' },
    otherNote: '',
    unknowns: [],
  }
}

const QUESTION_TYPES: QuestionType[] = QUESTION_TYPE_OPTIONS.map((item) => item.value)
const VERDICTS: PretestVerdict[] = PRETEST_VERDICT_OPTIONS.map((item) => item.value)
const KINDS: FindingKind[] = FINDING_KIND_OPTIONS.map((item) => item.value)

/**
 * 清洗落盘值。与 P 的 normalizeCompetitionDraft 同口径：结构不符返回 null，
 * 让公共层拒绝覆盖而不是悄悄存进半成品。
 */
export function normalizeQuestionnaireDraft(value: any): QuestionnaireDraft | null {
  if (!value || typeof value !== 'object') return null
  if (!Array.isArray(value.questions) || !Array.isArray(value.pretestRounds) || !Array.isArray(value.unknowns))
    return null
  if (typeof value.otherNote !== 'string') return null

  const meta = value.meta
  if (
    !meta ||
    typeof meta.title !== 'string' ||
    typeof meta.intro !== 'string' ||
    typeof meta.consent !== 'boolean' ||
    !(meta.estimatedMinutes === null || typeof meta.estimatedMinutes === 'number') ||
    typeof meta.anonymityNote !== 'string' ||
    typeof meta.closeNote !== 'string'
  )
    return null

  const adoption = value.adoption
  if (!adoption || typeof adoption.signature !== 'string' || typeof adoption.roundId !== 'string' || typeof adoption.note !== 'string')
    return null

  if (
    value.questions.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.text !== 'string' ||
        !QUESTION_TYPES.includes(item.type) ||
        typeof item.required !== 'boolean' ||
        !Array.isArray(item.options) ||
        typeof item.measureId !== 'string' ||
        typeof item.codingNote !== 'string' ||
        typeof item.screening !== 'boolean' ||
        !(item.scale === null || (typeof item.scale === 'object' && typeof item.scale.points === 'number')) ||
        item.options.some(
          (option: any) =>
            !option ||
            typeof option.id !== 'string' ||
            typeof option.label !== 'string' ||
            typeof option.code !== 'string' ||
            typeof option.exclusive !== 'boolean' ||
            typeof option.openEnded !== 'boolean',
        ),
    )
  )
    return null

  if (
    value.pretestRounds.some(
      (item: any) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.date !== 'string' ||
        !(item.respondentCount === null || typeof item.respondentCount === 'number') ||
        typeof item.channel !== 'string' ||
        !(item.completionRate === null || typeof item.completionRate === 'number') ||
        !(item.medianMinutes === null || typeof item.medianMinutes === 'number') ||
        !VERDICTS.includes(item.verdict) ||
        typeof item.revisionNote !== 'string' ||
        typeof item.signature !== 'string' ||
        !Array.isArray(item.findings) ||
        item.findings.some(
          (finding: any) =>
            !finding ||
            typeof finding.id !== 'string' ||
            typeof finding.questionId !== 'string' ||
            !KINDS.includes(finding.kind) ||
            typeof finding.text !== 'string' ||
            typeof finding.action !== 'string',
        ),
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
    meta: {
      title: meta.title,
      intro: meta.intro,
      consent: meta.consent,
      estimatedMinutes: meta.estimatedMinutes,
      anonymityNote: meta.anonymityNote,
      closeNote: meta.closeNote,
    },
    questions: value.questions.map((item: SurveyQuestion) => ({
      id: item.id,
      text: item.text,
      type: item.type,
      required: item.required,
      options: item.options.map((option) => ({
        id: option.id,
        label: option.label,
        code: option.code,
        exclusive: option.exclusive,
        openEnded: option.openEnded,
      })),
      scale:
        item.scale === null
          ? null
          : {
              points: item.scale.points,
              minLabel: String(item.scale.minLabel ?? ''),
              maxLabel: String(item.scale.maxLabel ?? ''),
              midLabel: String(item.scale.midLabel ?? ''),
              hasDontKnow: item.scale.hasDontKnow === true,
            },
      measureId: item.measureId,
      codingNote: item.codingNote,
      screening: item.screening,
    })),
    pretestRounds: value.pretestRounds.map((item: PretestRound) => ({
      id: item.id,
      date: item.date,
      respondentCount: item.respondentCount,
      channel: item.channel,
      completionRate: item.completionRate,
      medianMinutes: item.medianMinutes,
      findings: item.findings.map((finding) => ({
        id: finding.id,
        questionId: finding.questionId,
        kind: finding.kind,
        text: finding.text,
        action: finding.action,
      })),
      verdict: item.verdict,
      revisionNote: item.revisionNote,
      signature: item.signature,
    })),
    adoption: {
      signature: adoption.signature,
      ...(typeof adoption.versionId === 'string' ? { versionId: adoption.versionId } : {}),
      roundId: adoption.roundId,
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

/** FNV-1a 32 位，取 8 位十六进制。与阶段 3 同一算法，便于跨阶段核对。 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * 问卷内容指纹：只覆盖「问卷实质内容」——卷首说明、题目、其他说明。
 * 刻章排除 pretestRounds（试填记录是对问卷的评价，不是问卷内容）、
 * adoption（自身）与 unknowns（未知项不影响问卷内容）。
 *
 * 注意：开场说明也进指纹。改开场白等于改变了被试试填的那份材料，
 * 因此会让「已通过」退回需重测——这是刻意选择，见提案 §3.2。
 */
export function questionnaireSignature(draft: QuestionnaireDraft): string {
  const canonical = JSON.stringify({
    meta: {
      title: draft.meta.title,
      intro: draft.meta.intro,
      consent: draft.meta.consent,
      estimatedMinutes: draft.meta.estimatedMinutes,
      anonymityNote: draft.meta.anonymityNote,
      closeNote: draft.meta.closeNote,
    },
    questions: draft.questions.map((item) => ({
      id: item.id,
      text: item.text,
      type: item.type,
      required: item.required,
      options: item.options.map((option) => ({
        id: option.id,
        label: option.label,
        code: option.code,
        exclusive: option.exclusive,
        openEnded: option.openEnded,
      })),
      scale: item.scale
        ? {
            points: item.scale.points,
            minLabel: item.scale.minLabel,
            maxLabel: item.scale.maxLabel,
            midLabel: item.scale.midLabel,
            hasDontKnow: item.scale.hasDontKnow,
          }
        : null,
      measureId: item.measureId,
      codingNote: item.codingNote,
      screening: item.screening,
    })),
    otherNote: draft.otherNote,
  })
  return fnv1a(canonical)
}

export type QuestionnaireAdoptionState = 'none' | 'fixed' | 'drifted'

/** none = 还没固定；fixed = 已固定且内容未变；drifted = 固定后内容被改过。 */
export function questionnaireAdoptionState(draft: QuestionnaireDraft): QuestionnaireAdoptionState {
  if (!draft.adoption.signature) return 'none'
  const signature=questionnaireSignature(draft),round=draft.pretestRounds.find(item=>item.id===draft.adoption.roundId)
  return draft.adoption.signature===signature && round?.signature===signature && pretestState(draft).state==='passed' ? 'fixed' : 'drifted'
}

/** 生成一份「以当前内容为准」的固定记录。 */
export function fixQuestionnaire(draft: QuestionnaireDraft, roundId: string, note: string): QuestionnaireAdoption {
  return { signature: questionnaireSignature(draft), roundId, note }
}

// ── 预测试状态（推导，不落盘）──────────────────────────────────────────────

export interface PretestStateResult {
  state: PretestState
  /** passed 时指向「当前这一版被试填」的那一轮 */
  roundId: string | null
  /** 为什么是这个状态；直接展示给用户 */
  reasons: string[]
}

/**
 * 四态判定，顺序即优先级：
 *   draft          没有任何试填轮次
 *   collecting     有轮次但缺日期/人数，或发现问题没写「怎么改的」
 *   needs-revision 轮次完整，但最近一轮结论要求重测，或当前内容与该轮试填的版本不一致
 *   passed         存在完整轮次，且该轮试填的就是现在这一版
 *
 * 不存 passed: boolean —— 字段一旦可写就有把 false 改成 true 的路径。
 */
export function pretestState(draft: QuestionnaireDraft): PretestStateResult {
  const rounds = draft.pretestRounds
  if (!rounds.length) return { state: 'draft', roundId: null, reasons: ['还没有任何试填轮次。'] }

  const reasons: string[] = []

  const incomplete = rounds.filter((round) => !/^\d{4}-\d{2}-\d{2}$/.test(round.date) || !Number.isFinite(Date.parse(round.date)) || new Date(round.date).toISOString().slice(0,10)!==round.date || !Number.isInteger(round.respondentCount) || (round.respondentCount??0)<=0 || !round.channel.trim())
  if (incomplete.length) {
    reasons.push(`有 ${incomplete.length} 轮试填缺有效日期、正整数人数或渠道，录入资料未通过本机检查。`)
    return { state: 'collecting', roundId: null, reasons }
  }

  const openFindings = rounds.reduce(
    (count, round) => count + round.findings.filter((finding) => !finding.action.trim() || !finding.text.trim()).length,
    0,
  )
  if (openFindings) {
    reasons.push(`还有 ${openFindings} 条试填发现缺具体现象或处理说明，修订记录未闭环。`)
    return { state: 'collecting', roundId: null, reasons }
  }

  if(rounds.some(round=>round.verdict==='revised'&&!round.revisionNote.trim()))return {state:'collecting',roundId:null,reasons:['已修改的试填轮次还缺修订说明。']}
  const last = rounds[rounds.length - 1]
  if (last.verdict === 'retest') {
    reasons.push('最近一轮结论是「需重测」，改完必须再试填一轮。')
    return { state: 'needs-revision', roundId: null, reasons }
  }

  const current = questionnaireSignature(draft)
  if (last.signature !== current) {
    reasons.push('当前问卷内容与最近一轮试填的版本不一致：改过题但没重新试填。')
    return { state: 'needs-revision', roundId: null, reasons }
  }

  reasons.push(`最近一轮试填（${last.date}，${last.respondentCount} 人）所录指纹与当前内容一致，且问题记录已闭环；未核验真实试填。`)
  return { state: 'passed', roundId: last.id, reasons }
}

// ── 单题核对（软提示）──────────────────────────────────────────────────────

const VAGUE_FREQUENCY = ['经常', '一般', '通常', '较多', '偶尔', '有时']
const LEADING = ['是否同意', '您是否认为', '你是否认为', '显而易见', '众所周知']
const DOUBLE_BARREL = ['以及', '或者', '和']
/** 只匹配真正的否定式问法，避免「找不到」这类普通否定被反复提示。 */
const DOUBLE_NEGATIVE = /不[^，。？]{0,6}不|没[^，。？]{0,6}没|不认为|不应该|是否不/

export interface QuestionHint {
  level: 'warn' | 'info'
  text: string
}

/**
 * 单题的就地提示。这些判断都是启发式，**不进缺项列表**：
 * 提示必须可解决，而「题干含『和』」不是用户能通过编辑消除的确定错误。
 */
export function questionHints(question: SurveyQuestion, index: number): QuestionHint[] {
  const hints: QuestionHint[] = []
  const text = question.text.trim()
  if (!text) return hints
  const label = `第 ${index + 1} 题`

  if (question.type !== 'scale') {
    const vague = VAGUE_FREQUENCY.find((word) => text.includes(word))
    if (vague) hints.push({ level: 'warn', text: `${label}题干用了「${vague}」这类频率词，没有锚点，建议改成具体频次或时段。` })
  }

  const leading = LEADING.find((word) => text.includes(word))
  if (leading) hints.push({ level: 'warn', text: `${label}含「${leading}」，属于诱导性问法，建议改为中立表述。` })

  if (text.length > 15 && DOUBLE_BARREL.some((word) => text.includes(word)) && question.type !== 'scale') {
    hints.push({ level: 'info', text: `${label}可能一次问了两个对象（含「和／以及／或者」），请自行核对是否应拆成两题。` })
  }

  if (DOUBLE_NEGATIVE.test(text)) {
    hints.push({ level: 'info', text: `${label}疑似否定式问法，注意不要形成双重否定（如「您不认为…不合理」）。` })
  }

  if (question.type === 'text' && question.required) {
    hints.push({ level: 'warn', text: `${label}是开放文本且设为必填，会明显拉低完成率，建议改为非必填。` })
  }

  if (question.type === 'multi' && question.options.length && !question.options.some((option) => option.exclusive)) {
    hints.push({ level: 'warn', text: `${label}是多选，但没有「以上都不」这类排他项，选项可能不完备。` })
  }

  if (question.type === 'single' && question.options.length > 9) {
    hints.push({ level: 'warn', text: `${label}有 ${question.options.length} 个选项，单选超过 9 项受访者容易漏看。` })
  }

  if (question.type === 'scale' && question.scale && question.scale.points !== 5 && question.scale.points !== 7) {
    hints.push({
      level: 'info',
      text: `${label}量表为 ${question.scale.points} 点，非 5／7 点的量表需要在报告中说明为何这样分。`,
    })
  }

  return hints
}

/** 单题的硬缺项：能靠编辑确定解决的，才进 issues。 */
export function questionBlockers(question: SurveyQuestion, index: number): string[] {
  const issues: string[] = []
  const label = `第 ${index + 1} 题`

  if (!question.text.trim()) issues.push(`${label}的题干为空。`)

  if (question.type === 'single' || question.type === 'multi') {
    if (question.options.length < 2) issues.push(`${label}只有 ${question.options.length} 个选项，至少需要 2 个。`)
    if (question.options.some((option) => !option.label.trim())) issues.push(`${label}有选项文本为空。`)
    const labels = question.options.map((option) => option.label.trim()).filter(Boolean)
    if (new Set(labels).size !== labels.length) issues.push(`${label}有重复的选项文本。`)
    if (question.type === 'multi' && !question.codingNote.trim())
      issues.push(`${label}是多选，但没写最多可选几项、是否互斥。`)
  }

  if (question.type === 'scale') {
    if (!question.scale) issues.push(`${label}是量表题，但没有设置量表参数。`)
    else {
      if (!question.scale.minLabel.trim()) issues.push(`${label}量表缺少起点标签（如「非常不同意」）。`)
      if (!question.scale.maxLabel.trim()) issues.push(`${label}量表缺少终点标签（如「非常同意」）。`)
      if (!(question.scale.points >= 2)) issues.push(`${label}量表点数必须不小于 2。`)
    }
  }

  if (question.type === 'number' && !question.codingNote.trim())
    issues.push(`${label}是数值题，但没写单位与取值范围，阶段 6 无法核对字段。`)

  return issues
}

// ── 完整性检查 ─────────────────────────────────────────────────────────────

export interface QuestionnaireCheckResult {
  /** A 题目自身（含卷首信息） */
  questions: string[]
  /** B 与阶段 3 问卷变量的对应（独立模式下恒为空） */
  mapping: string[]
  /** D 预测试证据与固定版本 */
  pretest: string[]
  /** 全卷软提示：不进 issues，只在界面下方展示 */
  hints: string[]
  /** 平铺后的硬缺项，供 props.issues 与状态标签使用 */
  all: string[]
}

export function checkQuestionnaire(
  draft: QuestionnaireDraft,
  upstream: QuestionnaireUpstream,
): QuestionnaireCheckResult {
  const questions: string[] = []
  const mapping: string[] = []
  const pretest: string[] = []
  const hints: string[] = []

  // A 卷首信息
  if (!draft.meta.title.trim()) questions.push('问卷标题为空。')
  if (!draft.meta.intro.trim()) questions.push('开场说明为空：受访者需要知道调查目的、匿名承诺和大概时长。')
  if (!draft.meta.consent) questions.push('未声明知情同意：平台内匿名调查必须先说明数据用途与自愿退出。')

  // A 题目
  if (!draft.questions.length) questions.push('问卷还没有题目。')
  for (const [index, question] of draft.questions.entries()) questions.push(...questionBlockers(question, index))

  // C 全卷软提示
  if (!draft.meta.anonymityNote.trim()) hints.push('未单列匿名说明，建议在开场说明之外单独写清数据如何脱敏与保存。')
  if (draft.meta.estimatedMinutes !== null && draft.meta.estimatedMinutes > 10)
    hints.push(`预估时长 ${draft.meta.estimatedMinutes} 分钟，超过 10 分钟时中途退出会明显增加。`)
  if (draft.questions.length > 30) hints.push(`共 ${draft.questions.length} 题，题量偏多，建议合并或删减。`)
  if (draft.questions.length && draft.questions.every((item) => item.required))
    hints.push('所有题目都设为必填，建议保留一两道非必填，降低中途放弃。')
  if (draft.questions.length && !draft.questions.some((item) => item.screening))
    hints.push('没有筛选题：无法在作答开始就排除不符合条件的受访者。')

  // B 与阶段 3 的对应
  const plan = upstream.plan
  if (plan) {
    const measures = plan.measures.filter((item) => item.instrument === 'questionnaire')
    const questionIdsByMeasure = new Map<string, string[]>()
    for (const question of draft.questions) {
      if (!question.measureId) continue
      const list = questionIdsByMeasure.get(question.measureId) ?? []
      list.push(question.id)
      questionIdsByMeasure.set(question.measureId, list)
    }

    if (measures.length && !draft.questions.length)
      mapping.push(`阶段 3 记录了 ${measures.length} 个问卷类变量，问卷还没有任何题目。`)

    for (const measure of measures) {
      if (!questionIdsByMeasure.has(measure.id))
        mapping.push(`变量「${measure.name.trim() || '未命名'}」没有对应题目，阶段 3 的分析将没有数据可用。`)
    }

    for (const [index, question] of draft.questions.entries()) {
      if (!question.measureId) continue
      const measure = plan.measures.find((item) => item.id === question.measureId)
      if (!measure) {
        mapping.push(`第 ${index + 1} 题挂的变量已不在阶段 3 方案中（可能被删除或改过）。`)
        continue
      }
      if (measure.instrument !== 'questionnaire')
        mapping.push(`第 ${index + 1} 题挂的变量「${measure.name.trim() || '未命名'}」不是问卷采集类，应改用其他方式收集。`)
      const numericMeasure = NUMERIC_LEVELS.includes(measure.level)
      if (numericMeasure && (question.type === 'single' || question.type === 'multi' || question.type === 'text'))
        mapping.push(
          `第 ${index + 1} 题的类型（${questionTypeLabel(question.type)}）与变量「${measure.name.trim() || '未命名'}」的等距／等比尺度不符，统计会按错误尺度计算。`,
        )
      if (!numericMeasure && question.type === 'number')
        mapping.push(
          `第 ${index + 1} 题是数值题，但变量「${measure.name.trim() || '未命名'}」是${levelName(measure.level)}尺度，数值不应作为分类或等级处理。`,
        )
    }
  }

  // D 预测试
  for (const [index, round] of draft.pretestRounds.entries()) {
    const label = `第 ${index + 1} 轮试填`
    if (!round.date.trim()) pretest.push(`${label}没填日期，不能作为证据。`)
    if (round.respondentCount === null) pretest.push(`${label}没填参与人数，不能作为证据。`)
    if (round.respondentCount !== null && round.respondentCount < 5) hints.push(`${label}只有 ${round.respondentCount} 人，结论不稳，建议继续补到 5 人以上。`)
    if (round.verdict === 'revised' && !round.revisionNote.trim())
      pretest.push(`${label}标记为「已修改」，但没写改了什么。`)
    for (const [findingIndex, finding] of round.findings.entries()) {
      if (!finding.text.trim()) pretest.push(`${label}第 ${findingIndex + 1} 条发现没写具体现象。`)
      if (!finding.action.trim()) pretest.push(`${label}第 ${findingIndex + 1} 条发现没写「怎么改的」。`)
    }
  }

  const state = pretestState(draft)
  if (!draft.pretestRounds.length) pretest.push('尚未进行真实试填：预测试未完成，本阶段不能算完成。')
  else if (state.state !== 'passed') pretest.push(...state.reasons)

  // 固定版本
  const adoption = questionnaireAdoptionState(draft)
  if (adoption === 'drifted') pretest.push('本机标记后的问卷内容或试填依据已变化，请核对录入资料并重新标记。')
  if (adoption === 'fixed' && state.state !== 'passed') pretest.push('本机已标记，但试填录入资料当前不满足检查；不代表正式问卷。')
  if (adoption === 'fixed' && !draft.adoption.note.trim()) pretest.push('本机已标记，但没写标记理由。')
  if (adoption === 'fixed' && !draft.adoption.roundId.trim()) pretest.push('本机已标记，但没记录依据哪一轮试填。')

  // 未知项
  for (const unknown of draft.unknowns) {
    if (unknown.blocksDecision) questions.push('阻碍当前决定的未知项：' + unknown.text)
  }

  return {
    questions,
    mapping,
    pretest,
    hints,
    all: [...questions, ...mapping, ...pretest],
  }
}

/** 阶段 3 里走问卷采集的变量，是本阶段建题的对象。 */
export function questionnaireMeasures(plan: ResearchPlanDraft | null): PlanMeasure[] {
  if (!plan) return []
  return plan.measures.filter((item) => item.instrument === 'questionnaire')
}

// ── 展示用文案 ─────────────────────────────────────────────────────────────

export function questionTypeLabel(value: QuestionType): string {
  return QUESTION_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? '未定'
}

export function verdictLabel(value: PretestVerdict): string {
  return PRETEST_VERDICT_OPTIONS.find((item) => item.value === value)?.label ?? '未定'
}

export function findingKindLabel(value: FindingKind): string {
  return FINDING_KIND_OPTIONS.find((item) => item.value === value)?.label ?? '其他'
}

export function pretestStateLabel(value: PretestState): string {
  if (value === 'passed') return '录入资料符合本机检查'
  if (value === 'needs-revision') return '需重新试填'
  if (value === 'collecting') return '试填记录不完整'
  return '尚未试填'
}

export function levelName(value: MeasureLevel): string {
  if (value === 'nominal') return '分类'
  if (value === 'ordinal') return '等级'
  if (value === 'interval') return '等距'
  return '等比'
}
