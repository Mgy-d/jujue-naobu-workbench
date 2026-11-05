/**
 * 实时对话通道 —— 单例状态机 + DOM 渲染
 *
 * 把一次 AG-UI run 的事件流，实时画进工作台对话区的一条气泡里。
 * 之前这条通道**只收产物**，事件流全丢，所以平台那边看得见的对话，站点这边看不见。
 *
 * ⚠️ 2026-10-08 定调（两次，口径合起来看）：
 *   - 直接铺：智能体写给用户的**正文**（`text`）、真出错（`error`）
 *   - 收起来：**思考与工具调用**折成一条默认收起的「思考过程」（`<details>`），
 *     想看时点开 —— 既不把对话变成日志查看器，又不至于让过程彻底不可见
 *   - 转圈只留一个：还没有过程可展开、或最后一块是正在流的正文时，补一个 `busyHTML`
 *
 * 两个必须守住的细节：
 *   ① **块要按顺序分段落** —— 连续的过程块合成一条折叠条，正文穿插其间，
 *      这样「说一句 → 干点活 → 再说一句」的节奏才对得上。
 *   ② **折叠条的展开态是用户的** —— 每次重画都是整块 innerHTML 重写，
 *      所以重画前先记下哪些 `[data-lv]` 是打开的，重画后原样恢复；
 *      否则用户刚点开的思考，会被 700ms 一次的进度轮询收回去。
 *
 * 为什么不放在 flow.ts 里：flow 那条纪律是「不碰 DOM」。这里是渲染器，
 * 注定要碰 DOM —— 单独一层，边界才清楚（blocks 归约 → 本文件渲染）。
 */

import type { AguiEvent } from '@/types/agui'
import { Typewriter } from '@/utils/typewriter'
import {
  drainPending,
  emptyStream,
  reduce,
  closeOpenBlocks,
  settlePending,
  type LiveBlock,
  type LiveStream,
  type LiveTextBlock,
  type LiveThinkingBlock,
  type LiveToolBlock,
} from './blocks'
import { blockHTML, busyHTML, isLive, paintElapsed, procFoldHTML } from './render'

export type { LiveBlock, LiveStream } from './blocks'
export { resultText } from './blocks'

/**
 * 每个对话容器一份流状态。
 *
 * 为什么不是单例：任务仓把工作台的对话区按任务分了桶（见 core.ts 桥接层的
 * workHost），实时区必须跟着分 —— 否则「A 还在跑，我去 B 看看」之后，
 * A 剩下的事件会画进 B 的对话里。容器是 key，节点一旦被回收，这份状态
 * 也跟着走（WeakMap），不用手工清理。
 */
const streams = new WeakMap<HTMLElement, LiveStream>()
/** 最近一次挂载的容器。只在 liveMount 时更新 —— 由它决定「新一轮 run 该画哪」 */
let mounted: HTMLElement | null = null

function streamOf(el: HTMLElement | null | undefined): LiveStream | null {
  if (!el) return null
  let s = streams.get(el)
  if (!s) {
    s = emptyStream()
    streams.set(el, s)
  }
  return s
}

/* ── 打字机（移植自 kuaike） ──────────────────────────────────────────────── */

/**
 * 每个**正文块**一台打字机，而不是每轮一条。
 *
 * 为什么按块分：一轮 run 里可以有多个正文块（「说一句 → 干点活 → 再说一句」），
 * 归约层按到达顺序往各块的 `pending` 里堆。若全轮共用一台，就得维护「这段增量属于
 * 哪个块」的队列，顺序一乱正文就串位。按块各持一台，块自身的闭包就是归属，
 * 不存在串位问题，代价只是同屏可能有两台在跑（罕见，且互不干扰）。
 *
 * 表用 WeakMap 挂在块对象上：`liveBegin` 把 `s.blocks` 换掉之后，旧块被回收，
 * 对应的打字机与定时器也随之失联（不会有人再 append），无需手工清理。
 */
const typers = new WeakMap<LiveTextBlock, Typewriter>()

/** 块 → 它所在的容器：打字机吐出字符后要知道重画哪一块对话区 */
const blockBox = new WeakMap<LiveTextBlock, HTMLElement>()

