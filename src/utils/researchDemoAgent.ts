/**
 * 本机演示智能体服务（VITE_RESEARCH_AGENT_MODE=demo 时启用）。
 *
 * 边界声明：这是纯前端模拟脚本，不连接任何后端；对话内容、产物与统计结果
 * 均为演示示例数据，不代表真实运行或真实研究结论。仅用于客户演示与教学走查。
 * 交互形态对齐"数模演易"原型：逐步讲解、可提问、可回退上一步、刷新可恢复。
 */
import type { ResearchRunServices, ResearchRunResult } from '@/stores/researchRuns'
import type { ResearchIdentity } from '@/api/szRun'
import type { ResearchSessionStatus } from '@/api/researchAgent'
import type { AguiEvent, AguiRunRequest } from '@/types/agui'
import type { SessionTextMessage } from '@/api/session'
import type { ArtifactNode, ArtifactContent } from '@/types/sandbox'
import { buildDemoTask } from './researchDemoSeed'

/** 编译期开关；普通构建不开启，URL 参数或缓存无法启用演示模式。 */
export const RESEARCH_AGENT_DEMO = import.meta.env.VITE_RESEARCH_AGENT_MODE === 'demo'

type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>
interface DemoMessage { id: string; role: 'user' | 'assistant'; text: string }
interface DemoState { step: number; messages: DemoMessage[] }
const KEY_PREFIX = 'shidiaoyanzhen.demo-agent.v1:'
const PROJECT_KEY_PREFIX = 'shidiaoyanzhen.demo-agent-project.v1:'

