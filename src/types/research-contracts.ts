import type { TopicDraft } from '../components/research/topic-contract';
import type { ResearchPlanDraft as EditorResearchPlanDraft } from '../components/research/plan-contract';

/** P-owned integration subset of the approved C0 semantics. No endpoint URLs implied. */
export type WorkflowKind = 'full-study' | 'questionnaire-review' | 'dataset-analysis';
export interface DraftContext {
    localTaskId: string;
    revision: number;
}
export interface ActionContext {
    projectId: string;
    workflowId: string;
    workflowKind: WorkflowKind;
    phase: number;
}
export interface ArtifactRef {
    projectId: string;
    workflowId: string;
    artifactId: string;
    versionId: string;
}
export interface SourceRef {
    sourceId: string;
    fileId?: string;
    locator?: string;
    evidenceStatus: string;
}
export interface ContestSource {
    sourceId: string;
    title: string;
    locator: string;
    evidenceStatus: 'unverified' | 'user-provided' | 'source-cited';
}
export interface ContestRequirement {
    id: string;
    text: string;
    sourceIds: string[];
}
export interface ContestUnknown {
    id: string;
    text: string;
    blocksDecision: boolean;
}
export interface CompetitionDraft {
    background: string;
    edition: string;
    group: string;
    requirements: ContestRequirement[];
    sources: ContestSource[];
    unknowns: ContestUnknown[];
}
/** Local integration schema; align with F/BA delivery before formal persistence. */
export interface TopicCandidate {
    id: string;
    title: string;
    researchQuestion: string;
    targetPopulation: string;
    feasibility: string;
    sourceIds: string[];
}
export interface LegacyTopicAnalysisDraft {
    candidates: TopicCandidate[];
    selectedCandidateId: string | null;
    selectionReason: string;
    sources: ContestSource[];
    unknowns: ContestUnknown[];
}
export interface LegacyResearchPlanDraft {
    researchQuestion: string;
    targetPopulation: string;
    samplingPlan: string;
    recruitmentPlan: string;
    measurementPlan: string;
    evidenceNeeds: string;
    analysisPlan: string;
    sources: ContestSource[];
    unknowns: ContestUnknown[];
}
/** Current editor shape, with optional preserved pre-delivery content. */
export type TopicAnalysisDraft = TopicDraft & { legacyDraft?: LegacyTopicAnalysisDraft };
export type ResearchPlanDraft = EditorResearchPlanDraft & { legacyDraft?: LegacyResearchPlanDraft };
export type ResearchStageDraftUpdate =
    | { phase: 1; context: DraftContext; draft: TopicAnalysisDraft }
    | { phase: 2; context: DraftContext; draft: ResearchPlanDraft };
export interface ResearchPlanEditorProps {
    context: DraftContext;
    draft: ResearchPlanDraft;
    readOnly: boolean;
    issues: string[];
    upstream: { competition: CompetitionDraft | null; topic: TopicAnalysisDraft | null };
}
export interface TopicAnalysisEditorProps {
    context: DraftContext;
    draft: TopicAnalysisDraft;
    readOnly: boolean;
    issues: string[];
    upstream: CompetitionDraft | null;
}
export interface SelectedInputMetadata {
    name: string;
    size: number;
    lastModified: number;
}
export interface SandboxReference {
    workspaceId: string;
    runId?: string | null;
}
export interface LocalResearchTask {
    schemaVersion: 1;
    localTaskId: string;
    workflowKind: WorkflowKind;
    title: string;
    viewedPhase: number;
    revision: number;
    createdAt: number;
    updatedAt: number;
    savedAt: number | null;
    inputFile: SelectedInputMetadata | null;
    sandboxRef: SandboxReference | null;
    competition: CompetitionDraft;
    topicAnalysis: TopicAnalysisDraft;
    researchPlan: ResearchPlanDraft;
}
export interface ResearchFailure {
    code: 'CAPABILITY_UNAVAILABLE' | 'PERSIST_FAILED' | 'STALE_BASELINE' | 'PHASE_LOCKED' | 'UNAUTHORIZED' | 'MISSING_INPUT';
    message: string;
}
export type ResearchResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: ResearchFailure;
};
/** F receives these props, performs no fetching/storage, and emits context-bound requests. */
export interface ContestEditorProps {
    context: DraftContext;
    draft: CompetitionDraft;
    readOnly: boolean;
    issues: string[];
}
export interface ContestDraftUpdate {
    context: DraftContext;
    draft: CompetitionDraft;
}
export interface ContestActionRequest {
    context: DraftContext;
}
export interface ContestCandidate {
    kind: 'competition-understanding';
    content: CompetitionDraft;
    inputRefs: ArtifactRef[];
    sourceRefs: SourceRef[];
    producer: 'user';
    origin: 'manual';
    evidenceStatus: 'unverified';
}
