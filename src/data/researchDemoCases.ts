export const PART_TIME_DEMO_CASE_ID = 'college-part-time-satisfaction-pca'

export interface ResearchDemoRow {
  label: string
  question: string
  method: string
  finding: string
}

export interface ResearchDemoEvidenceRow {
  source: string
  scope: string
  supports: string
  limitation: string
}

export interface ResearchDemoCase {
  id: string
  title: string
  tag: string
  summary: string
  intro: string
  note: string
  rows: ResearchDemoRow[]
  info: string[]
  callout: string
  items: { dimension: string; sample: string; scale: string }[]
  evidenceRows: ResearchDemoEvidenceRow[]
  attach: string
  sourceNote: string
  sourceDocuments: string[]
  researchQuestions: string[]
  methods: string[]
  questionnaireThemes: string[]
  schedule: { period: string; work: string }[]
  metrics: {
    pretestSamples: number
    formalAcceptedResponses: number
    reliability: number
    validity: number
    originalVariables: number
    kmo: number
    pcaComponents: number
    pcaCumulativeVariance: string
    factors: string[]
    modelCoefficients: number[]
  }
}

const partTimeDemo: ResearchDemoCase = {
  id: PART_TIME_DEMO_CASE_ID,
  title: '德才\u2018兼\u2019备，机深\u2018智\u2019远——大学生兼职现状调查及影响因素研究',
  tag: '历届参赛案例 · 材料演示',
  summary: '围绕大学生兼职现状与影响因素开展调查，材料覆盖学生兼职经历、兼职信息与市场、权益风险及高校和用工方等相关主体。PCA 分析材料进一步聚焦兼职满意度影响因素。',
  intro: '本页按提供的计划书、问卷题库和 PCA 分析文档整理为本机固定脚本演示；不连接智能体，不读取或重算个人问卷记录。',
  note: '来源材料报告：正式问卷最终采纳量为 600 份；信度 0.822、效度 0.716。PCA 文档报告 KMO=0.708，提取 5 个主成分，累积方差贡献率 67.034%。材料标题对“兼职现状及影响因素”与“兼职满意度影响因素”的聚焦不完全一致，模型系数口径也需要回查原文；正式使用前应统一因变量、核对问卷版本并以原始数据复算。以上均为材料报告值，不是本页或后端的运行结果。',
  rows: [
    { label: '赛事理解', question: '先把计划书、问卷题库与 PCA 分析放在同一张材料清单里，区分研究主题和分析对象。', method: '核对研究对象、兼职现状、满意度及影响因素等核心概念；逐份记录材料能回答什么、缺少什么。', finding: '计划书聚焦大学生兼职现状及影响因素，PCA 文档标题转向兼职满意度影响因素；两者的研究口径需要人工统一。' },
    { label: '选题分析', question: '把大学生兼职主题拆成可调查的问题，并把描述现状与解释满意度分开。', method: '围绕兼职经历与类型、动机与信息来源、工时报酬、权益风险、满意度、高校支持和职业规划形成问题链。', finding: '建议先定义“兼职满意度”并确认它在研究模型中的位置，再决定哪些问题用于描述、分组或解释。' },
    { label: '研究方向', question: '将已有研究设计与可用统计方法对应到具体问题，说明每种方法需要什么数据。', method: '计划书列出文献研究、访谈和问卷调查；分析材料包含描述统计、文本分析、K-means、非参数检验、多重响应、PCA 与相关分析。', finding: '这是对文档方法清单的整理，不代表已在本页重新运行这些分析；需按题项编码、变量类型和实际样本逐项确认适用性。' },
    { label: '问卷与测试', question: '按研究问题梳理题项主题与变量编码，先核对题库版本，再决定量表结构。', method: '检查题干、选项、跳转、变量名和题项来源；把预测试与正式调查分开记录，确认信效度使用的题项集合。', finding: '计划书记载预测试 78 份，并报告信度 0.822、效度 0.716；题库中存在题号或选项重复，定稿前需核对版本。' },
    { label: '正式调查', question: '依据材料中已有的调查安排复原正式调查步骤，不把历史材料展示成现场采集。', method: '核对目标对象、发放渠道、时间、有效性标准与停止规则；区分计划样本、实际回收和最终采纳量。', finding: '计划书记录正式调查安排为 2022-01-19 至 2022-01-31，最终问卷采纳量为 600 份；本页未连接发布或回收服务。' },
    { label: '数据分析', question: '从原始问卷清洗、变量编码和统计口径开始，再复核 PCA 与结论的证据链。', method: '按材料中 12 个原始变量检查 KMO、提取成分、方差解释、载荷与命名；另行核对报告中的相关及模型系数。', finding: 'PCA 文档报告 KMO=0.708、5 个主成分、累积方差贡献率 67.034%；本机只展示这些来源汇总值，没有导入或重算个体数据。' },
  ],
  info: [
    '计划书题目聚焦“大学生兼职现状及影响因素”；PCA 文档标题聚焦“兼职满意度影响因素”，研究结果合并前需要先统一口径。',
    '计划书记载预测试 78 份、正式问卷最终采纳 600 份；当前仅引用文档汇总数字。',
    'PCA 文档报告 12 个原始变量、KMO=0.708、5 个主成分及 67.034% 累积方差贡献率；未在此重算。',
    '问卷题库有重复题号或选项，须确认最终问卷版本与题项编码。',
  ],
  callout: '证据边界：压缩包含受访者标识及位置字段的原始数据文件；本演示不复制、不展示这些记录，只引用报告中的汇总结果。',
  items: [
    { dimension: '兼职经历与类型', sample: '题库主题摘要；正式题干请以核验后的问卷版本为准', scale: '题型／编码待核对' },
    { dimension: '兼职动机与信息来源', sample: '题库主题摘要；正式题干请以核验后的问卷版本为准', scale: '题型／编码待核对' },
    { dimension: '工时、报酬与权益风险', sample: '题库主题摘要；正式题干请以核验后的问卷版本为准', scale: '题型／编码待核对' },
    { dimension: '满意度、学校支持与职业规划', sample: '题库主题摘要；正式题干请以核验后的问卷版本为准', scale: '题型／编码待核对' },
  ],
  evidenceRows: [
    { source: '市调计划书4.11.二.docx', scope: '研究设计、预测试与正式调查安排', supports: '调查主题、方法清单、78 份预测试、最终采纳量 600 份及报告统计摘要', limitation: '计划与摘要不能替代逐条原始记录核验；“采纳量”不等同于已知发放量或回收率。' },
    { source: '兼职问卷题库.docx', scope: '题项主题与问卷草稿', supports: '兼职经历、动机、信息、工时报酬、权益、高校支持与职业规划等题项主题', limitation: '题号／选项有重复，不能直接认定为最终发放版本。' },
    { source: '主成分分析05181512.docx', scope: 'PCA 方法与汇总结果', supports: '12 个变量、KMO=0.708、5 个成分、67.034% 累积方差贡献率及因子名称', limitation: '未带入个体答卷复算；模型系数及变量口径须结合完整模型定义复核。' },
  ],
  attach: '来源材料：市调计划书、兼职问卷题库、主成分分析文档；仅整理汇总信息，未复制个人答卷。',
  sourceNote: '来源报告汇总值 · 未导入个人答卷 · 未重新计算 · 非实时智能体结果',
  sourceDocuments: ['市调计划书4.11.二.docx', '兼职问卷题库.docx', '主成分分析05181512.docx'],
  researchQuestions: [
    '大学生兼职经历、类型与信息来源呈现什么现状？',
    '兼职动机、工时、报酬与权益风险有哪些材料可支持的描述？',
    '问卷中的兼职满意度应如何定义，并与兼职现状区分？',
    '高校、用工方与学生分别能采取哪些与证据匹配的改进措施？',
  ],
  methods: ['文献研究', '访谈', '问卷调查', '描述统计', '文本分析／词云', 'K-means 聚类', '非参数检验', '多重响应分析', '主成分分析', '相关分析'],
  questionnaireThemes: ['兼职经历与类型', '兼职动机与信息来源', '工时与报酬', '权益保障与风险', '满意度与兼职态度', '高校支持与职业规划'],
  schedule: [
    { period: '2022-01-08 至 2022-01-15', work: '预测试' },
    { period: '2022-01-19 至 2022-01-31', work: '正式调查' },
    { period: '2022-02-01 至 2022-02-05', work: '数据审核' },
    { period: '2022-02-09 至 2022-02-20', work: '统计分析' },
    { period: '2022-02-21 至 2022-03-10', work: '报告撰写' },
  ],
  metrics: {
    pretestSamples: 78,
    formalAcceptedResponses: 600,
    reliability: 0.822,
    validity: 0.716,
    originalVariables: 12,
    kmo: 0.708,
    pcaComponents: 5,
    pcaCumulativeVariance: '67.034%',
    factors: ['实习选择因素', '个人偏好因素', '个人情况因素', '职后态度因素', '职业规划因素'],
    modelCoefficients: [0.242, 0.124, 0.118, 0.102, 0.084],
  },
}

export function getResearchDemoCase(id: string | undefined): ResearchDemoCase | null {
  return id === partTimeDemo.id ? partTimeDemo : null
}
