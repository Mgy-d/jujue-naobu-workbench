import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { ApiError,authSnapshot,sameAuth } from '@/api/http'
import { INSUFFICIENT_STATUS, memberApi, type MemberOverview } from '@/api/member'

/**
 * 会员积分状态。
 *
 * 只缓存"会跨页面复用"的东西：余额、价格、已购权益。
 * 流水 / 订单 / 佣金这些只在各自页面用一次，页面内自己拉，不往全局塞。
 */
export const useMemberStore = defineStore('member', () => {
  const overview = ref<MemberOverview | null>(null)
  const loading = ref(false)
  const error = ref('')
  /** 最近一次"余额不足"的提示，供积分墙展示 */
  const lastShortfall = ref<{ need: number; balance: number; message: string } | null>(null)

  const balance = computed(() => overview.value?.balance ?? 0)
  const pricePaper = computed(() => overview.value?.pricePaper ?? 50)
  const priceNew = computed(() => overview.value?.priceNew ?? 800)
  const inviteCode = computed(() => overview.value?.inviteCode ?? '')
  const ownedPapers = computed(() => new Set(overview.value?.ownedPapers ?? []))
  const chargedWorks = computed(() => new Set(overview.value?.chargedWorks ?? []))

  let generation=0
  let loadPromise: Promise<void> | null = null

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    const auth=authSnapshot(),currentGeneration=generation
    try {
      const result=await memberApi.overview()
      if(currentGeneration!==generation || !sameAuth(auth))return
      overview.value = result
    } catch (e) {
      if(currentGeneration!==generation || !sameAuth(auth))return
      error.value = e instanceof Error ? e.message : '积分信息加载失败'
    } finally {
      if(currentGeneration===generation)loading.value = false
    }
  }

  /** 并发调用复用同一次请求（导航栏、页面挂载常同时触发）。 */
  function ensureLoaded(): Promise<void> {
    if (overview.value) return Promise.resolve()
    if (!loadPromise) {
      const current=refresh().finally(() => {if(loadPromise===current)loadPromise=null})
      loadPromise=current
    }
    return loadPromise
  }

  /** 登录态变化后必须清缓存，否则会看到上一个账号的余额。 */
  function reset(): void {
    generation++;loadPromise=null;loading.value=false
    overview.value = null
    error.value = ''
    lastShortfall.value = null
  }

  function applyBalance(next: number): void {
    if (overview.value) overview.value = { ...overview.value, balance: next }
  }

  function markPaperOwned(paperId: string): void {
    if (!overview.value) return
    if (overview.value.ownedPapers.includes(paperId)) return
    overview.value = { ...overview.value, ownedPapers: [...overview.value.ownedPapers, paperId] }
  }

  function markWorkCharged(workKey: string): void {
    if (!overview.value) return
    if (overview.value.chargedWorks.includes(workKey)) return
    overview.value = { ...overview.value, chargedWorks: [...overview.value.chargedWorks, workKey] }
  }

  /**
   * 统一处理计费接口的失败：402 表示余额不足，转成积分墙需要的结构。
   * 其它错误继续抛给调用方。
   */
  function captureShortfall(e: unknown, price: number): boolean {
    if (e instanceof ApiError && e.status === INSUFFICIENT_STATUS) {
      lastShortfall.value = { need: price, balance: balance.value, message: e.message }
      return true
    }
    return false
  }

  /**
   * 确保某道真题已解锁（买断）：已购直接放行，未购调计费接口。
   *
   * 余额不足（402）时写入 lastShortfall 并返回 false，由调用方拦截进入。
   * 其它错误同样返回 false——闸门宁紧勿松，但错误信息已落到 lastShortfall/error。
   */
  async function ensurePaperUnlocked(paperId: string): Promise<boolean> {
    if (ownedPapers.value.has(paperId)) return true
    await ensureLoaded()
    if (ownedPapers.value.has(paperId)) return true
    try {
      const result = await memberApi.unlockPaper(paperId)
      applyBalance(result.balance)
      markPaperOwned(paperId)
      return true
    } catch (e) {
      captureShortfall(e, pricePaper.value)
      if (!(e instanceof ApiError && e.status === INSUFFICIENT_STATUS)) {
        error.value = e instanceof Error ? e.message : '解锁失败'
      }
      return false
    }
  }

  /**
   * 确保某道新题已扣过费（进入拆解闸门）：已扣直接放行，未扣调计费接口。
   *
   * 口径与 ensurePaperUnlocked 一致：402 落 lastShortfall，其余错误落 error。
   */
  async function ensureWorkCharged(workKey: string): Promise<boolean> {
    if (chargedWorks.value.has(workKey)) return true
    await ensureLoaded()
    if (chargedWorks.value.has(workKey)) return true
    try {
      const result = await memberApi.chargeWork(workKey)
      applyBalance(result.balance)
      markWorkCharged(workKey)
      return true
    } catch (e) {
      captureShortfall(e, priceNew.value)
      if (!(e instanceof ApiError && e.status === INSUFFICIENT_STATUS)) {
        error.value = e instanceof Error ? e.message : '扣费失败'
      }
      return false
    }
  }

  return {
    overview,
    loading,
    error,
    balance,
    pricePaper,
    priceNew,
    inviteCode,
    ownedPapers,
    chargedWorks,
    lastShortfall,
    refresh,
    ensureLoaded,
    reset,
    applyBalance,
    markPaperOwned,
    markWorkCharged,
    captureShortfall,
    ensurePaperUnlocked,
    ensureWorkCharged,
  }
})
