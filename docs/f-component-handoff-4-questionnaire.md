# 第四阶段「问卷设计与预测试」组件交接（F → P）

> 交付时间：2026-10-26
> 前置：`docs/f-proposal-4-questionnaire.md`（数据形状提案，已确认）
> 本阶段验收标准（`docs/mvp-scope-and-status.md`）：**编辑/核对/真实试填反馈/修订；正式问卷固定版本；无真实反馈不标预测试通过**

## 1. 交付物

| 文件 | 说明 |
| --- | --- |
| `src/components/research/ResearchQuestionnaireEditor.vue` | 组件本体 |
| `src/components/research/questionnaire-contract.ts` | 类型 + 清洗 + 指纹 + 预测试状态机 + 完整性检查 |
| `docs/f-proposal-4-questionnaire.md` | 数据形状提案与取舍说明 |
| `docs/f-component-handoff-4-questionnaire.md` | 本文件 |

`git diff --stat` 为空，未改动 P 的任何已跟踪文件。临时自测宿主已删除，`src/dev/` 仍只有 P 的两个 fixture。

## 2. 契约

```ts
interface ResearchQuestionnaireEditorProps {
  context: DraftContext          // {localTaskId, revision}
  draft: QuestionnaireDraft
  upstream: { plan: ResearchPlanDraft | null }   // ← 比上阶段少一层
  readOnly: boolean
  issues: string[]               // 外壳用 checkQuestionnaire(draft, upstream).all
}
```

emits 与前三个阶段一致：

- `update-draft: {context, draft}` —— 整份 draft 覆盖语义
- `save-request: {context}` —— 正式候选保存请求，不表示已保存

组件内不 fetch、不写 localStorage、不碰 store。

`upstream` 从三阶段的两层收成一层：本阶段只消费 `plan.measures` 里 `instrument === 'questionnaire'` 的项，不复制赛事与方向。已有问卷快捷入口传 `{plan: null}`，自动转入独立模式。

## 3. P 的接线清单（6 步）

### 3.1 `LocalResearchTask` 增加 `questionnaire` 字段

```ts
export interface LocalResearchTask {
  // ...
  competition: CompetitionDraft
  topic?: TopicDraft
  plan?: ResearchPlanDraft
  questionnaire?: QuestionnaireDraft   // 新增
}
```

### 3.2 `cleanTask` 用默认值兜底，**不要**用清洗函数当准入

与前两阶段同一个坑：老草稿没有该字段，若把 `normalizeQuestionnaireDraft` 当硬准入，会被整份判为格式无效丢弃。

```ts
const questionnaire = v?.questionnaire === undefined
  ? emptyQuestionnaireDraft()
  : normalizeQuestionnaireDraft(v.questionnaire)
if (!questionnaire) return null
```

### 3.3 store 增加 `updateQuestionnaire`

与 `updateCompetition` / `updateTopic` / `updatePlan` 同形：`localTaskId` + `revision` 校验、陈旧事件拒绝、revision 递增。

### 3.4 本机完整性提示

```ts
const upstream = computed(() => ({ plan: task.plan ?? null }))
const issues = computed(() => checkQuestionnaire(task.questionnaire ?? emptyQuestionnaireDraft(), upstream.value).all)
```

### 3.5 新建第四阶段宿主 `src/views/research/ResearchQuestionnaireHost.vue`

```ts
const delivered = import.meta.glob('../../components/research/ResearchQuestionnaireEditor.vue')
```

**glob 仍是精确路径**，不是通配符：第一、二阶段就是因为写成通配符，`TopicAnalysisEditor.vue` 至今没进产物。

### 3.6 挂载条件

`ResearchWorkspaceView.vue` 里 `viewedPhase === 3` 时渲染 `ResearchQuestionnaireHost`。

### 3.7 「变量 ↔ 题目」由 P 保存时派生

问卷存 `measureId`，`plan.measures[].questionIds` 由公共层算，组件不回写：

```ts
for (const measure of plan.measures) {
  measure.questionIds = questionnaire.questions
    .filter((q) => q.measureId === measure.id)
    .map((q) => q.id)
}
```

两边都存就是两份真相，改题必有一边漏更新。

## 4. 数据结构要点

```
QuestionnaireDraft
├─ meta                标题 / 开场说明 / 知情同意 / 预估时长 / 匿名说明 / 结束语
├─ questions[]         id / text / type / required / options[] / scale / measureId / codingNote / screening
├─ pretestRounds[]     id / date / respondentCount / channel / completionRate / medianMinutes /
│                      findings[] / verdict / revisionNote / signature
├─ adoption            signature（内容指纹）/ versionId? / roundId / note
├─ otherNote
└─ unknowns[]          沿用第一阶段的 ContestUnknown
```

