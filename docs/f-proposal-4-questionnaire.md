# 第四阶段「问卷设计与预测试」数据形状提案（F，待确认）

> 状态：**提案，未写代码**。确认后再产出 `questionnaire-contract.ts` + `ResearchQuestionnaireEditor.vue`。
> 依据：`docs/mvp-scope-and-status.md` 阶段 4 验收标准一句话 + 阶段 3 已交付的 `plan-contract.ts`（问卷类变量）+ 原型 `QuestionnaireEditor.tsx`（题型与预览）。

## 1. 把一句话验收标准拆成可判定的条件

原文：**「编辑/核对/真实试填反馈/修订；正式问卷固定版本；无真实反馈不标预测试通过」**

| 拆出的条件 | 怎么算满足 |
| --- | --- |
| C1 可编辑 | 题干、题型、必填、选项/量表、编码口径都能改；顺序能调；每题能挂到阶段 3 的变量 |
| C2 可核对 | 纯前端能指出具体哪一题有问题（措辞、选项、量表、时长），而不是只给一个「请检查」 |
| C3 真实反馈 | 试填轮次必须由用户录入真实发生过的数据（日期、人数、完成率、发现的问题）；**组件不生成任何试填数据** |
| C4 修订闭环 | 每条发现的问题必须写「怎么改的」，未闭环不能算通过 |
| C5 固定版本 | 固定时记录内容指纹；之后任何改动让「已固定」失效 |
| C6 不虚报 | 预测试状态**由证据推导**，不是用户点一个开关；没有完整真实轮次，永远到不了「已通过」 |

C6 是本阶段的核心。原型里 `status: '草稿'` 是一个可以直接改的字段，等于允许把「没做试填」写成「已通过」——本条不沿用。

## 2. 数据形状

```ts
export type QuestionType = 'single' | 'multi' | 'scale' | 'number' | 'text'

export interface QuestionOption {
  id: string
  label: string
  /** 编码值，供阶段 6 统计；'' = 用题号-序号的默认编码 */
  code: string
  /** 排他项：「以上都不」「都不需要」「其他」—— 多选时必须互斥 */
  exclusive: boolean
  /** 选「其他」时要填写文字 */
  openEnded: boolean
}

export interface ScaleSpec {
  /** 点数：5 / 7 / 10 等 */
  points: number
  minLabel: string      // 1 = 非常不同意
  maxLabel: string      // 5 = 非常同意
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
  options: QuestionOption[]        // single / multi 使用
  scale: ScaleSpec | null          // scale 使用
  /** 对应阶段 3 的 PlanMeasure.id；'' = 还没挂变量 */
  measureId: string
  /** 填答口径：多选最多选几项、数值单位、文本字数上限 */
  codingNote: string
  /** 该题是否为筛选/甄别题（决定样本是否进入后续题） */
  screening: boolean
}

export interface SurveyMeta {
  title: string
  /** 开场说明：目的、匿名承诺、预计时长、可随时退出 */
  intro: string
  /** 是否包含知情同意（平台内匿名调查必须先声明） */
  consent: boolean
  estimatedMinutes: number | null
  /** 匿名与数据用途说明 */
  anonymityNote: string
  /** 结束语 */
  closeNote: string
}

export type PretestVerdict = 'no-change' | 'revised' | 'retest'

export interface PretestFinding {
  id: string
  /** 具体哪一题；'' = 全卷层面（如整体太长） */
  questionId: string
  kind: 'wording' | 'option' | 'scale' | 'skip' | 'length' | 'other'
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
  /** 招募渠道（与阶段 3 recruitment.channels 同口径的描述） */
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
  /** BA 接口到位后换成 versionId */
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
```

### props 与 emits

```ts
export interface QuestionnaireEditorProps {
  context: DraftContext
  draft: QuestionnaireDraft
  /** 只剩方案一层：本阶段不需要赛事来源清单，也不需要阶段 2 方向 */
  upstream: { plan: ResearchPlanDraft | null }
  readOnly: boolean
  issues: string[]
}
```