/**
 * 打字机重画的节流间隔。
 *
 * 打字机约 50 次/秒回调，但一次回调就整块重写 `innerHTML`（含 markdown 转换）
 * 代价太高。压到 ~12 帧/秒肉眼已足够顺，且与桥接层的 700ms 兜底轮询叠加后
 * 观感是连续的。真正的「一帧不差」不是这里的目标 —— 目标是别一次性蹦出一整段。
 */
const PAINT_MS = 80
const paintAt = new WeakMap<HTMLElement, number>()
const paintTimer = new WeakMap<HTMLElement, number>()

function schedulePaint(box: HTMLElement): void {
  const now = Date.now()
  const last = paintAt.get(box) ?? 0
  if (now - last >= PAINT_MS) {
    paintAt.set(box, now)
    liveRender(box)
    return
  }
  if (paintTimer.has(box)) return
  const t = window.setTimeout(() => {
    paintTimer.delete(box)
    paintAt.set(box, Date.now())
    liveRender(box)
  }, PAINT_MS - (now - last))
  paintTimer.set(box, t)
}

/** 取（或建）某正文块的打字机；吐出字符直接写回该块，并按节流重画它的容器 */
function typerFor(b: LiveTextBlock, box: HTMLElement): Typewriter {
  let t = typers.get(b)
  if (!t) {
    t = new Typewriter({
      onDrain: (chunk) => {
        b.text += chunk
        const el = blockBox.get(b)
        if (el) schedulePaint(el)
      },
    })
    typers.set(b, t)
    blockBox.set(b, box)
  }
  return t
}

/** 把归约层堆下的增量交给各自的打字机（有容器可画时） */
function pump(stream: LiveStream, box: HTMLElement): void {
  for (const { block, text } of drainPending(stream)) {
    typerFor(block, box).append(text)
  }
}

/** 收尾：剩余增量全部同步吐出（不留半句在缓冲里） */
function settle(stream: LiveStream): void {
  for (const { block, text } of drainPending(stream)) {
    const t = typers.get(block)
    if (t) t.append(text)
    else block.text += text
  }
  for (const b of stream.blocks) {
    if (b.kind !== 'text') continue
    typers.get(b)?.flushNow()
  }
}

/** 硬清：丢弃所有未吐出的字符并停掉定时器（换题 / 退出工作台） */
function discard(stream: LiveStream): void {
  for (const b of stream.blocks) {
    if (b.kind !== 'text') continue
    typers.get(b)?.cancel()
  }
  settlePending(stream)
}

/* ── 生命周期 ────────────────────────────────────────────────────────────── */

/**
 * 开始一轮 run：清空**这一轮宿主容器**里上一轮的内容，并把它交回调用方当凭据。
 *
 * 为什么要返回容器：一轮 run 的「宿主」必须在它开始的那一刻定下来。用户中途
 * 切到别的任务时 mounted 会变，但这一轮的事件流不能因此改道 —— 调用方拿着
 * 这个凭据调 liveFeed / liveClose，就永远写在自己那块对话区里。
 *
 * @param userText 触发这一轮的用户输入（自动发起的 run 传空）
 */
export function liveBegin(userText = ''): HTMLElement | null {
  return beginOn(mounted, userText)
}

/**
 * 在一张**指定**容器上开始一轮 —— **不碰「当前容器」**。
 *
 * 为什么需要它（2026-10-13）：动画浮窗与代码等待气泡是**与工作台对话区并发**
 * 存在的。它们若走 `liveBegin()`，画的是「当前挂载的那个容器」，三条通道就会
 * 互相抢 —— 浮窗一开始动，下一轮 run 的落点就被带偏到浮窗里去了。
 * 并发通道一律走这个显式口：宿主是谁，调用方自己说得清。
 */
export function liveBeginOn(el: HTMLElement | null, userText = ''): HTMLElement | null {
  return beginOn(el, userText)
}

function beginOn(el: HTMLElement | null, userText: string): HTMLElement | null {
  const s = streamOf(el)
  if (s) {
    /* 上一轮可能还有打字机在吐（用户刚切回来又发起新一轮）：先把它的定时器停掉，
       否则那台会继续往已作废的块里写、白跑一趟。 */
    discard(s)
    s.blocks = []
    s.events = 0
    s.closed = false
    s.userText = userText
    s.startedAt = Date.now()
  }
  if (el) el.innerHTML = ''
  return el
}

