export interface ResearchProgressHint {
  phase: string
  awaitingInput: boolean
  currentWork: string
  nextStep: string
  state: string
  nextStage?: string
}

/** Interpret only the final structured ledger. This never proves stage approval. */
export function readResearchProgress(text: string): ResearchProgressHint | null {
  const marker = text.lastIndexOf('[进度]')
  if (marker < 0) return null
  const line = text.slice(marker).trim().replace(/＝/g, '=')
  const fields = /^\[进度\]\s*阶段\s*=\s*(G[1-4])(?:\s*[（(](?:已通过|已完成|待确认|待审核)[）)])?\s*完成\s*=\s*([\s\S]*?)\s*进行中\s*=\s*([\s\S]*?)\s*剩余\s*=\s*([\s\S]*?)\s*下步\s*=\s*([\s\S]*?)\s*状态\s*=\s*([^\r\n]+)\s*$/u.exec(line)
  if (!fields) return null
  const phase = fields[1]!
  const currentWork = fields[3]!.replace(/\s+/g, '')
  const nextStep = fields[5]!.replace(/\s+/g, '')
  const state = fields[6]!.trim()
  const nextStage = 'G' + (Number(phase.slice(1)) + 1)
  const summary = {phase,currentWork:fields[3]!.trim(),nextStep:fields[5]!.trim(),state}
  const requestedStage=/^等待(?:团队|用户)?确认(?:是否)?进入(G[2-4])$/u.exec(nextStep)?.[1]
  if (currentWork === '无' && ['部分完成','等待人工'].includes(state)
      && ['G2', 'G3', 'G4'].includes(nextStage)
      && requestedStage === nextStage) {
    return {...summary, awaitingInput: true, nextStage}
  }
  const awaitingTeamItems = phase === 'G2'
    && currentWork === '等待团队题项清单' && state === '等待人工'
  const awaitingMaterials = phase === 'G3' && currentWork === '无'
    && state === '已阻塞' && /^等待团队提交原始数据[与和]分析计划$/u.test(nextStep)
  return {...summary, awaitingInput: awaitingTeamItems || awaitingMaterials || researchG3Action({...summary,awaitingInput:false})?.kind==='statistics'}
}


/** Describe a G3 input request without treating it as permission to run statistics. */
export function researchG3Action(progress:ResearchProgressHint|null) {
  if(progress?.phase!=='G3')return null
  const next=progress.nextStep.replace(/\s+/g,'')
  const waiting=['等待人工','已阻塞','部分完成'].includes(progress.state.trim())
  if(waiting && progress.currentWork.replace(/\s+/g,'')==='无'
      && /^等待(?:团队|用户)?确认(?:后)?(?:执行|启动)?统计(?:执行)?$/u.test(next)){
    return {
      kind:'statistics' as const,badge:'待确认统计',label:'查看分析计划与待确认事项',
      description:'当前等待统计执行确认。先查看分析计划，核对后再决定是否批准执行。',
      message:'请展示当前的数据范围、分析计划、准备执行的统计方法及结果用途，并列出仍需我确认的事项。材料已核对完整时请勿重复核验或要求重传。本消息仅查看计划，暂不执行统计，等待我明确批准。',
    }
  }
  if(waiting && /^等待.*(?:上传|提交|提供).*(?:原始数据|数据CSV|CSV|分析计划)/iu.test(next)){
    return {
      kind:'materials' as const,badge:'待补充材料',label:'查看缺少的材料清单',
      description:'当前进度记录要求补充材料。请先查看具体缺口，再上传对应文件。',
      message:'请逐项列出本研究确实缺少的文件、字段或分析计划，并说明已有文件是否已读取及具体缺口。已核对完整的材料无需重复核验。本消息只请求说明，暂不执行统计。',
    }
  }
  return {
    kind:'unknown' as const,badge:'待确认下一步',label:'查看当前需要确认的事项',
    description:'请先核对当前等待的具体事项。',
    message:'请说明当前是在等待补充材料、确认分析计划还是确认执行统计，并结合当前会话已有材料列出下一步所需事项。暂不执行统计。',
  }
}