emits 与前三阶段完全一致：`update-draft: {context, draft}`、`save-request: {context}`。

`upstream` 从三阶段的两层收成一层：本阶段只消费 `plan.measures`（`instrument === 'questionnaire'`）。不复制上阶段的赛事与方向，避免为了「字段对齐」把无关数据拖进来。已有问卷快捷入口传 `plan: null`，组件转入独立模式（见 §3.6）。

## 3. 关键设计取舍（六条）

### 3.1 预测试状态是推导出来的，不是存出来的

```ts
export type PretestState = 'draft' | 'collecting' | 'needs-revision' | 'passed'

export function pretestState(draft: QuestionnaireDraft): {
  state: PretestState
  roundId: string | null
  reasons: string[]
}
```

| 状态 | 判定 |
| --- | --- |
| `draft` | 没有任何试填轮次 |
| `collecting` | 有轮次但缺日期/人数/完成率，或 `findings` 里有 `action` 为空的 |
| `needs-revision` | 轮次完整，但最近一轮 `verdict='retest'` 之后没有新轮次；或当前指纹与该轮试填的指纹不一致（改过题但没重测） |
| `passed` | 存在一轮完整试填，且 `round.signature === questionnaireSignature(draft)`，且该轮 `verdict !== 'retest'` |

不存 `passed: boolean`。理由：字段一旦可写，就有「把 false 改成 true」的路径；推导函数是纯函数，可单测，也让「改完题自动退回需重测」成为必然结果而非靠自觉。

### 3.2 「这一版是否被试填过」用指纹对齐，不用时间戳

每轮记录保存 `signature`（该轮试填时的问卷内容指纹）。`passed` 要求它等于当前指纹——即**试填的就是现在这一版**。

不用「修改时间早于试填时间」的理由：时间戳判定会被「改回去又不改回来」绕过，而且导入/复制草稿会打乱时间顺序。指纹是内容判定，改一个字就失效，改回去又自动成立，这才是「这一版」的正确语义。

**代价**：改错别字也会退回需重测。这是刻意选择——文档里写明，不偷偷放行。真要放行，由用户补一轮真实试填，而不是我们放宽判定。

### 3.3 变量对应单向：问卷存 `measureId`，不回写 `plan`

阶段 3 已约定 `PlanMeasure.questionIds` 只由阶段 4 回填。但组件不碰 `plan`（`upstream` 是只读的），所以本阶段**只存题目侧的 `measureId`**，「变量 ↔ 题目」的映射由 P 在保存时派生：

```ts
// P 侧（保存时计算，不落进问卷草稿）
const questionIds = draft.questions.filter(q => q.measureId === m.id).map(q => q.id)
```

理由：两边都存就是两份真相，改题必有一边漏更新；阶段 6 字段核对已经踩过这个坑（提案 3 §3.2 同理）。

### 3.4 试填轮次是「证据表」，不是「感受表」

只记录四类可核查的量：日期、人数、完成率、中位时长，外加具体发现的问题。**不设「整体满意度」「用户反馈良好」这类字段**——它们无法证伪，写上去就是装饰。

`findings` 每条必须挂到具体 `questionId`（或明确标为全卷），并写 `action`。这条直接对应 C4：**没有「怎么改的」，就不算处理完**。

### 3.5 核对分「硬缺项」与「就地提示」两档

沿用阶段 3 的教训：提示必须可解决。像「题干疑似双barreled」这种启发式判断不能进缺项列表，否则用户改到死也清不掉——只能是题目下方的软提示。

| 档位 | 例子 | 是否进 `issues` |
| --- | --- | --- |
| 硬缺项 | 题干为空、选项少于 2 项、选项文本重复、量表缺端点标签、阶段 3 的问卷变量没有对应题目 | 是 |
| 就地提示 | 疑似双barreled、含诱导词、含模糊频率词、开放题设为必填、多选无排他项、选项超过 9 项、量表非 5/7 点 | 否 |

