/**
 * 市调大赛赛题库（板块演示数据）。
 *
 * 供「市调大赛」板块的赛题详情页（ContestProblemView）与首页赛题卡片区使用。
 * 结构参考实训指导书形态：指导书章节 / 调研流程演示 / 问卷与分析 / 成果示例。
 * 全部为前端静态演示数据：真实赛题、真实回收数据与正式保存仍待服务端接入，
 * 页面上所有数字均为示例口径，不作为真实调查结论。
 */
export interface GuideChapter {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
  callout?: string
}

export interface DemoStep {
  title: string
  desc: string
}

export interface ScaleItem {
  dimension: string
  sample: string
  scale: string
}

export interface ResultRow {
  question: string
  method: string
  finding: string
}

export interface ContestProblem {
  id: string
  title: string
  tag: string
  cat: string
  year: string
  level: string
  difficulty: string
  team: string
  views: string
  duration: string
  wordCount: string
  /** 题面导语：详情页顶部与「复现」带入阶段 1 的赛事理解背景 */
  summary: string
  background: string
  guide: GuideChapter[]
  demo: DemoStep[]
  questionnaire: {
    intro: string
    items: ScaleItem[]
    codeCaption: string
    code: string
  }
  results: {
    intro: string
    rows: ResultRow[]
    note: string
  }
}

