import { builtinProblem } from '@/data/problemStatement'
import { outsourcedCase } from '@/stores/outsourcedCases'

/**
 * 案例编号 → 真题名称。
 *
 * 台账备注里后端写的是编号（`解锁真题：p2`），直接摆给用户看没有意义，也看不出
 * 这 50 分花在哪道题上。这里统一换成案例标题：先查案例库（库是事实来源），
 * 再退到内置题面登记表；都查不到返回空串，由调用方决定是否保留原编号。
 */
export function caseTitleOf(protoId: string | null | undefined): string {
  const id = String(protoId ?? '').trim()
  if (!id) return ''
  return outsourcedCase(id)?.title || builtinProblem(id)?.title || ''
}

/** 备注里会带案例编号的前缀（与后端 TjdcMemberService 写入口径一致） */
const REMARK_PREFIXES = ['解锁真题：', '进入拆解：']

/**
 * 积分流水备注的展示文案：`解锁真题：p2` → `解锁真题：中药材热风烘干过程的热湿耦合建模`。
 *
 * 放在前端做而不是改后端重写历史流水：库里已经写进去的记录不会因为代码更新而变化，
 * 这里一次映射，新老记录都能显示名称。认不出编号就原样返回，不会把备注弄丢。
 */
export function ledgerRemarkText(remark: string | null | undefined): string {
  const text = String(remark ?? '').trim()
  if (!text) return ''
  for (const prefix of REMARK_PREFIXES) {
    if (!text.startsWith(prefix)) continue
    const key = text.slice(prefix.length).trim()
    const title = caseTitleOf(key)
    return title ? `${prefix}${title}` : text
  }
  return text
}
