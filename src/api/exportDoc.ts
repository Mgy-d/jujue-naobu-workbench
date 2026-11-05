/**
 * 产物导出（把分析产物渲染成 Word 下载）
 *
 * 后端：`POST /api/agents/{agentId}/sessions/{sessionId}/export`，请求体
 * `{ path, format:'docx' }`，响应**直接是 docx 字节流**（不是 JSON），文件名在
 * `Content-Disposition`；同时服务端会把文件落到该会话的 `exports/`，所以「下载一次
 * 就丢了」不成立 —— 会话还在，导出物就还在。
 *
 * 为什么不用 `http.post`：那一层会 `res.json()`，二进制响应会直接解析失败。这里降到
 * `rawFetch`，但**保留与 http 层同一套 401 口径**（本地预判过期 → 先刷新；服务端 401 →
 * 刷新后重放一次），否则长会话里下载会莫名其妙地 401。
 */

import { ApiError, ensureFreshToken, isAccessTokenExpired, rawFetch } from '@/api/http'
import { AGENT_ID } from '@/config'

export interface ExportedDoc {
  /** 下载用的文件名（后端按源文件名生成，含中文时走 RFC 5987 编码） */
  fileName: string
  blob: Blob
  /** 字节数 */
  size: number
  /** 服务端落盘位置（会话内相对路径，形如 `exports/analysis_v1.0.docx`） */
  storedPath: string
}

/** 后端错误体是 `{ code, message }`；网关 HTML 错误页则回原文 */
async function errorText(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text) as { message?: unknown; detail?: unknown }
    if (typeof json.message === 'string') return json.message
    if (typeof json.detail === 'string') return json.detail
  } catch {
    // 非 JSON，回落到原文
  }
  return text || res.statusText || `导出失败（HTTP ${res.status}）`
}

/** 从 `Content-Disposition` 取文件名：优先 RFC 5987 的 `filename*=`，退回 `filename="…"` */
export function fileNameOf(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      // 编码异常时退回原始串（总比没有强）
      return star[1]
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1] : fallback
}

/** 源文件名 → 同名 docx（后端拿不到文件名头时的兜底） */
function docxNameOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1) || 'report.md'
  return base.replace(/\.[^.]+$/, '') + '.docx'
}

/**
 * `X-Export-Path` 的解码。
 *
 * 后端那个头只能放 ASCII（HTTP 头值放不下中文，浏览器读头时会直接判非法头值），
 * 所以中文名是**百分号编码**过来的，这里还原。解析失败就原样用 —— 它只用于展示，
 * 不值得为它把整次导出判失败。
 */
function decodeStoredPath(raw: string | null): string {
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * 把会话里的一个 Markdown 产物导出为 docx。
 *
 * @param sessionId 会话（= threadId）
 * @param path      产物树里的**原样路径**（不能自己拼 `artifacts/` 前缀）
 */
export async function exportDocx(sessionId: string, path: string): Promise<ExportedDoc> {
  if (!AGENT_ID) throw new ApiError(0, '智能体未配置')
  const url = `/api/agents/${AGENT_ID}/sessions/${encodeURIComponent(sessionId)}/export`
  const body = { path, format: 'docx' }

  if (isAccessTokenExpired()) {
    if (!(await ensureFreshToken())) throw new ApiError(401, '登录已过期，请重新登录')
  }
  let res = await rawFetch(url, { method: 'POST', body })
  if (res.status === 401) {
    if (!(await ensureFreshToken())) throw new ApiError(401, '登录已过期，请重新登录')
    res = await rawFetch(url, { method: 'POST', body })
  }
  if (!res.ok) throw new ApiError(res.status, await errorText(res))

  const blob = await res.blob()
  return {
    fileName: fileNameOf(res.headers.get('Content-Disposition'), docxNameOf(path)),
    blob,
    size: blob.size,
    storedPath: decodeStoredPath(res.headers.get('X-Export-Path')),
  }
}

/** 触发浏览器下载。用临时 `<a download>`，随后回收 objectURL（否则 blob 一直驻留内存） */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'report.docx'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
