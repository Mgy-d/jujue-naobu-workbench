import type {ArtifactRef, WorkflowKind, LocalResearchTask, SourceRef} from './research-contracts';

/** Proposed frontend contract. The namespace is a fixture, not a BA deployment. */
export type BusinessMode = 'unavailable' | 'mock';
export type BusinessCode = 'CAPABILITY_UNAVAILABLE' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'STALE_BASELINE' | 'PHASE_LOCKED' | 'MISSING_INPUT' | 'UNAVAILABLE' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'IDENTITY_MISMATCH';
export interface BusinessError {code:BusinessCode; message:string}
export type BusinessResult<T> = {ok:true; value:T}|{ok:false; error:BusinessError};
export interface CandidateSummary {ref:ArtifactRef; phase:number}
export interface Material {fileId:string; sourceId:string; filename:string; size:number; parseStatus:'uploaded'|'parsing'|'failed'|'ready'; parseMessage:string; locator:string}
export interface BusinessProject {
 projectId:string; workflowId:string; clientTaskId:string; workflowKind:WorkflowKind; title:string;
 revision:number; activePhase:number; permissions:{read:boolean;write:boolean;confirm:boolean};
 lockedPhases:number[]; adopted:CandidateSummary[]; candidates:CandidateSummary[]; files:Material[];
}
export type PhaseContent = LocalResearchTask['competition']|LocalResearchTask['topicAnalysis']|LocalResearchTask['researchPlan']|LocalResearchTask['questionnaire'];
export interface FixedCandidate {ref:ArtifactRef;phase:number;content:PhaseContent;inputRefs:ArtifactRef[];sourceRefs:SourceRef[];origin:'manual';evidenceStatus:'unverified'}
export interface CandidateInput {phase:number;content:PhaseContent;inputRefs:ArtifactRef[];sourceRefs:SourceRef[];origin:'manual';evidenceStatus:'unverified';expectedRevision:number;requestId:string}
export interface PhaseCheck {checkId:string;projectId:string;workflowId:string;revision:number;phase:number;candidateRef:ArtifactRef;canConfirm:boolean;issues:string[];risks:string[]}
export interface CreateProjectInput {clientTaskId:string;workflowKind:WorkflowKind;title:string;requestId:string}
export interface BusinessGateway {
 mode:BusinessMode;
 createProject(input:CreateProjectInput):Promise<BusinessResult<BusinessProject>>;
 getProject(projectId:string):Promise<BusinessResult<BusinessProject>>;
 uploadMaterial(projectId:string,file:File,expectedRevision:number,requestId:string):Promise<BusinessResult<{project:BusinessProject;material:Material}>>;
 readMaterial(projectId:string,fileId:string):Promise<BusinessResult<Blob>>;
 saveVersion(projectId:string,input:CandidateInput):Promise<BusinessResult<{project:BusinessProject;version:FixedCandidate}>>;
 readVersion(ref:ArtifactRef,phase:number):Promise<BusinessResult<FixedCandidate>>;
 checkPhase(projectId:string,input:{phase:number;candidateRef:ArtifactRef;expectedRevision:number}):Promise<BusinessResult<PhaseCheck>>;
 confirmPhase(projectId:string,input:{phase:number;candidateRef:ArtifactRef;checkId:string;expectedRevision:number;requestId:string}):Promise<BusinessResult<BusinessProject>>;
}
