# 公司电脑拉取与运行

本说明对应前端分支 `feature-shidiao-workbench-20261105`。公司 GitLab 与个人 GitHub 的本次交付使用同一提交。

## 1. 拉取前端

准备 Node.js 20 或更新版本、兼容 lockfile v9 的 pnpm 和 Git。以下 PowerShell 示例将项目放在 D:/Codex 下，也可使用自己的开发目录。

```powershell
New-Item -ItemType Directory -Path D:/Codex/projects -Force
Set-Location D:/Codex/projects
git clone --branch feature-shidiao-workbench-20261105 http://gitlab.tipdm.net/tipdm/agents-frontend/scdc.git
Set-Location scdc
pnpm install --frozen-lockfile
Copy-Item .env.company.example .env.company.local
```

已有本机配置时先核对，避免覆盖自己的 `.env.company.local`。按实际环境编辑其中的接口地址，保存后启动。

## 2. 连接公司智能体

电脑需能访问公司接口网关。当前脚本默认使用 http://192.168.1.245:8084，若网关变化，在启动前设置 COMPANY_BACKEND_URL。

```powershell
$env:COMPANY_BACKEND_URL = 'http://192.168.1.245:8084'
pnpm dev:company
```

打开 http://localhost:5185/，使用自己的公司账号登录。脚本先检查接口可达性，检查成功后启动 Vite。失败时按错误核对内网连接、地址与权限。

智能体名称和编号见 `src/config/researchAgent.ts`。当前默认名称为“市调演真”，如公司部署使用其他编号，在 `.env.company.local` 设置 `VITE_SZ_AGENT_NAME` 和 `VITE_SZ_AGENT_ID` 后重启。

普通 `pnpm dev` 不等于公司联调入口，其配置可能仍指向本机后端。

## 3. 连接问卷收集服务

问卷发布、匿名填写、答卷管理依赖独立的 agents-backend-tjdc 服务。服务代码已在公司仓库分支 `feature-shidiao-survey-collection`，提交 `11f6a4c`。

如果负责人已经部署好服务，在 `.env.company.local` 中将 `VITE_COLLECTION_TARGET` 设为该服务地址，例如 http://服务电脑地址:8090，随后重启前端。前端通过 `/collection-api` 代理访问它。

服务负责人需要配置 PostgreSQL、Redis、服务可访问地址，以及与公司平台匹配的认证配置。当前实现使用服务端 `TJDC_JWT_SECRET` 验证平台令牌。该值仅配置在后端环境中，通过公司安全渠道提供，不能写进前端文件或 Git。

若自己启动后端，参考后端仓库 README 和 docs/collection-integration.md。需要 Java 21、Maven 和 Docker 或可访问的 PostgreSQL/Redis。

本机一键开发入口为 `pnpm dev:all`，仅用于本机问卷服务。需先设置 `TJDC_BACKEND_DIR` 为自己拉取的后端目录，并在后端环境配置认证。脚本默认路径是原开发电脑路径，不同电脑应显式覆盖。公司共用问卷服务时使用 `pnpm dev:company`。

## 4. 数据与权限

- 浏览器任务草稿和本机复现记录保存在当前浏览器，Git 拉取不会带走原开发电脑的草稿。
- 智能体对话和文件由公司平台按账号与会话权限读取。
- 已发布问卷、答卷和分析快照保存在问卷服务的数据库。共用数据需要连接同一服务，并具备对应账号权限。
- 首次验收请使用明确标注的合成题目和资料。统计执行仍需人工确认。
- 受访者通过已发布问卷的独立链接填写。让其他内网电脑访问时，需要站点和采集服务实际可达，不能分享 localhost 链接。

## 5. 检查和部署

```powershell
pnpm test
node scripts/check-contract.mjs
pnpm build
python scripts/check_repository.py
```

2026-11-05 本地前端回归 338 项通过，类型检查和构建通过；这是本机代码验证记录。另一台公司电脑的真实登录、智能体交互及问卷服务连接仍需在其环境验收。

正式站点由负责人部署 `dist`，为 `/api`、`/agui` 和 `/collection-api` 配置反向代理。Vite 开发代理不会随 `dist` 自动部署。独立沙箱 `/sandbox-api` 仍需部署其对应服务。

提交源码、锁文件、样例配置和必要静态资源。真实 `.env`、密码、令牌、数据库、node_modules、dist、浏览器草稿和运行日志保留在各自环境。
