import type { ContestSource, ContestUnknown, TopicAnalysisDraft, ResearchPlanDraft } from '../types/research-contracts';

export function emptyTopicAnalysisDraft(): TopicAnalysisDraft {
    return { candidates: [], selectedCandidateId: null, selectionReason: '', sources: [], unknowns: [] };
}
function uniqueIds(items: any[], key: string): boolean {
    return items.every(item => item && typeof item[key] === 'string' && item[key].trim()) && new Set(items.map(item => item[key])).size === items.length;
}
function normalizeEvidence(value: any): { sources: ContestSource[]; unknowns: ContestUnknown[] } | null {
    if (!Array.isArray(value?.sources) || !Array.isArray(value?.unknowns) || !uniqueIds(value.sources, 'sourceId') || !uniqueIds(value.unknowns, 'id')) return null;
    if (value.sources.some((s: any) => typeof s.title !== 'string' || typeof s.locator !== 'string' || !['unverified', 'user-provided', 'source-cited'].includes(s.evidenceStatus))) return null;
    if (value.unknowns.some((u: any) => typeof u.text !== 'string' || typeof u.blocksDecision !== 'boolean')) return null;
    return {
        sources: value.sources.map((s: ContestSource) => ({ sourceId: s.sourceId, title: s.title, locator: s.locator, evidenceStatus: s.evidenceStatus })),
        unknowns: value.unknowns.map((u: ContestUnknown) => ({ id: u.id, text: u.text, blocksDecision: u.blocksDecision })),
    };
}
export function normalizeTopicAnalysisDraft(value: any): TopicAnalysisDraft | null {
    const evidence = normalizeEvidence(value);
    if (!evidence || !Array.isArray(value.candidates) || !uniqueIds(value.candidates, 'id') || typeof value.selectionReason !== 'string') return null;
    const sources = new Set(evidence.sources.map(s => s.sourceId));
    if (value.candidates.some((c: any) => !['title', 'researchQuestion', 'targetPopulation', 'feasibility'].every(key => typeof c[key] === 'string') || !Array.isArray(c.sourceIds) || c.sourceIds.some((id: any) => typeof id !== 'string' || !sources.has(id)))) return null;
    if (value.selectedCandidateId !== null && (typeof value.selectedCandidateId !== 'string' || !value.candidates.some((c: any) => c.id === value.selectedCandidateId))) return null;
    return { ...evidence, candidates: value.candidates.map((c: any) => ({ id: c.id, title: c.title, researchQuestion: c.researchQuestion, targetPopulation: c.targetPopulation, feasibility: c.feasibility, sourceIds: [...c.sourceIds] })), selectedCandidateId: value.selectedCandidateId, selectionReason: value.selectionReason };
}
export function checkTopicAnalysisDraft(draft: TopicAnalysisDraft): string[] {
    const issues: string[] = [];
    if (!draft.candidates.length) issues.push('尚未整理候选方向。');
    for (const candidate of draft.candidates) {
        if (!candidate.title.trim() || !candidate.researchQuestion.trim() || !candidate.targetPopulation.trim() || !candidate.feasibility.trim()) issues.push('候选方向的名称、研究问题、调查对象或可行性尚未写全。');
        if (!candidate.sourceIds.length) issues.push('候选方向尚未关联依据来源。');
    }
    if (!draft.selectedCandidateId) issues.push('尚未记录本机拟选方向。');
    if (!draft.selectionReason.trim()) issues.push('尚未记录选择理由。');
    if (draft.sources.some(s => !s.title.trim() || !s.locator.trim())) issues.push('来源名称或定位信息尚未写全。');
    if (draft.unknowns.some(u => u.blocksDecision)) issues.push('仍有影响当前决定的未知项。');
    return [...new Set(issues)];
}

export function emptyResearchPlanDraft(): ResearchPlanDraft {
    return { researchQuestion: '', targetPopulation: '', samplingPlan: '', recruitmentPlan: '', measurementPlan: '', evidenceNeeds: '', analysisPlan: '', sources: [], unknowns: [] };
}
export function normalizeResearchPlanDraft(value: any): ResearchPlanDraft | null {
    const evidence = normalizeEvidence(value);
    if (!evidence || !['researchQuestion', 'targetPopulation', 'samplingPlan', 'recruitmentPlan', 'measurementPlan', 'evidenceNeeds', 'analysisPlan'].every(key => typeof value[key] === 'string')) return null;
    return { ...evidence, researchQuestion: value.researchQuestion, targetPopulation: value.targetPopulation, samplingPlan: value.samplingPlan, recruitmentPlan: value.recruitmentPlan, measurementPlan: value.measurementPlan, evidenceNeeds: value.evidenceNeeds, analysisPlan: value.analysisPlan };
}
export function checkResearchPlanDraft(draft: ResearchPlanDraft): string[] {
    const fields: [keyof ResearchPlanDraft, string][] = [['researchQuestion', '研究问题'], ['targetPopulation', '调查对象'], ['samplingPlan', '抽样安排'], ['recruitmentPlan', '招募安排'], ['measurementPlan', '测量安排'], ['evidenceNeeds', '证据需求'], ['analysisPlan', '分析计划']];
    const issues = fields.filter(([key]) => !(draft[key] as string).trim()).map(([, label]) => `尚未填写${label}。`);
    if (draft.sources.some(s => !s.title.trim() || !s.locator.trim())) issues.push('来源名称或定位信息尚未写全。');
    if (draft.unknowns.some(u => u.blocksDecision)) issues.push('仍有影响方案决定的未知项。');
    return issues;
}
