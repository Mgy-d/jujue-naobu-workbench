# 两案共用的前端业务与服务契约

日期：2026-10-19。状态：供两案评审的前端契约草案。类型和路径是实施目标，当前仓库没有这些产品模块。

## 1. 已确认、建议和待定

| 层次 | 内容 |
| --- | --- |
| 用户已确认 | 两套方案各配开发计划；两套都使用雾蓝；工程分层参考 scdc；保留市调业务 |
| 用户先前偏好 | B 外层站点版式更新、项目内保留三栏；本次按用户新要求同时展开 A/B 比较 |
| 技术建议 | 单一 Vue 应用、业务纯函数、Pinia 持有项目权威状态、Repository/RunGateway 适配持久化与运行服务 |
| 尚未决定 | 最终采用 A 还是 B、真实后端、服务认证/部署协议、最终日常交付入口 |

共同约束原文：

1. 品牌名称固定为“拒绝脑补”，全站采用雾蓝。
2. 七阶段业务规则来自原型归档，数学建模逐问求解流程不进入市调状态机。
3. 对话卡、预览、版本列表、全屏和下载绑定同一 projectId + artifactId + versionId。
4. 草稿、已保存待确认、已采用、历史与需重新核对分开表示。
5. 本轮前端迁移不以真实模型、通用文件解析、Python 服务或云协作为完成前提。
6. 归档原型、D:/scdc-develop 和作者日常浏览器数据保持不变。
7. 真实服务失败不得静默切换为模拟成功。
8. 本次文档没有授权开始产品代码实施。

## 2. 共同工程结构

```text
src/
  api/                  # Repository、RunGateway 的接口与 local/remote 实现
  config/               # 服务模式、来源标签与能力配置
  stores/               # projects、research、workbenchUi、runs
  views/                # HomeView、CasesView、CaseDetailView、ProjectsView、ResultsView、ResearchView
  components/
    site/               # SiteHeader、CaseCard、CaseTabs、ProjectRow
    research/           # 对话、问卷、报告、数据、版本、导出等共用组件
  engine/research/      # workflow、artifacts、questionnaire、observation、revisions、tasks
  types/                # research、services、content
  data/                 # publicWorks、tutorial、sampleRows（明确标注模拟）
  legacy/bridge/        # 一次性的旧备份导入与来源适配；不挂载旧 React 应用
  utils/                # 文本展示、下载、Markdown 安全渲染
  router/
  styles/               # tokens、global、site，以及所选工作台方案样式
```

两案是在同一个工程中择一实施，不新建两个长期产品仓库。不同方案的布局组件和样式由各自计划列明；不先写一个复杂可切换主题/布局平台。
目录参考 scdc，页面按 Vue 路由和组件拆分；不照搬单个巨大 PrototypeShell、全局 onclick、同页隐藏全部视图或 HTML 快照作为业务真相源。

依赖候选为 Vue 3、Vue Router 4、Pinia、Element Plus 2、Markdown-it、Vite、TypeScript、Vue-tsc、Sass、Vitest、Vue Test Utils 和 Playwright。
首任务读取各包的官方 registry 元数据、engines 和 peerDependencies，安装精确锁定的稳定版本，并验证 Node 24 环境。旧 scdc 锁定 Vite 5.4.2 仅作为来源事实，不直接当作新项目版本结论。
只选一个包管理器：建议 pnpm，记录实际版本到 packageManager；使用冻结锁文件安装。依赖审计发现高危问题时先修复或形成具体可审阅的受影响说明，不用旧配置的 `host: true` 暴露开发服务。

目标脚本（由首任务建立后才可执行）：

| 脚本 | 目标命令 |
| --- | --- |
| dev | `vite --host 127.0.0.1 --port 5182 --strictPort` |
| typecheck | `vue-tsc --noEmit` |
| test | `vitest run` |
| test:e2e | `playwright test` |
| build | `vue-tsc --noEmit && vite build` |
| preview | `vite preview --host 127.0.0.1 --port 5182 --strictPort` |

当前文档仓库无 package.json；本次未执行这些未来产品脚本。