/** 喂一个 AG-UI 事件（box 缺省=最近挂载的那个容器） */
export function liveFeed(ev: AguiEvent, box?: HTMLElement | null): void {
  feedOn(box ?? mounted, ev)
}

/**
 * 喂一个事件到**指定**容器。与 `liveFeed` 的差别只有一条：**不做「当前容器」回退**。
 *
 * 传 null 就是「这一步没有容器」，事件直接丢弃 —— 绝不落到对话区那份流里。
 * （`liveFeed(ev, null)` 会回退到 mounted，对并发通道来说这就是「动画的思考
 * 漏进了工作台对话」，所以并发通道必须用这个口。）
 */
export function liveFeedOn(el: HTMLElement | null, ev: AguiEvent): void {
  feedOn(el, ev)
}

function feedOn(el: HTMLElement | null, ev: AguiEvent): void {
  const s = streamOf(el)
  if (!s) return
  if (!s.startedAt) s.startedAt = Date.now()
  reduce(s, ev)
  /* 有容器就交给打字机逐字吐；没有（桥接层还没挂上）就直接并入 text，
     宁可少一段动画，也不能把正文丢在 pending 里没人管。 */
  if (el) pump(s, el)
  else settlePending(s)
}

/**
 * 收尾。**不改状态为「已关闭」以外的任何东西** ——
 * 真正的「活干完了」由 flow 决定（异步编排型智能体会先关流、后写产物）。
 *
 * 但打字机要在此**结清**：流关了还有字符在缓冲里的话，正文会永远缺个尾巴。
 */
export function liveClose(box?: HTMLElement | null): void {
  const s = streamOf(box ?? mounted)
  if (!s) return
  settle(s)
  closeOpenBlocks(s)
  s.closed = true
}

/** 彻底清掉某个容器的实时记录（换题、退出工作台）；缺省=最近挂载的那个 */
export function liveReset(box?: HTMLElement | null): void {
  const el = box ?? mounted
  if (!el) return
  const s = streams.get(el)
  if (s) discard(s)
  streams.delete(el)
  el.innerHTML = ''
}

/* ── 具名通道（2026-10-13：动画浮窗 / 代码等待气泡） ──────────────────────── */

/**
 * 通道名 → 当前宿主容器。
 *
 * 为什么要有名字这一层：那两个容器**是流动的**。
 *   · 动画浮窗：`animFloatRender` 只在「在跑」时才建它，收起、失败、完成都会被摘掉；
 *   · 代码等待气泡：一问一个，回答完就 remove。
 * 而事件是由 store（`stores/animation` / `stores/codegen`）在跑 run 时喂进来的 ——
 * store 不该认识 DOM，也不该在每次容器重建后重新拿一次引用。所以让**容器这一侧**
 * 主动登记（core 建好就 `liveBind`，摘掉就 `liveBind(name, null)`），
 * store 只按名字投递。名字没了 = 现在没人在看，事件丢弃（不落进对话区）。
 */
const channels = new Map<string, HTMLElement>()

/** 登记 / 注销一个通道的宿主容器 */
export function liveBind(name: string, el: HTMLElement | null): void {
  if (el) channels.set(name, el)
  else channels.delete(name)
}

/** 在具名通道的宿主上开始一轮；宿主还没登记就什么也不做（事件会按「没人在看」丢弃） */
export function liveBeginChannel(name: string, userText = ''): HTMLElement | null {
  const el = channels.get(name)
  return el ? beginOn(el, userText) : null
}

/** 往具名通道投一个事件；宿主不在就丢弃 */
export function liveFeedChannel(name: string, ev: AguiEvent): void {
  feedOn(channels.get(name) ?? null, ev)
}

/** 具名通道收尾（结清打字机缓冲、停掉转圈）；宿主不在就什么也不做 */
export function liveCloseChannel(name: string): void {
  const el = channels.get(name)
  if (el) liveClose(el)
}

/** 这一轮有没有内容可显示（正文 / 错误 / 过程块都算） */
export function liveActive(box?: HTMLElement | null): boolean {
  /* 注意别只认正文与错误：跑完一轮只有工具调用、它没来得及说话是常态 ——
     那种时候气泡里那条「思考过程」也该留下，否则用户点开什么都看不到 */
  const s = streamOf(box ?? mounted)
  return !!s && s.blocks.length > 0
}

