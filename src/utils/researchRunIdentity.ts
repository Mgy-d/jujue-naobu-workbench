/** Local identity only; server ownership and current interruption status remain authoritative. */
export interface ResearchScope { ownerId: string; agentId: string; taskId: string }
export interface StoredResearchIdentity extends ResearchScope {
  version: 1; projectId: string; threadId: string; runId: string
  status: 'new' | 'running' | 'interrupt' | 'finished' | 'uncertain' | 'submitting' | 'blocked'
  pendingIds: string[]; submittedIds: string[]
}
type LocalStorageAccess = Pick<Storage, 'getItem' | 'setItem'>
const validId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 256
const ids = (x: unknown): x is string[] => Array.isArray(x) && x.every(validId) && new Set(x).size === x.length
export function researchIdentityKey(scope: ResearchScope): string {
  if (![scope.ownerId,scope.agentId,scope.taskId].every(validId)) throw new Error('缺少账户或任务身份。')
  return 'shidiaoyanzhen.agent-run.v1:' + [scope.ownerId,scope.agentId,scope.taskId].map(encodeURIComponent).join(':')
}
export function createResearchIdentity(scope: ResearchScope, uuid: () => string = () => crypto.randomUUID()): StoredResearchIdentity {
  const projectId = 'sz-' + uuid(), threadId = 'main-' + uuid()
  return {...scope,version:1,projectId,threadId,runId:'',status:'new',pendingIds:[],submittedIds:[]}
}
function validate(value: unknown, scope: ResearchScope): StoredResearchIdentity {
  if (!value || typeof value !== 'object') throw new Error('运行身份数据损坏，原记录已保留。')
  const v = value as Record<string, unknown>
  if (v.version !== 1 || v.ownerId !== scope.ownerId || v.agentId !== scope.agentId || v.taskId !== scope.taskId || !validId(v.projectId) || !validId(v.threadId) || typeof v.runId !== 'string' || v.runId.length > 256 || !['new','running','interrupt','finished','uncertain','submitting','blocked'].includes(String(v.status)) || !ids(v.pendingIds) || !ids(v.submittedIds)) throw new Error('运行身份不匹配或记录损坏，已保留原记录。')
  if (v.status !== 'new' && !v.runId) throw new Error('缺少原运行身份，不能安全恢复。')
  return {version:1,ownerId:scope.ownerId,agentId:scope.agentId,taskId:scope.taskId,projectId:v.projectId,threadId:v.threadId,runId:v.runId as string,status:v.status as StoredResearchIdentity['status'],pendingIds:v.pendingIds,submittedIds:v.submittedIds}
}
export function loadResearchIdentity(storage: LocalStorageAccess, scope: ResearchScope): {identity:StoredResearchIdentity|null;baseline:string|null} {
  const raw = storage.getItem(researchIdentityKey(scope))
  if (raw === null) return {identity:null,baseline:null}
  let parsed: unknown
  try { parsed=JSON.parse(raw) } catch { throw new Error('运行身份数据损坏，原记录已保留。') }
  return {identity:validate(parsed,scope),baseline:raw}
}
export function saveResearchIdentity(storage: LocalStorageAccess, scope: ResearchScope, baseline: string | null, identity: StoredResearchIdentity): string {
  const key = researchIdentityKey(scope), clean = validate(identity,scope)
  if (storage.getItem(key) !== baseline) throw new Error('另一页面已更改运行身份，请刷新后核对；当前记录未覆盖。')
  const raw=JSON.stringify(clean)
  storage.setItem(key,raw)
  return raw
}
