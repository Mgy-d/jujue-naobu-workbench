/**
 * 调查演易权限码（单一事实来源）。
 *
 * <p>码值与 `agents-backend-tjdc/docs/tjdc-权限码清单.xlsx` 一一对应，格式
 * `域:动作[:子动作]`。**整个前端只有这一个文件允许出现权限码字面量**：
 * 路由 meta、菜单注册表、页面按钮全部用 `PERM.*` 引用，改码只改这里，
 * 与 agent-platform 的 `navigation.ts` / 后端 `@RequirePermission` 保持同一套口径。</p>
 *
 * <p>判定语义（与 agent-platform 一致）：一个入口挂多个码时用 `every()`（全部满足），
 * 不是「或」。本文件里的注册表刻意做到「每个入口只挂一个码」，避免歧义。</p>
 */

export const PERM = {
  // ── 案例管理 ────────────────────────────────────────────────
  CASE_MENU: 'case:menu',
  CASE_CREATE: 'case:create',
  CASE_UPDATE: 'case:update',
  CASE_DELETE: 'case:delete',
  CASE_PIN: 'case:pin',
  CASE_COVER_UPLOAD: 'case:cover:upload',
  CASE_COVER_GENERATE: 'case:cover:generate',
  CASE_DICT_UPDATE: 'case:dict:update',

  // ── 会员中心（用户自助） ────────────────────────────────────
  MEMBER_MENU: 'member:menu',
  MEMBER_PAPER_UNLOCK: 'member:paper:unlock',
  MEMBER_WORK_CHARGE: 'member:work:charge',
  MEMBER_RECHARGE_APPLY: 'member:recharge:apply',
  MEMBER_INVITE_BIND: 'member:invite:bind',
  MEMBER_COMMISSION_WITHDRAW: 'member:commission:withdraw',

  // ── 团队额度 ────────────────────────────────────────────────
  TEAM_MENU: 'team:menu',
  TEAM_JOIN: 'team:join',
  TEAM_ALLOCATE: 'team:allocate',
  TEAM_ALLOCATE_AVERAGE: 'team:allocate:average',
  TEAM_MEMBER_REMOVE: 'team:member:remove',
  TEAM_QUOTA_APPLY: 'team:quota:apply',

  // ── 会员管理后台（管理端总入口沿用平台既有 admin:access） ────
  ADMIN_ACCESS: 'admin:access',
  MEMBER_LEDGER_VIEW: 'member:ledger:view',
  MEMBER_LEDGER_GRANT: 'member:ledger:grant',
  MEMBER_RULE_VIEW: 'member:rule:view',
  MEMBER_RULE_UPDATE: 'member:rule:update',
  MEMBER_INVITE_VIEW: 'member:invite:view',
  MEMBER_COMMISSION_VIEW: 'member:commission:view',
  MEMBER_RECHARGE_VIEW: 'member:recharge:view',
  MEMBER_RECHARGE_REVIEW: 'member:recharge:review',
  MEMBER_TEAM_VIEW: 'member:team:view',
  MEMBER_TEAM_CREATE: 'member:team:create',
  MEMBER_TEAM_REVIEW: 'member:team:review',
  MEMBER_LOG_VIEW: 'member:log:view',

  // ── 我的成果 ────────────────────────────────────────────────
  ACHIEVEMENT_MENU: 'achievement:menu',
  ACHIEVEMENT_DELETE: 'achievement:delete',
  ACHIEVEMENT_DELETED_VIEW: 'achievement:deleted:view',

  // ── 沙箱工作台 ──────────────────────────────────────────────
  SANDBOX_MENU: 'sandbox:menu',
  SANDBOX_RUN: 'sandbox:run',
  SANDBOX_INTERRUPT: 'sandbox:interrupt',
  SANDBOX_RESET: 'sandbox:reset',
  SANDBOX_WORKSPACE: 'sandbox:workspace',
} as const

export type PermissionCode = (typeof PERM)[keyof typeof PERM]

/** 清单里的全部权限码（用于「权限体系是否已下发」的自检告警，不做放行判定） */
export const ALL_PERMISSION_CODES: PermissionCode[] = Object.values(PERM)

/**
 * 纯函数版判定，供路由守卫等拿不到组件上下文的地方使用，
 * 语义必须与 `usePermission().canAll` 完全一致（都走「全部满足」）。
 *
 * @param granted 当前账号持有的权限码
 * @param codes   入口要求的权限码（空数组 = 不限制）
 */
export function hasAllPermissions(
  granted: readonly string[] | null | undefined,
  codes: readonly string[],
): boolean {
  if (codes.length === 0) return true
  const list = granted ?? []
  return codes.every((code) => list.includes(code))
}

/**
 * 站点顶部导航注册表 —— 全站唯一来源。
 * `permissions` 为空表示公开/仅需登录；有码则由权限码决定显隐。
 */
export interface SiteNavItem {
  /** 路由名 */
  name: string
  label: string
  /** 需要的权限码（多个 = 全部满足） */
  permissions: PermissionCode[]
  /** 是否要求已登录（公开页不填） */
  requiresLogin?: boolean
}

export const SITE_NAV: SiteNavItem[] = [
  { name: 'home', label: '首页', permissions: [] },
  /**
   * 用户端页面**不挂菜单码**，登录即可用。
   *
   * 教训（2026-11-03）：先前这里挂了 `achievement:menu` / `team:menu`，结果权限中心
   * 尚未给账号下发这两个码时，登录后顶栏只剩「首页」，看起来像"登录后权限全丢"。
   * 用户端页面本来就该对所有登录用户开放（清单里这些码是 P1/P2 预留级），
   * 真正需要管控的是管理端入口与资金相关动作。
   */
  { name: 'mine', label: '我的成果', permissions: [], requiresLogin: true },
  { name: 'survey-management', label: '问卷管理', permissions: [], requiresLogin: true },
  /** 管理端入口沿用平台既有的 admin:access（案例页内的按钮再按 case:* 细分） */
  { name: 'case-admin', label: '案例管理', permissions: [PERM.ADMIN_ACCESS], requiresLogin: true },
  { name: 'member-team', label: '团队管理', permissions: [], requiresLogin: true },
]

/** 账号下拉里的「后台管理」入口 */
export const ADMIN_CONSOLE_ENTRY: SiteNavItem = {
  name: 'member-admin',
  label: '后台管理',
  permissions: [PERM.ADMIN_ACCESS],
  requiresLogin: true,
}
