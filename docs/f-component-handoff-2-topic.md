# F 交接：第二阶段「选题分析」编辑组件

交付日期：2026-10-26。对应 `docs/mvp-scope-and-status.md` 第 3 节「2 选题分析」验收标准：
**比较方向、明确研究问题／对象和可行性；用户选定方向；消费第一阶段已确认信息。**

## 1. 交付了什么

| 文件 | 归属 | 说明 |
| --- | --- | --- |
| `src/components/research/TopicAnalysisEditor.vue` | F 新增 | 组件本体，宿主用 `import.meta.glob` 发现 |
| `src/components/research/topic-contract.ts` | F 新增 | 类型、清洗、完整性检查、空草稿构造 |
| `docs/f-component-handoff-2-topic.md` | F 新增 | 本文件 |

未修改任何 P 已跟踪的文件。`git diff --stat` 为空。

## 2. 契约（相对第一阶段只多一个 prop）

```ts
props: {
  context: { localTaskId, revision }   // 同第一阶段
  draft: TopicDraft                    // 本阶段草稿
  upstream: CompetitionDraft | null    // 新增：第一阶段已确认信息，只读
  readOnly: boolean
  issues: string[]
}
emits: {
  'update-draft': { context, draft }   // 整份覆盖语义，同第一阶段
  'save-request': { context }
}
```

**为什么必须加 `upstream`**：验收标准要求「消费第一阶段已确认信息」。方向必须能挂回第一阶段的要求
（`requirementIds` 存 id，不存文案副本），否则无法说明这个选题回应了哪条赛事要求。传 `null` 时组件
仍可编辑，但会显式提示「无法关联要求」，`checkTopicDraft` 会跳过该项检查，不会假装通过。

## 3. 数据结构

```ts
export type FeasibilityVerdict = 'unknown' | 'workable' | 'at-risk' | 'blocked'

export interface TopicDirection {
  id: string
  title: string              // 方向名称
  question: string           // 研究问题（一句话、可用数据回答）
  population: string         // 研究对象／抽样框
  value: string              // 预期价值
  requirementIds: string[]   // 回应第一阶段的哪些要求
  verdict: FeasibilityVerdict
  feasibilityNote: string    // 可行性依据：数据可及／时间／成本／能力／风险
}

export interface TopicDraft {
  directions: TopicDirection[]
  selectedDirectionId: string | null
  selectionReason: string
  unknowns: ContestUnknown[]   // 复用第一阶段结构
}
```

三个设计取舍，需要你确认：

1. **`verdict` 用四档而不是布尔**。`unknown`（尚未判断）与 `blocked`（当前不可行）是不同的事，
   合成一个布尔会把「没查过」说成「查过」「可行」。默认值是 `unknown`，不是 `workable`。
2. **`selectedDirectionId` 默认 `null`**。不自动选中第一个方向——没选就是没选，否则「用户选定方向」
   这条验收会变成系统替用户选。
3. **方向不加 `order` 字段**，数组顺序即展示顺序，与第一阶段 `requirements`/`sources` 的口径一致。

## 4. 需要你做的接线（6 步）

### 4.1 类型

建议把 `topic-contract.ts` 整份迁入 `src/types/research-contracts.ts`（都归你维护，集中一处更好），
或保留本文件并从 `research-contracts.ts` re-export。两种都不影响我的组件引用路径——组件用的是
相对路径 `./topic-contract`。

### 4.2 `LocalResearchTask` 加字段（注意向后兼容）

```ts
export interface LocalResearchTask {
  // ...原有字段
  competition: CompetitionDraft
  topic: TopicDraft          // 新增
}
```

**关键：`cleanTask` 里不能用 `normalizeTopicDraft` 直接当准入条件**，否则用户已有的本机草稿
（没有 `topic` 字段）会被判成「任务草稿格式无效」整份丢弃。要这样：

```ts
// cleanTask 内
const topic = v?.topic === undefined ? emptyTopicDraft() : normalizeTopicDraft(v.topic)
if (!topic) return null          // 只有显式带了 topic 但格式坏时才拒绝
// ...返回对象里加上 topic
```

`createLocalTask` 里加 `topic: emptyTopicDraft()`；`editLocalTask` 与 store 的 `update()` 的
patch 泛型补上 `'topic'`。

### 4.3 store 加一个 action（与 `updateCompetition` 同构）

```ts
function updateTopic(event: { context: DraftContext; draft: TopicDraft }) {
  if (!draft.value || !matchesDraftContext(draft.value, event.context)) {
    feedback.value = '忽略了其他任务或旧修订的组件事件。'
    return false
  }
  const clean = normalizeTopicDraft(event.draft)
  if (!clean) {
    feedback.value = '组件草稿格式不完整，当前编辑未替换。'
    return false
  }
  update({ topic: clean })
  return true
}
// return 里导出 updateTopic
```

### 4.4 完整性检查

`checkTopicDraft(draft, upstream)` 已在 `topic-contract.ts` 里实现，签名带 `upstream`，
直接 import 到宿主即可（或搬进 `utils/researchDrafts.ts` 与 `checkContestDraft` 并排）：