export const CONTEST_PROBLEMS: ContestProblem[] = [
  {
    id: 'c2026-community-group-buying',
    title: '社区团购平台用户复购行为调研',
    tag: '2026年C题',
    cat: '市调大赛',
    year: '2026',
    level: '本科',
    difficulty: '中等',
    team: '3人',
    views: '6,945 次浏览',
    duration: '建议实训时长 8 课时',
    wordCount: '全文约 12,000 字',
    summary:
      '某社区团购平台在下沉市场快速扩张，但近两个季度月度复购率连续下滑。本题要求围绕「谁在复购、为什么不复购、平台能做什么」完成一份完整的调研：从研究问题界定、抽样与问卷设计，到数据清洗、统计分析和运营建议报告。',
    background:
      '市调大赛 2026 年 C 题：社区团购平台用户复购行为调研。平台在下沉市场扩张但复购率连续两个季度下滑，需围绕复购现状、影响因素与分层运营建议开展完整市场调研，产出可核查的结论与建议。需自行界定研究问题、完成抽样与问卷设计、用示例数据完成分析并撰写报告。',
    guide: [
      {
        id: 'ch1',
        title: '一、赛题重述与信息结构',
        paragraphs: [
          '本题的调研对象是某社区团购平台的注册用户，核心问题是复购行为的现状与成因。题目给出三类可用信息：平台订单流水（脱敏抽样）、存量用户问卷回收数据、少量团长深访记录。三类信息的口径、覆盖人群和缺失程度都不同，不能直接混用。',
          '动手前先完成两件事：把「复购」的操作性定义写清楚（例如：90 天内在该平台下单 ≥2 次记为复购用户）；把每一类信息「能回答什么、不能回答什么」列成一张信息清单。',
        ],
        bullets: [
          '问题一：复购现状如何？需要订单流水 + 用户画像；',
          '问题二：哪些因素影响复购？需要问卷量表 + 订单行为；',
          '问题三：不同用户群应如何分层运营？需要聚类 + 交叉验证；',
          '问题四：满意度在「信任 → 复购」中起什么作用？需要结构化的量表与路径分析。',
        ],
        callout:
          '与这一步的关键是先理出「一张信息清单」：每个研究问题对应哪些数据、缺什么、去哪里补。清单理清了，后面的抽样和分析才不会跑偏。',
      },
      {
        id: 'ch2',
        title: '二、抽样设计与问卷预测试',
        paragraphs: [
          '抽样按「城市层级 × 团购品类活跃度」做分层，各层按订单占比分配样本量；在 95% 置信水平、5% 容许误差下，最低有效样本约 384 份，考虑 20% 无效率，计划回收不少于 480 份。',
          '问卷初稿完成后必须做预测试：找 30 名左右目标用户试填，检查题干歧义、填答时长和量表信度（Cronbach α ≥ 0.7），再定稿正式版本。预测试与正式回收的数据要分开保存。',
        ],
      },
      {
        id: 'ch3',
        title: '三、数据处理与探索性分析',
        paragraphs: [
          '清洗顺序固定：先逻辑校验（填答时长过短、反向题全同分），再处理缺失，最后统一口径。对渠道来源不同的样本计算加权权重，避免某渠道过度代表。',
          '探索分析先做复购漏斗和 RFM 分层，把「现状」讲清楚；再对影响复购的候选因素做交叉和显著性检验，为下一章的建模筛选变量。',
        ],
      },
      {
        id: 'ch4',
        title: '四、从描述到解释：分析思路升级',
        paragraphs: [
          '在描述基础上，用逻辑回归识别复购的显著影响因素，报告比值比（OR）及其置信区间；对「信任 → 满意度 → 复购」的路径做中介检验。',
          '注意两点：一是自选择问题——流失用户往往不在回收样本里，结论外推要说明边界；二是交叉表单元格样本量过小时不下强结论。',
        ],
      },
      {
        id: 'ch5',
        title: '五、结果、稳健性与局限',
        paragraphs: [
          '对核心结论做分样本稳健性检验（按城市层级、按渠道来源分别重跑），报告结论是否一致。每一处关键数字都要能追溯到具体的数据文件和处理步骤。',
          '如实写出局限：回忆偏差、渠道覆盖不均、横截面数据无法做严格因果推断。局限写清楚反而提高报告可信度。',
        ],
      },
      {
        id: 'ch6',
        title: '六、报告撰写与答辩准备',
        paragraphs: [
          '报告按「结论先行」组织：每章开头一句话给出该章结论，再用图表与数据支撑。运营建议要与数据发现一一对应，说明「依据哪条发现、针对哪类人群、预期什么效果」。',
          '答辩准备重点准备三个追问：样本代表性依据、显著但效应量小的因素如何解读、建议的实施成本与优先级。',
        ],
      },
    ],
    demo: [
      { title: '界定研究问题', desc: '把赛题拆成 4 个可回答的研究问题，列出信息清单与缺口。' },
      { title: '抽样与招募', desc: '按城市层级 × 品类活跃度分层，计算样本量并制定招募配额。' },
      { title: '问卷预测试', desc: '30 人试填，检查题干歧义与量表信度，定稿正式版本。' },
      { title: '正式发放与回收', desc: '多渠道投放并记录渠道来源，回收过程留痕、可核查。' },
      { title: '清洗与分析', desc: '逻辑校验 → 缺失处理 → 加权 → 漏斗与交叉 → 回归与中介。' },
      { title: '报告与答辩', desc: '结论先行撰写报告，准备样本代表性与效应量解读的追问。' },
    ],
    questionnaire: {
      intro: '以下为该题问卷核心量表的节选示例（正式问卷含甄别、行为与开放题，共 28 题）：',
      items: [
        { dimension: '复购意愿', sample: '未来 30 天内，我愿意继续在该平台下单', scale: '李克特 5 级' },
        { dimension: '感知价值', sample: '在该平台购物，我觉得物有所值', scale: '李克特 5 级' },
        { dimension: '平台信任', sample: '我相信该平台的商品质量是稳定的', scale: '李克特 5 级' },
        { dimension: '满意度', sample: '总体而言，我对该平台的购物体验满意', scale: '李克特 5 级' },
      ],
      codeCaption: '示例分析脚本（Python · 实际数据待接入）',
      code: [
        'import pandas as pd',
        '',
        'df = pd.read_csv("orders_sample.csv", parse_dates=["pay_time"])',
        'df["repurchase"] = df.groupby("user_id")["order_id"].transform("count").ge(2)',
        '',
        'cross = pd.crosstab(df["city_tier"], df["repurchase"], normalize="index")',
        'print(cross.round(3))',
      ].join('\n'),
    },
    results: {
      intro: '以下为基于示例数据的成果摘要（口径与数字仅作演示）：',
      rows: [
        { question: '问题一 · 复购现状', method: 'RFM 分层 + 复购漏斗', finding: '90 天复购率 41.2%，生鲜品类贡献 63% 的复购订单' },
        { question: '问题二 · 影响因素', method: '逻辑回归（OR）', finding: '配送时效（OR=1.8）与缺货率（OR=0.6）最为显著' },
        { question: '问题三 · 分层运营', method: 'K-means 聚类 + 交叉验证', finding: '价格敏感型高价值用户占 22%，宜用满减券触达' },
        { question: '问题四 · 满意度的作用', method: '中介效应检验', finding: '满意度部分中介「信任 → 复购」的影响（占比 34%）' },
      ],
      note: '成果中的每个数字须可追溯到具体数据文件与处理步骤；本页为演示数据，正式成果以真实调查与回收数据为准。',
    },
  },
  {
    id: 'c2026-nev-lower-market',
    title: '新能源汽车下沉市场购买意愿调查',
    tag: '2026年A题',
    cat: '市调大赛',
    year: '2026',
    level: '本科',
    difficulty: '较难',
    team: '3人',
    views: '5,128 次浏览',
    duration: '建议实训时长 10 课时',
    wordCount: '全文约 14,000 字',
    summary:
      '新能源汽车渗透率在县域与乡镇市场快速上升，但购买决策链条与一线城市差异显著。本题要求评估下沉市场消费者的购买意愿、顾虑与决策路径，为渠道下沉策略提供依据。',
    background:
      '市调大赛 2026 年 A 题：新能源汽车下沉市场购买意愿调查。需评估县域及乡镇消费者的购买意愿、核心顾虑与信息渠道，完成抽样、问卷与深访结合的混合调研设计，产出渠道下沉策略建议。',
    guide: [
      {
        id: 'ch1',
        title: '一、赛题重述与信息结构',
        paragraphs: [
          '调研对象为县域及乡镇的潜在购车人群。「下沉市场」不是单一整体：县城、中心镇与行政村的充电条件、收入结构与用车场景差异很大，必须先做市场分层再谈意愿。',
          '本题采用问卷 + 深访的混合设计：问卷回答「意愿有多强、顾虑是什么」，深访回答「决策是怎么做出来的」。两类证据在报告中要分开呈现、互相印证。',
        ],
        bullets: [
          '问题一：下沉市场各层的购买意愿与预算分布；',
          '问题二：核心顾虑（充电、保值、售后）的强度排序；',
          '问题三：购车决策的信息渠道与关键影响人；',
          '问题四：渠道下沉策略建议与优先级。',
        ],
      },
      {
        id: 'ch2',
        title: '二、混合调研设计与预测试',
        paragraphs: [
          '问卷按县 / 镇 / 村三层配额抽样，深访按「已购车主、意向用户、持币观望」三类目的性抽样各 6-8 人。访问提纲需经预访修订，避免诱导性提问。',
          '意愿类量表采用 5 级李克特量表并设置反向题；正式发放前完成 30 人预测试，报告信度与题项修订记录。',
        ],
      },
      {
        id: 'ch3',
        title: '三、数据处理与探索性分析',
        paragraphs: [
          '先做意愿得分与顾虑强度的描述统计，按市场分层对比；用对应分析呈现「顾虑 × 人群」的关联结构，找出各层最突出的顾虑组合。',
          '深访记录逐字编码，提炼决策路径的共性节点（触媒、比较、试驾、家人意见），与问卷发现相互印证或指出矛盾。',
        ],
      },
      {
        id: 'ch4',
        title: '四、意愿的解释模型',
        paragraphs: [
          '以「是否愿意 3 年内购买」为因变量建立逻辑回归，重点关注充电条件感知、保值预期与售后网点的效应方向与大小。',
          '报告必须区分统计显著与实际重要：效应量小但显著的因素不应进入策略建议的第一梯队。',
        ],
      },
      {
        id: 'ch5',
        title: '五、稳健性与局限',
        paragraphs: [
          '对意愿结论做分层稳健性检验；对深访结论做双编码一致性核对。明确局限：意向不等于购买、样本对无车家庭覆盖可能不足。',
        ],
      },
      {
        id: 'ch6',
        title: '六、报告与策略建议',
        paragraphs: [
          '策略建议按「依据 — 动作 — 优先级」呈现：每条建议注明数据依据与预期触达人群，避免没有证据支撑的泛泛建议。',
        ],
      },
    ],
    demo: [
      { title: '市场分层', desc: '县 / 镇 / 村三层界定用车场景与充电条件差异。' },
      { title: '混合设计', desc: '问卷定「强度」、深访定「路径」，两线并行。' },
      { title: '预测试与提纲修订', desc: '问卷 30 人试填、深访预访，修订后定稿。' },
      { title: '回收与编码', desc: '问卷分渠道回收留痕，深访逐字编码双核。' },
      { title: '建模与解释', desc: '对应分析找顾虑组合，逻辑回归识别显著因素。' },
      { title: '策略建议', desc: '依据—动作—优先级三段式给出下沉建议。' },
    ],
    questionnaire: {
      intro: '以下为该题核心量表节选（正式问卷共 31 题）：',
      items: [
        { dimension: '购买意愿', sample: '如果换购或首购，我会优先考虑新能源车', scale: '李克特 5 级' },
        { dimension: '充电顾虑', sample: '我担心住处附近没有方便的充电条件', scale: '李克特 5 级（反向计分）' },
        { dimension: '保值预期', sample: '我认为新能源车几年后还能卖出好价钱', scale: '李克特 5 级' },
        { dimension: '渠道信任', sample: '我更愿意在本地有网点的品牌购车', scale: '李克特 5 级' },
      ],
      codeCaption: '示例分析脚本（Python · 实际数据待接入）',
      code: [
        'import pandas as pd',
        '',
        'df = pd.read_csv("nev_survey.csv")',
        'worry = df.filter(like="worry_").mean().sort_values(ascending=False)',
        'print("顾虑强度排序：")',
        'print(worry.round(2))',
      ].join('\n'),
    },
    results: {
      intro: '以下为基于示例数据的成果摘要：',
      rows: [
        { question: '问题一 · 意愿分布', method: '分层描述统计', finding: '县城意向率 38%，行政村仅 17%，差距主要来自充电条件' },
        { question: '问题二 · 顾虑排序', method: '对应分析', finding: '县域最突出组合为「充电 + 售后」，镇村追加「保值」顾虑' },
        { question: '问题三 · 决策路径', method: '深访编码', finding: '家人意见与本地口碑是试驾前的两道关键闸门' },
        { question: '问题四 · 策略建议', method: '回归 + 效应量评估', finding: '共建桩合作应先于价格补贴进入第一梯队' },
      ],
      note: '本页为演示数据；意向数据不能直接当作销量预测，正式结论以真实调查为准。',
    },
  },
  {
    id: 'c2025-county-express-satisfaction',
    title: '县域快递服务满意度与忠诚度研究',
    tag: '2025年B题',
    cat: '市调大赛',
    year: '2025',
    level: '本科',
    difficulty: '中等',
    team: '3人',
    views: '4,367 次浏览',
    duration: '建议实训时长 8 课时',
    wordCount: '全文约 11,000 字',
    summary:
      '快递进村覆盖面持续扩大，但「最后一公里」的服务质量参差不齐。本题要求测量县域用户对不同快递品牌的服务满意度，识别忠诚度的关键驱动，并提出服务改进建议。',
    background:
      '市调大赛 2025 年 B 题：县域快递服务满意度与忠诚度研究。需测量县域用户对各快递品牌的满意度与忠诚度，识别关键驱动因素，完成从量表设计到改进建议的完整调研。',
    guide: [
      {
        id: 'ch1',
        title: '一、赛题重述与信息结构',
        paragraphs: [
          '调研对象为县域常住的快递高频用户。满意度是多维概念，先把它拆成：时效、派件方式、包裹完好、投诉处理、价格感知五个维度，再决定问卷结构。',
          '忠诚度不能只问「会不会推荐」，要同时测量行为意向（继续使用、首选）与态度意向（推荐、容忍度），两者结论可能不一致，要如实呈现。',
        ],
      },
      {
        id: 'ch2',
        title: '二、量表设计与信效度',
        paragraphs: [
          '五维度满意度各 3 个题项，忠诚度 4 个题项；预测试后计算 Cronbach α 与效度检验，删除低相关题项并记录修订过程。',
        ],
      },
      {
        id: 'ch3',
        title: '三、数据分析：满意度与差距',
        paragraphs: [
          '用「重要性—满意度」四象限（IPA）定位改进优先级：重要且不满意的维度是改进第一梯队。',
          '品牌间对比用同一口径的加权满意度，注明各品牌样本量与渠道构成差异。',
        ],
      },
      {
        id: 'ch4',
        title: '四、忠诚度驱动模型',
        paragraphs: [
          '以忠诚度为因变量，用多元回归检验各满意度维度的驱动强度；对「投诉处理」单独检验其修复效应。',
        ],
      },
      {
        id: 'ch5',
        title: '五、稳健性与局限',
        paragraphs: [
          '按县 / 乡分样本重跑驱动模型检验一致性；说明投诉用户样本占比偏低的局限及其对修复效应估计的影响。',
        ],
      },
      {
        id: 'ch6',
        title: '六、报告与改进建议',
        paragraphs: [
          '改进建议对应 IPA 第一梯队逐条展开，每条注明预期改善的满意度维度与可核查的验收口径。',
        ],
      },
    ],
    demo: [
      { title: '维度拆解', desc: '满意度拆为五维，忠诚度区分行为与态度意向。' },
      { title: '量表预测试', desc: '30 人试填，信效度检验后定稿。' },
      { title: '配额回收', desc: '按县 / 乡与使用频次配额回收，渠道留痕。' },
      { title: 'IPA 分析', desc: '重要性—满意度四象限定位改进优先级。' },
      { title: '驱动建模', desc: '回归识别忠诚度驱动，单独检验服务修复效应。' },
      { title: '改进建议', desc: '对应第一梯队给出可验收的改进口径。' },
    ],
    questionnaire: {
      intro: '以下为该题量表节选（正式问卷共 24 题）：',
      items: [
        { dimension: '时效满意度', sample: '包裹在承诺时间内送达', scale: '李克特 5 级' },
        { dimension: '投诉处理', sample: '我的问题在合理时间内得到了解决', scale: '李克特 5 级' },
        { dimension: '行为忠诚', sample: '下次寄件我会继续选择该品牌', scale: '李克特 5 级' },
        { dimension: '态度忠诚', sample: '我会向亲友推荐该快递品牌', scale: '李克特 5 级' },
      ],
      codeCaption: '示例分析脚本（Python · 实际数据待接入）',
      code: [
        'import pandas as pd',
        '',
        'df = pd.read_csv("express_survey.csv")',
        'ipa = pd.DataFrame({',
        '    "importance": df.filter(like="imp_").mean(),',
        '    "satisfaction": df.filter(like="sat_").mean(),',
        '})',
        'print(ipa.round(2))',
      ].join('\n'),
    },
    results: {
      intro: '以下为基于示例数据的成果摘要：',
      rows: [
        { question: '满意度现状', method: '加权多维评分', finding: '五维中「派件方式」满意度最低（3.1 / 5）' },
        { question: 'IPA 定位', method: '重要性—满意度四象限', finding: '「时效」与「投诉处理」落入重要且不满意象限' },
        { question: '忠诚度驱动', method: '多元回归', finding: '投诉处理对行为忠诚的驱动最强（β=0.36）' },
        { question: '服务修复', method: '分组对比', finding: '投诉被妥善解决的用户忠诚度回升至未投诉者水平' },
      ],
      note: '本页为演示数据；品牌对比结论依赖各品牌样本构成，正式结论以真实回收数据为准。',
    },
  },
  {
    id: 'c2026-genz-cultural-creative',
    title: 'Z 世代文创消费动机与场景调研',
    tag: '2026年D题',
    cat: '市调大赛',
    year: '2026',
    level: '本科',
    difficulty: '中等',
    team: '3人',
    views: '3,882 次浏览',
    duration: '建议实训时长 6 课时',
    wordCount: '全文约 10,000 字',
    summary:
      '博物馆文创、IP 联名与国潮产品持续走热，Z 世代是核心购买人群。本题要求刻画 Z 世代文创消费的动机结构与消费场景，为产品与营销提供依据。',
    background:
      '市调大赛 2026 年 D 题：Z 世代文创消费动机与场景调研。需刻画 Z 世代文创消费的动机结构、场景偏好与溢价接受度，完成问卷为主的调研设计与分析，产出产品与营销建议。',
    guide: [
      {
        id: 'ch1',
        title: '一、赛题重述与信息结构',
        paragraphs: [
          '「文创消费」在本题限定为：博物馆文创、IP 联名商品与国潮日用品三类。动机结构参考自我决定理论拆为：文化认同、社交表达、收藏偏好与实用价值四个维度。',
          '场景是本题的 特色变量：送礼物、自用收藏、社交分享的购买决策差异很大，问卷要按场景分别设问。',
        ],
      },
      {
        id: 'ch2',
        title: '二、抽样与预测试',
        paragraphs: [
          '对象为 18-28 岁在校及初入职场人群，按性别与城市层级配额抽样；预测试重点检查「动机」题项是否被理解为单一含义。',
        ],
      },
      {
        id: 'ch3',
        title: '三、探索性分析',
        paragraphs: [
          '先用因子分析验证动机结构是否成立，再用聚类得到动机人群画像；对溢价接受度做分场景对比。',
        ],
      },
      {
        id: 'ch4',
        title: '四、动机与消费行为',
        paragraphs: [
          '以「近半年是否购买」与「客单价区间」为因变量，检验各动机维度的预测力，注意社交表达动机在不同场景下的方向差异。',
        ],
      },
      {
        id: 'ch5',
        title: '五、局限',
        paragraphs: [
          '横截面数据难以区分「认同」与「跟风」；自报客单价存在回忆偏差，报告中要说明。',
        ],
      },
      {
        id: 'ch6',
        title: '六、报告与建议',
        paragraphs: [
          '产品与营销建议按动机人群分别给出：触达渠道、内容调性与定价区间，注明每条建议对应的人群占比证据。',
        ],
      },
    ],
    demo: [
      { title: '概念界定', desc: '三类文创范围 + 四维动机结构 + 三类消费场景。' },
      { title: '配额抽样', desc: '按性别 × 城市层级配额，覆盖在校与职场人群。' },
      { title: '预测试', desc: '重点检查动机题项的单义性，修订后定稿。' },
      { title: '因子与聚类', desc: '验证动机结构，得到动机人群画像。' },
      { title: '行为建模', desc: '检验各动机维度对购买与客单价的预测力。' },
      { title: '人群化建议', desc: '按动机人群分别给出渠道、调性与定价建议。' },
    ],
    questionnaire: {
      intro: '以下为该题动机量表节选（正式问卷共 22 题）：',
      items: [
        { dimension: '文化认同', sample: '购买文创让我感到与传统文化有连接', scale: '李克特 5 级' },
        { dimension: '社交表达', sample: '我会因为文创产品适合分享而购买', scale: '李克特 5 级' },
        { dimension: '收藏偏好', sample: '我愿意为限量款文创支付更高价格', scale: '李克特 5 级' },
        { dimension: '实用价值', sample: '我更看重文创产品的日常实用性', scale: '李克特 5 级' },
      ],
      codeCaption: '示例分析脚本（Python · 实际数据待接入）',
      code: [
        'import pandas as pd',
        '',
        'df = pd.read_csv("wenchuang_survey.csv")',
        'scene_price = df.groupby("scene")["premium_ok"].mean()',
        'print("分场景溢价接受度：")',
        'print(scene_price.round(2))',
      ].join('\n'),
    },
    results: {
      intro: '以下为基于示例数据的成果摘要：',
      rows: [
        { question: '动机结构', method: '因子分析', finding: '四维结构成立，文化认同解释方差最大（31%）' },
        { question: '人群画像', method: 'K-means 聚类', finding: '「文化收藏型」占 27% 且溢价接受度最高' },
        { question: '场景差异', method: '分场景对比', finding: '送礼场景客单价最高，但决策周期最长' },
        { question: '营销建议', method: '回归 + 画像交叉', finding: '社交表达型宜用短视频种草，收藏型宜用限量策略' },
      ],
      note: '本页为演示数据；动机为自报数据，正式结论以真实调查为准。',
    },
  },
]

export function getContestProblem(id: string | undefined): ContestProblem | null {
  if (!id) return null
  return CONTEST_PROBLEMS.find((item) => item.id === id) ?? null
}
