# A01—A05 公共业务接口提案与接入说明

日期：2026-10-27。**这是供 BA 评审的前端提案，不是已交付后端文档。**

## 范围与环境

- 真实前端为 `D:/scdc-develop`；不修改 Java 后端。
- 正常构建 `BusinessMode=unavailable`，不请求猜测的正式 URL。既有本机草稿和沙箱入口保留。
- 只有构建时显式设置 `VITE_RESEARCH_BUSINESS_MODE=mock` 才启用下列测试路径。查询参数、缓存和登录状态不能启用 Mock。
- Mock 页面顶部及项目区显示“MOCK 测试环境 / 合成服务响应”，只使用合成输入。Mock 测试服务位于 `tests/fixtures`，不进入前端应用构建，不持久化业务数据。
- 调查了 [MSW 官方仓库](https://github.com/mswjs/msw)和[官方文档](https://mswjs.io/docs/)。本工程已有 Node 测试与 Playwright，当前使用独立 HTTP fixture 即能覆盖页面网络；不新增依赖和 Service Worker。后续协议稳定、跨项目共用 Mock 有需要时再评估。

## A01 操作—接口表

**下表所有路径均以 `/__research_mock__/v1` 为前缀，专供测试，不能部署成正式业务接口。**

| 页面操作 | 测试方法/路径 | 请求关键字段 | 成功返回 | 权限/版本要求 |
| --- | --- | --- | --- | --- |
| 创建项目 | POST /projects | clientTaskId, workflowKind, title, requestId | BusinessProject | 创建鉴权；幂等键与同一客户端任务关联不能产生重复项目 |
| 继续/刷新项目 | GET /projects/:projectId | 路径身份 | BusinessProject | 先检查账户权限；不得根据本机关联缓存直接显示文件/版本 |
| 上传原件 | POST /projects/:projectId/materials | multipart file, expectedRevision, requestId | project + material | write；并发冲突拒绝；上传与解析分开 |
| 列表/解析状态刷新 | GET /projects/:projectId | 无 | project.files | read；只手动刷新，不轮询轰炸服务 |
| 原件读取/下载 | GET /projects/:projectId/materials/:fileId/content | fileId | 二进制原件 | read；不直接打开服务端提供的任意外链 |
| 保存当前阶段候选 | POST /projects/:projectId/candidates | phase, content, inputRefs, sourceRefs, origin, evidenceStatus, expectedRevision, requestId | project + FixedCandidate | write；服务端拒绝锁定阶段、陈旧修订及非法来源/输入引用 |
| 读取固定候选 | GET /projects/:projectId/workflows/:workflowId/artifacts/:artifactId/versions/:versionId | 完整四元引用 | FixedCandidate | read；不能用 latest 代替指定 versionId |
| 阶段完成检查 | POST /projects/:projectId/checks | phase, candidateRef, expectedRevision | PhaseCheck | read/write；检查不推进、绑定准确候选和项目修订 |
| 用户确认阶段 | POST /projects/:projectId/confirmations | phase, candidateRef, checkId, expectedRevision, requestId | BusinessProject | confirm；原子采用、锁定及推进；confirm-checkId 幂等 |

## 身份、版本与响应

- `localTaskId/revision`：浏览器草稿及组件事件身份。绝不作为正式 projectId、workflowId 或服务端修订号。
- `BusinessProject`：projectId、workflowId、clientTaskId（仅关联）、immutable workflowKind、title、revision、activePhase、permissions(read/write/confirm)、lockedPhases、adopted、candidates、files。正式字段定义在 `src/types/research-business.ts`。
- `ArtifactRef`：projectId + workflowId + artifactId + versionId；每次读取必须核对全部四项及 phase。
- `Material`：fileId、sourceId、filename、size、parseStatus、parseMessage、locator。parseStatus 为 uploaded / parsing / failed / ready。ready 仅表示材料可供使用，不能代表来源真实性已核验。
- `FixedCandidate`：固定 ref、phase、content、inputRefs（上游已采用引用）、sourceRefs（可定位原件及手工来源）、origin=manual、evidenceStatus=unverified。成功保存不等于采用/确认。
- `PhaseCheck`：checkId、projectId、workflowId、revision、phase、candidateRef、canConfirm、issues、risks。服务须定义有效期；项目/材料/内容变化后必须重新保存/检查。
- 客户端校验字段完整性、工作流类型、项目/工作流/固定版本/阶段匹配，不接受缺失修订或串项目响应。相同文件名不会合并文件身份。
- 当前候选内容仅支持已交付的完整研究 0—3 阶段和独立问卷 0 阶段。正式调查、完整研究分析/报告的候选 schema 尚未交付；不提交空壳候选。

## 错误与保护

| HTTP / 本地错误 | 代码 | 页面处理 |
| --- | --- | --- |
| 尚无正式绑定 | CAPABILITY_UNAVAILABLE | 不发送猜测请求；本机编辑保留 |
| 401 | UNAUTHORIZED | 清除已加载项目/材料/版本、使全部在途响应失效，要求重新登录；不删除草稿 |
| 403 | FORBIDDEN | 清除已加载项目并作废在途响应，保持关联待重新读取；隐藏关联阶段内容 |
| 404 | NOT_FOUND | 明确资源不存在；不自动建另一个项目代替 |
| 409 | STALE_BASELINE | 保留编辑，不应用旧返回；重新读项目并核对 |
| 423 | PHASE_LOCKED | 拒绝写入；重新读取服务的锁定状态 |
| 422 | MISSING_INPUT | 展示缺项/请求不完整，保留编辑 |
| 其他服务错误 | UNAVAILABLE | 展示可重试失败，不报告成功 |
| 断网/15 秒超时 | NETWORK_ERROR | 不自动重放写入；保留当前内容 |
| 缺字段/串身份 | INVALID_RESPONSE / IDENTITY_MISMATCH | 不应用响应 |

读/写互斥以防重复点击；任务切换/卸载使旧请求返回失效。保存开始时复制快照，返回后只登记版本，不替换用户后来修改的编辑。预览也不自动替换；只有当前任务、阶段及编辑基线仍匹配，用户才能明确载入版本。预览读回完全不恢复可确认基线；刷新或载入后若要确认，需先另存当前候选，避免旧固定引用或新增材料与确认内容不一致。

正常本机关联缓存不存凭据、文件体、候选内容或授权判断。当前只为固定 Mock 账户保存 `schemaVersion + localTaskId -> projectId`；真实账户隔离命名空间待 BA 的账户身份协议确认，不能照搬 Mock 缓存作为多用户实现。

## A02—A05 的接线

`ResearchWorkspaceView` 将当前任务传给 `BusinessProjectPanel`；面板经 `BusinessSession` 调用 `researchBusiness.ts`。

- 组件 `save-request` → Host 校验 context/readOnly → `save-candidate` → 公共面板保存候选；与 `save-local` 完全分开。
- 读取项目前先清空上次授权内容；返回的 clientTaskId、workflowKind 和 read 权限必须与当前任务匹配。
- 文件选择还没有上传；上传失败保留所选文件，解析失败仍能读回原件。任务切换清空 File 及原生选择框。
- 保存候选使用服务端 revision；本机 revision 不用于服务器乐观锁。新增材料后候选基线失效，须重新保存。
- 检查不推进；用户阅读风险后单独确认。确认等待期间暂时只读，成功后使用服务返回的 activePhase/adopted/lockedPhases；失败不点亮下一步。
- 浏览历史阶段不发确认请求；历史按服务已采用的固定版本读取，只读显示、不替换本机草稿。固定历史或项目授权未读回时隐藏阶段内容，不能以本机草稿代替。服务也必须拒绝绕过页面的写请求。

## 正式后端交付检查表

1. BA 确认以上 schema/操作是否采用，并提供匹配部署版本、OpenAPI、成功/错误响应 fixture 及实际相对路径。
2. 鉴权/刷新机制、账户主体、项目权限和跨账户拒绝。当前真实 HTTP 客户端 `src/api/http.ts` 可复用，但写入重试只在幂等协议明确后绑定；不得自动把测试路径改成 /api 猜测上线。
3. 原件上传大小/类型限制、存储、下载鉴权、sourceId/fileId 与解析状态归属；BB 提供真实解析结果和失败原因。
4. 固定候选是否不可变、上游引用/输入指纹、来源定位、业务内容 schema，项目 revision 增量与冲突处理。
5. check 有效期、候选/输入变化失效规则、confirm 幂等键；采用/锁定/推进需同事务。撤销或上游修订后，服务须返回失效采用/解锁状态，客户端重新保存和检查。
6. 登录、断网、超时未知结果、重复请求、无权限、缺项目、陈旧版本、锁定写入均需真实服务响应验证。

真实绑定交付后，替换隔离测试适配为获确认的请求映射，保留同一组件/Session 与回归用例，逐项补真实页面证据。本轮不声称数据库保存、真实解析、账户安全或团队部署已通过。


## Mock 的可确认范围与重复使用

当前仅完整研究第0阶段有明确的合成缺项检查，能够演示“保存→检查→确认→读取采用版本→历史只读”。其规则不核验赛事事实。

其余已交付编辑阶段和独立问卷可以保存/读回候选，但检查会明确返回“检查规则尚未交付，不予确认”。不能将空选题、空方案或零题问卷作为成功确认。浏览器对这些组件的接线测试会分别设置合成项目的目标阶段；这不是七阶段连续业务流程通过。

在前端根目录运行 `npm run dev:business-mock`，可启动 `http://127.0.0.1:5185/#/research/work?mode=full` 的单独合成开发环境。环境标志只在该进程中设置；正常 dev/build 不受影响。服务和页面均仅监听本机，停止进程即停止。模拟项目只存内存，重启后应新建本机测试任务，原本机草稿不会被脚本删除。

`npm test` 覆盖公共逻辑与真实 localhost HTTP fixture；页面验收记录见 [验收说明](research-business-acceptance.md)。这不是部署或真实数据库的验收命令。
