# 完整研究第一阶段：P 接入与交接

## 当前范围

- 三个 immutable workflowKind：full-study（0—6）、questionnaire-review（0）、dataset-analysis（0—1）。新任务 viewedPhase=0，只是当前查看范围；没有伪造 activePhase、projectId、workflowId、runId。
- 本机身份 localTaskId + revision 仅用于草稿事件与隔离。正式项目身份、阶段、修订号、历史锁定和确认，以 BA 响应为准。
- 七阶段按业务顺序承载；第五阶段已登记平台内匿名发布、手机填写、回收及停止收集，未实现。既有沙箱在数据快捷入口继续可用，不强行挂到完整研究第六阶段。
- 用户本次顺序覆盖历史问卷优先安排；对外品牌为市调演真。

## 文件与职责

| 文件 | P 提供什么 |
| --- | --- |
| src/types/research-contracts.ts | C0 最小公共身份、候选、来源；赛事草稿、组件 props/events 类型 |
| src/utils/researchDrafts.ts | 流程阶段、草稿清洗、旧数据迁移、持久化、本机完整性提示 |
| src/stores/research.ts | 任务切换、新建/继续、局部修订与保存反馈、生命周期之外的沙箱引用回写 |
| src/views/ResearchWorkspaceView.vue | 三入口/任务选择、七阶段、当前查看阶段和组件挂载 |
| src/views/research/CompetitionUnderstandingHost.vue | 第一阶段摘要、来源/未知项、公共动作和 F 组件接点 |
| src/api/research.ts | saveCandidate 语义适配口与 unavailable；失败保稿/陈旧响应拒绝，没有生产 URL |
| src/dev/ResearchComponentHarness.vue | 开发合成样例，不写真实草稿，不进入生产构建 |

本机目录 `shidiaoyanzhen.research-tasks.v1` 保存元数据和草稿。旧 `refuse-naobu.research-intake.v1`、`research-sandbox-ref` 仅读取迁移到 dataset-analysis；不删除旧键。若目录损坏则拒绝覆盖。检测到另一标签已修改目录时拒绝陈旧保存，保留当前页编辑；这不是数据库事务或跨设备同步。不同端口的浏览器目录仍各自独立。

## 向 F 交接

接入位置：`src/components/research/ResearchDesignEditor.vue`。2026-10-26 已从用户交付包接入 F 原始文件，未重写编辑器、未新增依赖。集成验证见 `verification/contest-component-integration.md`。

- props：`context: {localTaskId, revision}`、`draft: CompetitionDraft`、`readOnly: boolean`、`issues: string[]`。
- emit `update-draft: {context, draft}`；完整 draft 结构见公共类型。保留来源 ID、原文 locator 和 evidenceStatus；不可根据文件名标已读或核实。
- emit `save-request: {context}` 表示正式候选保存请求；当前公共层明确提示接口未接入，不映射为本机保存成功。本机保存是外壳独立动作。
- 每次编辑由 P 增加 revision；下次事件使用最新 props.context。旧修订或其他任务事件拒绝应用；组件不能直接写全局 store、localStorage 或 fetch。
- 提交组件 commit 与正常/空/错误/只读样例，确认是否接受此最小接线类型；如已有不同载荷，在公共适配处对齐，不另造编辑器。
- 开发路由提供空态、合成正常内容、模拟本机保存失败、只读和错误 context 场景。合成样例不是赛事事实或正式组件交付。

## 向 BA 交接

缺少实际 URL、OpenAPI/响应 fixture 和匹配版本，当前不能真实联调以下动作：

1. createProject/getProject：immutable workflowKind、projectId/workflowId、activePhase、revision、权限/锁定状态；正式项目与本机任务如何关联。
2. putSource/readSource：fileId/sourceId、定位信息、允许 evidenceStatus、解析/核实状态和未知项。
3. saveCandidate(context,candidate,expectedRevision)：允许 kind/origin/evidenceStatus 枚举、返回 ArtifactRef、PHASE_LOCKED/STALE_BASELINE/PERSIST_FAILED。
4. checkCompletion：候选固定引用、缺项/风险、确认上下文。
5. confirmCompletion：绑定候选/修订/指纹、幂等 confirmRequestId；采用/锁定/推进同事务。前端导航不会执行这些行为。

代码中的 `competition-understanding/manual/unverified` 是本轮前端接线提案，需 BA 确认允许值后绑定，不能当成已存在接口。接入真实路径后复用现有 `src/api/http.ts` 的鉴权与错误处理；不调用旧数模会话代替业务保存。

R1/S01 应返回可追溯要求、来源及未知项；当前 G0 本机提示不调用模型，也不声称当届规则已核实。未知届次/组别若改变可行性，必须在正式检查中处理。

## 验证边界与下一步

本轮自动测试及浏览器记录分别覆盖草稿/阶段接线与合成 HTTP 响应。F 正式组件已完成本机填写、保存、刷新、任务切换与失败保稿验收；真实正式项目保存、阶段确认/锁定仍未通过。运行记录与截图放 `D:/Codex/workspace/市场调研大赛/outputs/full-study-20261024`，不进入源代码仓库。

第一阶段本机填写链已通过；接续任务为消费 BA 真实接口，验收候选保存→固定版本读回→正式完成检查→用户确认→同事务推进。等待交付时可依同一公共协议准备第二阶段挂载，不把后续范围预览标为功能完成。