新项目使用5182，避开原型4183与scdc5181。Playwright使用独立测试端口5184：项目名固定`chromium`，`testDir='tests/e2e'`，`baseURL='http://127.0.0.1:5184'`，webServer命令为 `pnpm exec vite --host 127.0.0.1 --port 5184 --strictPort`，`reuseExistingServer=false`。
端口占用时明确失败，不停止作者正在运行的服务。测试使用隔离browser context；双标签冲突场景在同一测试context内打开两个页面。

## 3. 页面与路由

采用 hash 路由和相对资源基址，首版可由静态 HTTP 服务承载。

| 路由 | 职责 | 共同约束 |
| --- | --- | --- |
| `/#/` | 首页：研究输入、完整演练、公开介绍入口、最近项目 | 输入仅按现有演示规则或手动建题处理，不假装已理解任意材料 |
| `/#/cases` | 列表：公开作品与完整演练分区、筛选 | 10条公开介绍不标为10份全文；待收录项不算已获奖作品 |
| `/#/cases/:caseId` | 详情：公开资料、材料、可用演练 | 公开介绍不可“复现全文”；完整观演演练可创建明确的教学项目 |
| `/#/projects` | 我的项目：恢复、继续、备份、删除 | 删除当前项目需确认；恢复备份新建副本 |
| `/#/results` | 我的成果：当前保存稿、已采用稿与待核项 | 不拿过程事件数冒充成果数量 |
| `/#/work/:projectId` | 当前研究工作台 | A/B 布局不同，业务与引用一致；未知项目显示返回项目入口 |

登录不是本机教学流程的前置条件。未来 remote 模式需要认证时，再启用 LoginView 与返回目标的守卫；本轮不植入默认管理员或明文演示账户。

## 4. 数据模型与身份

以下是需落在 `src/types/research.ts` 的最低接口；其余既有业务字段按迁移清单显式补齐，禁止依靠未记录的 any/全局变量保存业务。

```ts
type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6
type ReviewStatus = 'needs-review' | 'adopted' | 'superseded' | 'needs-update'
type Origin = 'demo' | 'user-authored' | 'user-file' | 'public-reference' | 'aggregate-summary'
interface ArtifactRef { projectId: string; artifactId: string; versionId: string }
interface ProjectRecord {
  schemaVersion: 1; id: string; revision: number; title: string
  mode: 'custom' | 'tutorial'; stage: Stage; maxStage: Stage
  confirmedStages: Stage[]; createdAt: number; updatedAt: number
  questions: Question[]; drafts: ProjectDrafts; choices: ResearchChoices
  stageEvidence: StageEvidence; study?: StudyState; observation?: ObservationSettings
  snapshots: ProjectSnapshot[]; artifacts: Artifact[]; messages: Message[]
  files: FileRef[]; workItems: WorkItem[]; runs: RunRecord[]
  provenance: ProjectProvenance
}
```

- `Question`：稳定 id、title、type（单选/多选/量表/填空）、options、required、可选的 sourceNumber。
- `ProjectDrafts`：按成果或题目 id 保存未提交正文、输入框草稿和基线签名；草稿不生成 adopted 版本。
- `ResearchChoices`：背景、topic、plan、method、reportText、code、预试反馈、样例处理、分析视角及观察参数。迁移时建立显式字段映射，不能仅迁移标题和阶段。
- `StageEvidence`：backgroundConfirmed、pilotStatus、surveyStatus、analysisStatus、reportConfirmed；状态保留demo/team-reported/verified的来源区分，只有明确证据才能使用verified。`StudyState`保留scenario、population/place/period/channels/goal、字段/质量确认、decisions及解释/建议。`ObservationSettings`包含field、threshold、limit。
- `ProjectSnapshot`：不可变 id、createdAt、stage 及当时的研究字段、问卷、参数和来源。
- `Artifact`：id、kind、currentSavedVersionId、adoptedVersionId、versions。
- `ArtifactVersion`：id、number、snapshotId、inputRefs、reviewStatus、sourceRunId、sourceMessageId、createdAt、origin。
- `Message`：id、stage、role、text、parts，其中 artifactRef 固定到当时的 ArtifactRef；旧快捷操作只读。
- `FileRef`：id、projectId、originalName、bytes、mime、origin、availability（available/missing）、hash（可计算时）。文件名不作为文件身份。
- `WorkItem`：id、type（task/feedback）、owner、due、status、dependsOn、sourceQuote、decisionReason、sourceRef。
- `RunRecord`：id、projectId、inputFingerprint、status、startedAt、finishedAt、events、origin；演示日志明确未执行 Python。
- `ProjectProvenance`：kind、caseId、legacyProjectId、导入时间和缺失附件提示；真实导入不继承教学资格规则。

