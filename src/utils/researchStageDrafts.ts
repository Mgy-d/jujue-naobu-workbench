import type { ContestSource, ContestUnknown, CompetitionDraft, TopicAnalysisDraft, ResearchPlanDraft, LegacyTopicAnalysisDraft, LegacyResearchPlanDraft } from '../types/research-contracts';
import { emptyTopicDraft, normalizeTopicDraft, checkTopicDraft } from '../components/research/topic-contract';
import { emptyPlanDraft, normalizePlanDraft, checkPlanDraft, type PlanUpstream } from '../components/research/plan-contract';

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
function normalizeLegacyTopicAnalysisDraft(value: any): LegacyTopicAnalysisDraft | null {
    const evidence = normalizeEvidence(value);
    if (!evidence || !Array.isArray(value.candidates) || !uniqueIds(value.candidates, 'id') || typeof value.selectionReason !== 'string') return null;
    const sources = new Set(evidence.sources.map(s => s.sourceId));
    if (value.candidates.some((c: any) => !['title', 'researchQuestion', 'targetPopulation', 'feasibility'].every(key => typeof c[key] === 'string') || !Array.isArray(c.sourceIds) || c.sourceIds.some((id: any) => typeof id !== 'string' || !sources.has(id)))) return null;
    if (value.selectedCandidateId !== null && (typeof value.selectedCandidateId !== 'string' || !value.candidates.some((c: any) => c.id === value.selectedCandidateId))) return null;
    return { ...evidence, candidates: value.candidates.map((c: any) => ({ id: c.id, title: c.title, researchQuestion: c.researchQuestion, targetPopulation: c.targetPopulation, feasibility: c.feasibility, sourceIds: [...c.sourceIds] })), selectedCandidateId: value.selectedCandidateId, selectionReason: value.selectionReason };
}
function normalizeLegacyResearchPlanDraft(value: any): LegacyResearchPlanDraft | null {
    const evidence = normalizeEvidence(value);
    if (!evidence || !['researchQuestion', 'targetPopulation', 'samplingPlan', 'recruitmentPlan', 'measurementPlan', 'evidenceNeeds', 'analysisPlan'].every(key => typeof value[key] === 'string')) return null;
    return { ...evidence, researchQuestion: value.researchQuestion, targetPopulation: value.targetPopulation, samplingPlan: value.samplingPlan, recruitmentPlan: value.recruitmentPlan, measurementPlan: value.measurementPlan, evidenceNeeds: value.evidenceNeeds, analysisPlan: value.analysisPlan };
}

export function emptyTopicAnalysisDraft(): TopicAnalysisDraft { return emptyTopicDraft(); }
export function emptyResearchPlanDraft(): ResearchPlanDraft { return emptyPlanDraft(); }

export function normalizeTopicAnalysisDraft(value: any): TopicAnalysisDraft | null {
    if (!value || typeof value !== 'object') return null;
    if ('directions' in value) {
        const clean = normalizeTopicDraft(value);
        if (!clean || !uniqueIds(clean.directions, 'id') || !uniqueIds(clean.unknowns, 'id') || (clean.selectedDirectionId !== null && !clean.directions.some(d => d.id === clean.selectedDirectionId))) return null;
        const legacy = value.legacyDraft === undefined ? undefined : normalizeLegacyTopicAnalysisDraft(value.legacyDraft);
        return legacy === null ? null : { ...clean, ...(legacy ? { legacyDraft: legacy } : {}) };
    }
    const legacy = normalizeLegacyTopicAnalysisDraft(value);
    if (!legacy) return null;
    const hasContent = legacy.candidates.length || legacy.selectionReason.trim() || legacy.sources.length || legacy.unknowns.length;
    return { directions: legacy.candidates.map(c => ({ id: c.id, title: c.title, question: c.researchQuestion, population: c.targetPopulation, value: '', requirementIds: [], verdict: 'unknown', feasibilityNote: c.feasibility })), selectedDirectionId: legacy.selectedCandidateId, selectionReason: legacy.selectionReason, unknowns: legacy.unknowns.map(u => ({...u})), ...(hasContent ? { legacyDraft: legacy } : {}) };
}

