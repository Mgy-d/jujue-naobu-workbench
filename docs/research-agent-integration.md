# 市调智能体接入与验收边界

更新：2026-10-28。本机同一项合成 G1 研究的生成、退回、修订、通过、成果读回及刷新链路已真实验收；正式七阶段、不可变版本与业务权限仍单独验收。

## 调用链与代码

| 用户操作 | 接口与处理 | 代码 |
| --- | --- | --- |
| 校验智能体 | GET /api/agents，匹配名称、ID 和 active | src/config/researchAgent.ts、src/api/researchAgent.ts |
| 对话与新运行 | POST /agui/run/{agentId}，Accept: text/event-stream；新消息使用新 runId | src/api/szRun.ts、src/stores/researchRuns.ts |
| 表单与审核续跑 | ui_form_advanced/ui_gate；resume 使用审核所属 threadId/runId，覆盖全部待答项 | src/api/szRun.ts、src/api/formInterrupt.ts |
| 刷新恢复 | transcript、form-interrupts、run-status；缺 pendingWork 时补读 progress | src/stores/researchRuns.ts、src/api/session.ts |
| 后台审核身份 | latest watermark → 最近运行完整事件 → 唯一匹配 srv 运行、工具编号和全部参数；不猜造编号 | src/api/researchAgent.ts、src/api/szRun.ts |
| 预览下载 | artifacts、artifacts/content、artifacts/download-ticket；使用产物 API 返回的完整路径 | src/api/artifact.ts、src/api/szArtifacts.ts |
| 界面与任务关联 | 正文、审核、运行状态、材料和文件；不自动确认正式业务阶段 | src/views/research/ResearchAgentPanel.vue |

正常 RUN_FINISHED 省略 outcome 时，仅在同一 threadId/runId 已有 RUN_STARTED 后接受为本段结束；错误、断流和未知 outcome 不改判成功。后台 recorder 的结束事件同样不带 interrupt outcome，恢复时还要将完整工具调用参数与活跃登记精确核对，歧义/失败/跨会话/残缺记录均阻断。

CONTINUE 表示台账尚有后续，不能断言子任务现在仍执行。WAIT_HITL 也可能是等待普通用户指令：登记为空且没有已知未解决审核时显示“等待后续输入”；新审核身份未验证、已知待答丢失、旧审核复活仍阻断。显示本轮回复结束不等于整个研究完成。

## 本轮真实验收

使用独立端口、合成资料和本机测试身份，后端是经过两处获准模型初始化修补的隔离构建。正常 OAuth 和原交付分支零补丁运行没有据此通过。

- projectId：sz-48076bc0-c505-46b2-887a-6f7922aaf154；threadId：main-b8441091-dc63-4ac4-9d82-554fb729a632。
- 初始 runId：run-989acac4-dc3a-4a30-9d65-389d2ace1abf；后台审核运行：srv-0effb3b67f67。
- 输入完整，按交付规则跳过重复资料表单，生成真实研究简报、研究问题、调查方案及 manifest。
- 后台审核刷新恢复；在同一研究中退回、按意见修改简报、重发新审核、刷新只显示新审核，再通过。
- 三份文件均由实际页面预览/下载；修订版重新下载，与后台原件 SHA-256 一致；manifest 读回一致，status=g1_approved，decisionLog 保留不通过/通过。
- 最终 parent running=false、form-interrupts=[]；刷新后无旧审核/无页面报错，显示“等待后续输入”。
- 初始 ui_form_advanced 的实际填写、刷新、原运行续跑另有上一项合成研究的真实证据，未冒充本轮重复触发。

验证：234 项自动测试、类型与生产构建通过；DOM 契约无断链；12 组隔离浏览器模拟页面操作通过。模拟测试与上述真实接口验收分别保留。

## 已复现限制与后续

1. 阶段通过后的额外自动自检：G1_APPROVED 等待新指令仍可能被平台任务台账/完成契约看护唤醒。展示分类把“部分完成”归为 CONTINUE；自动看护另外依据真实任务/挂起状态，不能只改文字分类就说修好。需平台明确“阶段完成但全流程未完成”的暂停状态；前端不能伪写全流程 session-complete.json。
2. 本批模型产物将“前端前三业务阶段”括注为 G2/G3/G4，口径错误。前端前三为赛事理解、选题分析、研究方案，均涉及 G1；接入不按这段自由文本推进阶段。需智能体资料负责人修订。
3. manifest frozen 是智能体约定，不是 BA 不可变版本/权限锁。结构检查不是全部内容质量审核；七阶段正式确认、正常用户权限、真实附件上传、问卷发布回收及团队部署未因此通过。
4. 数据库/Redis 为 tmpfs；停止后不能假定会话仍在。本轮原会话曾 404，因此新建明确标记的验收会话。最终结果先验收，再暂停该合成测试的自动唤醒，服务保留运行；不是通过暂停制造成功。

原始事件、截图、合成研究文件、模型检查结果、隔离后端补丁及报告留在仓库外 D:/Codex/workspace/市场调研大赛/outputs/g1-local-20261028。密钥、token、截图、运行数据及后端源码不提交。完整过程见该目录“今天G1主链路真实验收报告.md”和 fullchain-final-audit.json。
