/**
 * 认证接口 —— 对接 agent-platform 的 AuthController（/api/auth/*）
 *
 * 复用沙箱模块已有的 http 客户端（`@/api/http`）：
 * 它已经是完整范式 —— JWT exp 本地预判、401 静默刷新、并发刷新去重、
 * httpStream 长连接。这里不再造第二个客户端，否则两套 token 状态会打架。
 *
 * 后端契约（2026-09-28 实测取证）：
 *   POST /api/auth/login    { username, password }  → { accessToken, refreshToken, userId, role, permissions[] }
 *   GET  /api/auth/me                                → { userId, username, role }
 *   POST /api/auth/refresh  { refreshToken }         → 同 login
 *   POST /api/auth/logout                            → 204
 *   目标 Java 后端 JWT 为 HS256，access token 默认有效期 30 分钟（可通过后端配置覆盖）。
 */

import { http, saveTokens, authSnapshot, sameAuth, USER_ID_KEY, USER_INFO_KEY, DUAL_TOKEN, BUSINESS_AUTH_BASE, BUSINESS_USER_INFO_KEY, clearTokens, saveOAuthToken } from '@/api/http'

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType?: string
  userId: string
  /** 后端登录响应里带用户名；refresh 响应可能不带 */
  username?: string
  role: string
  permissions?: string[]
  oauthAccessToken?: string
}

export interface UserInfoResponse {
  userId: string
  username: string
  role: string
  createdAt?: string
  permissions?: string[]
}

/** 注册接口返回用户信息，不返回 access/refresh token。 */
export interface RegisterResponse {
  userId?: string | null
  username?: string | null
  role?: string | null
  createdAt?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  permissions?: string[] | null
}

/** 登录/刷新成功后落盘：token 与用户信息分开存，会话恢复时先读后者 */
function persist(tokens: TokenResponse): void {
  saveTokens(tokens.accessToken, tokens.refreshToken)
  const username = tokens.username ?? ''
  localStorage.setItem(USER_ID_KEY, tokens.userId)
  localStorage.setItem(
    USER_INFO_KEY,
    JSON.stringify({ userId: tokens.userId, username, role: tokens.role, permissions: tokens.permissions ?? [] }),
  )
}

