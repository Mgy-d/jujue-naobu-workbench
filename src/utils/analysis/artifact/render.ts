/**
 * 产物卡渲染层（Step3）
 *
 * 只做一件事：把产物树拍平成一列文件，画成**站点风格**的卡片墙。
 * 不做像素级复刻平台那套深色卡片 —— 配色一律沿用站点（青绿主色 / 墨色文字 / 浅底），
 * 与 live 那条通道同一个口径。
 *
 * 两条纪律：
 *   ① **不过滤**（2026-10-09 用户拍板「先不考虑过滤」）：产物树里有什么就列什么 ——
 *      包括 `input/` 下用户自己传的原题与附件，也包括两个子会话各写一套造成的重名
 *      （后端已在展示名后加了会话短标，如实呈现即可）。过滤是下一步的事。
 *   ② **样式自己注入**（`#smyy-artifact-style`），不动生成物那套 prototype.scss。
 */

import type { ArtifactNode } from '@/types/sandbox'

/** 一个要上屏的产物文件 */
export interface ArtifactFile {
  name: string
  /** 相对路径；点开预览时原样回传（见 sandbox/api/artifact.ts 的硬约束） */
  path: string
  size: number
  updatedAt: number
}

/**
 * 产物树 → 文件列表。
 *
 * **保留接口给的顺序**（每层「目录优先、名称升序」），深度优先展开 ——
 * 这样同一批产物（`analysis/` 那几个、`truth/` 那几个）会连在一起，
 * 不需要额外排序，也就不必引入「谁更重要」这种判断。
 */
