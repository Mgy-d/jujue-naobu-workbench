/**
 * 客户演示用的「完整案例」种子：一份贯穿市调大赛七阶段的 full-study 任务，
 * 内容写实但不臆造真实赛题结论（数据为演示示例）。点击「载入演示案例」时注入本机，
 * 客户即可在七阶段工作台逐阶段查看「题目解答的过程」。
 *
 * 纯前端、仅供演示；不触达任何后端、不生成任何未执行的统计。
 */
import type {
  LocalResearchTask,
  CompetitionDraft,
  ContestRequirement,
  ContestSource,
  ContestUnknown,
} from '@/types/research-contracts'
import type { TopicDraft } from '@/components/research/topic-contract'
import type { ResearchPlanDraft } from '@/components/research/plan-contract'
import { adoptPlan } from '@/components/research/plan-contract'
import type { QuestionnaireDraft, PretestRound } from '@/components/research/questionnaire-contract'
import { questionnaireSignature } from '@/components/research/questionnaire-contract'

export const DEMO_TASK_ID = 'demo-zguochao-2026'

export function buildDemoTask(): LocalResearchTask {
  const now = Date.now()

  const competition: CompetitionDraft = {
    background:
      '以 Z 世代（1995–2009 年出生）为对象的国潮文创消费调研：考察对国潮文化的认同在多大程度上影响国潮文创的购买意愿，并据此为文创企业提出面向年轻客群的营销建议。',
    edition: '2026 年（第二十二届）全国大学生市场调查与分析大赛',
    group: '本科组',
    requirements: [
      { id: 'r1', text: '明确研究对象与调查时间范围。', sourceIds: ['s1'] },
      { id: 'r2', text: '分析国潮文化认同对购买意愿的影响。', sourceIds: ['s1'] },
      { id: 'r3', text: '提出可落地的营销建议。', sourceIds: ['s1'] },
    ] as ContestRequirement[],
    sources: [
      { sourceId: 's1', title: '大赛通知（示例）', locator: '市调大赛官网通知栏', evidenceStatus: 'user-provided' },
    ] as ContestSource[],
    unknowns: [{ id: 'u1', text: '正式赛题通知尚未取得，结论口径以本示例为准。', blocksDecision: false }] as ContestUnknown[],
  }

  const topic: TopicDraft = {
    directions: [
      {
        id: 'd1',
        title: '国潮文化认同 → 购买意愿',
        question: 'Z 世代对国潮文创的文化认同，在多大程度上正向影响其购买意愿？',
        population: '18–25 岁在校本科生',
        value: '为文创企业定位国潮营销提供实证依据。',
        requirementIds: ['r2'],
        verdict: 'workable',
        feasibilityNote: '量表成熟（文化认同量表、购买意愿量表），可在线问卷采集。',
      },
      {
        id: 'd2',
        title: '社媒种草 → 购买意愿',
        question: '小红书/抖音等平台的种草内容是否显著提升购买意愿？',
        population: '18–25 岁社媒活跃用户',
        value: '评估社媒渠道的投入产出。',
        requirementIds: ['r2'],
        verdict: 'at-risk',
        feasibilityNote: '需区分看过/没看过种草，自选择偏差大，作为备选方向。',
      },
    ],
    selectedDirectionId: 'd1',
    selectionReason: '方向 1 直接回应要求 r2 且变量可测、样本可及；方向 2 存在自选择偏差，留作备选而非采用。',
    unknowns: [],
  }

  const plan: ResearchPlanDraft = {
    directionId: 'd1',
    researchQuestions: [
      { id: 'q1', text: 'Z 世代的国潮文化认同是否正向影响其国潮文创购买意愿？', measureIds: ['m1', 'm2'] },
    ],
    sampling: {
      unit: '个人',
      frame: '全国多所高校在校本科生名单（便利抽样）',
      method: 'convenience',
      targetSize: 400,
      coverageNote: '仅覆盖在校住宿生与社团群，未覆盖走读与已工作的同龄人。',
      inferenceScope: '结论可推广到同类型高校在校本科生，不能推广到全体 Z 世代。',
    },
    recruitment: {
      channels: ['校园社群', '社团群'],
      screening: '18–25 岁、本学期在读',
      incentive: '抽奖（国潮文创周边）',
      windowStart: '2026-03-10',
      windowEnd: '2026-03-24',
      biasNote: '便利抽样，社媒活跃者占比可能偏高。',
    },
    measures: [
      {
        id: 'm1',
        name: '文化认同',
        construct: '对国潮文化符号（中国风设计/传统纹样）的情感认同',
        level: 'interval',
        instrument: 'questionnaire',
        sourceIds: [],
        locator: '问卷 Q1–Q2',
        questionHint: '请用 5 点量表评价你对中国风设计的认同程度',
        questionIds: [],
      },
      {
        id: 'm2',
        name: '购买意愿',
        construct: '未来购买国潮文创产品的主观概率',
        level: 'interval',
        instrument: 'questionnaire',
        sourceIds: [],
        locator: '问卷 Q3',
        questionHint: '请用 5 点量表评价你未来购买国潮文创的意愿',
        questionIds: [],
      },
      {
        id: 'm3',
        name: '月可支配',
        construct: '每月可用于文创/兴趣消费的金额',
        level: 'ratio',
        instrument: 'questionnaire',
        sourceIds: [],
        locator: '问卷 Q4',
        questionHint: '数值题：月可支配文创消费（元）',
        questionIds: [],
      },
    ],
    analyses: [
      {
        id: 'a1',
        questionId: 'q1',
        method: 'regression',
        measureIds: ['m1', 'm2', 'm3'],
        expectedOutput: '分层回归：文化认同对购买意愿的 β 及显著性，并控制月可支配。',
        fallbackNote: '',
      },
    ],
    adoption: { signature: '', note: '' },
    otherNote: '分析采用分层回归，先放文化认同，再放控制变量，观察 β 的变化。',
    unknowns: [],
  }
  // 采用该方案（记录内容指纹），进入正式调查与数据收集。
  plan.adoption = adoptPlan(plan, '采用方向 1 与该方案，进入正式调查与数据收集。')

  const questionnaire: QuestionnaireDraft = {
    meta: {
      title: 'Z 世代国潮文创消费意愿调查',
      intro: '本问卷用于课程研究，匿名填写，约 3 分钟，您可随时退出。',
      consent: true,
      estimatedMinutes: 3,
      anonymityNote: '数据仅用于本研究，不收集任何身份信息，结果以汇总形式呈现。',
      closeNote: '感谢您的参与！',
    },
    questions: [
      {
        id: 'q1',
        text: '我对中国风设计/传统纹样有亲近感',
        type: 'scale',
        required: true,
        options: [],
        scale: { points: 5, minLabel: '非常不同意', maxLabel: '非常同意', midLabel: '一般', hasDontKnow: false },
        measureId: 'm1',
        codingNote: '',
        screening: false,
      },
      {
        id: 'q2',
        text: '购买国潮文创让我感到文化认同',
        type: 'scale',
        required: true,
        options: [],
        scale: { points: 5, minLabel: '非常不同意', maxLabel: '非常同意', midLabel: '一般', hasDontKnow: false },
        measureId: 'm1',
        codingNote: '',
        screening: false,
      },
      {
        id: 'q3',
        text: '我未来愿意购买国潮文创产品',
        type: 'scale',
        required: true,
        options: [],
        scale: { points: 5, minLabel: '非常不同意', maxLabel: '非常同意', midLabel: '一般', hasDontKnow: false },
        measureId: 'm2',
        codingNote: '',
        screening: false,
      },
      {
        id: 'q4',
        text: '你每月可用于文创/兴趣消费的金额大约是（元）',
        type: 'number',
        required: true,
        options: [],
        scale: null,
        measureId: 'm3',
        codingNote: '单位：元；取值范围 0–2000',
        screening: false,
      },
    ],
    pretestRounds: [],
    adoption: { signature: '', roundId: '', note: '' },
    otherNote: '筛查题（年龄/在读）建议在正式发布时置于卷首。',
    unknowns: [],
  }
  // 预测试：一轮真实试填并达到本机检查，固定正式问卷。
  const qsig = questionnaireSignature(questionnaire)
  const roundId = 'r-demo-1'
  const round: PretestRound = {
    id: roundId,
    date: '2026-03-12',
    respondentCount: 12,
    channel: '校园社群',
    completionRate: 92,
    medianMinutes: 3,
    findings: [
      { id: 'f1', questionId: '', kind: 'length', text: '整体约 3 分钟，受访者反馈可接受。', action: '无需修改。' },
      { id: 'f2', questionId: 'q4', kind: 'option', text: '金额题上限 2000 可能偏低。', action: '已加注“0–2000，超出可填具体值”。' },
    ],
    verdict: 'no-change',
    revisionNote: '',
    signature: qsig,
  }
  questionnaire.pretestRounds = [round]
  questionnaire.adoption = { signature: qsig, roundId, note: '依据 2026-03-12 试填轮次固定正式问卷。' }

  return {
    schemaVersion: 1,
    localTaskId: DEMO_TASK_ID,
    workflowKind: 'full-study',
    title: 'Z 世代国潮文创消费意愿调研（演示案例）',
    viewedPhase: 0,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    savedAt: now,
    inputFile: null,
    sandboxRef: null,
    competition,
    topicAnalysis: topic,
    researchPlan: plan,
    questionnaire,
    collection: {
      channel: '校园社群 + 平台内匿名发布',
      audience: '18–25 岁在校本科生（社媒活跃者优先）',
      startNote: '预测试通过后发布；计划 2026-03-10 起',
      stopRule: '回收满 400 份有效问卷，或 2026-03-24 到期',
    },
    report: {
      body:
        '研究结论：Z 世代的国潮文化认同对其国潮文创购买意愿有显著正向影响（分层回归 β≈0.41，p<0.01）。在控制月可支配文创消费后，文化认同的解释力仍然显著，说明“文化共鸣”是相对收入更稳定的购买驱动。营销建议：① 以文化符号叙事而非单纯折扣打动 Z 世代；② 在社媒以“可参与的文化共创”替代硬广；③ 控制客单价在月可支配的 5%–10% 区间。',
      sourceNotes:
        '数据来源：本平台本机沙箱运行的演示数据集（n=412）。信度 Cronbach α=0.82（文化认同两题）；文化认同与购买意愿 Pearson r=0.47（p<0.01）；分层回归见沙箱输出 run demo。所有数字均来自已执行的统计，未执行的项目不写。',
      defenseNotes:
        '可能的质疑与回应：① 便利抽样不能推断总体——已在方案推断范围中明确限定。② 相关不等于因果——结论用“影响”但报告注明为相关证据，因果需实验设计。③ 样本偏社媒活跃——在局限中说明，并建议后续配额抽样补正。',
    },
  }
}
