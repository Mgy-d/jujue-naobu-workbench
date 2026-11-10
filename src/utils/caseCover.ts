/**
 * 案例封面的统一取图逻辑。
 *
 * 封面有两条来源，优先级由高到低：
 *   1) 库里的 `cover_image` —— 管理员在案例管理里上传，或生图模型生成，落盘在服务器内容根
 *      `<protoId>/cover/`，通过 `/case-files/...` 访问。**目前绝大多数案例都是 NULL。**
 *   2) 内置静态封面 `public/cases/pN/cover/cover.jpg` —— 随前端构建发布，不依赖后端，
 *      本地与线上表现一致。11 个案例齐备（900×600 JPEG，单张 40–100KB）。
 *
 * 为什么需要这一层：案例管理页原来只读 `item.coverImage`（即库字段），库为空就直接显示
 * 「无封面」；而首页走的是原型 `BASE_PROBLEMS` 的 `coverFallback`，所以同一张卡片在首页
 * 有图、在案例管理里没图。两边统一走这里之后不会再出现这种错位。
 *
 * ⚠ 案例编号漂移的兜底：2026-10-26 时库编号是 p1–p7/p9–p12，p8 空着，
 * 与星共舞（DWTS）顶在 p12；而静态封面是按题库编号放的。别名把 p12 指回 p8，
 * 让它在重排完成前也能出图。编号归位后别名自然闲置，不需要删。
 */

/** 编号 / slug → 题库编号。首页（core.ts）与案例管理共用这一份，避免两处漂移。 */
export const CASE_COVER_ALIAS: Record<string, string> = {
  p12: 'p8',
  dwts: 'p8',
  'case-p12': 'p8',
}

/** 已随前端发布静态封面的编号。不在表内的编号不猜路径，免得每次渲染白打一个 404。 */
const STATIC_COVER_IDS = new Set([
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
  'p9',
  'p10',
  'p11',
])

/**
 * 把 `public/` 下的相对资源拼成最终 URL。
 *
 * 不能直接写死 `/cases/...`：`vite.config.ts` 是 `base: './'`（为子目录部署准备），
 * 写死站内绝对路径在 `https://host/tjdc/` 这种部署下会指向 `https://host/cases/...` 而 404。
 * 这里沿用 `pythonRunner.ts` 的同一套写法：`BASE_URL` + `document.baseURI` 解析。
 */
function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const joined = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  if (typeof document === 'undefined') return joined
  try {
    return new URL(joined, document.baseURI).href
  } catch {
    return joined
  }
}

/** 把 protoId / slug 归一化成题库编号（p8 这种）；无法识别时返回空串。 */
export function normalizeCaseId(protoId?: string | null, slug?: string | null): string {
  const raw = (protoId || '').trim().toLowerCase()
  const slugKey = (slug || '').trim().toLowerCase()
  const mapped = CASE_COVER_ALIAS[raw] || CASE_COVER_ALIAS[slugKey] || raw
  return /^p\d+$/.test(mapped) ? mapped : ''
}

/**
 * 内置静态封面 URL；该编号没有静态封面时返回空串。
 * 直接给 `<img src>` 用（已按部署路径解析成绝对地址）。
 */
export function staticCaseCover(protoId?: string | null, slug?: string | null): string {
  const id = normalizeCaseId(protoId, slug)
  if (!id || !STATIC_COVER_IDS.has(id)) return ''
  return publicUrl(`cases/${id}/cover/cover.jpg`)
}

/**
 * 取某案例最终该显示的封面。
 * 库里有就用库里的（管理员上传/生图，优先级最高），否则回落到静态图，都没有返回空串。
 */
export function caseCoverOf(item: {
  protoId?: string | null
  slug?: string | null
  coverImage?: string | null
}): string {
  const stored = (item.coverImage || '').trim()
  if (stored) return stored
  return staticCaseCover(item.protoId, item.slug)
}

/** 这批静态封面是否覆盖该案例（用于给「当前展示的是内置封面」这类提示做判断）。 */
export function hasStaticCaseCover(protoId?: string | null, slug?: string | null): boolean {
  return !!staticCaseCover(protoId, slug)
}