export function flattenFiles(nodes: ArtifactNode[] | null | undefined): ArtifactFile[] {
  const out: ArtifactFile[] = []
  const walk = (list: ArtifactNode[]): void => {
    for (const n of list) {
      if (n.type === 'dir') {
        if (n.children?.length) walk(n.children)
        continue
      }
      out.push({ name: n.name, path: n.path, size: n.size ?? 0, updatedAt: n.updatedAt ?? 0 })
    }
  }
  if (Array.isArray(nodes)) walk(nodes)
  return out
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 文件大小：`12.1 KB` 这种口径（1024 进制、一位小数），与截图一致 */
export function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 扩展名 → 图标。**按「打开它要什么工具」分色**，不按智能体业务分：
 * 文档＝青绿、代码/结构化＝青蓝、表格＝绿、图片＝暖金、PDF＝砖红、其余＝灰。
 */
const EXT_ICON: Record<string, { text: string; tone: string }> = {
  md: { text: 'M', tone: 'doc' },
  txt: { text: 'TXT', tone: 'doc' },
  rst: { text: 'TXT', tone: 'doc' },
  json: { text: '{}', tone: 'code' },
  jsonl: { text: '{}', tone: 'code' },
  yaml: { text: '{}', tone: 'code' },
  yml: { text: '{}', tone: 'code' },
  py: { text: 'PY', tone: 'code' },
  js: { text: 'JS', tone: 'code' },
  ts: { text: 'TS', tone: 'code' },
  java: { text: 'JV', tone: 'code' },
  sh: { text: 'SH', tone: 'code' },
  html: { text: '<>', tone: 'code' },
  css: { text: '{}', tone: 'code' },
  ipynb: { text: 'NB', tone: 'code' },
  csv: { text: 'CSV', tone: 'sheet' },
  tsv: { text: 'CSV', tone: 'sheet' },
  xlsx: { text: 'X', tone: 'sheet' },
  xls: { text: 'X', tone: 'sheet' },
  png: { text: 'IMG', tone: 'img' },
  jpg: { text: 'IMG', tone: 'img' },
  jpeg: { text: 'IMG', tone: 'img' },
  webp: { text: 'IMG', tone: 'img' },
  svg: { text: 'SVG', tone: 'img' },
  pdf: { text: 'PDF', tone: 'pdf' },
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function iconOf(name: string): { text: string; tone: string } {
  return EXT_ICON[extOf(name)] ?? { text: '·', tone: 'bin' }
}

/** 一张文件卡（`data-path` 是给桥接层做事件委托用的，路径原样） */
export function cardHTML(f: ArtifactFile): string {
  const ic = iconOf(f.name)
  return (
    '<button type="button" class="art-item" data-path="' + esc(f.path) + '" title="' + esc(f.path) + '">' +
    '<span class="art-ico ' + ic.tone + '">' + esc(ic.text) + '</span>' +
    '<span class="art-meta"><b>' + esc(f.name) + '</b><em>' + fmtSize(f.size) + '</em></span>' +
    '<span class="art-go">›</span>' +
    '</button>'
  )
}

export interface WallState {
  files: ArtifactFile[]
  /** 正在拉树 */
  loading: boolean
  /** 至少成功拉到过一次（决定了要不要报「N 项」） */
  loaded: boolean
  /** 失败原因（读不到清单时如实显示，不装作「没有产物」） */
  error: string
}

/** 整张卡的 HTML（含头部与刷新按钮）—— 作为 `.art-card` 的 innerHTML */
export function wallHTML(s: WallState): string {
  const count = s.loaded ? '<em class="art-count">' + s.files.length + ' 项</em>' : ''
  const head =
    '<div class="art-head"><span class="art-title">智能体产物</span>' +
    count +
    '<button type="button" class="art-refresh" data-art-refresh="1">' +
    (s.loading ? '读取中…' : '刷新') +
    '</button></div>'

  let body: string
  if (s.error) {
    body = '<div class="art-empty">产物清单没读到：' + esc(s.error) + '</div>'
  } else if (s.loading && !s.loaded) {
    body = '<div class="art-empty">正在读这个会话的产物…</div>'
  } else if (!s.files.length) {
    body =
      '<div class="art-empty">这个会话还没有产物。智能体写出来的文件会出现在这里 —— ' +
      '它可能还在写（这类题常见要二三十分钟），过会儿点右上角「刷新」再看。</div>'
  } else {
    body = '<div class="art-grid">' + s.files.map(cardHTML).join('') + '</div>'
  }

  const note = s.files.length
    ? '<div class="art-note">本会话与全部子会话的产物都列在这里，没有过滤；'
      + '重名的那几份是不同子会话各写的一套，名字后面带会话短标。</div>'
    : ''

  return head + note + body
}

/* ── 样式（自己注入，不动生成物那套 CSS） ─────────────────────────────────── */

const STYLE_ID = 'smyy-artifact-style'

export function ensureArtifactStyle(): void {
  if (typeof document === 'undefined') return
  /* 光看 id 不够：活久了的文档里那张表可能是旧版本的（见 live/index.ts 同一处说明） */
  const prev = document.getElementById(STYLE_ID)
  if (prev) {
    if (prev.textContent === ARTIFACT_CSS) return
    prev.remove()
  }
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = ARTIFACT_CSS
  document.head.appendChild(el)
}

const ARTIFACT_CSS = `
.art-card{display:block;margin:10px 0 2px;padding:10px 12px;border:1px solid #dfeaea;border-radius:10px;background:#fff}
.art-head{display:flex;align-items:center;gap:8px}
.art-title{font-size:13.5px;font-weight:600;color:#0b2e36}
.art-count{padding:0 6px;border-radius:999px;background:#eef6f5;color:#0b6e68;font-style:normal;font-size:11px;line-height:16px}
.art-refresh{margin-left:auto;flex:0 0 auto;padding:2px 10px;border:1px solid #cde6e3;border-radius:999px;background:#f2fbfa;color:#0b6e68;font-size:12px;line-height:18px;cursor:pointer;transition:background .12s ease,color .12s ease,border-color .12s ease}
.art-refresh:hover{background:#12a594;border-color:#12a594;color:#fff}
.art-note{margin:5px 0 8px;color:#8fa5a9;font-size:11.5px;line-height:1.6}
.art-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.art-item{display:flex;align-items:center;gap:9px;width:100%;min-width:0;padding:8px 9px;border:1px solid #e6f0ef;border-radius:9px;background:#fafdfd;text-align:left;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.art-item:hover{background:#f0f8f7;border-color:#bfe3df}
.art-ico{flex:0 0 auto;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:#9fb0b4;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;font-weight:700;letter-spacing:-.2px}
.art-ico.doc{background:#12a594}
.art-ico.code{background:#146c87}
.art-ico.sheet{background:#2f9e6f}
.art-ico.img{background:#e0a04a}
.art-ico.pdf{background:#b0563f}
.art-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}
.art-meta b{font-size:12.5px;font-weight:600;color:#123039;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-meta em{font-style:normal;font-size:11px;color:#8fa5a9}
.art-go{flex:0 0 auto;color:#bfd5d3;font-size:15px;line-height:1}
.art-item:hover .art-go{color:#0b6e68}
.art-empty{margin:6px 0 2px;padding:9px 11px;border:1px dashed #dfeaea;border-radius:9px;background:#fafdfd;color:#57727c;font-size:12.5px;line-height:1.7}
.art-pv{margin:0;padding:12px 14px;color:#123039;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.art-pv-note{margin:10px 12px;padding:9px 11px;border:1px dashed #dfeaea;border-radius:9px;background:#fafdfd;color:#57727c;font-size:12.5px;line-height:1.7}
.art-pv-img{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:9px}
@media (max-width:560px){.art-grid{grid-template-columns:minmax(0,1fr)}}
`
