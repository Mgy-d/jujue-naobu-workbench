# 第三阶段「研究方案」数据形状提案（F，待确认）

> 状态：**提案，未写代码**。确认后再产出 `plan-contract.ts` + `ResearchPlanEditor.vue`。
> 依据：`docs/mvp-scope-and-status.md` 阶段 3 验收标准一句话 + 原型 `PlanEditor` / `EvidenceEditor` 的字段。

## 1. 把一句话验收标准拆成可判定的条件

原文：**「抽样/招募/测量/证据/分析计划对应；预检问卷和统计可执行，用户采用固定版本」**

| 拆出的条件 | 怎么算满足 |
| --- | --- |
| C1 五块互相对应 | 每个研究问题必须有变量、有分析；每个分析用到的变量必须属于该问题；每个变量必须有数据来源与定位 |
| C2 预检可执行 | 能自动判断「这个统计方法在你记录的变量尺度和预期样本量下做不做得成」，不满足要写补救 |
| C3 固定版本 | 用户点「采用」后记录方案内容指纹；之后任何改动都让「已采用」失效并要求重新采用 |

这三条决定了它**不能是一个自由文本框**。原型里 `PlanEditor` 是一个 12 行 textarea 套模板文字，正是「看起来写了方案、其实什么都没定」的入口，本阶段不沿用。

## 2. 数据形状

```ts
/** 测量尺度决定能算什么统计，所以必须显式记录，不能只写「一道单选题」 */
export type MeasureLevel = 'nominal' | 'ordinal' | 'interval' | 'ratio'

export type SamplingMethod =
  | 'census'        // 普查
  | 'simple-random' // 简单随机
  | 'stratified'    // 分层
  | 'cluster'       // 整群
  | 'quota'         // 配额
  | 'convenience'   // 便利
  | 'snowball'      // 滚雪球
  | 'unknown'       // 未定

export interface SamplingPlan {
  unit: string               // 分析单位：一个人 / 一个宿舍 / 一条记录
  frame: string              // 抽样框：从哪份名单或哪个范围取人
  method: SamplingMethod
  targetSize: number | null  // 预期有效样本量（null = 还没估）
  coverageNote: string       // 谁被排除在外（如「只覆盖在校住宿生」）
  inferenceScope: string     // 结论能推广到谁、不能推广到谁
}

export interface RecruitmentPlan {
  channels: string[]         // 招募渠道，可多条
  screening: string          // 筛选条件
  incentive: string          // 激励（无则写「无」）
  windowStart: string        // ISO 日期字符串，'' = 未定
  windowEnd: string
  biasNote: string           // 渠道带来的自选择偏差
}

export interface PlanQuestion {
  id: string
  text: string               // 可用数据回答的问题，不是「研究某某」
  measureIds: string[]
}

export interface PlanMeasure {
  id: string
  name: string               // 变量名，与阶段 6 字段核对的口径一致
  construct: string          // 这个变量测的是什么构念
  level: MeasureLevel
  instrument: 'questionnaire' | 'interview' | 'observation' | 'existing'
  /** existing 时必填：指向第一阶段 sources 的 sourceId */
  sourceIds: string[]
  locator: string            // 定位：文件第几页、表名、字段名
  questionHint: string       // 拟测题目的描述，供阶段 4 建题
  /** 阶段 4 回填的问卷题目 id；本阶段恒为 [] 且只读 */
  questionIds: string[]
}

export type AnalysisMethod =
  | 'frequency'        // 频数 / 分布
  | 'crosstab'         // 交叉表
  | 'chi-square'       // 卡方
  | 't-test'           // 均值比较（两组）
  | 'anova'            // 均值比较（多组）
  | 'correlation'      // 相关
  | 'regression'       // 回归
  | 'content-analysis' // 内容分析（文本）
  | 'descriptive-only' // 仅描述
  | 'undecided'        // 未定

export interface PlanAnalysis {
  id: string
  questionId: string         // 对应哪个研究问题
  method: AnalysisMethod
  measureIds: string[]       // 用到的变量
  expectedOutput: string     // 预期产出：一张什么表 / 什么图
  /** 预检不通过时必须写：补什么数据、缩到什么范围、改用什么方法 */
  fallbackNote: string
}

export interface PlanAdoption {
  /** 采用时的方案内容指纹；'' = 尚未采用 */
  signature: string
  /** BA 接口到位后换成 versionId，现在留空 */
  versionId?: string
  note: string               // 采用理由
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
  unknowns: ContestUnknown[]
}
```

