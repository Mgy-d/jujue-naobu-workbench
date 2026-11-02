# F 组件交付：赛事理解编辑组件

更新：2026-10-26。本文件只说明本次交付的组件、契约实现、验证过的操作与仍需 P/BA 处理的部分。不据此宣布正式保存或阶段确认可用。

## 1. 交付物

| 项目 | 内容 |
| --- | --- |
| 文件 | `src/components/research/ResearchDesignEditor.vue`（单文件，无子组件） |
| 挂载方式 | 宿主 `CompetitionUnderstandingHost.vue` 通过 `import.meta.glob` 自动发现，未修改宿主代码 |
| 新增依赖 | 无。只使用 `vue` 与 `styles/tokens.scss` 已有的 CSS 变量 |
| 样式 | `<style scoped>`，青绿体系（`--c-primary` / `--c-line` / `--c-muted` 等），未引入第二套配色 |
| 品牌与字体 | 继承全局 `--font-sans`，未引入 Cal Sans、Inter 等外部字体 |

此前 `D:/tipdmsmyy/scdc/front` 下的 React 版本仅作为交互与字段设计参考，未复制进本仓库，也不参与构建。

## 2. 契约实现

按 `src/types/research-contracts.ts` 的 `ContestEditorProps` 原样实现：

| 项 | 实现 |
| --- | --- |
| props | `context`、`draft`、`readOnly`、`issues`，未增加额外必填 props |
| emits | `update-draft`（整份 draft 覆盖）、`save-request`（仅带 context） |
| 副作用 | 不 `fetch`、不读写 `localStorage`、不访问 Pinia store、不操作 `window` |
| 陈旧事件 | 每次 emit 都带 `{...props.context}` 浅拷贝，不缓存 revision |
| revision | 由外壳递增；组件不自行修改 revision |
| 来源可信度 | 保留 `evidenceStatus` 三态原值，不做前端推断或自动升级 |
| id 生成 | 新增条目用 `crypto.randomUUID()`，前缀 `req-` / `src-` / `unknown-`，保证 `normalizeCompetitionDraft` 的 string 校验通过 |

### 字段覆盖

`background`、`edition`、`group` 直接编辑；`requirements[]`（正文 + `sourceIds` 多选）、`sources[]`（名称 + 定位 + 核对状态）、`unknowns[]`（正文 + `blocksDecision`）均支持增删改。

### 两处必须保留的隐式约束

1. **删除来源时同步摘除要求里的引用**。否则 `checkContestDraft` 会持续报「要求缺少可定位来源」，而界面上已看不到被删的来源，用户无法自解。
2. **只有同时具备名称与定位信息的来源才会出现在勾选列表**，与 `checkContestDraft` 判定可用来源的口径保持一致，避免「能勾上但仍报缺来源」。

## 3. 关键实现决策

### 3.1 同一轮事件循环里的多次编辑合并成一次 emit

外壳以 `localTaskId + revision` 判定事件是否陈旧，而 revision 递增后要等下一次渲染才回到 props。若在同一轮里连续 emit（例如同时改名称与定位、或新增一条后立刻填写），第二次带出去的是旧 revision，会被 `store.updateCompetition` 直接丢弃。

处理方式：编辑先累积成一份完整 draft，用 `queueMicrotask` 合并提交一轮。真实键盘输入本身跨事件循环，不受影响；极端情况（同一 tick 多字段联动）不再丢事件。

### 3.2 合并期间列表编辑以待提交草稿为基准

仅在 emit 层合并还不够：若列表 patch 仍读 `props.draft`，第二次编辑会以旧数组重建，把第一次的改动覆盖回旧值。表现为「两个字段只留下后填的那个」。因此列表编辑统一读 `pendingDraft ?? props.draft`。

### 3.3 提交正式候选前先落盘再取最新 revision

`requestCandidate` 先 `flushDraft()`，再 `await nextTick()`，最后才 emit `save-request`。否则保存请求携带的 revision 比外壳当前的旧，会被宿主判为陈旧请求并提示「忽略了其他任务或旧修订的保存请求」。

## 4. 已验证的操作（2026-10-26，生产构建 + 真实页面）

验证方式：`pnpm build` 通过后在 `pnpm preview`（端口 5181）用 CDP 驱动真实页面操作，清空本机草稿后从空态开始。

| # | 操作 | 结果 |
| --- | --- | --- |
| 1 | 进入 `/#/research/work?mode=full` | 组件自动挂载，初始「待补充 4 项」 |
| 2 | 同一轮填写背景 / 届次 / 组别 | 三项全部生效，状态降为「待补充 1 项」 |
| 3 | 新增来源并同一轮填写名称 + 定位 | 两个字段均保留，未出现覆盖 |
| 4 | 新增要求、填写正文 | 正文生效，行内提示从「正文为空」变为「缺少可定位来源」 |
| 5 | 勾选依据来源 | 勾选成功，状态升为「本机完整」 |
| 6 | 新增未知项、填写正文、标记「影响当前决定」 | 正文与开关均生效，状态按规则变为「待补充 1 项」 |
| 7 | 点击「提交为正式候选」 | 宿主提示「正式项目、候选保存和阶段确认接口尚未接入」，未显示保存成功 |
| 8 | 点击宿主「保存本机草稿」后刷新页面 | 背景/届次/组别、要求正文、来源名称与定位、未知项正文与开关、来源勾选状态全部恢复；无 storageError |
| 9 | 820px 窄屏 | 两栏降为单栏，竖分隔线改为横向分隔，未知项行不错位、无横向溢出 |

构建结果：`vue-tsc -b && vite build` 通过，无类型错误；组件产物 JS 9.54 kB / CSS 6.98 kB（gzip 后 4.08 kB / 1.69 kB）。

## 5. 需要 P 复核或配合的部分

1. **外壳摘要区把 `sourceIds` 直接渲染成 id**。`CompetitionUnderstandingHost.vue` 的「要求与来源」摘要使用 `item.sourceIds.join('、')`，真实 id 是 UUID，页面会出现 `src-0f7df0d7-…` 这样的长串。建议改为按 `sources` 映射出 `title`。这不是组件内能修的问题。
2. **保存动作出现两次**。外壳操作区已有 disabled 的「保存正式候选（待接入）」，组件底部另有「提交为正式候选」（真正 emit `save-request`）。语义不同但并排容易误解，建议去掉外壳那一个占位，或明确二者关系。
3. **只读态未在真实页面构造**。宿主当前不向组件传 `readOnly`，组件内已按 `readOnly` 全量禁用输入、勾选、删除与提交，并显示「只读」标记。请在外壳的只读场景中复核实际表现。
4. **错误态来源单一**。组件只消费 `issues: string[]` 做行内提示与计数；若后续需要显示服务端校验错误（字段级），需要新增契约，当前契约里没有该通道。
5. **`save-request` 之后没有回执**。组件发完请求即结束，接口接入后如需「保存中 / 失败 / 冲突」反馈，需要外壳通过 props 回传状态。

## 6. 本次未覆盖

- 正式项目、候选固定、阶段确认与锁定：接口未接入，组件不表示成功。
- 陈旧事件与跨任务事件拒绝：由外壳逻辑保证，P 的 `ContestEditorFixture` 已覆盖，本组件不重复构造。
- 附件、OCR、赛事通知自动解析：不在本阶段范围。
- 第 2—7 阶段组件：本次只交付第一阶段，按同一契约逐阶段扩展。
