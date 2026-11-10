import { computed } from 'vue'

import { ALL_PERMISSION_CODES, PERM, hasAllPermissions, type PermissionCode } from '@/config/permissions'
import { useUserStore } from '@/stores/user'

/**
 * 权限判定（对齐 agent-platform 的 `usePermission` / `PermissionGuard` 语义）。
 *
 * <p>判据只有一个：登录时由统一认证下发的 `permissions` 权限码数组。
 * 不看用户名、不看写死的角色名 —— 角色只用于后端接口鉴权，前端显隐一律走码。</p>
 *
 * <p>语义与 agent-platform 保持一致：</p>
 * <ul>
 *   <li>{@link canAll}：全部满足（路由/菜单用它，多码即 AND）；</li>
 *   <li>{@link canAny}：任一满足（少见，用于「两种权限都能进」的兼容场景）。</li>
 * </ul>
 */

/** 缺码告警去重：同一码只提示一次，避免开发期刷屏 */
const warned = new Set<string>()

const userStore = () => useUserStore()

export function usePermission() {
  /** 当前账号持有的权限码（未登录为空数组） */
  const permissions = computed<string[]>(() => {
    const list = userStore().user?.permissions
    return Array.isArray(list) ? list : []
  })

  const isLogged = computed(() => userStore().isLogged)

  /**
   * 单个权限码判定。
   *
   * <p>开发期缺码会给一次 console 提示：线上表现为「菜单/按钮不见了」，
   * 但排查时往往误以为是前端 bug，直接把缺失的码打出来最快。</p>
   */
  function can(code: PermissionCode | string): boolean {
    const granted = permissions.value.includes(code)
    if (!granted && import.meta.env.DEV && permissions.value.length && !warned.has(code)) {
      warned.add(code)
      console.warn(`[permission] 当前账号缺少权限码 ${code}，对应入口已隐藏`)
    }
    return granted
  }

  /** 全部满足（与路由守卫 hasAllPermissions 同一语义） */
  function canAll(codes: readonly (PermissionCode | string)[]): boolean {
    return hasAllPermissions(permissions.value, codes)
  }

  /**
   * 管理端动作判定：**细码命中，或持有 `admin:access`**。
   *
   * 为什么需要兜底：`case:*` / `member:*` 这套细码是后加的，权限中心尚未下发时，
   * 若一律只认细码，现有管理员会瞬间失去案例管理、会员后台的全部操作能力（页面直接空掉）。
   * 这里的语义是「管理员默认全权；细码用于把权限收窄/下放给运营账号」。
   * 等细码在全环境授齐后，把兜底去掉即可获得严格的最小权限模型。
   */
  function canOrAdmin(code: PermissionCode | string): boolean {
    return can(code) || can(PERM.ADMIN_ACCESS)
  }

  /** 任一满足 */
  function canAny(codes: readonly (PermissionCode | string)[]): boolean {
    return codes.length === 0 || codes.some((code) => can(code))
  }

  /** 一个权限码都没有：多为未登录或认证侧未下发，仅用于给页面兜底提示文案 */
  const hasNoPermission = computed(() => permissions.value.length === 0)

  return {
    PERM,
    permissions,
    isLogged,
    can,
    canAll,
    canAny,
    canOrAdmin,
    hasNoPermission,
    /** 清单里的全部码，页面「缺少哪些权限」提示用 */
    allCodes: ALL_PERMISSION_CODES,
  }
}
