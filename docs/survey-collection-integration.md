# 问卷发布与答卷管理接入

后端与运行说明见 D:/Codex/projects/agents-backend-tjdc/docs/collection-integration.md。

## 页面与入口

- 现有问卷弹窗新增发布表单，默认合成验收，填写批次与用途说明后发布。
- 首页和我的成果导航新增问卷管理。
- /survey/:code 是独立免登录填写路由，使用已发布版本和匿名浏览器凭证。
- /research/surveys 提供登录后批次选择、答卷查看、时间筛选、关闭收集和CSV导出。
- 全部答卷快照需先查看数量并人工确认，再交付原研究G3。

## 复用与身份

QuestionnaireFillPreview 新增 collecting 和 submit 事件，默认模式仍为本机试填。
questionnaire-contract 与 researchAgentQuestionnaire 保留题号、选项码、量表标签。
researchCollection 通过 /collection-api 访问独立服务，管理请求携带当前平台token，匿名请求 skipAuth。
401提供采集服务验签配置提示，不删除平台登录。
快照采用原始字节计算SHA-256，避免UTF8 BOM改变校验值。

## 发布与运行限制

真实发布需要采集服务的 TJDC_JWT_SECRET 与平台签发方一致。
本机当前验收服务使用随机合成测试密钥，不能直接验收公司账号发布。
修改同版本题面会被服务端拒绝，需要智能体修订后提供新版本。
暂不支持的题型、跳转及扩展选项规则会阻止发布。
管理页交付G3需要该浏览器仍保存来源任务与会话绑定。
所有统计执行保持单独确认。

## IDEA 一键启动

在前端项目的运行配置中选择“市调演真 · 一键启动”，或在前端目录执行 npm run dev:all。
本机配置文件为 .run/Survey-All.run.xml，该目录已被 Git 忽略。

首次使用，在 IDEA“运行 → 编辑配置 → 市调演真 · 一键启动 → 环境变量”中设置 TJDC_JWT_SECRET。
该密钥由平台负责人提供并与公司签发方匹配。不要填写合成测试密钥用于公司账号，也不要提交密钥。
后端默认路径为 D:/Codex/projects/agents-backend-tjdc，可用 TJDC_BACKEND_DIR 覆盖。

入口检查公司网络和本机依赖，复用已有容器及健康的采集服务，再启动前端。
Docker Desktop 需要先打开。Docker 引擎不可用、端口冲突、密钥缺失时会输出具体原因。
已有容器沿用实际映射端口，新容器使用现有 Compose 定义，不重建已有容器。
停止 IDEA 运行时，会结束本次入口新启动的程序进程，数据库容器与已有服务继续保留。

只检查环境可执行 npm run dev:all -- --check，查看帮助可执行 npm run dev:all -- --help。