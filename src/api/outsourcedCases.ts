import { http } from '@/api/http'

export const READ_ONLY_CASE_CATALOG = import.meta.env.VITE_CASE_CATALOG_MODE === 'smyy-readonly'
const publicCaseBase = READ_ONLY_CASE_CATALOG ? '/case-catalog-api' : '/api/tjdc'

export type CaseSection = 'guide' | 'animation' | 'code' | 'result' | 'replay'

/** 成果分类：论文（默认）/ 表格 / 代码 / 图片 / 数据文件 / 题目附件（2026-10-26 增加 attachment）。 */
export type ResultCategory = 'paper' | 'table' | 'code' | 'image' | 'data'

/**
 * 成果文件条目。
 *
 * 三种形态（与后端 TjdcOutsourcedCaseService#applyResultFiles 对齐）：
 * - 文本：{ name, category, kind:'text', text } —— HTML / TXT / MD
 * - 二进制新上传：{ name, category, kind:'binary', token } —— PDF / Word / Excel / 图片
 * - 已存在（编辑回环）：{ name, category, kind, path, url, size }
 */
export interface CaseResultFile {
  name: string
  category?: ResultCategory
  kind?: 'text' | 'binary'
  text?: string
  token?: string
  path?: string
  url?: string
  size?: number
  mime?: string
  missing?: boolean
}

/** 二进制成果暂存上传的返回（token 提交案例时带回）。 */
export interface StagedCaseAsset {
  token: string
  name: string
  category: ResultCategory
  size: number
  mime: string
}

/**
 * 案例库行（后端 CaseView 的 1:1 映射）。
 *
 * 2026-10-22 对齐 agents-backend-tjdc：
 * - 元数据从「标签字符串」拆成结构化字段 year / category / problemType / problemCode；
 * - tag 仍保留（后端从 entries 子表 entry_key='tag' 读出），但现在由前端按元数据自动拼；
 * - pinned 决定它进不进首页轮播；summary 保留在库里但案例管理不再让手填。
 */