### props 与 emits

```ts
export interface ResearchPlanEditorProps {
  context: DraftContext
  draft: ResearchPlanDraft
  /** 阶段 1 赛事信息 + 阶段 2 选题结果，均只读；null 表示外壳没接上 */
  upstream: { competition: CompetitionDraft | null; topic: TopicDraft | null }
  readOnly: boolean
  issues: string[]
}
```

emits 与前一阶段完全一致：`update-draft: {context, draft}`、`save-request: {context}`。
`upstream` 从单个对象扩成 `{competition, topic}` —— 因为本阶段同时要用第一阶段的来源清单和第二阶段的采用方向。

## 3. 关键设计取舍（六条，都附理由）

### 3.1 抽样与招募分开，不合并成「样本方案」

验收标准本身就是分开写的，而且这是学生调研最容易糊弄的两件事：写「随机抽样」实际是便利样本；写「面向大学生」实际只发到自己的班群。
分开之后，`frame`（从哪份名单取人）和 `channels`（怎么接触到人）必须各自成立，编不下去。

### 3.2 「证据」不单独建一张表，合并进变量的数据来源

原型的 `EvidenceEditor` 是四列映射：研究问题 → 题目/变量 → 证据来源 → 分析路径。
其中「证据来源」与「变量」天然是一对一，单独建表会变成两张表互相对不上的老问题（阶段 6 字段核对已经踩过一次）。
所以 `PlanMeasure.instrument + sourceIds + locator` 承担「证据」职责：**每个变量都得说清数据从哪来、在第几页**。

### 3.3 `level`（测量尺度）是必填项，不是备注

没有测量尺度，「统计可执行」就是一句空话 —— 卡方要求分类变量，t 检验要求数值变量。
把 `level` 显式化之后，预检可以纯前端判定，不依赖 BB 的执行引擎。

### 3.4 分析可执行性用三档判定，不用布尔

```ts
type Precheck = 'ok' | 'risky' | 'blocked'
```

- `ok`：方法要求的尺度齐备、变量属于该问题
- `risky`：能做但有前提（如卡方每格期望频数接近 5、回归样本量偏少）→ 提示但不拦
- `blocked`：方法要求的尺度根本不满足（如对两个分类变量做回归）→ 必须改方法或写 `fallbackNote`

理由：**真实数据还没采到，没人能保证统计一定做得成**。用布尔会把「预计有风险」误判成「不可行」，逼用户去改本来正确的方案。

### 3.5 「固定版本」用内容指纹，不等 BA

```ts
export function planSignature(draft: ResearchPlanDraft): string
// 对 researchQuestions / sampling / recruitment / measures / analyses 做键序固定的确定性序列化
// 排除 adoption 与 unknowns（未知项不影响方案内容）
```

判定：`adoption.signature === planSignature(draft)` → 已采用；不相等 → 已变更，需重新采用。

不用 `revision` 的理由：revision 每次编辑都涨，连"改一个错别字"也会让采用失效，用户会被反复要求重新点采用；而且 revision 语义归 P，我不该把业务含义压在上面。
指纹是纯内容判定，可单测、可 CDP 验证，BA 接口到位后直接把 `versionId` 填上即可共存。

### 3.6 不提供「方案正文」自由文本框

原型里那个 12 行 textarea 是模板文字，用户改了也看不出方案是否自洽。
只在最后加一个 3 行的「其他说明」栏（归入 `unknowns` 之外的单字段），不复刻大段正文。

## 4. 预检规则（三组，全部纯前端可判定）

### A 统计可执行性（逐条 `PlanAnalysis`）

