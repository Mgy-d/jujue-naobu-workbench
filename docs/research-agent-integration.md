# 市调智能体接入与验收边界

更新：2026-10-28。以下为前端接入及本机合成联调结论，正式项目/版本保存和七阶段确认仍单独验收。

## 调用链与代码

| 用户操作 | 接口与处理 | 代码 |
| --- | --- | --- |
| 确认市调智能体 | GET /api/agents；按名称、ID、active 状态匹配 | src/config/researchAgent.ts、src/api/researchAgent.ts |
| 测试模型、发送研究消息 | POST /agui/run/{agentId}；Accept: text/event-stream；新消息使用新 runId | src/api/szRun.ts、src/stores/researchRuns.ts |
| 填写资料/人工确认 | 归一化 ui_form_advanced/ui_gate；resume 复用原 threadId/runId、覆盖全部待答项 | src/api/szRun.ts、src/api/formInterrupt.ts |
| 刷新/核对会话 | transcript、form-interrupts、run-status；必要时用会话事件核对新中断的运行身份 | src/stores/researchRuns.ts、src/api/aguiEvents.ts |
| 老平台没有 pendingWork | 父会话空闲后补读 progress；CONTINUE 仅表示台账待推进，不能断言子任务仍运行；WAIT_HITL 无表单则提示核查 | src/api/researchAgent.ts |
| 预览/下载父子会话文件 | artifacts、artifacts/content、artifacts/download-ticket；使用返回的完整文件路径 | src/api/artifact.ts、src/api/szArtifacts.ts |
| 页面呈现 | 当前任务的独立运行身份、流式正文、表单、错误及文件列表；不自动确认业务阶段 | src/views/research/ResearchAgentPanel.vue |

RUN_FINISHED 未带 outcome 的旧平台正常终态，仅在已收到同一 threadId/runId 的 RUN_STARTED 后接受为本段结束。RAW/RUN_ERROR、断流、身份冲突和未知 outcome 均不能被改判成功。本段结束还要核对后台状态，不代表研究完成。

## 已取得的真实本机证据

使用独立端口、合成研究资料与本机测试身份；后端为经过明确授权的两处初始化补丁的隔离构建，不能等同原交付分支或正常 OAuth 账号验收。

- 真实模型返回文字；实际收到资料表单；刷新恢复原表单。
- 提交表单沿用原 threadId/runId；输入落盘后派发研究设计子任务。
- 实际页面预览/下载输入文件、读取子会话测试文件；下载内容与原件 SHA-256 一致。
- 后台后来生成研究简报、研究问题、调查方案、manifest 和核验记录；本机磁盘复核及交付自带结构校验通过。manifest 为 g1_pending。
- 日志记录后台 G1 闸门登记，随后等待 30 分钟超时取消；未取得实际页面通过/退回及续跑的真实成功证据。

原运行标识：projectId=sz-2e210403-4f76-4d92-8104-081dddc897f4；threadId=main-335f31db-3fe8-4a2f-8d91-83b5cf8adce8；runId=run-fcb5bd6f-9f32-4c17-b24e-a38386f9d093。新后台闸门属于新的后台执行段，不能直接借用这个旧 runId。

## 本轮前端验证

- 229 项自动测试通过；类型和生产构建通过；DOM 契约无断链。
- 隔离浏览器 12 组模拟操作通过：表单、原运行续接、新旧闸门、退回、刷新、父子路径、下载、CONTINUE、缺表单和状态请求失败。
- 模拟回归只证明前端处理，不能代替真实人工确认或真实部署验收。

## 待接续

1. 恢复本机隔离服务，并先检查临时库是否仍有会话。数据库和 Redis 为 tmpfs；停止后不能假定数据仍在，文件产物不等于运行状态备份。
2. 核对后台唤醒产生的新闸门能否提供权威 runId。交付源码 WakeupInterruptRegistrar 的登记记录没有 runId；不能验证原运行时必须保持阻断，交平台确认恢复协议，不能前端猜造编号。
3. 新闸门在有效期内进行真实页面恢复、退回修订、重新确认和通过续跑；随后读取对应 manifest/产物并刷新核对。已超时闸门不应重放。
4. 读取真实三份研究产物的预览和下载尚待页面验收；当前只有磁盘和结构检查通过。
5. 正常账户 OAuth、实际附件上传及权限边界、团队部署、正式版本保存、七阶段正式确认仍不在已通过范围。

原始 SSE、截图、构建补丁、模型凭据检查结果及运行数据留在仓库外 D:/Codex/workspace/市场调研大赛/outputs/g1-local-20261028；密钥、token、运行态和截图不提交 GitHub。