artifactId 可在单项目内使用原型的 kind 身份，但所有跨视图引用必须携带 projectId；versionId 不复用为“当前最新”的动态别名。
预览焦点、弹层、选中题号、滚动位置和专注模式属于 `workbenchUi`，不复制一份 ProjectRecord。

## 5. 状态与内核接口

`stores/projects.ts` 持有 `byId` 和 activeProjectId。research store 使用当前项目的 computed 视图及受控动作；engine 仅处理对象，不访问 DOM、localStorage 或网络。
以下签名是两案计划的共同边界；函数实现可以保留旧规则但需移除隐式副作用。

```ts
declare function createProject(input: { title: string; mode: 'custom' | 'tutorial'; caseId?: string }): ProjectRecord
declare function canAdvance(project: ProjectRecord): { ok: true } | { ok: false; code: string; message: string }
declare function advance(project: ProjectRecord): { ok: true; project: ProjectRecord } | { ok: false; code: string; message: string }
declare function invalidateFrom(project: ProjectRecord, from: Stage): ProjectRecord
declare function saveArtifact(project: ProjectRecord, kind: string, snapshot: ProjectSnapshot): { project: ProjectRecord; ref: ArtifactRef }
declare function adoptStage(project: ProjectRecord, stage: Stage): ProjectRecord
declare function resolveArtifact(project: ProjectRecord, ref: ArtifactRef): ResolvedArtifact | null
declare function questionnaireIssues(questions: Question[]): QuestionIssue[]
declare function questionnaireSignature(questions: Question[]): string
declare function deriveObservation(rows: DataRow[], field: string, settings: { threshold: number; limit: number }): Observation
declare function textSignature(text: string): string
declare function proposeRevision(input: { before: string; replacement: string; selectionStart: number; selectionEnd: number; baseSignature: string }): RevisionProposal
declare function applyRevision(currentText: string, proposal: RevisionProposal): { ok: true; text: string } | { ok: false; reason: 'stale' }
declare function interpretMessage(project: ProjectRecord, text: string): ConversationDecision
```

`ResolvedArtifact`包含artifact/version/snapshot。`QuestionIssue`包含id/index/message。`DataRow`包含稳定id及原字段；`Observation`包含selected、valid、included、missing、percent、rowIds、rows、field、threshold、limit与summary，零有效分母时percent=null。
`RevisionProposal`保存before全文、replacement、selectionStart、selectionEnd和baseSignature；使用同一textSignature生成内容标记，最终仍精确比较before全文及选区原文，不能把非安全哈希当安全证明。签名或原文不再匹配时不得应用。问卷签名包含id/title/type/options/required及实际启用的分支条件。
`ConversationDecision`包含kind（confirm/open-artifact/edit-request/explanation/unsupported）、text及可选artifactKind。解释与命令解析不修改项目；明确确认仍调用同一阶段动作，普通“好/嗯”不推进。未知自然语言给出手动操作或现有示例入口，不假装通用AI理解。

保存动作先持久化候选结果，成功后发布到权威状态；失败时保留编辑草稿并显示恢复操作，不先显示“已保存”。
advance内部也要重做前置检查；推进失败不变更 stage、确认状态或版本。回看只改变 UI 引用；显式“从此阶段继续编辑”才触发复核失效。
历史快照正文不修改；adopted/needs-update 等评审状态是版本元数据，可随上游变化调整。

