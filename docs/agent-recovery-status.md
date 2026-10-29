# 异常审核会话的重新核对

工作台发现已答审核再次出现时，仍保存 blocked 和 submittedIds，禁止重投。用户可显式点击“重新核对异常会话”，仅发起查询。

解除保护要求同时满足：

- 当前账户、任务和会话身份未变；服务端无活动运行或在途任务。
- 平台待答列表和框架实时中断列表均为空；实时接口缺失时保持保护。
- 所有本机已提交/待答编号都有唯一匹配的 HITL 调用及其后出现的 success 工具结果。空转录、ERROR、RUNNING、重复调用编号不能放行。
- 保存核对结果成功，且没有另一页面修改身份。

核对完成保留 submittedIds、原 projectId/threadId/runId，再读取会话状态。空闲只表示会话可核对，不表示研究阶段已完成。存在新待答审核时保持保护，交平台核查；不删除新审核，不自动续跑。

实现：src/api/szRun.ts 的 successfulResearchHitlIds、src/stores/researchRuns.ts 的 recheckBlocked、ResearchAgentPanel.vue 按钮。单元回归位于 tests/research-agent-session.test.mjs。

本轮验证：241项前端测试通过，类型检查/构建与 DOM 契约检查通过；真实构建页面配合 Mock 响应验证缺失记录拦截、成功核对、保留提交编号、刷新恢复以及全程仅 GET。真实后端异常恢复尚未通过：审核登记候选补丁未应用，原临时测试库停止后丢失。此功能不恢复丢失数据库、不代替后端修复。
