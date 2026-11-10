/**
 * 统一 HTTP 客户端
 *
 * 设计沿用既有范式（跨项目验证过的「难写件」）：
 * - 自动携带 `Authorization: Bearer <access_token>`
 * - 本地预判 token 过期 → 先静默 refresh 再发业务请求
 * - 服务端 401 → refresh 后重放一次（并发请求共享同一次刷新，避免刷爆）
 * - refresh 也失败 → 清空本地会话，交由上层处理
 *
 * ⚠️ 后端未配置 CORS，浏览器直连 :8080 会被跨域拦死。
 *    所有请求必须经 Vite 代理（vite.config.ts 的 `/api` `/agui`）以同源方式发出。
 */

export type AuthMode = 'mock' | 'real'

const rawMode = import.meta.env.VITE_AUTH_MODE as string | undefined
export const AUTH_MODE: AuthMode = rawMode === 'mock' ? 'mock' : 'real'

export const TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'
export const USER_ID_KEY = 'user_id'
export const USER_INFO_KEY = 'user_info'
export const AUTH_CHANGE_EVENT = 'agent-auth-change'
/** 公司双服务沿用上游分通道模式；默认通道保留既有研究身份。 */
export type TokenChannel = 'agent' | 'biz'
export const DUAL_TOKEN = import.meta.env.VITE_DUAL_TOKEN === '1'
export const BUSINESS_AUTH_BASE = '/business-auth'
export const BUSINESS_TOKEN_KEY = 'biz_access_token'
export const BUSINESS_REFRESH_TOKEN_KEY = 'biz_refresh_token'
export const BUSINESS_USER_INFO_KEY = 'biz_user_info'
export const OAUTH_TOKEN_KEY = 'oauth_access_token'
const generations: Record<TokenChannel, number> = {agent: 0, biz: 0}
const channelKey = (channel: TokenChannel) => DUAL_TOKEN ? channel : 'agent'
export function channelOf(path: string): TokenChannel {
  return DUAL_TOKEN && ['/api/tjdc', BUSINESS_AUTH_BASE].some(prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) ? 'biz' : 'agent'
}
export const authSnapshot = (requested: TokenChannel = 'agent') => {
  const channel = channelKey(requested)
  return {channel, access: getAccessToken(channel), refresh: getRefreshToken(channel), generation: generations[channel],
    owner: channel === 'biz' ? getAccessToken() : '', ownerGeneration: channel === 'biz' ? generations.agent : 0}
}
export const sameAuth = (snapshot: ReturnType<typeof authSnapshot>) => {
  const current = authSnapshot(snapshot.channel)
  return Object.keys(current).every(key => current[key as keyof typeof current] === snapshot[key as keyof typeof snapshot])
}
function notifyAuthChange() { if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(AUTH_CHANGE_EVENT)) }

/** 非 2xx 响应统一抛出的错误，`message` 已尽量取后端可读文案 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Token 读写 ─────────────────────────────────────────────────────────────
export const getAccessToken = (channel: TokenChannel = 'agent'): string => localStorage.getItem(channelKey(channel) === 'biz' ? BUSINESS_TOKEN_KEY : TOKEN_KEY) ?? ''
export const getRefreshToken = (channel: TokenChannel = 'agent'): string => localStorage.getItem(channelKey(channel) === 'biz' ? BUSINESS_REFRESH_TOKEN_KEY : REFRESH_TOKEN_KEY) ?? ''
export function saveOAuthToken(token?: string): void { if (token) localStorage.setItem(OAUTH_TOKEN_KEY, token) }
export function saveTokens(accessToken: string, refreshToken: string, requested: TokenChannel = 'agent'): void {
  const channel = channelKey(requested)
  localStorage.setItem(channel === 'biz' ? BUSINESS_TOKEN_KEY : TOKEN_KEY, accessToken)
  const refreshKey = channel === 'biz' ? BUSINESS_REFRESH_TOKEN_KEY : REFRESH_TOKEN_KEY
  if (refreshToken) localStorage.setItem(refreshKey, refreshToken)
  else localStorage.removeItem(refreshKey)
  generations[channel]++
  if (channel === 'agent') notifyAuthChange()
}
export function clearBusinessTokens(): void {
  for (const key of [BUSINESS_TOKEN_KEY, BUSINESS_REFRESH_TOKEN_KEY, BUSINESS_USER_INFO_KEY, OAUTH_TOKEN_KEY]) localStorage.removeItem(key)
  generations.biz++
}
export function clearTokens(): void {
  for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ID_KEY, USER_INFO_KEY]) localStorage.removeItem(key)
  clearBusinessTokens()
  generations.agent++
  notifyAuthChange()
}

/** 解析 JWT 的 exp（秒）为毫秒时间戳；无法解析返回 null（交给服务端 401 兜底） */
export function getAccessTokenExpiryMillis(channel: TokenChannel = 'agent'): number | null {
  const token = getAccessToken(channel)
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    if (typeof payload?.exp === 'number') return payload.exp * 1000
  } catch {
    // token 结构异常 —— 按未知处理，交给 401 兜底
  }
  return null
}