```ts
const issues = computed(() => checkTopicDraft(props.draft, props.upstream))
```

### 4.5 宿主（新建 `src/views/research/TopicAnalysisHost.vue`）

照 `CompetitionUnderstandingHost.vue` 的结构写，把挂载点换成：

```ts
const delivered = import.meta.glob('../../components/research/TopicAnalysisEditor.vue')
```

摘要区建议渲染：`directions.length` 个方向、采用方向名、`selectionReason`、未知项。
**摘要区里不要把 `requirementIds` 直接 `join('、')` 打印**——那是 `req-1` 这类内部 id，
在第一阶段已经出现过把 `sourceIds` 渲染成 UUID 长串的问题。要映射成要求文案。

### 4.6 挂载条件（`ResearchWorkspaceView.vue`）

```vue
<TopicAnalysisHost
  v-else-if="kind === 'full-study' && task.viewedPhase === 1 && store.context"
  :key="task.localTaskId"
  :context="store.context"
  :draft="task.topic"
  :upstream="task.competition"
  :read-only="false"
  :issues="checkTopicDraft(task.topic, task.competition)"
  @update-draft="store.updateTopic"
  @save-local="store.save()"
/>
```

注意 `v-else-if` 顺序：必须排在现有的 `viewedPhase === 0` 分支之后，否则会被 stage-pending 吞掉。

## 5. 验证记录（真实操作，不是构建通过）

当前 P 侧还没有 `topic` 字段和第二阶段宿主，所以我用一个**临时自测宿主**（`src/dev/` 下新增，
验证完已删除，不在交付里）复刻外壳的关键行为：`localTaskId + revision` 陈旧事件拒绝、
`update-draft` 后 revision 递增、`save-request` 只回反馈不假装成功、可切只读。

用 CDP 驱动真实页面（Edge headless + 调试端口），实测结果：

| # | 操作 | 结果 |
| --- | --- | --- |
| 1 | 空草稿进入 | 提示「尚未记录候选方向」「尚未选定采用的方向」「第一阶段仍有影响决定的未知项」 |
| 2 | 点两次「新增方向」 | 两个方向出现，`revision` 只 +1（同轮多次编辑已合并） |
| 3 | 同一任务内连填 D1 的 5 个字段 | `revision` 只 +1，5 个字段全部保留，无被覆盖 |
| 4 | 填 D2 并把可行性改为「有风险」、勾两条要求 | D2 生效，D1 的 verdict／requirementIds 不受影响 |
| 5 | 对比表点 D1「采用」 | `selectedDirectionId` 指向 D1，卡片出现「已采用」标签与左侧高亮边 |
| 6 | 填选择理由、新增未知项并勾「影响当前决定」 | 落进草稿，`checkTopicDraft` 计入阻碍项 |
| 7 | 点「提交为正式候选」 | 用最新 revision 发出 `save-request`，宿主回「接口未接入」，不显示保存成功 |
| 8 | 注入一次陈旧事件后编辑 | 宿主拒绝，草稿保持旧值（契约未被绕过） |
| 9 | 删除已采用的方向 | `selectedDirectionId` 自动清空，并提示「只有 1 个候选方向，无法体现比较」 |
| 10 | 切只读 | 12 个输入框 `readonly`、8 个按钮 disabled，「新增方向」点不动 |
| 11 | 窄屏 820px | 字段降为单列、无横向溢出；对比表隐藏「研究对象」列（卡片里已有同字段），5 列完整可读 |

截图：`D:/tipdmsmyy/_verify/topic-wide.png`、`topic-narrow.png`、`topic-readonly.png`。

`pnpm build`（`vue-tsc -b && vite build`）通过，无类型错误。

## 6. 已知限制／需要你判断的三件事

1. **「本机保存 → 切任务 → 刷新恢复」这条链我没法验**。它依赖 `LocalResearchTask.topic` 和 4.2 的
   向后兼容处理，都在你的代码里。合并后需要补跑一次，这也是阶段 2 的正式验收缺口。
2. **陈旧事件被拒绝时，输入框仍显示用户刚打的字，而草稿没变**。这是「宿主拒绝 + 受控输入」的固有组合，
   第一阶段同样存在。真实并发（两个标签页）才触发，外壳已给提示。要不要处理（例如拒绝后强制回写）
   由你定——强制回写会打断正常输入，我个人倾向不处理，只保留提示。
3. **`issues` 只有在传入 `upstream` 时才包含「采用方向未关联第一阶段要求」这一条**。
   如果宿主偷懒传 `null`，这条检查会静默消失，选题就可能完全不挂赛事要求。

## 7. 下一步

第三阶段「研究方案」：抽样／招募／测量／证据／分析计划对应。结构上会第一次需要引用+
多段映射（计划条目 ↔ 证据需求 ↔ 分析方法），比前两阶段的「列表 + 勾选」复杂一档。
在同一套契约（`upstream` 传入前两阶段已确认信息）下扩展，不需要改外壳接口。