### 3.6 已有问卷入口走「独立模式」

`upstream.plan === null` 时：

- 不检查「阶段 3 问卷变量是否都建了题」（没有上游，无法也无权判断）
- 不显示变量对照区，题目编辑区保留 `measureId` 字段但隐藏
- 预测试与固定版本的判定**完全不变**

理由：快捷入口的验收标准是「直接核对与修订已有问卷；明确范围；没有反馈证据不标预测试完成」——预测试这条不能因为走捷径就免掉。

### 3.7 首版 5 种题型，不做矩阵题与排序题

`single / multi / scale / number / text` 覆盖了学生市调问卷的绝大多数场景。矩阵题（一组同量表题）与排序题需要子题目结构，会把「一题一编辑区」的模型改成两层，首版不做（见 §7）。

原型的四种题型（单选/多选/填空/量表）缺「数值」，而阶段 3 的 `interval`/`ratio` 变量必须落在数值题上，所以补 `number`；「填空」拆成 `number` 与 `text` 两类，避免把「月消费」和「你的建议」混成同一种数据结构。

## 4. 核对规则（三组，纯前端可判定）

### A 题目自身（硬缺项）

- 题干为空（`text.trim() === ''`）
- `single` / `multi` 选项少于 2 项
- 选项 `label` 为空或有重复文本
- `scale` 的 `minLabel` / `maxLabel` 为空，或 `points < 2`
- `number` 题没有写单位/范围口径（`codingNote` 为空）→ 硬缺项，因为阶段 6 无法据此核对字段
- `multi` 题 `codingNote` 为空（最多可选几项、是否互斥）

### B 与阶段 3 的对应（硬缺项，仅完整研究模式）

- 阶段 3 有 `instrument='questionnaire'` 的变量，但问卷 0 题 → 「阶段 3 记录了 N 个问卷变量，问卷还没有对应题目」
- 某问卷变量没有任何题目挂 → 「变量『X』没有对应题目，阶段 3 的分析将无数据可用」
- 题目 `measureId` 指向不存在的变量 → 「题目『…』挂的变量已不在阶段 3 方案中」（陈旧引用）
- 阶段 3 该变量 `level` 为 `interval`/`ratio`，但挂的是 `single`/`multi`/`text` 题 → 「测量尺度与题型不符，统计会按错误尺度计算」

### C 全卷（硬缺项 + 软提示）

| 项 | 档位 |
| --- | --- |
| `meta.title` 为空 | 硬 |
| `consent = false`（平台内匿名调查） | 硬 |
| `intro` 未提匿名或未提可退出 | 软 |
| `estimatedMinutes > 10` | 软 |
| 题量 > 30 | 软 |
| 全部题目都设 `required` | 软 |
| 没有 `screening` 题 | 软 |
| 多选题一个 `exclusive` 选项都没有 | 软 |
| 选项 > 9 项（单选） | 软 |
| 量表点数既非 5 也非 7 | 软 |
| 题干含「和/以及/或者」且长度 > 15 字 | 软（疑似双barreled） |
| 题干含「是否同意/您是否认为/显而易见」 | 软（诱导性） |
| 题干含「经常/一般/通常/较多」且题不是量表 | 软（频率词无锚点） |
| 题干含否定词（不/没/未） | 软（双重否定风险） |

### D 预测试（硬缺项，且拦住「固定版本」）

- 有轮次但缺日期或人数 → 「试填轮次不完整，不能作为证据」
- `respondentCount` 有值但 `< 5` → 软提示（样本过少，结论不稳）
- `verdict='revised'` 但 `revisionNote` 为空 → 硬
- `findings[].action` 为空 → 硬
- 当前指纹 ≠ 最近一轮 `signature` → 硬（「改过题但没重新试填」）
- 状态非 `passed` 时点「固定为正式问卷」→ 拒绝并说明原因

