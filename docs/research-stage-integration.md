# 首页与前三阶段本机接入

更新：2026-10-27。当前目标是“首页进入工作台，在同一任务中推进完整研究”。本轮前半完成首页、流程范围整理和前三阶段本机操作，检查点提交为 `0a258a4`；随后已继续接入第四阶段问卷本机编辑，见 [问卷接入说明](research-questionnaire-integration.md)。七阶段全部业务、真实 AI、正式保存和阶段确认没有完成。

## 当前已通过的操作

- 首页沿用原数模首页的导航、居中主视觉、推荐卡、大输入框和页脚布局，品牌为“市调演真”。复用布局和局部样式，不启动旧数模业务。
- 首页填写研究背景后，“开始完整研究”创建新的完整研究本机任务，将文字交给赛事理解，并保存后进入工作台。保存失败停留首页并保留输入；“继续本机研究”恢复原任务和原查看阶段。
- 实际 F 组件 `ResearchDesignEditor.vue`、`TopicAnalysisEditor.vue`、`ResearchPlanEditor.vue` 已挂入工作台。前三阶段可以填写、保存、刷新和切换任务。
- 选题读取同一任务的赛事要求；方案读取同一任务的赛事来源与拟选方向。上游均标为未正式确认的本机参考，不自动建立正式输入版本。
- 七阶段导航分别显示可用范围。查看阶段不表示完成、正式采用或推进。同日续作已接问卷本机编辑；正式调查、完整研究内分析与报告仍待接入；已有答卷的独立本机分析保留。

此前“两个编辑组件未交付、仅合成接线通过”的记录描述的是基线提交 `14ddae69407ffd97093fa6ab5ade8b6f1166dab8`，已被本轮实际交付组件验收更新，不能作为当前状态使用。

## 交付来源与选择性复用

用户提供的 `scdc-develop(1).zip`：236,013,013 字节，SHA-256 `9bd4af02d0195e738c45cc031bc8f8d6112e0e06de813216a1a2f74bad7e9c66`。没有提供可核对的公司仓库提交，因此以包和原文件哈希追溯，不杜撰来源 commit。

本轮只引入两个编辑器、两个 contract 和三份相关 F 文档。原件哈希：

| 文件 | 原始 SHA-256 |
| --- | --- |
| TopicAnalysisEditor.vue | `3eedfebf244a9f5f0ef412bea82dcc3c62746ed18a696a1e82fe53019016af2a` |
| topic-contract.ts | `48d74d9e84f82eb1873a45f25b2c14f85bdf2f91456359f74130f5d3f15a5e26` |
| ResearchPlanEditor.vue | `19bb4042cbcf699fe0cdd0d8e2742e26dacc6531ff7053af8da6c5ec64cf15b4` |
| plan-contract.ts | `ce7fcfb0c27d7fc201e639816f0a9eacc1e323e5e20a2278e48d47af1c79c75f` |

接入后调整了本机标记文案、失效关联清理和必要兼容类型；当前文件不再与交付原件完全相同，具体差异由 Git 保留。F 交接文档保留原文，其“确认/采用”等描述不能代替真实后端验收。

没有覆盖包内旧公共 store、类型、Host、路由和依赖；没有采用 F 临时独立存储 `scdc-f-topic-plan-v1:<localTaskId>`。未验证用户是否曾用该临时存储，不能声称已经迁移其中的数据。包中问卷组件在后续检查点选择性集成，详见问卷接入说明。赛事理解原件与现有组件一致，未重复替换。没有新增依赖。

## 实际文件与数据流

| 位置 | 作用 |
| --- | --- |
| `src/views/ResearchHomeView.vue` | 首页布局、本机新任务、背景传入与继续入口 |
| `src/views/ResearchWorkspaceView.vue` | 任务切换、七阶段可用范围、前三阶段组件挂载 |
| `src/views/research/ResearchStageHost.vue` | 真实编辑器、只读上游、事件上下文/格式校验、保存反馈 |
| `src/components/research/TopicAnalysisEditor.vue`、`topic-contract.ts` | 候选方向、拟选理由、赛事要求引用和未知项 |
| `src/components/research/ResearchPlanEditor.vue`、`plan-contract.ts` | 问题、抽样、招募、测量、分析安排和本机方案标记 |
| `src/types/research-contracts.ts` | 实际 F 草稿类型、旧版保留类型和阶段事件 |
| `src/utils/researchStageDrafts.ts` | 新旧结构识别、迁移、结构/引用检查与本机提示 |
| `src/utils/researchDrafts.ts`、`src/stores/research.ts` | 每任务保存、刷新恢复、修订与陈旧写入保护 |
| `src/dev/ResearchStageHarness.vue`、`ResearchStageFixture.vue` | DEV 独立边界验证；生产路由不包含该样例 |