/** 已存 token 且已过期（无 token 或无法解析时返回 false） */
export function isAccessTokenExpired(channel: TokenChannel = 'agent'): boolean {
  const exp = getAccessTokenExpiryMillis(channel)
  if (exp == null) return false
  return Date.now() >= exp
}

// ── 401 / 过期自动刷新 ──────────────────────────────────────────────────────
/** 正在进行的 refresh（并发去重），多个 401 共享同一次刷新 */
type AuthSnapshot = ReturnType<typeof authSnapshot>
const refreshInFlight = new Map<TokenChannel, {snapshot:AuthSnapshot; promise:Promise<AuthSnapshot|null>}>()

async function doRefresh(snapshot:AuthSnapshot): Promise<AuthSnapshot|null> {
  const refreshToken = snapshot.refresh
  if (!refreshToken) return null
  try {
    const tokens = (await rawFetch(snapshot.channel === 'biz' ? BUSINESS_AUTH_BASE + '/refresh' : '/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
      timeoutMs: 10000,
    }).then((res) => {
      if (!res.ok) throw new ApiError(res.status, 'refresh 失败')
      return res.json()
    })) as {
      accessToken: string
      refreshToken?: string
      userId?: string
      username?: string
      role?: string
      permissions?: string[]
      oauthAccessToken?: string
    }
    if (!tokens.accessToken || !sameAuth(snapshot)) return null
    const nextRefresh=tokens.refreshToken ?? refreshToken
    saveTokens(tokens.accessToken, nextRefresh, snapshot.channel)
    const committed=authSnapshot(snapshot.channel)
    if(committed.access!==tokens.accessToken || committed.refresh!==nextRefresh)return null
    if (tokens.oauthAccessToken && snapshot.channel === 'biz') saveOAuthToken(tokens.oauthAccessToken)
    if (tokens.userId) {
      const infoKey = snapshot.channel === 'biz' ? BUSINESS_USER_INFO_KEY : USER_INFO_KEY
      let cached: Record<string, unknown> = {}
      try { cached = JSON.parse(localStorage.getItem(infoKey) || '{}') } catch {}
      if (snapshot.channel === 'agent') localStorage.setItem(USER_ID_KEY, tokens.userId)
      let permissions = tokens.permissions ?? cached.permissions ?? []
      if (snapshot.channel === 'agent' && DUAL_TOKEN) {
        try { permissions = JSON.parse(localStorage.getItem(BUSINESS_USER_INFO_KEY) || '{}').permissions ?? permissions } catch {}
      }
      localStorage.setItem(infoKey, JSON.stringify({...cached, userId: tokens.userId,
        username: tokens.username ?? cached.username ?? '', role: tokens.role ?? cached.role ?? '',
        permissions}))
    }
    return committed
  } catch {
    return null
  }
}

/** 用 refresh_token 换新 access token；失败返回 false（调用方负责清会话） */
function refreshAuth(channel: TokenChannel = 'agent'): Promise<AuthSnapshot|null> {
  const snapshot = authSnapshot(channel), current = refreshInFlight.get(snapshot.channel)
  if (current && sameAuth(current.snapshot)) return current.promise
  const entry = {snapshot, promise: Promise.resolve<AuthSnapshot|null>(null)}
  entry.promise = doRefresh(snapshot).finally(() => {if (refreshInFlight.get(snapshot.channel) === entry) refreshInFlight.delete(snapshot.channel)})
  refreshInFlight.set(snapshot.channel, entry)
  return entry.promise
}
export async function refreshAccessToken(channel: TokenChannel = 'agent'): Promise<boolean> {
  const committed = await refreshAuth(channel)
  return !!committed && sameAuth(committed)
}
export async function ensureFreshToken(channel: TokenChannel = 'agent'): Promise<boolean> {
  const snapshot = authSnapshot(channel), committed = await refreshAuth(channel)
  if (!committed && sameAuth(snapshot)) {
    if (snapshot.channel === 'biz') clearBusinessTokens()
    else clearTokens()
  }
  return !!committed && sameAuth(committed)
}

// ── 请求核心 ────────────────────────────────────────────────────────────────
export interface RequestOptions {
  method?: string
  accept?: string
  body?: unknown
  params?: Record<string, string>
  /** 超时毫秒数；不传则一直等（留给 SSE 之类长连接） */
  timeoutMs?: number
  /** 跳过 Authorization 头（登录/刷新等公开端点） */
  skipAuth?: boolean
  signal?: AbortSignal
  /** multipart 上传：传 FormData 时不要设 Content-Type，浏览器自己带 boundary */
  formData?: FormData
}

