# 第三阶段「研究方案」组件交接（F → P）

> 交付时间：2026-10-26
> 前置：`docs/f-proposal-3-research-plan.md`（数据形状提案，已确认）
> 本阶段验收标准（`docs/mvp-scope-and-status.md`）：**抽样/招募/测量/证据/分析计划对应；预检问卷和统计可执行，用户采用固定版本**

## 1. 交付物

| 文件 | 说明 |
| --- | --- |
| `src/components/research/ResearchPlanEditor.vue` | 组件本体 |
| `src/components/research/plan-contract.ts` | 类型 + 清洗 + 指纹 + 统计预检 + 完整性检查 |
| `docs/f-proposal-3-research-plan.md` | 数据形状提案与取舍说明 |
| `docs/f-component-handoff-3-plan.md` | 本文件 |

`git diff --stat` 为空，未改动 P 的任何已跟踪文件。

## 2. 契约

```ts
interface ResearchPlanEditorProps {
  context: DraftContext                 // {localTaskId, revision}
  draft: ResearchPlanDraft
  upstream: {                           // ← 注意：本阶段比上阶段多一层
    competition: CompetitionDraft | null
    topic: TopicDraft | null
  }
  readOnly: boolean
  issues: string[]                      // 外壳用 checkPlanDraft(draft, upstream).all
}
```

emits 与前两阶段一致：

- `update-draft: {context, draft}` —— 整份 draft 覆盖语义
- `save-request: {context}` —— 正式候选保存请求，不表示已保存

组件内不 fetch、不写 localStorage、不碰 store。

## 3. P 的接线清单（6 步）

### 3.1 `LocalResearchTask` 增加 `plan` 字段

```ts
export interface LocalResearchTask {
  // ...
  competition: CompetitionDraft
  topic?: TopicDraft
  plan?: ResearchPlanDraft   // 新增
}
```

### 3.2 `cleanTask` 用默认值兜底，**不要**用清洗函数当准入

与第二阶段同一个坑：用户已有的、没有 `plan` 字段的本机草稿，若把 `normalizePlanDraft` 当硬准入，会被整份判为「格式无效」丢弃。

```ts
const plan = v?.plan === undefined ? emptyPlanDraft() : normalizePlanDraft(v.plan)
if (!plan) return null
```

### 3.3 store 增加 `updatePlan`

与 `updateCompetition` / `updateTopic` 同形：`localTaskId` + `revision` 校验、陈旧事件拒绝、revision 递增。

### 3.4 本机完整性提示

```ts
const issues = computed(() => checkPlanDraft(task.plan ?? emptyPlanDraft(), upstream).all)
const upstream = computed(() => ({
  competition: task.competition,
  topic: task.topic ?? null,
}))
```

### 3.5 新建第三阶段宿主 `src/views/research/ResearchPlanHost.vue`

```ts
const delivered = import.meta.glob('../../components/research/ResearchPlanEditor.vue')
```

**注意**：宿主的 glob 是**精确路径**，不是通配符（第一阶段宿主就是这么写的，`TopicAnalysisEditor.vue` 因此至今未进产物）。第三阶段宿主需要单独指向 `ResearchPlanEditor.vue`。

### 3.6 挂载条件

`ResearchWorkspaceView.vue` 里 `viewedPhase === 2` 时渲染 `ResearchPlanHost`。

## 4. 数据结构要点

```
ResearchPlanDraft
├─ directionId            基于阶段 2 采用的哪个方向（只存 id）
├─ researchQuestions[]    id / text / measureIds
├─ sampling               分析单位、抽样框、方法、预期样本量、覆盖之外、可推广范围
├─ recruitment            渠道[]、筛选、激励、起止日期、自选择偏差
├─ measures[]             id / name / construct / level / instrument / sourceIds / locator / questionHint / questionIds
├─ analyses[]             id / questionId / method / measureIds / expectedOutput / fallbackNote
├─ adoption               signature（内容指纹）/ versionId? / note
├─ otherNote              其他说明（替代原型那段大正文）
└─ unknowns[]             沿用第一阶段的 ContestUnknown
```

四个关键约定：

1. **`level`（测量尺度）是必填枚举**，不是备注。统计可执行性完全靠它判定，不依赖 BB 的执行引擎。
2. **`analyses[].measureIds ⊆ researchQuestions[].measureIds`**，组件在换问题、摘变量时会自动维持子集关系，不会留下跨问题的悬空引用。
3. **`measures[].questionIds` 本阶段恒为 `[]` 且只读**，只由阶段 4 单向回填，形成「变量 ↔ 题目」对应。
4. **`adoption.signature` 是内容指纹**（FNV-1a 32 位，8 位十六进制）。覆盖 `directionId`、问题、抽样、招募、变量、分析、其他说明；**不覆盖** `adoption` 自身（否则改采用记录会让自己失效）与 `unknowns`（未知项不影响方案内容）。因此改「采用理由」不会让采用失效，改「其他说明」会让它失效。

## 5. 预检的三组规则

| 组 | 判定 |
| --- | --- |
| 对应关系 | 每个问题有变量、有分析；分析变量属于该问题；变量有来源与定位；抽样/招募必填项；采用状态 |
| 统计可执行 | 按方法要求的最低测量尺度判定 `ok / risky / blocked`；`blocked` 且未写 `fallbackNote` 才算缺项 |
| 问卷可测 | 问卷类变量必须有拟测题目描述；用到问卷数据却没有问卷类变量 |