/** 这一轮是不是已经收到 RUN_FINISHED */
export function liveClosed(box?: HTMLElement | null): boolean {
  return !!streamOf(box ?? mounted)?.closed
}

export function liveBlocks(box?: HTMLElement | null): LiveBlock[] {
  return streamOf(box ?? mounted)?.blocks ?? []
}

/** 思考段数与工具次数（只用于判断「还在不在干活」，不再上屏） */
export function liveCounters(box?: HTMLElement | null): { think: number; tools: number } {
  let think = 0
  let tools = 0
  for (const b of streamOf(box ?? mounted)?.blocks ?? []) {
    if (b.kind === 'thinking') think += 1
    else if (b.kind === 'tool') tools += 1
  }
  return { think, tools }
}

/* ── DOM 渲染 ────────────────────────────────────────────────────────────── */

/**
 * 把实时区挂到某个容器上。传 null 卸载。
 * 这是我们唯一更新「当前容器」的地方 —— 它决定下一轮 run 往哪画。
 */
export function liveMount(el: HTMLElement | null): void {
  if (el === mounted) return
  mounted = el
  if (mounted) {
    streamOf(mounted)
    mounted.innerHTML = ''
  }
}

/**
 * 刷新。由桥接层的轮询调用（也可在事件回调里调）。
 * 传容器时以参数为准（气泡重建后旧引用会失效），且**不改「当前容器」** ——
 * 否则别条任务的一次刷新会把「下一轮 run 该画哪」带偏。
 *
 * ⚠️ **2026-10-13 从「整块重写」改成「按块增量 patch」**，原因见文件顶部那段
 * 「为什么会闪」——整块重写会把每个子节点都换掉，里面的 `<i class="lv-spin">`
 * 跟着重生、CSS 动画从 0° 重头转，打字机吐字期间（最高 12.5 次/秒）肉眼就是闪。
 * 现在只动**模具真的变了**的那些块；秒数单独走 {@link paintElapsed}。
 */
export function liveRender(target?: HTMLElement | null): void {
  const el = target ?? mounted
  if (!el) return
  ensureLiveStyle()

  const s = streamOf(el)
  if (!s) return

  const open = openState(el)
  patchChildren(el, streamPieces(s))
  restoreOpen(el, open)
  paintElapsed(el, Date.now())
}

/** 一块对话内容：`key` 稳定（块只往后追加，前面那些键不会变），`html` 与时间无关 */
interface Piece {
  key: string
  html: string
}

/**
 * 上一轮写进每个块节点的「HTML 模具」。
 *
 * 为什么不能拿 `el.innerHTML` 去比：里面 `.lv-elapsed` 的秒数每秒都在变，
 * 比 innerHTML 会永远不等、等于没有守卫。模具里秒数是**空壳**，所以两轮之间
 * 只要真有新内容它才会变。节点被换掉时这份记录随 WeakMap 一起走。
 */
const molds = new WeakMap<HTMLElement, string>()

/** 块列表 → 一块块「与时间无关」的 HTML（过程折成折叠条，正文与错误直接铺） */
function streamPieces(s: LiveStream): Piece[] {
  const out: Piece[] = []
  let buf: Array<LiveThinkingBlock | LiveToolBlock> = []
  let foldIdx = 0

  const flush = (): void => {
    if (!buf.length) return
    out.push({ key: `f${foldIdx}`, html: procFoldHTML(buf, foldIdx) })
    foldIdx += 1
    buf = []
  }

  s.blocks.forEach((b, i) => {
    if (b.kind === 'thinking' || b.kind === 'tool') {
      buf.push(b)
      return
    }
    flush()
    if (b.kind === 'text' || b.kind === 'error') out.push({ key: `b${i}`, html: blockHTML(b) })
  })

  const tail = s.blocks[s.blocks.length - 1]
  const tailIsProc = !!tail && (tail.kind === 'thinking' || tail.kind === 'tool') && isLive(tail)
  flush()

  /* 还在干活、且转圈没画在折叠条里 → 补一个独立的 */
  if (!s.closed && !tailIsProc && pending(s)) out.push({ key: 'busy', html: busyHTML(s.startedAt) })
  return out
}

