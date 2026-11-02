import type { ActionContext, ArtifactRef, ContestCandidate, LocalResearchTask, ResearchResult } from '../types/research-contracts';
/** BA semantics only. Bind this adapter after actual paths, auth and response fixtures arrive. */
export interface ResearchGateway {
    saveCandidate(context: ActionContext, candidate: ContestCandidate, expectedRevision: number): Promise<ResearchResult<ArtifactRef>>;
}
export const BUSINESS_API_STATUS = { available: false, message: '正式项目、候选保存和阶段确认接口尚未接入。' } as const;
export const unavailableResearchGateway: ResearchGateway = { async saveCandidate() { return { ok: false, error: { code: 'CAPABILITY_UNAVAILABLE', message: BUSINESS_API_STATUS.message } }; } };
export async function saveContestCandidate(task: LocalResearchTask, context: ActionContext | null, expectedRevision: number | null, gateway: ResearchGateway = unavailableResearchGateway, isCurrent: () => boolean = () => true): Promise<ResearchResult<ArtifactRef>> {
    if (!context || expectedRevision === null)
        return { ok: false, error: { code: 'CAPABILITY_UNAVAILABLE', message: BUSINESS_API_STATUS.message } };
    if (task.workflowKind !== 'full-study' || context.workflowKind !== task.workflowKind || context.phase !== 0)
        return { ok: false, error: { code: 'PHASE_LOCKED', message: '当前任务或阶段不允许保存赛事理解候选。' } };
    const candidate: ContestCandidate = { kind: 'competition-understanding', content: JSON.parse(JSON.stringify(task.competition)), inputRefs: [], sourceRefs: task.competition.sources.map(s => ({ sourceId: s.sourceId, locator: s.locator, evidenceStatus: s.evidenceStatus })), producer: 'user', origin: 'manual', evidenceStatus: 'unverified' };
    try {
        const result = await gateway.saveCandidate(context, candidate, expectedRevision);
        if (!isCurrent())
            return { ok: false, error: { code: 'STALE_BASELINE', message: '任务或草稿已变化，本次返回未应用，请保留当前编辑并重新核对。' } };
        return result;
    }
    catch {
        return { ok: false, error: { code: 'PERSIST_FAILED', message: '候选保存失败，当前草稿已保留。' } };
    }
}
