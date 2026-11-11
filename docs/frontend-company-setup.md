# 公司前端拉取与启动

代码分支：`feature-shidiao-workbench-20261105`。请拉取整个仓库并切换该分支，不要只复制 `src`。

## 安装与启动

按仓库 `pnpm-lock.yaml` 安装依赖：

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.company.example .env.company.local
pnpm dev:company
```

已有 `.env.company.local` 时先核对，勿覆盖个人配置。启动地址为 `http://127.0.0.1:5185/`；端口被占用时脚本报错，不自动切换。

公司模式先只读检查智能体 API；需连接公司网络。当前 `scripts/dev-company.mjs` 的默认服务如下，需由维护者确认对应部署可用：

| 前端入口 | 目标 | 用途 |
| --- | --- | --- |
| `/api`、`/agui` | `192.168.1.245:8084` | 智能体、会话、待答表单、成果及登录 |
| `/api/tjdc`、`/business-auth` | `192.168.1.245:8085` | 市调业务与业务认证；是否已部署各接口需单独核实 |
| `/case-catalog-api`、`/case-files` | `192.168.1.245:8081` | 已授权的数模案例只读展示，会员不共用 |
| `/collection-api` | `127.0.0.1:8090` | 独立问卷、答卷、研究记录存储服务 |
| `/sandbox-api` | `127.0.0.1:8766` | 本机分析沙箱；使用时另行启动 |

前端不直接连接 PostgreSQL。第二后端的源码、数据库凭据、认证配置和部署不包含在本次前端提交里。`127.0.0.1:8090` 指每位开发者自己的电脑，不能自动访问原开发电脑上的服务。公司数据库已存在也不代表问卷服务已启动。

## 地址不同如何配置

`dev:company` 读取下列进程环境变量覆盖默认地址，例如：

```powershell
$env:COMPANY_BACKEND_URL='http://192.168.1.245:8084'
$env:VITE_COLLECTION_TARGET='http://127.0.0.1:8090'
$env:VITE_BACKEND_TARGET_TJDC='http://192.168.1.245:8085'
$env:VITE_BUSINESS_AUTH_TARGET='http://192.168.1.245:8085'
pnpm dev:company
```

这些地址是当前约定，不保证对应服务持续可用。不要把密码、token 或服务器验签密钥填进 `VITE_*`；此类变量可能进入浏览器构建。所有真实凭据和个人 `.env*.local` 均不入库。

## 常见故障

- 连接被拒绝：核对地址、端口与服务进程；前端可启动不等于各后端可访问。
- 404“接口不存在”：核对该入口代理目标和后端版本，不靠重复登录解决。
- 401/403：核对对应服务的账号、登录态与认证配置，不要共享 token。
- 500：保留请求路径、状态码及响应，对照第二后端日志；不要直接判定为数据库故障。
- 历史记录复现读取缺口：旧版本不会自动补造表单答案或文件。可在原研究空闲时重新保存成果记录，补读仍可访问的历史。

## 提交前检查

```powershell
pnpm test
node scripts/check-contract.mjs
pnpm build
python scripts/check_repository.py
```

自动检查及合成页面验证不能替代公司环境真实联调。本次提交未部署后端，也未执行真实审核或统计。