## 6. Repository：本地与远端分离

建议为新前端使用新的 IndexedDB 名称 `jujue-workbench-v1`，`projects` 与 `files` 分别存项目和原件；localStorage 仅存轻量偏好/索引。
这是为新项目提出的持久化设计，不声称旧 B 版已经如此实现。旧版 localStorage 继续保留，只通过用户导出的 JSON 导入。

```ts
interface ProjectRepository {
  listProjects(): Promise<ProjectSummary[]>
  getProject(projectId: string): Promise<ProjectRecord | null>
  saveProject(candidate: ProjectRecord, expectedRevision: number | null): Promise<SaveResult>
  deleteProject(projectId: string): Promise<void>
  putFile(projectId: string, file: File): Promise<FileRef>
  getFile(projectId: string, fileId: string): Promise<Blob | null>
}
type SaveResult = { ok: true; record: ProjectRecord }
  | { ok: false; reason: 'conflict' | 'quota' | 'unavailable'; latest?: ProjectRecord }
```

create 使用 expectedRevision=null；已有项目保存使用当前 revision。在同一 IndexedDB readwrite transaction 中比较旧 revision 并写入新 revision，成功后 revision 加1。
不可把 localStorage 的“先读再写”称为跨标签原子锁。BroadcastChannel 只负责通知，不承担一致性校验。
多个标签发生冲突时保留草稿，提供查看新版和另存副本，不自动最后写入者获胜。
附件保管与解析状态分开。本地附件单文件保留现有10MB限制，材料打包保留80MB合计限制；以后真实服务的20MB等限制由适配层协商，不直接拿 scdc 的值覆盖。
删除只操作明确的目标项目及其文件，先确认；不清空整个源站或旧数据库。

## 7. 旧项目导入与导出

`legacy/bridge/importBackup.ts` 提供 `previewImport(raw: unknown): ImportReview` 与 `confirmImport(review: ImportReview): Promise<ProjectRecord>`。
导入先校验结构、上限与版本，再展示预览，确认后新建 projectId。重绑消息、成果、输入引用、任务依赖及题目关联；保留历史正文、原时间与采用来源。
沿用现有最多500题、单字段合理上限和缺附件提示；反馈与最终确认重新核对。JSON 不含原件，不能将文件名清单标为“附件已恢复”。
新备份使用 schemaVersion=1；旧无版本格式由明确的 legacy importer 识别。未知未来版本、损坏 JSON 和不安全对象键拒绝导入，不做部分写入。
导出 HTML/Markdown 使用指定保存版，不混入未保存草稿；项目备份可以包含草稿且不包含 Blob。
材料 ZIP 汇集可取回原件并列缺项；固定 Word/PDF/PPT 是独立演练原件，不伪称当前编辑稿的重新生成文件。

## 8. 运行事件与服务接入

```ts
interface RunContext { projectId: string; runId: string; inputFingerprint: string }
interface RunEvent extends RunContext { sequence: number; type: string; payload: unknown }
interface RunCursor extends RunContext { lastSequence: number; status: 'running' | 'completed' | 'cancelled' | 'failed' }
interface RunInput { kind: 'demo-analysis'; datasetRef: ArtifactRef; settings: ObservationSettings }
interface RunGateway {
  start(input: RunInput, context: RunContext, signal: AbortSignal): AsyncIterable<RunEvent>
  cancel(context: RunContext): Promise<void>
}
declare function isCurrentRun(event: RunEvent, cursor: RunCursor, activeProjectId: string): boolean
```

`RunInput`是本轮演示任务的最低输入，不作为未知真实服务的通用协议。运行事件type限定为started/progress/artifact/succeeded/cancelled/failed/requires-input；payload按事件类型校验，未知事件不创建成果。
`isCurrentRun`同时检查cursor仍running、三项身份匹配、当前project以及sequence大于lastSequence。runs store的 `start(projectId,input)` 与 `cancel(projectId,runId)` 不操作其他项目/运行。