数据流：组件接收只读 `context + draft + readOnly + issues + upstream` → `update-draft` 发出完整新草稿 → Host 校验上下文与结构、加阶段身份 → store 核对当前任务、修订和查看阶段 → 只替换对应字段 → “保存本机草稿”写入已有本机任务目录 → 刷新读回原任务。

组件不直接写 store、localStorage 或调用业务 API。Host 拒绝其他任务、旧修订、格式损坏和只读编辑；深层只读同时阻止组件直接修改嵌套数据。

## 草稿结构与迁移

- 选题现在使用 `directions[]`、`selectedDirectionId`、`selectionReason`、`unknowns`；方向包含问题、对象、价值、赛事要求引用和可行性说明。
- 方案现在使用 `directionId`、`researchQuestions[]`、`sampling`、`recruitment`、`measures[]`、`analyses[]`、`adoption`、`otherNote`、`unknowns`。问题、变量、分析、来源用 ID 关联。
- 保留键 `shidiaoyanzhen.research-tasks.v1`。缺新增字段的旧任务补空稿；旧简化稿转换到实际 F 结构。无法准确映射的原说明和来源保留在 `legacyDraft`，页面提供可展开旧资料，后续编辑仍保留。
- 不把旧来源 ID 当赛事要求 ID，不根据旧文字猜测样本量、测量变量或统计方法，不自动生成正式版本。旧迁移通过单元测试；没有把这一点扩大为任意旧系统回滚兼容保证。
- 显式损坏的数据不清空覆盖。正常未完成草稿允许保存；缺项和失效引用另作提示。上游要求或来源删除后，可在真实编辑器中取消失效关联。
- 本机方案 signature 只用于提示内容变化；“本机标记”不是服务器固定版本、真实预测试或正式阶段确认。

## 验证证据与边界

- 当前自动测试 **157/157** 通过；新增交付/迁移/引用回归测试曾先失败后通过。
- 当前 `npm run build`（vue-tsc + Vite）通过。
- 实际交付组件生产页面 **12 组**：真实字段/同轮输入、关联、刷新、同类任务隔离、本机标记变更、删除联动、正式请求待接入、失败保稿/重试、跨标签防覆盖、赛事和快捷入口往返。
- 当前生产首页链 **4 组**：首页创建并传背景、前三阶段同一任务、返回继续原阶段、首页保存失败保留输入。
- 当前生产路由 **2 组**：开发样例不进入生产；独立问卷/答卷入口范围准确，未触发旧数模业务请求。
- 实际编辑器/Host 开发边界 **3 组**：只读字段和操作、其他任务/旧修订/损坏事件、深层直接修改拦截。
- 实际编辑器失效关联 **2 组**：删除来源后方案提示并可清除；选题失效赛事要求可提示并清除。

以上共 23 组场景不是 23 个独立业务功能；输入均为明确合成内容，真实 localStorage/生产页面行为与正式后端验收分开。没有执行新沙箱任务、真实 AI 或正式项目保存。

截图、日志、浏览器脚本和包清单位于 `D:/Codex/workspace/市场调研大赛/outputs/delivered-stages-20261027/`；不进入前端仓库。DOM 契约与仓库检查结果在本轮收尾记录登记。

## 正式接口与后续依赖

`src/api/research.ts` 仍 unavailable，点击“提交为正式候选”明确提示尚未接入，不发猜测 URL。需要 BA 实际交付地址/鉴权、项目与 workflow 身份、候选 schema、权威修订/并发错误、固定 `artifactId/versionId` 保存及读回、检查/采用/确认/历史锁定规则。验收必须完成真实页面提交→服务器保存→按固定版本重新读取同一内容。

问卷编辑器及其与研究方案的变量关系已经在同日续作验证；下一步为正式调查服务交接，正式调查的匿名发布/回收/停止需要真实采集服务与部署。完整研究的数据采用/分析/结果版本与报告不能只靠导航补齐。已有独立分析和本机沙箱保留，团队服务器能力仍单独验收。