| 方法 | 变量要求 | 不满足时 |
| --- | --- | --- |
| `frequency` / `descriptive-only` | 任意 | — |
| `crosstab` / `chi-square` | 两个 `nominal`/`ordinal` | `blocked` |
| `t-test` | 一个 `nominal`（二分）+ 一个 `interval`/`ratio` | `blocked` |
| `anova` | 一个 `nominal`（≥3 组）+ 一个 `interval`/`ratio` | `blocked` |
| `correlation` | 两个 `interval`/`ratio`（或两个 `ordinal`，提示用 Spearman） | `risky` |
| `regression` | 因变量 `interval`/`ratio` | `blocked` |
| `content-analysis` | 至少一个 `interview`/`observation` 变量 | `blocked` |
| `undecided` | — | `blocked`（等于没有分析计划） |

另加两条软提示：
- `targetSize` 非空且 `method='regression'` 且 `targetSize < 10 × 自变量数` → `risky`
- `targetSize` 非空且 `targetSize < 30` → 全部分析 `risky`（样本太小，任何统计都不稳）

### B 五块对应关系

- `researchQuestions` 为空 → 缺项
- 某问题 `measureIds` 为空 → 「问题没有对应的测量」
- 某问题没有 `PlanAnalysis` → 「问题没有分析计划」
- 某分析用到的变量不在该问题的 `measureIds` 里 → 「分析与问题不对应」（这是验收标准 C1 的核心）
- `PlanMeasure.instrument='existing'` 且 `sourceIds` 为空 → 「已有资料未指明来源」
- `directionId` 与上游 `topic.selectedDirectionId` 不一致 → 「本方案基于的方向已不是当前采用方向」

### C 问卷可测性（接阶段 4）

- `instrument='questionnaire'` 的变量，`questionHint` 为空 → 「阶段 4 无法据此建题」
- 有分析需要问卷数据，但问卷类变量为 0 → 缺项

## 5. 与前后阶段的接口

| 方向 | 内容 |
| --- | --- |
| 吃进去 | 阶段 1 `CompetitionDraft`（sources 供 `existing` 类型变量引用）、阶段 2 `TopicDraft`（采用方向） |
| 产出给阶段 4 | `measures`（`instrument='questionnaire'` 的那些）→ 建题；阶段 4 回填 `questionIds`，形成「变量 ↔ 题目」对应 |
| 产出给阶段 6 | `measures`（变量名、`level`）+ `analyses`（方法、预期产出）→ 字段核对与统计编排的输入 |
| 产出给阶段 7 | `expectedOutput` 列表 → 报告里必须出现的表和图清单 |

`questionIds` 在本阶段恒为 `[]` 且只读，**只由阶段 4 单向回填**，避免两边互相改。

## 6. 需要你确认的四点

| # | 问题 | 我的建议 |
| --- | --- | --- |
| 1 | 抽样方法枚举 9 项够不够，「分层 + 配额」这种混合写法怎么办？ | 够用。混合方法写在 `coverageNote` 里说明，枚举只记主方法 |
| 2 | 预检不通过时，是拦住不让提交，还是提示但允许继续？ | 提示但允许，但 `blocked` 必须写 `fallbackNote`，否则算缺项 |
| 3 | 要不要保留一个大的「方案正文」文本框兜底？ | 不要。只留 3 行「其他说明」，避免回到套模板文字 |
| 4 | 「固定版本」先用内容指纹，等 BA 的 `versionId`？ | 是。指纹与 `versionId` 字段并存，接口到位后只填不清 |

## 7. 本阶段明确不做

- **不建问卷题目** —— 那是阶段 4。本阶段只写「拟测题目描述」（`questionHint`）
- **不算样本量** —— 需要效应量假设，属于统计咨询范围；只做门槛提示
- **不执行任何统计** —— 归 BB；本阶段只产出计划
- **不写死任何「推荐方法」** —— 方法由用户选，代码只判定可执行性

## 8. 确认后的产出

| 文件 | 内容 |
| --- | --- |
| `src/components/research/plan-contract.ts` | 上述类型 + `emptyPlanDraft` + `normalizePlanDraft` + `planSignature` + `precheckPlan` + `checkPlanDraft` |
| `src/components/research/ResearchPlanEditor.vue` | 组件本体（沿用前两阶段的合并提交与 `flushDraft + nextTick` 再发 save-request） |
| `docs/f-component-handoff-3-plan.md` | 接线清单与验证记录 |