export interface OutsourcedCase {
  id: string
  protoId: string
  slug: string
  title: string
  tag: string | null
  category: string | null
  year: string | null
  problemType: string | null
  problemCode: string | null
  summary: string | null
  /** 封面：已归一化成可直接用的 URL（/case-files/... 或 /hero-assets/...），可能为空。 */
  coverImage: string | null
  pinned: boolean
  /** 浏览次数：详情页每打开一次 +1，首页卡片展示「N 次浏览」 */
  viewCount: number
  source: string
  status: 'DRAFT' | 'PUBLISHED' | 'BLANK'
  guideHtml: string | null
  animationHtml: string | null
  animationSegmentsJson: string | null
  codeText: string | null
  resultHtml: string | null
  replayHtml: string | null
  guideFileName: string | null
  guideFilesJson: string | null
  animationFileName: string | null
  codeFileName: string | null
  codeFilesJson: string | null
  resultFileName: string | null
  resultFilesJson: string | null
  replayFileName: string | null
  /** 题目附件清单 [{"name","path","url","size","kind"}]，落盘在 <protoId>/attachments/ */
  attachmentFilesJson: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface CaseSectionInput {
  guide?: string | null
  animation?: string | null
  code?: string | null
  result?: string | null
  replay?: string | null
  /** 复现 HTML 的上传原名：后端落盘时用它当文件名（不再自动重命名）。 */
  replayFileName?: string | null
  animationSegments?: string | null
  guideFiles?: string | null
  codeFiles?: string | null
  resultFiles?: string | null
  /** 题目附件集合（2026-10-26）：与成果同一套三种条目形态（token / text / path）。 */
  attachmentFiles?: string | null
}

/** 提交 / 编辑案例的请求体。新建时 protoId 传 'auto'，编号由后端按顺序分配。 */
export interface CaseUpsertInput {
  protoId: string
  title: string
  tag?: string | null
  year: string
  category: string
  problemType: string
  problemCode?: string | null
  summary?: string | null
  /** 封面路径；不传表示不改动已有封面。 */
  coverImage?: string | null
  pinned?: boolean
  sections: CaseSectionInput
}

/** 赛别 / 题型 / 题号字典 + 年份区间（下限 1985，上限由服务器当前年份决定）。 */
export interface CaseDicts {
  categories: string[]
  problemTypes: string[]
  problemCodes: string[]
  yearMin: number
  yearMax: number
}

export const outsourcedCaseApi = {
  list: async (admin = false) => {
    const path = admin ? '/api/tjdc/admin/cases' : publicCaseBase + '/cases'
    /* 案例库是首页首屏数据，不能等默认的 60 秒：15 秒拿不到就让调用方回落内置题库 */
    return (await http.get<{ items: OutsourcedCase[]; total: number }>(path, undefined, { timeoutMs: 15_000, skipAuth: READ_ONLY_CASE_CATALOG && !admin })).items
  },
  get: (protoId: string) => http.get<OutsourcedCase>(`${publicCaseBase}/cases/${encodeURIComponent(protoId)}`, undefined, {skipAuth: READ_ONLY_CASE_CATALOG}),
  /**
   * 浏览次数 +1：打开案例详情时调用。
   *
   * <p>单独一个写接口，不走 `get`：详情接口还会被「进演示 / 复现」复用，
   * 用读接口计数会把预览也算成浏览。</p>
   */
  addView: (protoId: string) =>
    READ_ONLY_CASE_CATALOG ? Promise.resolve({protoId, views: 0}) : http.post<{ protoId: string; views: number }>(
      `/api/tjdc/cases/${encodeURIComponent(protoId)}/view`,
      undefined,
      { timeoutMs: 8_000 },
    ),
  dicts: () => http.get<CaseDicts>(publicCaseBase + '/case-dicts', undefined, {skipAuth: READ_ONLY_CASE_CATALOG}),
  upsert: (data: CaseUpsertInput) => http.post<OutsourcedCase>('/api/tjdc/admin/cases', data, { timeoutMs: 300_000 }),
  /**
   * 二进制文件暂存上传（PDF / Word / Excel / 图片 / 题目附件）。
   * 返回 token，提交案例时放进对应板块条目；后端 upsert 时搬到案例目录。
   * `attachment` 是题目附件专用分类，落盘到 <protoId>/attachments/（不套分类子目录）。
   */
  uploadResultAsset: (file: File, category: ResultCategory | 'attachment') => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('category', category)
    return http.upload<StagedCaseAsset>('/api/tjdc/admin/case-assets', fd)
  },
  replaceSection: (protoId: string, section: CaseSection, content: string | null) =>
    http.put<OutsourcedCase>(`/api/tjdc/admin/cases/${encodeURIComponent(protoId)}/sections/${section}`, { content }, { timeoutMs: 300_000 }),
  /** 置顶开关：只动 pinned，不涨版本号、不碰内容文件。
   *  显式 15s 超时：http 的业务请求默认没有超时，一旦请求挂住，
   *  页面里的 pinBusy 会一直非空，按钮点下去全部静默无反应。 */
  pin: (protoId: string, pinned: boolean) =>
    http.put<OutsourcedCase>(`/api/tjdc/admin/cases/${encodeURIComponent(protoId)}/pin`, { pinned }, { timeoutMs: 15000 }),
  /** 删除：后端连带删 entries 子表与 public/cases/<protoId> 目录。 */
  remove: (protoId: string) => http.delete<void>(`/api/tjdc/admin/cases/${encodeURIComponent(protoId)}`),

  /* ── 封面（2026-10-26）──────────────────────────────────────────
     封面此前一直是「前端硬编码 + 静态图兜底」，后端 /covers 从来没有实现过。
     现在 DB 有 cover_image 列，两条写入通道：手动上传、调生图模型重新生成。 */

  /** 上传一张本地图片作为封面，落盘 <protoId>/cover/ 并更新 DB。 */
  uploadCover: (protoId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    return http.upload<OutsourcedCase>(`/api/tjdc/admin/cases/${encodeURIComponent(protoId)}/cover`, fd)
  },

  /** 调后端生图模型重新生成封面（同步慢请求，给 5 分钟）。 */
  generateCover: (protoId: string) =>
    http.post<OutsourcedCase>(
      `/api/tjdc/admin/cases/${encodeURIComponent(protoId)}/cover/generate`,
      {},
      { timeoutMs: 300_000 },
    ),

  /** 生图能力是否已配置（未配置时按钮置灰并给出原因）。 */
  coverAvailable: () =>
    http.get<{ available: boolean; hint: string }>('/api/tjdc/admin/cover-available', undefined, {
      timeoutMs: 10_000,
    }),
}