/**
 * 按块更新：**只动模具真的变了的那些块**，结构变化也走键控增删。
 *
 * 两条路：
 *   · 有 DOM（真浏览器）—— 按 `data-lvk` 认领既有节点：用不上的摘掉、缺的建出来、
 *     顺序不对的挪一下；然后只对「模具变了」的节点写 innerHTML。于是打字机吐字时
 *     只有正文那一块被重写，**转圈与折叠条的节点原地不动**（动画不中断）；
 *   · 无 DOM（单测的极简桩）—— 直接回退成字符串拼接整体写入。桩里 `children`
 *     恒空，逐块 patch 无从谈起，而这层逻辑本来也不是那些用例要测的东西。
 */
function patchChildren(el: HTMLElement, pieces: Piece[]): void {
  if (typeof document === 'undefined') {
    el.innerHTML = pieces
      .map((p) => `<div class="lv-block" data-lvk="${p.key}">${p.html}</div>`)
      .join('')
    return
  }

  const cur = Array.from(el.children) as HTMLElement[]
  const byKey = new Map<string, HTMLElement>()
  for (const c of cur) {
    const k = c.dataset.lvk
    if (k && !byKey.has(k)) byKey.set(k, c)
  }

  /* 先摘掉这一轮用不上的（含没有键的杂节点），免得它占着位置把顺序带偏 */
  const wanted = new Set(pieces.map((p) => p.key))
  for (const c of cur) {
    if (!c.dataset.lvk || !wanted.has(c.dataset.lvk)) c.remove()
  }

  let at = 0
  for (const p of pieces) {
    let node = byKey.get(p.key)
    if (!node) {
      node = document.createElement('div')
      node.className = 'lv-block'
      node.dataset.lvk = p.key
    }
    /* 新建的、以及顺序不对的，都要落到第 at 位 —— 新建的那支别漏插（实测漏过一次：
       节点建出来却没进 DOM，整块实时区空白，只有探针抓得住） */
    if (el.children[at] !== node) el.insertBefore(node, el.children[at] ?? null)
    if (molds.get(node) !== p.html) {
      node.innerHTML = p.html
      molds.set(node, p.html)
    }
    at += 1
  }
}

/** 记下当前哪些折叠条是打开的（data-lv → 是否 open） */
function openState(el: HTMLElement): Map<string, boolean> {
  const m = new Map<string, boolean>()
  el.querySelectorAll<HTMLElement>('[data-lv]').forEach((d) => {
    m.set(d.dataset.lv ?? '', d.hasAttribute('open'))
  })
  return m
}

/** 重画后把展开态补回去。没记过的（新出现的块）保持默认收起 */
function restoreOpen(el: HTMLElement, m: Map<string, boolean>): void {
  if (!m.size) return
  el.querySelectorAll<HTMLElement>('[data-lv]').forEach((d) => {
    const want = m.get(d.dataset.lv ?? '')
    if (want === undefined) return
    if (want) d.setAttribute('open', '')
    else d.removeAttribute('open')
  })
}

/** 还有活没干完吗：没有任何块（刚开始）/ 最后一块还在变 */
function pending(s: LiveStream): boolean {
  if (!s.blocks.length) return !!s.startedAt
  return isLive(s.blocks[s.blocks.length - 1])
}

/* ── 样式（自己注入，不动生成物那套 CSS） ─────────────────────────────────── */

const STYLE_ID = 'smyy-live-style'

/**
 * 把对话流那张样式表挂到 head（幂等）。
 *
 * ⚠️ **导出的理由**（2026-10-12）：它原来只由 liveRender 懒注入 —— 页面刷新后，
 *    工作台的对话区是从任务快照整块 innerHTML 贴回来的，那一刻没有任何渲染函数
 *    被调用，这张表就不在 head 里，于是快照里那堆 lv-* 节点（正文 / 列表 / 折叠的
 *    思考过程 / 工具明细）全部掉回浏览器默认样式。用户看到的就是「对话内容没样式」。
 *    现在由页面外壳挂载时统一补一次（见 utils/analysis/styles.ts）。
 */
