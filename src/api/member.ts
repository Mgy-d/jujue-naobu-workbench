import { http } from '@/api/http'

/**
 * 会员体系接口（积分制）。
 *
 * 口径见 docs/20261031-会员体系需求说明.md：
 *   注册 +100 / 邀请双方各 +100 / 真题 −50（买断）/ 新题 −800（一次性）
 *   充值 1 元 = 10 积分 / 首充佣金 ¥20 + 200 积分 / 续充 6%
 *
 * 全部走业务 token（`/api/tjdc/**` 不在 AGENT_PATH_PREFIXES 里），
 * 因此未登录时由路由守卫拦在页面外，这里不再重复判登录。
 */

const BASE = '/api/tjdc/member'
const ADMIN = '/api/tjdc/admin/member'

export interface MemberOverview {
  balance: number
  earned: number
  spent: number
  frozen: number
  inviteCode: string
  pricePaper: number
  priceNew: number
  ownedPapers: string[]
  chargedWorks: string[]
}

export interface LedgerItem {
  id: string
  type: string
  delta: number
  /** 团队额度侧的消耗（负数）；团队额度支付时 delta 为 0、这里才是实际扣的积分 */
  teamDelta: number
  balanceAfter: number
  remark: string | null
  createdAt: string
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface RechargeOrder {
  id: string
  /** 后台列表才有：下单用户 */
  userId?: string
  /** 后台列表才有：下单用户姓名（取团队成员名 / 账户显示名，可能为空串） */
  userName?: string
  amountCny: number
  points: number
  /** PENDING 待支付/待审批 / PAID 已到账 / REJECTED 已驳回 / REFUNDED 已退款 */
  status: string
  /** 支付渠道：有值说明是渠道支付单，为空是人工审批单 */
  payChannel?: string | null
  /** 渠道交易号，对账用 */
  transactionId?: string | null
  /** 到账来源：CHANNEL 渠道回调 / ADMIN 人工审批 */
  paidBy?: string | null
  /** 支付超时时间 */
  payExpiredAt?: string | null
  createdAt: string
}

/** 可用支付渠道（后端按配置下发，未启用的渠道不会出现） */
export interface PayChannelOption {
  code: string
  label: string
  hint: string
}

/** 发起支付后的支付参数：支付宝给 payUrl，微信给 qrCode */
export interface PayParams {
  orderId: string
  outTradeNo: string
  channel: string
  amountCny: number
  points: number
  payUrl: string | null
  qrCode: string | null
  hint: string
  expiresAt: string
}

export interface PayStatus {
  orderId: string
  status: string
  points: number
  balance: number
  payChannel: string | null
  transactionId: string | null
  paidAt: string
}

export interface InviteInfo {
  code: string
  invited: number
  monthInvited: number
  monthCap: number
  monthRemaining: number
  bonusPerPerson: number
  shareText: string
}

export interface CommissionItem {
  id: string
  type: string
  amount: number
  status: string
  unfreezeAt: string | null
  createdAt: string
}

export interface CommissionInfo {
  able: number
  frozen: number
  paid: number
  withdrawTimesThisMonth: number
  withdrawMonthLimit: number
  withdrawMin: number
  records: CommissionItem[]
}

export interface WithdrawRecord {
  id: string
  amount: number
  taxAmount: number
  status: string
  createdAt: string
}

export interface TeamMember {
  id: string
  userId: string
  name: string | null
  studentNo: string | null
  role: 'member' | 'team_admin'
  quota: number
  used: number
  remaining: number
}

export interface TeamInfo {
  id: string | null
  name: string
  inviteCode: string
  adminUserId: string
  term: string | null
  quotaTotal: number
  pool: number
  quotaUsed: number
  allocated: number
  mode: 'member' | 'leader' | 'platform'
  me: TeamMember | null
  members: TeamMember[]
}

export interface QuotaApplication {
  id: string
  teamId?: string
  quota: number
  purpose: string
  contact?: string | null
  status: string
  expectDate?: string | null
  createdAt: string
}

/** 后台团队列表行：额度申请审批要靠 teamId 拼出团队名称/邀请码 */
export interface AdminTeamRow {
  id: string
  name: string
  inviteCode: string
  quotaTotal: number
  pool: number
  quotaUsed: number
  adminUserId: string
  /** 管理员用户名（后端按 adminUserId 反查；查不到时为空，前端回落到 ID） */
  adminName?: string
}

export interface RuleItem {
  key: string
  value: number
  min: number
  max: number
  label: string
  remark: string | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface AdminSummary {
  totalGranted: number
  totalSpent: number
  pending: number
  manualOps: number
  monthInvited: number
  inviteGranted: number
  blockedInvites: number
  pendingInvites: number
  pendingApplications: number
  commissionCount: number
}

/** 后端 402 + INSUFFICIENT_POINTS 表示余额不足，前端据此弹积分墙。 */
export const INSUFFICIENT_STATUS = 402

export const memberApi = {
  overview: () => http.get<MemberOverview>(`${BASE}/overview`),

  ledger: (page = 0, size = 20) =>
    http.get<PageResult<LedgerItem>>(`${BASE}/ledger`, { page: String(page), size: String(size) }),

  rules: () => http.get<Record<string, number>>(`${BASE}/rules`),

  unlockPaper: (paperId: string) =>
    http.post<{ unlocked: boolean; balance: number; price: number; alreadyOwned: boolean }>(
      `${BASE}/paper/${encodeURIComponent(paperId)}/unlock`,
    ),

  chargeWork: (workKey: string) =>
    http.post<{ charged: boolean; balance: number; price: number; alreadyCharged: boolean }>(
      `${BASE}/work/charge`,
      { workKey },
    ),

  /** 提交充值申请：只建单，不直接到账，等平台管理员审批 */
  createOrder: (amountCny: number) =>
    http.post<RechargeOrder>(`${BASE}/recharge/orders`, { amountCny }),

  /** 可用支付渠道：返回空数组表示在线支付未启用，退回人工审批流程 */
  rechargeChannels: () => http.get<PayChannelOption[]>(`${BASE}/recharge/channels`),

  /** 发起支付：拿到收银台链接或二维码内容，积分要等回调/查单确认后才到账 */
  prepay: (orderId: string, channel: string) =>
    http.post<PayParams>(`${BASE}/recharge/orders/${encodeURIComponent(orderId)}/pay`, { channel }),

  /** 轮询支付状态：未支付时后端会顺带向渠道查一次单 */
  payStatus: (orderId: string) =>
    http.get<PayStatus>(`${BASE}/recharge/orders/${encodeURIComponent(orderId)}/pay-status`),

  orders: (page = 0, size = 20) =>
    http.get<PageResult<RechargeOrder>>(`${BASE}/recharge/orders`, {
      page: String(page),
      size: String(size),
    }),

  invite: () => http.get<InviteInfo>(`${BASE}/invite`),

  bindInvite: (code: string) =>
    http.post<{ rewarded: boolean; inviterCode: string; message: string }>(`${BASE}/invite/bind`, { code }),

  commission: () => http.get<CommissionInfo>(`${BASE}/commission`),

  withdraw: () =>
    http.post<WithdrawRecord>(`${BASE}/withdraw`),

  withdrawRecords: () => http.get<WithdrawRecord[]>(`${BASE}/withdraw/records`),

  team: () => http.get<TeamInfo>(`${BASE}/team`),

  joinTeam: (inviteCode: string, name?: string) =>
    http.post<TeamMember>(`${BASE}/team/join`, { inviteCode, name }),

  allocate: (memberId: string, quota: number) =>
    http.post<TeamMember>(`${BASE}/team/allocate`, { memberId, quota }),

  allocateAverage: (teamId: string) =>
    http.post<TeamMember[]>(`${BASE}/team/allocate-average`, { teamId }),

  removeMember: (memberId: string) =>
    http.delete<void>(`${BASE}/team/members/${encodeURIComponent(memberId)}`),

  myApplications: () => http.get<QuotaApplication[]>(`${BASE}/team/applications`),

  applyQuota: (payload: {
    quota: number
    purpose: string
    contact?: string
    expectDate?: string
    note?: string
  }) => http.post<{ id: string; status: string }>(`${BASE}/team/applications`, payload),
}

export const memberAdminApi = {
  summary: () => http.get<AdminSummary>(`${ADMIN}/summary`),

  /** 后台流水类型（与后端 TjdcMemberService 的 type 常量一一对应），供查询下拉使用 */
  ledgerTypes: [
    '注册赠送',
    '邀请赠送',
    '充值获得',
    '真题练习消耗',
    '新题演易消耗',
    '人工调账',
  ] as string[],

  /** 后台台账：分页 + 可选筛选（用户 ID 前缀、流水类型），空串表示不过滤 */
  ledger: (page = 0, size = 10, userId = '', type = '') =>
    http.get<{ items: (LedgerItem & { userId: string; operator: string | null })[]; total: number }>(
      `${ADMIN}/ledger`,
      { page: String(page), size: String(size), userId, type },
    ),

  grant: (payload: { userId: string; points: number; reason: string; type?: string; requestId: string }) =>
    http.post<{ userId: string; balance: number }>(`${ADMIN}/grant`, payload),

  rules: () => http.get<RuleItem[]>(`${ADMIN}/rules`),

  updateRule: (key: string, value: number, reason: string) =>
    http.put<RuleItem>(`${ADMIN}/rules/${encodeURIComponent(key)}`, { value, reason }),

  invites: (page = 0, size = 50) =>
    http.get<{ items: Record<string, string>[]; total: number }>(`${ADMIN}/invites`, {
      page: String(page),
      size: String(size),
    }),

  commissions: (page = 0, size = 50) =>
    http.get<{ items: Record<string, string>[]; total: number }>(`${ADMIN}/commissions`, {
      page: String(page),
      size: String(size),
    }),

  logs: (page = 0, size = 50) =>
    http.get<{ items: Record<string, string>[]; total: number }>(`${ADMIN}/logs`, {
      page: String(page),
      size: String(size),
    }),

  teams: () => http.get<AdminTeamRow[]>(`${ADMIN}/teams`),

  /** adminUser 可填用户名或用户 ID，后端按用户名解析 */
  createTeam: (payload: { name: string; adminUser: string; term?: string; quotaTotal: number }) =>
    http.post<{ id: string; inviteCode: string }>(`${ADMIN}/teams`, payload),

  /** 充值申请列表：status 为空表示全部，默认只看待审批 */
  rechargeOrders: (status = 'PENDING', page = 0, size = 50) =>
    http.get<{ items: RechargeOrder[]; total: number }>(`${ADMIN}/recharge-orders`, {
      status,
      page: String(page),
      size: String(size),
    }),

  /** 审批充值申请：通过即入账，驳回只改状态 */
  reviewRecharge: (id: string, approve: boolean) =>
    http.post<RechargeOrder>(`${ADMIN}/recharge-orders/${encodeURIComponent(id)}/review`, {
      approve,
    }),

  applications: () => http.get<QuotaApplication[]>(`${ADMIN}/team-applications`),

  review: (id: string, approve: boolean) =>
    http.post<QuotaApplication>(`${ADMIN}/team-applications/${encodeURIComponent(id)}/review`, {
      approve,
    }),
}