四个关键约定：

1. **预测试状态不落盘。** `pretestState(draft)` 是纯函数，返回 `draft | collecting | needs-revision | passed`。落盘值里没有 `passed` 字段，也就没有「把 false 改成 true」的路径。
2. **`passed` 要求「最近一轮试填的指纹 === 当前指纹」。** 每轮记录 `signature`（该轮试填时的问卷内容指纹），改任何一个字都退回「需重新试填」，改回去又自动成立。
3. **指纹覆盖 `meta` + `questions` + `otherNote`，不覆盖 `pretestRounds` / `adoption` / `unknowns`。** 覆盖 `meta` 是刻意的：改开场白等于改变了被试试填的那份材料。改「固定理由」不会让固定失效。
4. **`options[].exclusive` 与 `openEnded` 显式记录。** 「以上都不」这类排他项不是装饰，多选没有它选项就不完备；这一条只能靠结构化字段判断，不能靠题干文字猜。

## 5. 核对规则的四组

| 组 | 判定 | 进 issues |
| --- | --- | --- |
| A 题目与卷首 | 题干空、选项少于 2、选项文本空/重复、量表缺端点标签或点数 < 2、数值题无单位与范围、多选无填答口径、标题空、开场说明空、未声明知情同意 | 是 |
| B 与阶段 3 对应 | 问卷变量无题、题目挂的变量已不在方案、`interval`/`ratio` 变量挂单选题、分类/等级变量挂数值题 | 是（独立模式恒为空） |
| C 全卷软提示 | 无匿名说明、时长 > 10 分钟、题量 > 30、全部必填、无筛选题、多选无排他项、单选选项 > 9、量表非 5/7 点、疑似双barreled / 诱导词 / 模糊频率词 / 双重否定 | 否，就地提示 |
| D 预测试 | 轮次缺日期或人数、发现未写处理方式、`revised` 未写改了什么、改过题没重测、固定后又被改 | 是 |

`checkQuestionnaire` 返回 `{questions, mapping, pretest, hints, all}`，`all` 是前三组的平铺结果，`hints` 单独给界面展示。

## 6. 验证记录（临时自测宿主 + CDP 驱动真实页面，34 项）

在 `src/dev/` 建临时宿主复刻外壳三条规则（revision 递增回传、陈旧事件拒绝、`save-request` 只发请求），并额外提供「冻结上下文」开关以构造真实页面里难以自然出现的陈旧事件。**验证后已删除并重新构建**。

| # | 项 | 结果 |
| --- | --- | --- |
| 1 | 空态 | 0 题；题目组与预测试组各有缺项；状态「尚未试填」；「固定」按钮禁用 |
| 2 | 上游变量对照 | 3 个问卷变量列出且全为「未建题」；访谈类变量不要求建题 |
| 3 | 同 tick 连点 5 个题型按钮 | 5 题落地，revision **只 +1** |
| 4 | 同 tick 填 3 个题干 | 三条都保留（覆盖 bug 未复发），revision 只 +1 |
| 5 | 多选未写口径 | 计入硬缺项 |
| 6 | 5 个选项 + 排他项 | 全部落盘，「以上都不适用」`exclusive=true` |
| 7 | 单选切数值 | 选项清空、口径成必填，不残留旧选项 |
| 8 | 卷首 6 字段同 tick | 全部保留，revision 只 +1 |
| 9 | 三个变量分别挂题 | 互不串 |
| 10 | 等距/等比变量挂单选题 | 报「类型与尺度不符」 |
| 11 | 改回数值题 | 该缺项消失，三个问卷变量都有题 |
| 12 | 第 4 题改开放并取消必填 | 题型与必填位同步落盘 |
| 13 | 第 5 题改单选并设筛选题 | 落盘正确 |
| 14 | 题目组与对应组 | 缺项归零，只剩「尚未试填」1 条 |
| 15 | 新增轮次 | 状态「试填记录不完整」（缺日期/人数） |
| 16 | 同 tick 填 5 个试填字段 | 状态转「预测试已通过」，revision 只 +1 |
| 17 | 通过后 | 三组缺项全 0，头部「本机完整」 |
| 18 | 固定按钮 | 通过后可用 |
| 19 | 固定 | 记录指纹与依据轮次，徽标「已固定为正式问卷」，按钮隐藏 |
| 20 | 固定理由 | 落盘，且不影响指纹（改理由不会让固定失效） |
| 21 | 改题干 | 固定失效、状态退回「需重新试填」、轮次标记「试填的不是这一版」 |
| 22 | 改回原文 | 指纹回归，自动恢复「已通过」与「已固定」 |
| 23 | 结论改「需重测」 | 状态变「需重新试填」，固定按钮不可用 |
| 24 | 结论改回 | 恢复已通过 |
| 25 | 新增发现未写处理 | 退回「试填记录不完整」 |
| 26 | 补上处理方式 | 闭环恢复已通过 |
| 27 | 只读态 | 全部输入控件（文本、文本域、下拉、复选框）均 readonly/disabled，`locked === total`；组件内 0 个可点按钮；头部显示「只读」 |
| 28 | 冻结上下文后连改两次 | 第 2 次被判陈旧（拒绝 +1），草稿保持上次值 |
| 29 | 解冻后编辑 | 恢复受理，草稿正确写入 |
| 30 | 提交为正式候选 | 发出 1 次保存请求，上下文为最新 revision |
| 31 | 无上游（已有问卷入口） | 不做变量对应检查；变量选择禁用；上游区提示独立模式 |
| 32 | 820px 窄屏 | 横向溢出 0（`scrollWidth 812 / clientWidth 820`） |
| 33 | 把发现挂到第 2 题 | `questionId` 正确 |
| 34 | 删除该题 | 发现退化为「全卷」，不留悬空 `questionId` |