function loadState(storage: DemoStorage, threadId: string): DemoState | null {
  try {
    const raw = storage.getItem(KEY_PREFIX + encodeURIComponent(threadId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoState
    if (!parsed || !Array.isArray(parsed.messages) || !Number.isInteger(parsed.step)) return null
    return { step: Math.max(0, parsed.step), messages: parsed.messages.filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant')) }
  } catch { return null }
}
function saveState(storage: DemoStorage, threadId: string, state: DemoState): void {
  storage.setItem(KEY_PREFIX + encodeURIComponent(threadId), JSON.stringify(state))
}

/** 用户输入的正文（去掉面板自动附带的草稿上下文与材料引用）。 */
function headOf(userText: string): string {
  return userText.split('\n\n以下为用户提供的本机草稿')[0]!.split('\n\n本会话已上传材料引用')[0]!.trim()
}

const STEP_TAG = (step: number, total: number) => `【演示讲解 ${step}/${total}】`

/** 七阶段逐步讲解脚本；内容与演示案例种子一致，均为演示示例。 */
export const DEMO_STEPS: string[] = [
`${STEP_TAG(0, 8)} 演示导览 · 我们在做什么

你好，我是市调智能体（演示模式）。已接收演示案例：

《Z 世代国潮文创消费意愿调研（演示案例）》
· 2026 市调大赛 · 本科组 · 完整研究
· 附件：赛题说明、演示问卷、示例数据（均为演示数据）

接下来我按市调大赛七个阶段，一步一步带你走完「从赛题到答辩」的完整解题过程。每个阶段讲三件事：
① 题目要什么 —— 赛题对本阶段的要求
② 我们怎么解 —— 解题思路与示例产出
③ 落在哪里 —— 在平台哪个面板里查看与确认

快捷指令（点上方按钮或直接发送）：
· 「下一步」→ 进入下一阶段讲解
· 「回退上一步」→ 退回上一阶段
· 「我有的问题」→ 查看可以问我的问题

边界说明：本会话为本机演示模拟，不连接真实后端；所有数据均为演示示例。`,

`${STEP_TAG(1, 8)} 阶段 1 · 赛事理解 —— 先把"题目到底要什么"读准

① 题目要什么：明确研究对象、时间范围、交付物与评审关注点；有阻断性未知项时必须先登记，不许脑补。
② 我们怎么解：从赛题原文拆出「背景／届次／组别／要求」四要素，并标注每条的来源；本例对象是 Z 世代（18–29 岁）对国潮文创产品的消费意愿，要求产出完整调研报告。
③ 落在哪里：左侧「赛事理解」阶段卡片；"新增未知项"用来登记尚未拿到正式通知这类阻碍项——这正是平台"拒绝脑补"的机制。

解题要点：宁可在阶段 1 留下"未知项待补充"，也不要编造赛事要求。`,

`${STEP_TAG(2, 8)} 阶段 2 · 选题分析 —— 在候选方向里做一次可辩护的选择

① 题目要什么：给出可选研究方向，并说明为什么选它（可行性、数据可得性、与赛题匹配度）。
② 我们怎么解：列出两个候选并对比——
· 方向 A「Z 世代国潮消费意愿与影响因素」：群体清晰、问卷可得、与赛题直接匹配 → 采用；
· 方向 B「文创品牌联名定价研究」：需要企业定价数据，学生团队拿不到 → 备选。
③ 落在哪里：左侧「选题分析」卡片，"采用理由"写清选择依据，评审问起有话可答。

解题要点：选题不是选最喜欢的，是选"做得完、答得住"的。`,

`${STEP_TAG(3, 8)} 阶段 3 · 研究方案 —— 把问题翻译成可执行的测量

① 题目要什么：研究问题、抽样设计、变量测量与分析计划，四件套齐全才能进问卷。
② 我们怎么解：
· 研究问题：R1 Z世代对国潮文创的支付意愿处于什么水平？R2 文化认同、社交展示需求如何影响购买意愿？
· 抽样：配额抽样（高校/商圈/线上三渠道），目标 n≈400，按性别、学段配额；
· 测量：购买意愿采用 5 点李克特量表（演示示例题项）；
· 分析计划：描述统计 → 相关分析 → 二元 Logistic 回归。
③ 落在哪里：左侧「研究方案」卡片；点「采用此方案」固定下来，后续阶段以它为准。

解题要点：方案阶段的每个决定，都要能在答辩时说出"为什么"。`,

`${STEP_TAG(4, 8)} 阶段 4 · 问卷设计与预测试 —— 题目是改出来的

① 题目要什么：完整问卷 + 预测试记录，证明题项经过了检验而不是拍脑袋。
② 我们怎么解：问卷分四部分共 13 题（筛选 2 + 认知态度 4 + 购买意愿量表 4 + 背景 3）；两轮预测试（n=38）后修订：删歧义题 1 道、改选项措辞 2 处，信度 Cronbach's α=0.83（演示示例值）。
③ 落在哪里：左侧「问卷设计」卡片查看题项与预测试轮次；"已固定"徽标表示结构不再随意改动。

解题要点：预测试不是走过场——每一处修订都要留下"改了什么、为什么改"。`,

`${STEP_TAG(5, 8)} 阶段 5 · 正式调查 —— 发布前的四项准备

① 题目要什么：说明回收渠道、对象、起止规则，保证数据可追溯。
② 我们怎么解：渠道=线上问卷平台+线下拦访；对象=18–29 岁且近一年购买过文创产品；起=预测试修订版发布；停=有效样本达 400 或截至第 4 周周日 24:00。
③ 落在哪里：左侧「正式调查」卡片填四字段 → 顶部亮"准备就绪"徽标；正式的服务端发布与回收属未交付能力，演示中由就绪度提示代替。

解题要点：没有停止规则的调查会一直"再收几天"，数据口径就乱了。`,

`${STEP_TAG(6, 8)} 阶段 6 · 数据分析 —— 只写真正执行过的统计

① 题目要什么：用数据回答研究问题，结论与统计一一对应。
② 我们怎么解（示例结果，均为演示数据）：有效样本 n=402；信度 α=0.83；文化认同与购买意愿相关 r=0.47（p<0.01）；Logistic 回归中文化认同 β=0.39（R²=0.21）。
③ 落在哪里：「本机沙箱」上传数据跑描述/相关/回归，结果回写结论；工作台阶段 6 会显示"待补充：尚未关联本机分析结果"，直到真实关联沙箱运行——平台不允许把没跑过的统计写成已验证。

解题要点：这一页的每个数字，答辩时都可能被追问"在哪算的"。`,

`${STEP_TAG(7, 8)} 阶段 7 · 报告与答辩 —— 把过程讲成一个可辩护的故事

① 题目要什么：结构完整的报告 + 答辩问答准备。
② 我们怎么解：报告按「摘要→方法→发现→局限→建议」组织，局限里写明演示数据边界与样本偏差；答辩准备预演三类追问：抽样代表性、量表效度、因果边界。
③ 落在哪里：左侧「报告与答辩」卡片；结论、来源注释、答辩预案三段齐全即"准备就绪"。

解题要点：好的答辩不是没有局限，而是知道局限在哪并提前想好怎么答。`,

`${STEP_TAG(8, 8)} 收尾 · 全流程回顾与能力边界

回顾七阶段：赛事理解 → 选题分析 → 研究方案 → 问卷设计与预测试 → 正式调查 → 数据分析 → 报告与答辩。每个阶段都遵循同一原则：先登记"题目要什么"，再做"我们能做的"，最后明确"什么还没做"。

能力边界（演示模式）：
· 本对话与产物均为本机演示模拟，不连接真实后端；
· 「项目、材料与版本」面板走本机合成服务（MOCK），阶段 0–3 可体验"保存候选→阶段检查→确认推进"；
· 正式七阶段服务端确认、真实问卷发布回收与团队部署需接入真实后端后使用。

你可以随时「回退上一步」重听任意阶段，或「我有的问题」查看可提问的主题。`]

const STEP_HINT = '\n\n—— 发送「下一步」继续，「回退上一步」返回，「我有的问题」查看可提问主题。'

const FAQ_TOPICS = `可以问我的问题（演示示例）：
· 抽样方案：为什么用配额抽样？样本量怎么定？
· 问卷设计：题项怎么改出来的？预测试做了什么？
· 统计结果：相关/回归数字怎么解读？（演示数据）
· 预算与周期：这份调研要多少钱、多少天？
· 局限与风险：这个研究最容易被质疑什么？
· 数据边界：演示数据是真的吗？
· 平台操作：阶段确认在哪里做？产物能下载吗？`

/** 关键词问答（不推进步骤游标）。 */
const QA: Array<{ keys: string[]; text: string }> = [
  { keys: ['抽样', '样本量', '样本'], text: `抽样方案（演示示例）：配额抽样，渠道为高校、商圈、线上问卷平台三路；目标 n≈400，按性别（约 1:1）与学段（本科/研究生约 7:3）配额，尽量覆盖不同城市线级。\n为什么不随机抽样？学生团队没有完整抽样框，配额抽样在可执行性与代表性之间取平衡——这也是答辩时主动说明的点。` },
  { keys: ['问卷', '题项', '量表', '预测试'], text: `问卷与预测试（演示示例）：问卷四部分 13 题——筛选 2、认知态度 4、购买意愿量表 4、背景 3。两轮预测试（n=38）：第一轮删歧义题 1 道；第二轮改选项措辞 2 处；修订后信度 Cronbach's α=0.83。\n平台里阶段 4 卡片记录每轮修订，评审能看见"改了什么、为什么改"。` },
  { keys: ['信度', '效度', 'cronbach'], text: `信度（演示示例值）：总量表 Cronbach's α=0.83，各分量表 α∈[0.78,0.86]，达到常用门槛（≥0.7）。注意：这是演示数据；正式研究中要在本机沙箱用真实回收数据复算。` },
  { keys: ['相关', '回归', '显著', '统计', '分析', 'r=', 'β'], text: `统计结果解读（演示示例数据）：n=402；文化认同与购买意愿相关 r=0.47（p<0.01），中等强度正相关；Logistic 回归中文化认同 β=0.39（R²=0.21），控制性别与学段后依然显著。\n重要边界：工作台阶段 6 会提示"尚未关联本机分析结果"，直到你真实上传数据并在沙箱执行——平台不允许把未执行的统计写成已验证。` },
  { keys: ['预算', '费用', '成本'], text: `预算构成（演示示例）：问卷平台服务费约 200 元；线下拦访礼品 400 份×3 元≈1200 元；交通与打印约 300 元；合计约 1700 元。学生赛事预算以"小额可解释"为原则，每项都要留凭证。` },
  { keys: ['时间', '周期', '进度', '排期'], text: `四周排期（演示示例）：W1 赛事理解+选题；W2 方案+问卷预测试；W3 正式调查+数据清洗；W4 分析+报告+答辩演练。关键依赖：预测试修订必须在正式发布前完成，所以 W2 是全流程的紧路径。` },
  { keys: ['风险', '局限', '不足', '质疑'], text: `最容易被质疑的三点（演示示例）：① 配额抽样非概率抽样，外推有限——答辩话术：明确结论适用范围；② 自-report 量表的社会赞许偏差——话术：匿名作答+反向题校验；③ 横截面数据不能做因果推断——话术：把"影响"表述为"关联"。局限写进报告，不藏。` },
  { keys: ['真实', '假的', '编的', '演示数据', '可信', '造假'], text: `诚实边界：本演示中的样本量、α、r、β 等全部数字均为演示示例数据，不是真实调查结果；真实研究中它们必须来自你上传到本机沙箱的真实数据。平台的设计目标之一就是让"演示数据"与"已验证结论"在界面上肉眼可分。` },
  { keys: ['下载', '导出'], text: `演示模式下产物仅支持「预览成果」，下载按钮已禁用；正式接入后端后，产物经下载票据接口提供原件下载。` },
  { keys: ['确认', '锁定', '正式项目', '阶段检查', '候选'], text: `阶段确认在哪里做：任务页「项目、材料与版本」面板（演示中为 MOCK 合成服务）：创建项目 → 上传材料 → 保存候选 → 请求阶段检查 → 勾选"我已阅读" → 确认本阶段。演示环境阶段 0–3 可完整走通，确认后服务端阶段自动推进；阶段 4–6 的正式确认属未交付能力。` },
  { keys: ['研究问题', '题目解析', '这道题', '解题'], text: `本题解析摘要：赛题要求对 Z 世代国潮文创消费意愿做完整调研。核心链条：消费意愿（因变量）← 文化认同、社交展示需求（自变量），控制背景变量；用"意愿水平描述 + 影响因素关联"两层结论回答 R1/R2。完整拆解见阶段 1–3 讲解。` },
]

function fallback(userText: string): string {
  return `这个问题我先记下："${userText.slice(0, 40)}${userText.length > 40 ? '…' : ''}"。\n\n演示模式的问答围绕本案例展开，你可以换个问法（比如"抽样方案""信度是多少""局限在哪"），或发送「我有的问题」查看全部可提问主题；发送「下一步」继续阶段讲解。`
}

/** 纯函数：给定当前状态与用户输入，返回应答文本与新的步骤游标。 */
export function demoRespond(state: DemoState | null, userText: string): { text: string; step: number } {
  const total = DEMO_STEPS.length
  const head = headOf(userText)
  if (!state) return { text: DEMO_STEPS[0]! + STEP_HINT, step: 0 }
  if (/我有的问题|帮助|指令|能问什么|怎么提问/.test(head)) return { text: FAQ_TOPICS, step: state.step }
  if (/回退|上一步|back/i.test(head)) {
    const step = Math.max(0, state.step - 1)
    return { text: `（已回退）重新显示上一条讲解。\n\n${DEMO_STEPS[step]!}`, step }
  }
  if (/下一步|继续/.test(head)) {
    const step = Math.min(total - 1, state.step + 1)
    return { text: DEMO_STEPS[step]! + (step === total - 1 ? '' : STEP_HINT), step }
  }
  for (const item of QA) if (item.keys.some(k => head.toLowerCase().includes(k))) return { text: item.text, step: state.step }
  return { text: fallback(head), step: state.step }
}

/* ── 演示产物：与七阶段面板的阶段过滤规则对齐（见 researchStageArtifacts.ts） ── */

interface DemoFile { suffix: string; content: string }
let demoFilesCache: DemoFile[] | null = null

function demoFiles(): DemoFile[] {
  if (demoFilesCache) return demoFilesCache
  const t = buildDemoTask()
  const q = t.questionnaire.questions
  const list: DemoFile[] = [
    { suffix: '研究简报.md', content: `# 研究简报（演示示例）\n\n- 赛事：${t.competition.edition}\n- 背景：${t.competition.background}\n- 要求：${t.competition.requirements.join('；')}\n- 未知项：${t.competition.unknowns.map(u => u.text).join('；')}\n\n本文件由演示模式生成为示例内容，不代表真实赛事结论。` },
    { suffix: '研究问题.md', content: `# 研究问题（演示示例）\n\n- 采用方向：${t.topicAnalysis.directions.find(d => d.id === t.topicAnalysis.selectedDirectionId)?.title ?? ''}\n- 采用理由：${t.topicAnalysis.selectionReason}\n- R1 支付意愿水平；R2 文化认同/社交展示与购买意愿的关联。` },
    { suffix: '调查方案.md', content: `# 调查方案（演示示例）\n\n- 抽样：配额抽样，n≈400\n- 测量：5 点李克特购买意愿量表\n- 分析计划：描述统计 → 相关分析 → Logistic 回归\n\n（演示数据，非真实执行记录）` },
    { suffix: '问卷/预测试题项.md', content: `# 问卷题项与预测试（演示示例）\n\n${q.map((item, i) => `${i + 1}. [${item.type}] ${item.text}（${item.options.map(o => o.label).join('/')}）`).join('\n')}\n\n预测试两轮（n=38）：删歧义题 1、改措辞 2；α=0.83。` },
    { suffix: '数据/示例统计结果.md', content: `# 示例统计结果（演示数据）\n\n- 有效样本 n=402；信度 α=0.83\n- 文化认同 × 购买意愿：r=0.47（p<0.01）\n- Logistic 回归：β=0.39，R²=0.21\n\n注意：以上为演示示例，正式研究需在本机沙箱用真实数据复算。` },
    { suffix: '报告/演示报告骨架.md', content: `# 报告骨架（演示示例）\n\n1. 摘要\n2. 方法（抽样/测量/分析）\n3. 发现（R1/R2）\n4. 局限（演示数据边界、样本偏差、横截面）\n5. 对国潮文创品牌的营销建议\n\n答辩预案：抽样代表性 / 量表效度 / 因果边界。` },
  ]
  demoFilesCache = list
  return list
}

export function demoArtifactFiles(projectId: string): ArtifactNode[] {
  if (!projectId) return []
  const now = Date.now()
  return demoFiles().map(file => ({ name: file.suffix.split('/').pop()!, path: projectId + '/' + file.suffix, type: 'file' as const, size: file.content.length, updatedAt: now }))
}

export function demoArtifactRead(path: string): ArtifactContent {
  const file = demoFiles().find(item => path.endsWith('/' + item.suffix) || path === item.suffix)
  if (file) return { path, content: file.content, size: file.content.length }
  return { path, content: null, reason: '演示模式未提供该文件内容；列表中的演示产物可预览。' }
}

/* ── ResearchRunServices 的本机演示实现 ── */

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')) }, { once: true })
})

async function streamReply(text: string, messageId: string, identity: ResearchIdentity, onEvent: (event: AguiEvent) => void, signal: AbortSignal): Promise<void> {
  const chunk = 24
  for (let i = 0; i < text.length; i += chunk) {
    await sleep(12, signal)
    const event: AguiEvent = { type: 'TEXT_MESSAGE_CONTENT', messageId, threadId: identity.threadId, runId: identity.runId, delta: text.slice(i, i + chunk) }
    onEvent(event)
  }
}

export function createDemoResearchServices(storage: DemoStorage = localStorage): ResearchRunServices {
  return {
    async verify() { /* 演示模式无需探测远端智能体 */ },
    async run(identity, request, onEvent, signal): Promise<ResearchRunResult> {
      const userText = (request.messages ?? []).flatMap(message => (message.content ?? []).filter(block => block.type === 'text').map(block => block.text ?? '')).join('\n')
      const isProbe = userText.includes('这是模型响应检查')
      if (isProbe) {
        const text = '演示模式连接正常：这是本机模拟回复，不连接真实模型。'
        await streamReply(text, 'demo-probe', identity, onEvent, signal)
        return { status: 'success', message: '', texts: { 'demo-probe': text }, interrupts: [] }
      }
      const state = loadState(storage, identity.threadId)
      const reply = demoRespond(state, userText)
      const messageId = 'demo-' + crypto.randomUUID()
      const next: DemoState = { step: reply.step, messages: [...(state?.messages ?? []), { id: 'u-' + crypto.randomUUID(), role: 'user', text: userText }, { id: messageId, role: 'assistant', text: reply.text }] }
      saveState(storage, identity.threadId, next)
      try { storage.setItem(PROJECT_KEY_PREFIX + encodeURIComponent(identity.threadId), identity.projectId) } catch { /* 记不住 projectId 只影响产物列表，不影响对话 */ }
      await streamReply(reply.text, messageId, identity, onEvent, signal)
      if (signal.aborted) return { status: 'error', message: '演示回放已被停止。', texts: {}, interrupts: [] }
      return { status: 'success', message: '', texts: { [messageId]: reply.text }, interrupts: [] }
    },
    async transcript(_agentId, threadId) {
      const state = loadState(storage, threadId)
      const messages: SessionTextMessage[] = (state?.messages ?? []).map(item => ({ id: item.id, role: item.role, content: [{ type: 'text', text: item.text }] }))
      return { messages }
    },
    async pending() { return [] },
    async runStatus(): Promise<ResearchSessionStatus> { return { running: false, awaitingInput: true } },
    async register() { /* 演示无服务端表单 */ },
    async remove() { /* 演示无服务端表单 */ },
    async tree(_agentId, threadId) { return demoArtifactFiles(storedProjectId(storage, threadId)) },
    async read(_agentId, _threadId, path) { return demoArtifactRead(path) },
  }
}

/** 产物面板按 identity.projectId 过滤路径段；projectId 在首次 run 时记录。 */
function storedProjectId(storage: DemoStorage, threadId: string): string {
  try { return storage.getItem(PROJECT_KEY_PREFIX + encodeURIComponent(threadId)) ?? '' } catch { return '' }
}
