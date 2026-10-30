# public/cases/ —— 案例静态资源（按案例分目录）

每个案例一个目录：`public/cases/<protoId>/`，里面放该案例专属的动画与截图。

```
public/cases/
├── p1/anims/          中药材热风烘干过程的热湿耦合建模（2026 国赛 A 题）
├── p2/anims/          无线电干扰源的快速自动定位与清除（2026 国赛 B 题）
├── p3/anims/          微网与外部电网的电力调控策略（2026 国赛 C 题）
│   └── anim-shots/    演示缩略图 0..4.png
└── p5/anims/          SEM 广告投放策略优化（2026 国赛 E 题）
    ├── anims/         emod-0..4.html + emod.html
    └── anim-shots/    演示缩略图 0..4.png
```

## protoId 对照表

| protoId | 标题 | DB slug | 动画前缀 |
|---|---|---|---|
| p1 | 中药材热风烘干过程的热湿耦合建模 | `case-p1` | `mod-p1-` |
| p2 | 无线电干扰源的快速自动定位与清除 | `radio-interference-localization` | `rid-` |
| p3 | 微网与外部电网的电力调控策略 | `microgrid-power-dispatch` | `mod-` |
| p4 | 用频装备的时频冲突检测与消解 | —（未入库） | 兜底 `mod-` |
| p5 | SEM 广告投放策略优化 | `sem-ad-optimization`（BLANK） | `emod-` |
| p6 | 智能手机电池耗电建模 | —（未入库） | 兜底 `mod-` |
| p7 | 太空电梯系统建立月球殖民地 | `space-elevator-moon` | 无动画 |
| p8 | 舞动明星的数据洞察 | —（未入库） | 兜底 `mod-` |
| p9 | 成功的体育管理 | —（未入库） | 兜底 `mod-` |

> p2 已接线：`setAnimSet()` 有 `pid==='p2'` 分支，5 段动画（`rid-0..4.html`）已作为
> `animation_segments_json` 入库；指导书 / 代码 / 成果在库里留空，前端渲染成「尚未录入」占位。

## 代码里的两处约定

路由在 `src/legacy/prototype/core.ts` 的 `setAnimSet(pid)` 里，进题时按 pid 同时切换三样东西，三者必须同源：

```ts
ANIM_PREFIX_CUR   // 文件名前缀，如 'emod-'
ANIM_DIR_CUR      // 案例目录名，如 'p5'
ANIM_SHOT_CUR     // 截图 URL 表
```

运行时拼出：`'./cases/' + ANIM_DIR_CUR + '/anims/' + ANIM_PREFIX_CUR + k + '.html'`

## ⚠️ 两个已知问题（本次整理时发现，未擅自修改）

1. **p4/p6~p9 没有自己的动画**，全部走 `else` 兜底分支，实际加载的是 p3 的 `mod-*.html`。这是既有行为，不是本次改动引入的——但语义上是错的，需要时得逐个补。
2. **p2 的 `rid-*.html` 做好了但没接线**：`setAnimSet()` 里没有 `pid==='p2'` 分支，`'rid-'` 前缀从未被使用。文件先放在 `p2/anims/` 待接线，接上只需在 `setAnimSet()` 里加一个分支。

## 新增一个案例要做什么

1. 建 `public/cases/<protoId>/anims/`，动画命名沿用统一前缀 `<prefix>-0..N.html`
2. 在 `setAnimSet()` 里加分支，同时设 `ANIM_PREFIX_CUR` 和 `ANIM_DIR_CUR`
3. 有截图就建 `anim-shots/`，并加对应的 `ANIM_SHOT_*` 表

## 注意

管理员在【案例管理】上传的内容**不在这里**，存在数据库 `smyy_outsourced_cases` 表里（`guide_html` / `animation_html` / `code_text` / `result_html`）。本目录只放随代码发布的种子/内置资源，两者不冲突。