function buildHeaders(path: string, hasBody: boolean, skipAuth?: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  if (!skipAuth) {
    const token = getAccessToken(channelOf(path))
    if (channelOf(path) === 'biz' && path.startsWith('/api/tjdc/')) {
      const oauthToken = localStorage.getItem(OAUTH_TOKEN_KEY)
      if (oauthToken) headers['X-OAuth-Token'] = oauthToken
    }
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (hasBody) headers['Content-Type'] = 'application/json'
  return headers
}

/** 后端统一错误体为 { code, message }，同时兼容 FastAPI 风格的 detail */
async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const json = JSON.parse(text) as { message?: unknown; detail?: unknown }
    if (typeof json.message === 'string') return json.message
    if (typeof json.detail === 'string') return json.detail
  } catch {
    // 非 JSON（例如网关 HTML 错误页），回落到原文
  }
  return text || res.statusText || `请求失败（HTTP ${res.status}）`
}

async function rawFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, params, skipAuth, timeoutMs, signal, formData, accept } = options
  const url = new URL(path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = timeoutMs
    ? window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
    : undefined
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(url.toString(), {
      method,
      // multipart 时不设 Content-Type，由浏览器生成 boundary
      headers: { ...(formData ? (skipAuth ? {} : buildHeaders(path, false, skipAuth)) : buildHeaders(path, body !== undefined, skipAuth)), ...(accept ? { Accept: accept } : {}) },
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    })
  } catch (e) {
    // 调用方自己取消的不做包装，原样抛出
    if (!timedOut && e instanceof DOMException && e.name === 'AbortError') throw e
    throw timedOut
      ? new ApiError(408, '请求超时，请确认后端已启动')
      : new ApiError(0, '无法连接后端服务，请确认后端已启动（默认 :8080）')
  } finally {
    if (timer) window.clearTimeout(timer)
  }
}

/** Keep a request associated with the credentials it started with. */
async function authenticatedFetch(path:string, options:RequestOptions):Promise<Response> {
  const channel = channelOf(path)
  const guarded=!options.skipAuth && !path.startsWith('/api/auth/') && !path.startsWith(BUSINESS_AUTH_BASE + '/')
  if (guarded && channel === 'biz' && !getAccessToken('biz')) throw new ApiError(401, '案例与会员登录尚未建立，请退出后重新登录')
  if(guarded && isAccessTokenExpired(channel)){
    if(!(await ensureFreshToken(channel)))throw new ApiError(401,'登录已过期或发生变化，请重新操作')
  }
  let snapshot=authSnapshot(channel)
  let res=await rawFetch(path,options)
  if(guarded && !sameAuth(snapshot))throw new ApiError(401,'登录状态已变化，请重新操作')
  if(guarded && res.status===401){
    if(!(await ensureFreshToken(channel)))throw new ApiError(401,'登录已过期或发生变化，请重新操作')
    snapshot=authSnapshot(channel)
    res=await rawFetch(path,options)
    if(!sameAuth(snapshot))throw new ApiError(401,'登录状态已变化，请重新操作')
  }
  if(!res.ok)throw new ApiError(res.status,await extractErrorMessage(res))
  return res
}

async function request<T>(path:string,options:RequestOptions={}):Promise<T>{
  const res=await authenticatedFetch(path,options)
  if(res.status===204)return undefined as T
  return await res.json() as T
}
async function requestText(path:string,options:RequestOptions={}):Promise<string>{
  const res=await authenticatedFetch(path,options)
  return res.text()
}
export async function httpStream(path:string,body:unknown,signal?:AbortSignal):Promise<Response>{
  return authenticatedFetch(path,{method:'POST',body,signal,accept:'text/event-stream'})
}
export async function httpStreamGet(path:string,signal?:AbortSignal):Promise<Response>{
  return authenticatedFetch(path,{method:'GET',signal})
}

export const http = {
  get: <T>(path: string, params?: Record<string, string>, options?: Omit<RequestOptions, 'method' | 'body' | 'params' | 'formData'>) =>
    request<T>(path, { ...options, method: 'GET', params }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  /** multipart 上传 */
  upload: <T>(path: string, formData: FormData, options?: Omit<RequestOptions, 'method' | 'body' | 'formData'>) =>
    request<T>(path, { ...options, method: 'POST', formData }),
  /** 期望纯文本响应 */
  getText: (path: string, params?: Record<string, string>, options?: Omit<RequestOptions, 'method' | 'body' | 'params' | 'formData'>) =>
    requestText(path, { ...options, method: 'GET', params }),
}

export { rawFetch }