本轮以 DemoRunGateway 支持明确演示任务。RealRunGateway 的请求协议在服务联调任务中确定，缺服务时显示 unavailable，不走 mock 兜底。
前端首版切换项目时取消当前演示运行，取消后旧事件失效；未来真实后台任务继续运行属于另行设计，不能仅凭断开 SSE 判定取消成功。
接受事件同时校验 projectId、runId、inputFingerprint 和 sequence；旧 run 不能取消或覆盖新 run。只在跟随当前任务且无未保存草稿时自动定位新成果。
scdc 的 SSE、401刷新、interrupt/resume、产物读取可作为适配参考；项目完成条件不依赖模型消息中的“已完成”或原数学建模阶段文本。
未来接入真实HTTP/SSE适配时，HTTP 200 + HTML、RUN_ERROR、缺终态、未取得本次产物均不是成功。本轮先用Gateway契约桩验证失败事件、缺成功终态和不采用历史结果；真实HTTP协议测试留给后续联调。
未收到终态保留待核实/失败状态，不引用历史产物冒充本轮。当前演示若收到尚不支持的requires-input，显示需处理/不可恢复说明，不伪造服务确认成功。
UI 层不写死 `/api/agents/...`；具体服务端点、JWT、AgentScope、业务表或会话扩展存储方式均不由前端方案代为冻结。

## 9. 数据与内容边界

- 观演：29题、20条模拟；票价阻碍 threshold=4、limit=20 时15/20=75%，threshold=5、limit=8 时2/8=25%。本次从固定行数据重新核算。
- 10条虚构样例：默认纳入9、有效8、选中5，5/8=62.5%；排除r09后有效7、选中4，4/7=57.1%。漏答不进入有效分母。
- 满意度按现有 `6−原码` 统一方向，其他字段不擅自反转；A/B/C 是互补分析视角。
- 零有效分母在新契约中统一为percent=null并显示“无有效回答”。旧固定案例deriveObservation在这个边界曾返回0，独立样例返回null；这是迁移时要消除的不一致，不称为已存在的一致实现。
- 公开作品只有简介时，详情不显示伪造的完整问卷、模型或结论；占位项不显示假的学校、奖项和年份。
- 真实附件未解析时显示“仅保管，尚未解析”；CSV/XLSX通用导入与统计不是本轮完成条件。
- 文本与 Markdown 先安全渲染；默认禁用原始 HTML，外链限制协议，处理生成 HTML 预览时采用受限 iframe 和显式能力白名单。
- 不迁移同页面 `new Function` 执行任意代码的 localRunner。代码查看和执行能力分开，真实 Python 任务仍未具备。

## 10. 全局验收与证据

共同验收编号见 `acceptance-matrix.json`。两案使用相同案例输入、相同窗口和相同能力边界。
每条记录保存源提交、所选方案、输入、实际步骤、预期、结果、截图/下载文件与限制；本次文档只定义验收，不预填 passed。
最优先验证：历史版本准确、改上游后的失效、双标签保存冲突、跨项目旧事件、含漏答的分母、导入备份缺附件、导出保存版。
发布产物为 Vite dist 资源；需要静态 HTTP 服务。旧单 HTML 继续作为固定对照，新单文件离线打包若需要，应单列实现和断网验证，不隐含在普通 build 中。

## 11. 官方工具依据

本轮浏览官方资料核对职责和命令；没有安装或运行新前端依赖。

- [Vue TypeScript说明](https://vuejs.org/guide/typescript/overview.html)：Vue单文件组件的类型检查由vue-tsc承担，不能只凭Vite能转换文件就认定类型通过。
- [Vite入门与兼容要求](https://vite.dev/guide/)：核对运行环境与构建入口；具体所选版本仍检查其engines和依赖关系，不从本机已有Node推定安装成功。
- [Vitest指南](https://vitest.dev/guide/)：作为新项目单元/组件测试工具候选，实际命令以锁定版本的CLI核验。
- [Playwright命令行](https://playwright.dev/docs/test-cli)：指定测试文件和chromium项目执行；配置中必须实际定义相应项目。
