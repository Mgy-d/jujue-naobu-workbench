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
let authGeneration = 0
export const authSnapshot = () => ({access:getAccessToken(), refresh:getRefreshToken(), generation:authGeneration})
export const sameAuth = (s:ReturnType<typeof authSnapshot>) => s.generation===authGeneration && s.access===getAccessToken() && s.refresh===getRefreshToken()
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
export const getAccessToken = (): string => localStorage.getItem(TOKEN_KEY) ?? ''
export const getRefreshToken = (): string => localStorage.getItem(REFRESH_TOKEN_KEY) ?? ''

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  authGeneration++
  notifyAuthChange()
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(USER_INFO_KEY)
  authGeneration++
  notifyAuthChange()
}

/** 解析 JWT 的 exp（秒）为毫秒时间戳；无法解析返回 null（交给服务端 401 兜底） */
export function getAccessTokenExpiryMillis(): number | null {
  const token = getAccessToken()
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
export function isAccessTokenExpired(): boolean {
  const exp = getAccessTokenExpiryMillis()
  if (exp == null) return false
  return Date.now() >= exp
}

// ── 401 / 过期自动刷新 ──────────────────────────────────────────────────────
/** 正在进行的 refresh（并发去重），多个 401 共享同一次刷新 */
type AuthSnapshot = ReturnType<typeof authSnapshot>
let refreshInFlight: {snapshot:AuthSnapshot; promise:Promise<AuthSnapshot|null>} | null = null

async function doRefresh(snapshot:AuthSnapshot): Promise<AuthSnapshot|null> {
  const refreshToken = snapshot.refresh
  if (!refreshToken) return null
  try {
    const tokens = (await rawFetch('/api/auth/refresh', {
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
    }
    if (!tokens.accessToken || !sameAuth(snapshot)) return null
    const nextRefresh=tokens.refreshToken ?? refreshToken
    saveTokens(tokens.accessToken, nextRefresh)
    const committed=authSnapshot()
    if(committed.access!==tokens.accessToken || committed.refresh!==nextRefresh)return null
    if (tokens.userId) {
      localStorage.setItem(USER_ID_KEY, tokens.userId)
      localStorage.setItem(
        USER_INFO_KEY,
        JSON.stringify({
          userId: tokens.userId,
          username: tokens.username ?? '',
          role: tokens.role ?? '',
        }),
      )
    }
    return committed
  } catch {
    return null
  }
}

/** 用 refresh_token 换新 access token；失败返回 false（调用方负责清会话） */
function refreshAuth():Promise<AuthSnapshot|null> {
  const snapshot=authSnapshot()
  if(refreshInFlight && sameAuth(refreshInFlight.snapshot))return refreshInFlight.promise
  const entry={snapshot,promise:Promise.resolve<AuthSnapshot|null>(null)}
  entry.promise=doRefresh(snapshot).finally(()=>{if(refreshInFlight===entry)refreshInFlight=null})
  refreshInFlight=entry
  return entry.promise
}
export async function refreshAccessToken():Promise<boolean>{
  const committed=await refreshAuth()
  return !!committed && sameAuth(committed)
}
export async function ensureFreshToken():Promise<boolean>{
  const snapshot=authSnapshot()
  const committed=await refreshAuth()
  if(!committed && sameAuth(snapshot))clearTokens()
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

function buildHeaders(hasBody: boolean, skipAuth?: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  if (!skipAuth) {
    const token = getAccessToken()
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
      headers: { ...(formData ? (skipAuth ? {} : buildHeaders(false, skipAuth)) : buildHeaders(body !== undefined, skipAuth)), ...(accept ? { Accept: accept } : {}) },
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
  const guarded=!options.skipAuth && !path.startsWith('/api/auth/')
  if(guarded && isAccessTokenExpired()){
    if(!(await ensureFreshToken()))throw new ApiError(401,'登录已过期或发生变化，请重新操作')
  }
  let snapshot=authSnapshot()
  let res=await rawFetch(path,options)
  if(guarded && !sameAuth(snapshot))throw new ApiError(401,'登录状态已变化，请重新操作')
  if(guarded && res.status===401){
    if(!(await ensureFreshToken()))throw new ApiError(401,'登录已过期或发生变化，请重新操作')
    snapshot=authSnapshot()
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