export function normalizeResearchPlanDraft(value: any): ResearchPlanDraft | null {
    if (!value || typeof value !== 'object') return null;
    if ('researchQuestions' in value) {
        const clean = normalizePlanDraft(value);
        if (!clean || ![clean.researchQuestions, clean.measures, clean.analyses, clean.unknowns].every(items => uniqueIds(items, 'id')) || (clean.sampling.targetSize !== null && !Number.isFinite(clean.sampling.targetSize))) return null;
        const legacy = value.legacyDraft === undefined ? undefined : normalizeLegacyResearchPlanDraft(value.legacyDraft);
        return legacy === null ? null : { ...clean, ...(legacy ? { legacyDraft: legacy } : {}) };
    }
    const legacy = normalizeLegacyResearchPlanDraft(value);
    if (!legacy) return null;
    const draft: ResearchPlanDraft = emptyPlanDraft();
    if (legacy.researchQuestion.trim()) draft.researchQuestions = [{ id: 'legacy-plan-question', text: legacy.researchQuestion, measureIds: [] }];
    draft.sampling.frame = legacy.targetPopulation;
    const notes: [string,string][] = [['旧版抽样说明',legacy.samplingPlan],['旧版招募说明',legacy.recruitmentPlan],['旧版测量说明',legacy.measurementPlan],['旧版证据需求',legacy.evidenceNeeds],['旧版分析说明',legacy.analysisPlan]];
    draft.otherNote = notes.filter(([,text])=>text.trim()).map(([label,text])=>label+'：'+text).join('\n\n');
    draft.unknowns = legacy.unknowns.map(u=>({...u}));
    const hasContent = [legacy.researchQuestion,legacy.targetPopulation,...notes.map(([,text])=>text)].some(text=>text.trim()) || legacy.sources.length || legacy.unknowns.length;
    if (hasContent) draft.legacyDraft = legacy;
    return draft;
}

// These are local hints only. No server identity, adoption or confirmation is created.
function localWording(issue: string) { return issue.split('正式检查').join('本机完整性检查').split('采用方向').join('本机拟选方向').split('尚未采用').join('尚未在本机标记').split('重新采用').join('重新标记'); }
export function checkTopicAnalysisDraft(draft: TopicAnalysisDraft, upstream: CompetitionDraft | null = null): string[] {
    const issues = checkTopicDraft(draft, upstream).map(localWording);
    if (draft.directions.some(direction => !direction.title.trim())) issues.push('存在方向名称为空的候选，请补充或删除该方向。');
    if (upstream && draft.directions.some(d=>d.requirementIds.some(id=>!upstream.requirements.some(r=>r.id===id)))) issues.push('方向引用的上游要求已不存在，请重新核对关联。');
    return issues;
}
export function checkResearchPlanDraft(draft: ResearchPlanDraft, upstream: PlanUpstream = {competition:null,topic:null}): string[] {
    const issues = checkPlanDraft(draft, upstream).all.map(localWording);
    const measureIds = new Set(draft.measures.map(measure => measure.id));
    if (draft.researchQuestions.some(question => question.measureIds.some(id => !measureIds.has(id)))) issues.push('研究问题引用的测量变量已不存在，请重新核对关联。');
    if (draft.analyses.some(analysis => analysis.measureIds.some(id => !measureIds.has(id)))) issues.push('分析安排引用的测量变量已不存在，请重新核对关联。');
    const sourceIds = upstream.competition ? new Set(upstream.competition.sources.map(source => source.sourceId)) : null;
    if (sourceIds && draft.measures.some(measure => measure.sourceIds.some(id => !sourceIds.has(id)))) issues.push('测量变量引用的上游来源已不存在，请重新核对关联。');
    if (draft.sampling.targetSize !== null && (!Number.isInteger(draft.sampling.targetSize) || draft.sampling.targetSize <= 0)) issues.push('预期有效样本量应为正整数。');
    return issues;
}
