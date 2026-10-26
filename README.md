# 市调演真前端

在数模演易 Vue/Vite 外壳上逐步接入市调功能。实际开发目录是 `D:/scdc-develop`，本目录直接由 Git 管理；GitHub 仓库为 `Mgy-d/jujue-naobu-workbench`。通过功能分支、提交和 PR 管理源码，无需另拷贝一份 frontend 快照。

## 本地启动

使用 Node.js 20+ 与 pnpm，按 `pnpm-lock.yaml` 安装依赖：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认端口 5181。需要后端时，参照 `.env.example` 设置本机 `.env.local`；不要提交凭据。`VITE_AUTH_MODE=mock` 和 `VITE_SANDBOX_MODE=mock` 只供前端演示，不能证明真实接口可用。

## 当前接入范围

首页进入 `/#/research/work` 完整研究工作台，按七阶段承载业务，新任务从赛事理解开始。`?mode=questionnaire` 是已有问卷独立入口；`?mode=analysis` 是已有答卷／数据分析独立入口，历史 `/#/research/intake` 保留跳转到数据分析。三类任务和同类多份本机草稿分别保存，流程类型不随入口切换而改变。查看阶段不代表正式推进。

赛事理解已接入 F 交付的正式编辑组件，可填写背景、届次/组别、要求、来源与未知项，并完成本机保存、任务切换和刷新恢复。`/#/dev/research/contest` 仅在开发模式提供合成事件样例和错误／只读验证；加 `?editor=delivered` 可检查实际交付组件，不进入生产构建。项目创建、正式候选保存、G0 检查及确认仍等待 BA 真实接口，不猜测 URL 或显示成功。接线与交接说明见 `docs/research-first-stage.md`。

数据分析入口保留 CSV/XLSX 上传、解析、描述统计、受限 Python、运行反馈和固定候选结果下载。运行引用按本机任务保存；请求发出后切换页面，返回的登记仍写回原任务。文件正文和访问令牌不写入草稿目录；本机候选不等于业务项目／版本保存。

前端与分析服务分别启动：网页导航依赖前端进程；解析、统计和运行依赖本机沙箱。启动后可以连续测试，无需每次重启。停止前端后，已打开首页可能仍能显示，但首次进入工作台所需的页面文件无法加载。

独立服务源码在 `D:/Codex/workspace/市场调研大赛/services/research-sandbox`，按其 README 准备 Docker 与固定运行依赖，运行 `start.ps1` 后检查 `http://127.0.0.1:8766/sandbox-api/health` 的 ready。页面使用本机访问令牌连接；不要将令牌写入 URL、截图或提交。

开发地址为 `http://127.0.0.1:5181/#/`。5182 仅在显式启动预览时可用；不同端口的浏览器草稿和连接信息分别保存，不要因为测试而随意切换用户正在使用的地址。验收结束只清理本轮专属进程，不停止用户正在使用的服务；留下服务地址、健康状态和是否保持运行的交接记录。

本机 CSV/XLSX 页面链路、容器资源边界与专属 API 强杀恢复已有实际验收；一次 Docker 启动延迟触发超时的记录仍保留，不能据单次通过宣称持续稳定。本机保存的结果是待审候选，不代表正式业务采纳。

主要接线：`src/views/ResearchWorkspaceView.vue`、`src/views/ResearchSandboxView.vue`、`src/api/researchSandbox.ts`、`src/stores/research.ts`、`src/types/research-contracts.ts` 和 `src/utils/researchDrafts.ts`（保留旧 `research-intake.js` 迁移读取）。旧数模原型在 `/#/legacy/prototype`；保留其 DOM 契约，不从市调入口误调用旧智能体。

## 检查

```sh
pnpm test
node scripts/check-contract.mjs
pnpm build
python scripts/check_repository.py
```

`scripts/port` 和 `scripts/sandbox` 中的历史探针依赖各自的浏览器、后端或本机样本，不是上述默认测试入口。真实附件、会话样本已忽略，缺样本的探针不能视作可复现验收。不要运行历史外壳生成器覆盖手工接线。

代码、锁文件、必要静态资源与迁移配置进入仓库；密钥、原始调查数据、运行态、截图、验证构建及本机配置不进入仓库。`public/cases` 为原外壳随包发布的静态示例资源，不能代表真实后端执行结果。

稳定版本规则见 `VERSIONS.md`。当前分支通过检查不等于真实业务闭环验收；正式项目/版本保存、身份权限桥接和团队部署仍需对应后端与环境交付；本机沙箱的通过范围见独立服务验收文档。