`blocked` 的判定不拦提交，但必须写补救说明——写了就不再算缺项（方案内部自洽即可）。这与「提示但允许继续」的约定一致。

**非概率抽样（便利/配额/滚雪球）不进缺项列表**，只在字段下方做就地提示。原因：它是学生调研的合理选择，若每填一次都报一条永不消失的缺项，方案永远到不了「本机完整」——提示应当可解决，而「选了这个方法」本身解决不了。

## 6. 验证记录（临时自测宿主 + CDP 驱动真实页面，22 项）

因 P 侧还没有第三阶段宿主，在 `src/dev/` 建临时宿主复刻外壳三条规则（revision 递增回传、陈旧事件拒绝、`save-request` 只发请求），**验证后已删除并重新构建**。

| # | 项 | 结果 |
| --- | --- | --- |
| 1 | 空态 | 待补充 10 项（方向 1 + 问题 1 + 抽样 5 + 招募 2 + 采用 1） |
| 2 | 记为当前方向 | `directionId=dir-1`，revision +1 |
| 3 | 同一 tick 新增 2 个问题 | 2 个，revision **只 +1**（合并提交生效） |
| 4 | 同一 tick 填两个问题正文 | 两条都保留（覆盖 bug 未复发） |
| 5 | 同一 tick 新增 3 个变量 | 3 个，revision 只 +1 |
| 6 | 同一 tick 填变量 4 个字段 | 全部保留 |
| 7 | 变量设为「已有资料」 | 出现来源 chip（2 条）+ 定位输入，勾选与定位都能落盘 |
| 8 | 变量挂到问题 | Q1 1 个、Q2 2 个，互不串 |
| 9 | 抽样 6 个字段同 tick | 全部保留，非概率提示出现 |
| 10 | 招募渠道/筛选/日期 | 全部保留，日期区间正常 |
| 11 | 3 条分析同 tick 新增 | revision 只 +1 |
| 12 | 三条分析分别命中三态 | `尺度齐备` / `有前提` / `不可执行` |
| 13 | 换问题后变量自动收敛 | 变成新问题的变量子集，不留悬空引用 |
| 14 | 不可执行时补救框出现 | 只有 blocked 那条有 |
| 15 | 填补救说明 | 统计组缺项 1 → **0** |
| 16 | 采用 | 徽标「已采用」，生成指纹 `7e73415e`，采用按钮隐藏 |
| 17 | 改用**用理由** | 仍为「已采用」（理由不进指纹，符合预期） |
| 18 | 改「其他说明」 | 变「内容已变更，需重新采用」 |
| 19 | 重新采用 | 恢复「已采用」，指纹更新 |
| 20 | 最终态 | **本机完整，issues 为空** |
| 21 | 只读态 | 55 个输入/选择/复选框 readonly 或 disabled，组件内 0 个可点按钮 |
| 22 | 陈旧上下文 | 编辑被拒（事件 revision 21 / 当前 22），草稿保持原值；`save-request` 用最新 revision 被接受 |

窄屏 820px：所有 `grid2` 降为单列，横向溢出 0，未知项行改为「编号跨行 + 输入框 / 开关与删除对齐输入框」。

## 7. 本轮修掉的 5 个问题（都是跑起来才暴露的）

1. **非概率抽样报一条永不消失的缺项** → 方案永远到不了「本机完整」。改为就地提示，不进缺项列表。
2. **双列字段被另一侧的提示文字拉高**，输入框被拉伸、两列不齐 → `.rpe-field { align-content: start }` + `.rpe-grid2 { align-items: start }`。
3. **「已有资料」类变量仍显示「拟测题目描述」** → 按来源类型换文案：问卷=拟测题目 / 访谈=提纲要点 / 观察=记录口径 / 已有资料=取值口径。
4. **采用后按钮「已采用」与顶部徽标重复** → 已采用时隐藏按钮，只留「当前内容已采用 指纹 xxxx」。
5. **窄屏未知项行开关未对齐输入框** → 改三列网格，编号跨两行居中。

## 8. 未验证 / 留给 P

1. **「本机保存 → 切任务 → 刷新恢复」全链路**：依赖 P 的 `LocalResearchTask.plan` 字段，组件侧无法自测。合并后必须补跑一次，这是本阶段正式验收的缺口。
2. **只读由外壳驱动**：组件只读逻辑已验证（手工传 `readOnly=true`），但宿主当前不传该 prop，真实页面构造不出只读态。
3. **`upstream.competition` 来自第一阶段草稿、`upstream.topic` 来自第二阶段草稿**：宿主要能同时读到两阶段数据，否则组件会明确提示「外壳未传入第二阶段结果」并计入缺项，不会静默通过。
4. **阶段 4 接口**：`measures.filter(m => m.instrument === 'questionnaire')` + `questionIds` 回填，是下阶段的输入契约。

## 9. 已知与本阶段无关但会干扰验收的现象

陈旧事件被外壳拒绝时，输入框里仍是用户刚敲的字，但草稿没变（受控输入 + 宿主拒绝的固有限制，第一、二阶段同样存在）。目前只保留宿主提示，不强制回写，避免和用户的正在输入打架。
