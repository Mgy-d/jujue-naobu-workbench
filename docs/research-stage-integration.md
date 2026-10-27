# 选题分析与研究方案本机接入

更新：2026-10-27。范围：P 负责的前端状态、保存恢复、宿主和错误反馈。用户确认当天暂无新 F 组件或 BA 正式接口。当前不是两个阶段的完整可用业务交付。

## 当前可用与不可用

- 实际工作台的选题分析、研究方案已分别挂载宿主，显示本机摘要、来源、未知项、完整性检查和本机保存操作。
- 正式编辑组件缺失时，页面明确提示“编辑组件待接入”，没有临时复制另一套 F 编辑器。普通用户暂时不能在这两个页面填写内容。
- 本机状态、真实浏览器存储与任务切换接线已经用开发合成组件验证；这不等于真实 F 编辑组件验收，也不等于真实服务器保存通过。
- “本机拟选”不是正式采用；阶段导航只表示正在查看。上游赛事和选题均标识未确认的本机参考，不制作固定业务版本或推进阶段。

## 代码位置与数据流

1. `src/types/research-contracts.ts`：新增 `TopicAnalysisDraft`、`ResearchPlanDraft`、两阶段组件 props 和带阶段判别的 `ResearchStageDraftUpdate`。
2. `src/utils/researchStageDrafts.ts`：空稿、结构校验、引用校验、复制和本机完整性提示。
3. `src/utils/researchDrafts.ts`：每任务分别保留 `competition` / `topicAnalysis` / `researchPlan`；读取旧记录、保存、更新任务/修订/当前阶段保护。
4. `src/stores/research.ts`：`updateStage` 接收编辑事件；通过检查后仅替换对应字段。`save` 继续使用已有本机存储与失败保稿机制。
5. `src/views/ResearchWorkspaceView.vue`：完整研究 phase 1/2 挂 `ResearchStageHost`，分别传入各自草稿。phase 0 的赛事组件保持原接线。
6. `src/views/research/ResearchStageHost.vue`：可选组件挂载、上下文校验、只读保护、摘要与真实未接入提示。
7. `src/dev/ResearchStageHarness.vue` / `ResearchStageFixture.vue`：仅开发路由 `/dev/research/stages`。使用明确合成输入和实际 store/localStorage；不会出现在生产构建中。不要把合成样例当成正式交付组件。

数据流：F 组件接收 `context + draft + readOnly + issues + upstream` → `update-draft` 返回完整新草稿 → 宿主补当前 phase 并验证 → store 核对任务/修订/阶段 → 仅更新对应草稿 → `save-local` 使用已有保存机制 → 刷新读回同一任务。

## 本机暂定结构与 F 交接

这是本机接入结构，不是 BA 已发布的正式 schema。F 或 BA 交付时须对照真实结构适配。

| 内容 | 字段 |
| --- | --- |
| 选题候选 | `candidates[]`：`id/title/researchQuestion/targetPopulation/feasibility/sourceIds[]` |
| 本机拟选 | `selectedCandidateId`（允许 null）和 `selectionReason` |
| 研究方案 | `researchQuestion/targetPopulation/samplingPlan/recruitmentPlan/measurementPlan/evidenceNeeds/analysisPlan` |
| 各阶段证据 | 各自的 `sources[]`（沿用来源ID、名称、定位和未核实状态）与 `unknowns[]`（含是否阻塞决定） |

宿主当前可发现 `src/components/research/TopicAnalysisEditor.vue` / `ResearchPlanEditor.vue`，这两个名称是接点约定，**不是已存在文件或同事已承诺的文件名**。如果 F 扩展同一 `ResearchDesignEditor.vue` 或使用其他文件/事件，应由 P 在宿主适配，不要求 F 推倒重写。当前两个正式组件均缺失。

事件：

```ts
// F -> Host：不要直接写 props、store、localStorage 或调用业务 fetch。
emit('update-draft', { context: { localTaskId, revision }, draft: completeNewDraft })
emit('save-request', { context: { localTaskId, revision } })
// Host -> P：phase=1 为第2阶段选题；phase=2 为第3阶段方案。
```

同一轮多项输入应合并为一份新草稿，确保携带最新 context；单项事件不能丢掉同阶段的其他字段。F 交付需要仓库分支/提交或包哈希、所需子组件/样式、依赖清单、空稿/正常/错误/只读样例和事件说明。两组件都要重新验证真实填写、刷新、切任务和失败反馈。

## 旧稿与错误保护

- 沿用存储键 `shidiaoyanzhen.research-tasks.v1`。旧任务缺少新增阶段字段时补空稿；不触碰旧赛事正文或分析引用，读取本身不写存储。
- 明确存在但格式损坏的新阶段字段不会被重置为空；报告损坏并阻止覆盖原记录。正常的未填完草稿仍可保存。
- 拒绝候选重复ID、选中不存在候选、引用不存在来源或无效证据状态；不自动把来源升级为已核实。
- 只接受当前完整研究任务、正在查看阶段和当前 revision；其他任务、旧修订或错误阶段事件不改草稿。
- 本机存储失败保留本页编辑，成功重试后再标已保存；跨标签保存沿用 raw baseline 检查，防止覆盖较新记录。
- 旧数据由新代码加载已验；没有承诺回滚到旧应用后，旧代码仍能保留新字段。正式回滚策略另行确认。

## BA 正式接口最小交接

当前 `src/api/research.ts` 仍明确 unavailable。没有新增猜测 URL、模拟正式成功、用 localTaskId 冒充 projectId 或用本机 revision 冒充服务器修订。

接通前需提供：

1. 实际服务地址/路由、认证方式、请求响应样例和错误约定。
2. 创建/读取正式项目及 workflow，取得服务端身份和权威修订。
3. 两阶段候选 schema、来源登记/固定输入引用和保存接口；并发冲突、权限、历史只读等错误。
4. 保存响应中的固定 `projectId/workflowId/artifactId/versionId`，以及按此引用读取同一份内容的接口。
5. 正式检查/采用/阶段确认和历史锁定规则。导航或本机完整性检查不能替代这些行为。

正式验收必须完成“页面提交 → 服务器保存 → 按固定版本重新读取 → 内容相同”，不能只以 HTTP 成功或本机保存作为通过。

## 本轮验证

- 开工基线 137 项自动测试通过。新增选题7项、方案6项，合计150项全部通过；新增测试先失败，再实现并通过。
- `npm run build`（vue-tsc + Vite）通过；DOM契约53处引用、0断链。
- 实际浏览器：12组开发/工作台接线场景、4组生产构建检查、2组方案失败/只读补验，另1组空白选题开发样例回归，共19组/项。选题与方案输入来自合成 DEV 组件；生产仅验缺件提示、摘要/保存接点、入口与刷新恢复。
- 独立只读复核未发现高/中问题；发现开发样例首次直接输入名称携带不存在来源ID，已先复现失败再修复并验证。
- 真实F组件与正式后端均未交付，未验；未调用旧数模智能体或执行沙箱任务，没有修改 Java 后端。

本轮日志、浏览器记录、截图和过程位于 `D:/Codex/workspace/市场调研大赛/outputs/research-stages-20261027/`，不放进前端源码仓库。