export function ensureLiveStyle(): void {
  if (typeof document === 'undefined') return
  const prev = document.getElementById(STYLE_ID)
  if (prev) {
    /* 2026-10-12 补：**光看 id 在不在是不够的**。
       一份文档活久了（HMR 更新过模块、或这页压根没重载），head 里那张 <style> 是
       **旧版本的**：id 还在、内容却不是现在的 —— 于是新标记配旧样式，页面上就表现为
       「对话内容没样式」（或只掉一部分）。id 命中就 return 会让这种错位**永久**存在，
       因为每次调用都只会早退。内容一致才放过；不一致就换掉。 */
    if (prev.textContent === LIVE_CSS) return
    prev.remove()
  }
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = LIVE_CSS
  document.head.appendChild(el)
}

/** 站点配色：青绿主色 / 墨色文字 / 浅底 */
const LIVE_CSS = `
.lv-stream{display:flex;flex-direction:column;gap:8px;margin:10px 0 2px}
.lv-block{display:block}
.lv-busy{display:flex;align-items:center;gap:8px;padding:4px 0 2px;color:#57727c;font-size:12.5px;line-height:1.5}
.lv-spin{width:13px;height:13px;flex:0 0 auto;border:1.6px solid #cde6e3;border-top-color:#12a594;border-radius:50%;animation:lv-rotate .8s linear infinite}
@keyframes lv-rotate{to{transform:rotate(360deg)}}
.lv-answer{font-size:13.5px;line-height:1.8;color:#123039}
.lv-answer p{margin:7px 0}
.lv-answer .lv-h{margin:12px 0 6px;color:#0b2e36;font-weight:600}
.lv-answer .lv-ul,.lv-answer .lv-ol{margin:6px 0;padding-left:20px}
.lv-answer li{margin:3px 0}
.lv-answer code{padding:1px 5px;border-radius:4px;background:#eef6f5;color:#0b6e68;font-size:12.5px}
.lv-answer strong{color:#0b2e36}
.lv-code{margin:6px 0;padding:9px 11px;border-radius:7px;background:#0f2a30;color:#d6ecea;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.65;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.lv-table{width:100%;margin:7px 0;border-collapse:collapse;font-size:12.5px}
.lv-table th,.lv-table td{border:1px solid #dfeaea;padding:5px 8px;text-align:left}
.lv-table th{background:#f0f8f7;color:#0b6e68;font-weight:600}
.lv-muted{margin:4px 0;color:#9fb0b4;font-size:12.5px}
.lv-error{margin:8px 0;padding:9px 11px;border:1px solid #e7b7b0;border-left-width:3px;border-radius:7px;background:#fdf4f2;color:#a5352a;font-size:12.5px;line-height:1.7}
.lv-error b{display:block;margin-bottom:3px}
/* 思考过程：默认收起，点开才看明细 —— 收着是为了对话不变成日志，能展开是为了别把过程藏死 */
.lv-think{margin:2px 0 6px;border:1px solid #e2eeed;border-radius:8px;background:#fafdfd}
.lv-think>summary{display:flex;align-items:center;gap:7px;padding:6px 10px;list-style:none;cursor:pointer;color:#57727c;font-size:12px;line-height:1.55}
.lv-think>summary::-webkit-details-marker{display:none}
.lv-think>summary::after{content:'展开';margin-left:auto;flex:0 0 auto;color:#8fa5a9;font-size:11px}
.lv-think[open]>summary::after{content:'收起'}
.lv-think>summary:hover{color:#0b6e68}
.lv-proc{padding:2px 10px 9px;border-top:1px dashed #e2eeed}
.lv-thought{padding:6px 0;color:#3d6570;font-size:12.5px;line-height:1.75;white-space:pre-wrap;word-break:break-word}
.lv-tool{display:flex;align-items:baseline;gap:8px;padding:5px 0;font-size:12px;color:#123039}
.lv-tool b{flex:0 0 auto;color:#0b6e68;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.lv-tool .lv-args{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#57727c}
.lv-tool em{flex:0 0 auto;padding:0 6px;border-radius:999px;background:#eef6f5;color:#0b6e68;font-style:normal;font-size:11px;line-height:16px}
.lv-tool.error em{background:#fdf4f2;color:#a5352a}
.lv-tout{margin:0 0 7px;padding:8px 10px;border-radius:6px;background:#f2f7f7;color:#3d6570;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}
`
