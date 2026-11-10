import { computed, ref } from 'vue'

import { outsourcedCaseApi, type CaseDicts, type OutsourcedCase } from '@/api/outsourcedCases'

const cases = ref<OutsourcedCase[]>([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')

export const caseByProtoId = computed<Record<string, OutsourcedCase>>(() => {
  const map: Record<string, OutsourcedCase> = {}
  for (const item of cases.value) map[item.protoId] = item
  return map
})

export function outsourcedCases(): OutsourcedCase[] {
  return cases.value
}

/** 置顶案例 —— 首页轮播只认这一批（2026-10-22）。 */
export function pinnedOutsourcedCases(): OutsourcedCase[] {
  return cases.value.filter((item) => item.pinned)
}

export function outsourcedCase(protoId: string | null | undefined): OutsourcedCase | null {
  if (!protoId) return null
  return caseByProtoId.value[protoId] ?? null
}

/**
 * 记一次浏览（2026-11-03）：打开案例详情时调用。
 *
 * <p>先在本地 +1 再发请求：计数是统计数据，接口慢或失败都不该拖住详情页；
 * 请求回来后用服务端的真实值覆盖（可能已被别人 +1）。</p>
 *
 * @param protoId 案例编号
 * @returns 自增后的浏览次数；请求失败时退化为本地值
 */
export function recordCaseView(protoId: string | null | undefined): Promise<number> {
  const id = String(protoId ?? '').trim()
  if (!id) return Promise.resolve(0)
  return outsourcedCaseApi
    .addView(id)
    .then((result) => {
      const views = Number(result?.views ?? 0)
      const item = caseByProtoId.value[id]
      if (item && views) item.viewCount = views
      return views
    })
    /* 未登录（401）或接口异常时不编造数字：宁可卡片继续显示真实值，
       也不要在没算上账的时候先 +1 骗用户。 */
    .catch(() => 0)
}

export function hasPublishedCase(protoId: string | null | undefined): boolean {
  const item = outsourcedCase(protoId)
  return !!item && item.status === 'PUBLISHED'
}

/**
 * 最近一次案例库加载失败的原因（空串＝没失败）。
 *
 * 为什么要单独暴露：`loadOutsourcedCases` 把 401 / 404 / 超时一律收进 error 字段，
 * 而此前**没有任何地方读它** —— 于是「后端没起」「接口 404」「未登录」在前端
 * 长得一模一样：详情页四个面板全是占位，用户只看到「什么都没有」。
 * 2026-10-16 定位该现象时就是被这一点拖长了排查。
 */
export function outsourcedCaseError(): string {
  return error.value
}

/* ================= 复现正文按需拉取 =================
   列表接口**不返回正文**（`replayHtml` 恒为空，单条 1.9MB 的首屏代价太大），
   只有 `GET /cases/{protoId}` 才带内容。于是首页「进入演示」过去拿不到正文，
   只能落到写死的内置静态页（文件名一改版就 404，表现为点了没反应）。
   这里按需拉一次并缓存：演示/复现都走它，和后台看到的是同一份最新文件。 */
const replayHtmlCache = new Map<string, string>()
const replayPending = new Map<string, Promise<string>>()

/**
 * 取某案例的复现正文（按需请求详情接口，失败返回空串）。
 *
 * @param protoId 案例编号
 * @returns 复现 HTML；没有复现或请求失败时为空串
 */
export function ensureCaseReplay(protoId: string | null | undefined): Promise<string> {
  const id = String(protoId ?? '').trim()
  if (!id) return Promise.resolve('')
  const cached = replayHtmlCache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)
  const inflight = replayPending.get(id)
  if (inflight) return inflight
  const job = outsourcedCaseApi
    .get(id)
    .then((detail) => {
      const html = String(detail?.replayHtml ?? '')
      replayHtmlCache.set(id, html)
      return html
    })
    .catch(() => '')
    .finally(() => {
      replayPending.delete(id)
    })
  replayPending.set(id, job)
  return job
}

/** 后台改过复现文件后清掉缓存，避免继续演示旧版本 */
export function invalidateCaseReplay(protoId?: string): void {
  if (protoId) {
    replayHtmlCache.delete(String(protoId))
    return
  }
  replayHtmlCache.clear()
}

/** 同一时刻只跑一个列表请求；相同 admin 口径的调用复用同一个 Promise（别让并发调用者拿到「立刻返回」的假结果） */
let loadPromise: Promise<void> | null = null
let loadPromiseAdmin = false
let loadedAdmin: boolean | null = null
/** 首屏那次失败是否已经自动补过（只补一次，避免后端真挂时反复打） */
let autoRetried = false

export function loadOutsourcedCases(admin = false): Promise<void> {
  if (loadPromise) {
    if (loadPromiseAdmin === admin) return loadPromise
    /* 口径不同：排队，等当前这次结束后再按新口径拉一次 */
    return loadPromise.then(() => loadOutsourcedCases(admin))
  }
  if (loaded.value && loadedAdmin === admin) return Promise.resolve()
  // 切换公共/管理列表时，不把上一种口径的数据展示在等待新请求的页面上。
  if (loadedAdmin !== null && loadedAdmin !== admin) {
    cases.value = []
    loaded.value = false
  }
  loading.value = true
  error.value = ''
  loadPromiseAdmin = admin
  loadPromise = (async () => {
    try {
      cases.value = await outsourcedCaseApi.list(admin)
      loaded.value = true
      loadedAdmin = admin
      autoRetried = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : '案例库加载失败'
      /* 首屏这一次失败（冷启动后端、15s 超时、网络抖动）不该让整个会话停在
         兜底题库上 —— 不重试的话首页「精选案例」就一直是内置数据。
         只自动补一次：后端真挂了也不会变成循环打接口。 */
      if (!admin && !autoRetried) {
        autoRetried = true
        /* 不写 window.setTimeout：单测里这段代码在 Node 下跑，没有 window */
        setTimeout(() => {
          void loadOutsourcedCases(admin)
        }, 800)
      }
    } finally {
      loading.value = false
      loadPromise = null
      loadPromiseAdmin = false
    }
  })()
  return loadPromise
}

/**
 * 强制重新加载：先等在飞的这次结束，再发起一次新的。
 * 不能直接走 `loadOutsourcedCases` —— 那会在有请求在飞时把旧结果当成本次结果返回。
 */
export async function reloadOutsourcedCases(admin = false): Promise<void> {
  if (loadPromise) await loadPromise
  loaded.value = false
  /* 手动强制重载：把自动补拉的机会还回去，这次失败仍可补一次 */
  autoRetried = false
  await loadOutsourcedCases(admin)
}

/* ================= 字典缓存 =================
   赛别 / 题型 / 题号由后端 tjdc_case_dict 驱动（加新值只改表，不改前端）。
   案例管理页和后续筛选都可能用到，这里做一次会话级缓存；后端不可用时返回 null，
   由调用方回落到内置的同类清单。 */
let dictsCache: CaseDicts | null = null
let dictsPromise: Promise<CaseDicts | null> | null = null

export async function loadCaseDicts(): Promise<CaseDicts | null> {
  if (dictsCache) return dictsCache
  if (dictsPromise) return dictsPromise
  dictsPromise = outsourcedCaseApi
    .dicts()
    .then((value) => {
      dictsCache = value
      return value
    })
    .catch(() => null)
    .finally(() => {
      dictsPromise = null
    })
  return dictsPromise
}

export function caseDicts(): CaseDicts | null {
  return dictsCache
}

export function invalidateCaseDicts(): void {
  dictsCache = null
}

export function outsourcedCaseState() {
  return { cases, loading, loaded, error, caseByProtoId }
}
