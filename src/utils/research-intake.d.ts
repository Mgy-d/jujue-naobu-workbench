export interface SelectedInputMetadata {
  name: string
  size: number
  lastModified: number
}
export interface ResearchIntakeDraft {
  schemaVersion: 1
  draftId: string
  title: string
  workflowKind: 'dataset-analysis'
  activePhase: 0
  createdAt: number
  updatedAt: number
  inputFile: SelectedInputMetadata | null
}
export interface SavedResearchIntakeDraft extends ResearchIntakeDraft {
  savedAt: number
}
export interface IntakeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface UnavailableIntakeCapability {
  available: false
  message: string
}
export const RESEARCH_INTAKE_CAPABILITIES: Readonly<{
  projectCreation: UnavailableIntakeCapability
  projectUpload: UnavailableIntakeCapability
  analysisRun: UnavailableIntakeCapability
  serverSave: UnavailableIntakeCapability
}>
export function newResearchIntakeDraftId(): string
export function createResearchIntakeDraft(draftId: string, now?: number): ResearchIntakeDraft
export function recordSelectedInput(
  draft: ResearchIntakeDraft,
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
  now?: number,
): ResearchIntakeDraft
export function saveResearchIntakeDraft(
  storage: IntakeStorage,
  draft: ResearchIntakeDraft,
  savedAt?: number,
): SavedResearchIntakeDraft
export function loadResearchIntakeDraft(storage: IntakeStorage): SavedResearchIntakeDraft | null