视觉复核（1280px 桌面 + 820px 窄屏截图逐块看）：三列「本机完整性」卡片等高（124px）；双列/三列字段顶对齐、无输入框拉伸；选项行 6 列宽度 `19 / 734 / 84 / 40 / 51 / 36`；窄屏下选项行变「文本+编码」两行、开关与删除落在第二行；无重叠、无裁切。

## 7. 本轮修掉的 3 个问题（都是跑起来才暴露的）

1. **新增/记录类按钮被 grid 拉满整行** —— `.rqe-field` 是 grid，`justify-items` 默认 stretch，`+ 新增选项` 变成通栏块。改为 `.rqe-field > .btn { justify-self: start }`。
2. **补充说明的标签写错** —— 原写「不进指纹以外的判定」，但 `otherNote` 是计入指纹的。改为写明「计入内容指纹：改这里也会让预测试已通过退回需重测」，避免标签与行为相反。
3. **补了 20 处 `aria-label`** —— 原本题干、选项、试填轮次字段只靠视觉位置区分，屏幕阅读器与自动化都定位不到。这不是测试钩子，是无障碍缺口。

## 8. 与提案的差异（两处，均已落在代码里）

1. **完成率与中位时长不列为硬缺项。** 提案 §3.1 把它们和日期/人数并列成 `collecting` 条件，§4 D 的硬缺项只写日期与人数。实现按后者：`date` + `respondentCount` 缺失才算证据不完整，完成率/时长缺失只做提示——试填 5 人时「完成率」意义有限，强填只会逼出假数。
2. **「尚未试填」本身算一条硬缺项。** 提案没写这条。不加的话，题目填完就会出现「本机完整」，而本阶段的验收标准恰恰是「无真实反馈不标预测试通过」。加进去之后「本机完整」只在预测试通过后才出现，且它是可解决的（去做试填），不会像阶段 3 的非概率抽样那样死锁。

## 9. 未验证 / 留给 P

1. **「本机保存 → 切任务 → 刷新恢复」全链路**：依赖 P 的 `LocalResearchTask.questionnaire` 字段，组件侧无法自测。合并后必须补跑，这是本阶段正式验收的缺口。
2. **只读由外壳驱动**：组件只读逻辑已验证（宿主传 `readOnly=true`），但真实宿主当前不传该 prop，正式页面构造不出只读态。
3. **正式问卷固定后的版本登记**：`adoption.signature` 是本地指纹，`versionId` 留空等 BA。阶段 5 绑定正式问卷版本时，要拿 `versionId` 而不是指纹。
4. **试填数据的真实性无法技术验证**：组件只保证「不生成、必填完整、与当前版本对齐」，用户填假数据是人的问题，不是代码能挡的。这一点写进交接，避免以后把「passed」当成客观证据。

## 10. 阶段 5 需要的输入

- `adoption.signature` + `versionId`（固定版本）—— 正式调查只能绑这一版
- `questions[]`（题干、题型、选项编码、`codingNote`）—— 发布与字段核对
- `meta`（开场说明、知情同意、时长）—— 填写页的卷首与进度提示