export const authApi = {
  /** 两侧并行验证；默认身份仍为智能体身份，不迁移既有研究归属。 */
  async login(username: string, password: string): Promise<TokenResponse> {
    clearTokens()
    const snapshot = authSnapshot()
    const aliasTarget = import.meta.env.DEV && username.trim() === 'admin'
      ? (import.meta.env.VITE_LOCAL_LOGIN_ALIAS_TARGET as string | undefined)?.trim() : undefined
    const payload = {username: aliasTarget || username, password}
    const login = (path: string) => http.post<TokenResponse>(path, payload, {skipAuth: true, timeoutMs: 10000})
    const [agent, business] = await Promise.allSettled([
      login('/api/auth/login'), DUAL_TOKEN ? login(BUSINESS_AUTH_BASE + '/login') : Promise.resolve(null),
    ])
    if (!sameAuth(snapshot)) throw new Error('登录状态已变化，请重新操作')
    if (agent.status === 'rejected') throw new Error('智能体服务登录失败：' + (agent.reason instanceof Error ? agent.reason.message : '请稍后重试'))
    if (!agent.value.accessToken) throw new Error('智能体服务未返回登录凭据')
    // 不以另一侧凭据兜底，避免把不兼容的身份发往错误服务。
    if (business.status === 'rejected') throw new Error('案例与会员服务登录失败：' + (business.reason instanceof Error ? business.reason.message : '请稍后重试'))
    if (DUAL_TOKEN && !business.value?.accessToken) throw new Error('案例与会员服务未返回登录凭据')
    const tokens = {...agent.value, permissions: business.value?.permissions ?? agent.value.permissions}
    if (business.value) {
      saveTokens(business.value.accessToken, business.value.refreshToken, 'biz')
      saveOAuthToken(business.value.oauthAccessToken)
      localStorage.setItem(BUSINESS_USER_INFO_KEY, JSON.stringify({
        userId: business.value.userId, username: business.value.username || username,
        role: business.value.role, permissions: business.value.permissions ?? [],
      }))
    }
    persist(tokens)
    return tokens
  },

  /** 当前登录用户信息（需 token；用于刷新页面后校验会话是否还有效） */
  me: () => http.get<UserInfoResponse>('/api/auth/me', undefined, { timeoutMs: 10000 }),

  /** 用 refresh_token 换新 token。http 层已封装自动刷新，这里供会话恢复手动调用 */
  async refresh(): Promise<TokenResponse> {
    const snapshot = authSnapshot()
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) throw new Error('无 refresh_token')
    const tokens = await http.post<TokenResponse>(
      '/api/auth/refresh',
      { refreshToken },
      { skipAuth: true, timeoutMs: 10000 },
    )
    if (!sameAuth(snapshot)) throw new Error('登录状态已变化，请重新操作')
    // 研究端刷新只更新研究身份，业务权限仍取业务侧登录结果。
    if (DUAL_TOKEN) {
      try { tokens.permissions = JSON.parse(localStorage.getItem(BUSINESS_USER_INFO_KEY) || '{}').permissions ?? tokens.permissions } catch {}
    }
    persist(tokens)
    return tokens
  },

  /** 同时退出两侧；在发出请求后立即清凭据，晚返回不能恢复登录。 */
  async logout(): Promise<void> {
    const requests = [http.post<void>('/api/auth/logout', undefined, {timeoutMs: 5000})]
    if (DUAL_TOKEN) requests.push(http.post<void>(BUSINESS_AUTH_BASE + '/logout', undefined, {timeoutMs: 5000}))
    clearTokens()
    await Promise.allSettled(requests)
  },

  /* ── 以下端点来自 kuaike 登录框架，**尚未对 agent-platform 实测** ──────────
     登录四件套（login / me / refresh / logout）是实测过的；注册与找回密码
     这一组沿用 kuaike 的契约（同平台家族）。若 agent-platform 没实装，
     调用会抛后端返回的可读错误并原样显示在表单上 —— 属于显式失败，
     不是静默失败。要启用前建议先 `curl` 一次确认。 */

  /** 发送手机号验证码（注册用） */
  sendPhoneCode: (phone: string) =>
    http.get<number>(`/api/users/captcha/phone/${phone}`, { type: 'register' }, { skipAuth: true, timeoutMs: 10000 }),

  /** 发送邮箱验证码（注册用） */
  sendEmailCode: (email: string) =>
    http.get<number>(`/api/users/captcha/email/${email}`, { type: 'register' }, { skipAuth: true, timeoutMs: 10000 }),

  /** 忘记密码：发送重置验证码（手机号或邮箱，统一账号框） */
  sendForgetCode: (principal: string) =>
    http.get<number>(`/api/users/captcha/forgot/${principal}`, { type: 'forgot' }, { skipAuth: true, timeoutMs: 10000 }),

  /** 公开注册；principal 传用户名/手机号/邮箱，手机号与邮箱需带 captcha */
  register: (
    principal: string,
    password: string,
    opts: { registerType?: string; captcha?: string } = {},
  ) =>
    http.post<RegisterResponse>(
      '/api/users/register',
      { principal, password, registerType: opts.registerType, captcha: opts.captcha },
      { skipAuth: true, timeoutMs: 10000 },
    ),

  /** 登录态修改自己的密码 */
  changePassword: (oldPassword: string, newPassword: string) =>
    http.post<void>('/api/users/password', { oldPassword, newPassword }),

  /** 未登录态重置密码（手机号/邮箱 + 验证码） */
  forgotPassword: (principal: string, newPassword: string, captcha: string) =>
    http.post<void>(
      '/api/users/password/forgot',
      { principal, password: newPassword, captcha },
      { skipAuth: true, timeoutMs: 10000 },
    ),
}