## 5. 与前后阶段的接口

| 方向 | 内容 |
| --- | --- |
| 吃进去 | 阶段 3 `ResearchPlanDraft.measures`（`instrument='questionnaire'`）：`id`、`name`、`construct`、`level`、`questionHint` —— `questionHint` 直接作为建题起点 |
| 产出给阶段 5 | `adoption.signature` + `versionId`（正式问卷固定版本）；`questions[].id` 与顺序；`meta`（开场说明、时长） |
| 产出给阶段 6 | `questions[]`（题干、题型、选项编码、`codingNote`）+ `measureId` 映射 → 字段核对 |
| 产出给 P | 「变量 ↔ 题目」映射由 P 保存时派生（§3.3） |

`questionHint` 不作为题目正文自动写入——它是阶段 3 的一句话描述，直接当题干会得到「你觉得价格怎么样」这种不能测量的问法。组件的做法是：新增题目时把 `questionHint` 作为**待改写提示**显示在题干输入框下方，用户自己写成可回答的题干。

## 6. 需要你确认的五点

| # | 问题 | 我的建议 |
| --- | --- | --- |
| 1 | 题型首版只做 5 种（单选/多选/量表/数值/开放），矩阵题和排序题不做？ | 是。矩阵/排序要改两层数据结构，等阶段 5 之后再单独提 |
| 2 | 跳题逻辑首版不做，只设「筛选题」标记 + 提示？ | 是。完整跳题要可视化分支编辑，首版用「筛选题 + 题号顺序」表达，够用 |
| 3 | 试填数据全部由用户手填真实值，组件不预填、不生成样例？ | 是。这是 C3 的唯一保证，任何预填都会变成假证据 |
| 4 | 预测试「已通过」= 存在完整轮次且该轮指纹 === 当前指纹；改任何一个字退回「需重测」？ | 是。宁可严格，不虚报。放行等于让「无真实反馈」也能标通过 |
| 5 | 没到「已通过」就不允许固定正式问卷版本（按钮禁用 + 说明原因）？ | 是。阶段 5 要绑定固定问卷，先固定再试填就是本末倒置 |

## 7. 本阶段明确不做

- **不做发布与回收** —— 阶段 5；本阶段只做问卷本体与试填记录，不生成填写链接
- **不做真实问卷渲染与作答界面** —— 预览只用于核对措辞，不产生答卷数据
- **不做统计** —— 试填的完成率/时长是用户录入的观察值，组件不计算任何推断统计
- **不自动评估题目好坏** —— 只做规则提示，不说「这道题质量 82 分」这类伪量化
- **不导入外部问卷平台文件** —— 需要格式约定，属独立范围

## 8. 确认后的产出

| 文件 | 内容 |
| --- | --- |
| `src/components/research/questionnaire-contract.ts` | 上述类型 + `emptyQuestionnaireDraft` + `normalizeQuestionnaireDraft` + `questionnaireSignature` + `pretestState` + `checkQuestionnaire` |
| `src/components/research/ResearchQuestionnaireEditor.vue` | 组件本体（沿用合并提交与 `flushDraft + nextTick` 再发 `save-request`） |
| `docs/f-component-handoff-4-questionnaire.md` | 接线清单与验证记录 |

接线要点（提前告知 P，避免第五阶段返工）：

```ts
// LocalResearchTask 增加
questionnaire?: QuestionnaireDraft

// cleanTask 同样不能用清洗函数当准入
const questionnaire = v?.questionnaire === undefined
  ? emptyQuestionnaireDraft()
  : normalizeQuestionnaireDraft(v.questionnaire)
if (!questionnaire) return null
```

宿主 glob 仍然是**精确路径**：`import.meta.glob('../../components/research/ResearchQuestionnaireEditor.vue')`。
