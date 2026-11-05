# 任务 3a 在副本的落地（B3 等价：阶段就绪度三档）

> 日期 2026-10-29 · 接手人 CodeBuddy · 分支 `feat/research-intake` · 基线＝副本（最新）
> 关联任务：3a「B3 起步：A5 修复（DataAnalysisHost.vue 行数留空按 0 登记）」。

## 一、A5 在副本的处置：N/A，不实施

A5 的原意（本地旧基线）：`DataAnalysisHost.vue` 数据集登记表单的「行数」字段留空时报错拒绝，改为「留空按 0 登记」。

核查结论：**副本没有 A5 的落点**，故跳过、不改动：
- 副本阶段 5 已改用真实沙箱 `ResearchSandboxView.vue`（上传/解析文件得到行数），不存在手动「行数」输入框；全仓搜索 `rowCount` / `registerDataset` / 任何手动行数登记字段均为 0 命中。
- 副本的后期阶段草稿 `CollectionDraft` / `ReportDraft` 全是文本字段，无数值计数。
- 空值兜底在副本已天然具备：`researchDrafts.ts` 的 `emptyCollectionDraft()` / `emptyReportDraft()` / `stringDraft()` 保证草稿永远是非空字符串默认值；新任务默认初始化，旧数据格式异常时 `cleanTask` 直接返回 `null` 失败关闭（不会以 `undefined` 渲染崩溃）。

> 即「空值按 0 / 默认」的防护在副本已存在，无需再改。

## 二、B3 等价项：阶段就绪度三档（实际落点）

本地 B3 是「数据可行性三档（ok / risky / blocked，基于变量尺度与样本量）」。副本已无该分析子系统（被真实沙箱取代），但其精神——**对阶段给出一致的就绪度判断、避免把未完成的阶段误认为完整**——直接映射到副本现有的后期阶段宿主 `ResearchLaterStageHost.vue`（阶段 4 正式调查发布准备、阶段 6 报告与答辩），这两个阶段此前**完全没有就绪度判定**。

### 2.1 纯函数 `precheckLaterStageReadiness`
位置：`src/utils/researchDrafts.ts`

```ts
export type ReadinessLevel = 'ok' | 'risky' | 'blocked';
export interface StageReadiness { level: ReadinessLevel; reasons: string[]; }
export function precheckLaterStageReadiness(task: LocalResearchTask, phase: number): StageReadiness
```

判定规则（只读 task，无副作用；缺字段一律按空处理，不臆造后端或默认数字）：

| 阶段 | 依据字段 | ok | risky | blocked |
|---|---|---|---|---|
| 阶段 4 正式调查发布准备（full-study, viewedPhase=4） | `collection`：channel / audience / startNote / stopRule | 四字段均非空 | 部分填写 | 全部为空 |
| 阶段 6 报告与答辩（full-study, viewedPhase=6） | `report`：body / sourceNotes / defenseNotes ＋ 是否关联 `sandboxRef` | 三字段均填 **且** 已关联本机分析结果 | 任一内容缺失，或未关联 sandboxRef | 三字段全空 |
| 非 full-study 入口 | — | — | — | blocked |

阶段 6 复用既有约束：`ResearchLaterStageHost` 原本就提示「尚未关联本机分析结果；不能把未执行的统计写成已验证结论」，现被正式纳入 readiness 的 `risky` 理由。

### 2.2 渲染
`src/views/research/researchLaterStageHost.vue`：在 `<section class="later-stage">` 顶部新增就绪度徽标（`.readiness--ok/risky/blocked` 三色）＋ 待补清单 `reasons`。阶段 4 / 6 共用同一 computed，无需分别维护。

## 三、验证（本环境实跑）
- IDE lint：0 错误。
- `vue-tsc -b`：0 类型错误（exit 0）。
- `vite build`：成功（exit 0），`dist/` 产物含新组件与 `researchDrafts` 分块；仅 Sass legacy JS API 弃用告警（既有、非本次引入）。
- 单测：`tests/research-later-readiness.test.mjs`（3 条，全过）——覆盖阶段 4 的 blocked/risky/ok、阶段 6 的「未关联 sandbox 不算就绪」、非 full-study 返回 blocked。

> 单测加载用 `fileURLToPath(new URL(...))` 而非 `.pathname`，以兼容测试目录含中文「副本」与空格时的 URL 编码路径（`node --test` 下 esbuild 才能正确解析）。

## 四、不在本次范围
- A5 字面修复（无目标，跳过并本文明注）。
- 不触碰 `ResearchSandboxView`（阶段 5 真实沙箱，无手动数值字段）。
- 未引入任何后端契约或 AI 能力；纯前端、加行、复用既有字段。

## 五、你本地走查路径
```bash
cd "scdc-develop - 副本"
pnpm dev
```
进入完整研究 → 查看阶段 5 之后的「正式调查」（阶段 4）或「报告与答辩」（阶段 6），顶部应显示三色就绪度徽标与待补清单；填写对应字段后徽标在 blocked/risky/ok 间切换。
