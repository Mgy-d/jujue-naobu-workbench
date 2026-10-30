import type { WorkflowKind, LocalResearchTask, CompetitionDraft, DraftContext, SandboxReference, ResearchStageDraftUpdate, ResearchResult } from '../types/research-contracts';
import type {QuestionnaireDraftUpdate} from '../types/research-contracts';
import {emptyQuestionnaireDraft,normalizeQuestionnaireDraft} from './researchQuestionnaire';
export {emptyQuestionnaireDraft,normalizeQuestionnaireDraft,checkQuestionnaireDraft,questionnaireSignature,questionnairePretestState} from './researchQuestionnaire';
import { loadResearchIntakeDraft } from './research-intake';
import { emptyTopicAnalysisDraft, normalizeTopicAnalysisDraft, emptyResearchPlanDraft, normalizeResearchPlanDraft } from './researchStageDrafts';
export { emptyTopicAnalysisDraft, normalizeTopicAnalysisDraft, checkTopicAnalysisDraft, emptyResearchPlanDraft, normalizeResearchPlanDraft, checkResearchPlanDraft } from './researchStageDrafts';
export const TASK_STORAGE_KEY = 'shidiaoyanzhen.research-tasks.v1';
const kinds: WorkflowKind[] = ['full-study', 'questionnaire-review', 'dataset-analysis'];
const fullStages = ['赛事理解', '选题分析', '研究方案', '问卷设计与预测试', '正式调查', '数据分析', '报告与答辩'];
export function stagesFor(kind: WorkflowKind) { return (kind === 'full-study' ? fullStages : kind === 'questionnaire-review' ? ['问卷核对'] : ['数据分析', '报告与答辩']).map((title, phase) => ({ title, phase })); }
export function modeToKind(mode: unknown): WorkflowKind { return mode === 'analysis' ? 'dataset-analysis' : mode === 'questionnaire' ? 'questionnaire-review' : 'full-study'; }
export function kindToMode(kind: WorkflowKind) { return kind === 'dataset-analysis' ? 'analysis' : kind === 'questionnaire-review' ? 'questionnaire' : 'full'; }
export function workflowLabel(kind: WorkflowKind) { return kind === 'dataset-analysis' ? '已有答卷／数据分析' : kind === 'questionnaire-review' ? '已有问卷核对' : '完整研究'; }
export function emptyCompetitionDraft(): CompetitionDraft { return { background: '', edition: '', group: '', requirements: [], sources: [], unknowns: [] }; }
export function createLocalTask(workflowKind: WorkflowKind, localTaskId = 'local-' + crypto.randomUUID(), now = Date.now()): LocalResearchTask {
    return { schemaVersion: 1, localTaskId, workflowKind, title: workflowKind === 'full-study' ? '新的完整研究' : workflowKind === 'questionnaire-review' ? '新的问卷核对' : '新的数据分析任务', viewedPhase: 0, revision: 0, createdAt: now, updatedAt: now, savedAt: null, inputFile: null, sandboxRef: null, competition: emptyCompetitionDraft(), topicAnalysis: emptyTopicAnalysisDraft(), researchPlan: emptyResearchPlanDraft(), questionnaire: emptyQuestionnaireDraft(), collection: emptyCollectionDraft(), report: emptyReportDraft() };
}
export function matchesDraftContext(task: LocalResearchTask, context: DraftContext) { return task.localTaskId === context.localTaskId && task.revision === context.revision; }
export function editLocalTask(task: LocalResearchTask, patch: Partial<Pick<LocalResearchTask, 'title' | 'competition' | 'topicAnalysis' | 'researchPlan' | 'questionnaire' | 'inputFile' | 'sandboxRef' | 'viewedPhase' | 'collection' | 'report'>>, now = Date.now()): LocalResearchTask {
    return { ...task, ...patch, revision: task.revision + 1, updatedAt: now, savedAt: null };
}
export interface TaskRegistry {
    schemaVersion: 1;
    tasks: Record<string, LocalResearchTask>;
    lastByKind: Partial<Record<WorkflowKind, string>>;
    baseline: string | null;
}
export function emptyTaskRegistry(): TaskRegistry { return { schemaVersion: 1, tasks: {}, lastByKind: {}, baseline: null }; }
function validFile(value: any) { return value && typeof value.name === 'string' && Number.isFinite(value.size) && value.size >= 0 && Number.isFinite(value.lastModified) && value.lastModified >= 0 ? { name: value.name, size: value.size, lastModified: value.lastModified } : null; }
function validRef(value: any): SandboxReference | null { return value && typeof value.workspaceId === 'string' && value.workspaceId ? { workspaceId: value.workspaceId, ...(typeof value.runId === 'string' ? { runId: value.runId } : {}) } : null; }
export function normalizeCompetitionDraft(value: any): CompetitionDraft | null {
    if (!value || !['background', 'edition', 'group'].every(k => typeof value[k] === 'string') || !['requirements', 'sources', 'unknowns'].every(k => Array.isArray(value[k])))
        return null;
    if (value.sources.some((s: any) => !s || typeof s.sourceId !== 'string' || typeof s.title !== 'string' || typeof s.locator !== 'string' || !['unverified', 'user-provided', 'source-cited'].includes(s.evidenceStatus)))
        return null;
    if (value.requirements.some((r: any) => !r || typeof r.id !== 'string' || typeof r.text !== 'string' || !Array.isArray(r.sourceIds) || r.sourceIds.some((id: any) => typeof id !== 'string')))
        return null;
    if (value.unknowns.some((u: any) => !u || typeof u.id !== 'string' || typeof u.text !== 'string' || typeof u.blocksDecision !== 'boolean'))
        return null;
    return { background: value.background, edition: value.edition, group: value.group, requirements: value.requirements.map((r: any) => ({ id: r.id, text: r.text, sourceIds: [...r.sourceIds] })), sources: value.sources.map((s: any) => ({ sourceId: s.sourceId, title: s.title, locator: s.locator, evidenceStatus: s.evidenceStatus })), unknowns: value.unknowns.map((u: any) => ({ id: u.id, text: u.text, blocksDecision: u.blocksDecision })) };
}
export function applyResearchStageUpdate(task: LocalResearchTask, event: ResearchStageDraftUpdate, now = Date.now()): ResearchResult<LocalResearchTask> {
    if (task.workflowKind !== 'full-study' || ![1, 2].includes(event?.phase) || task.viewedPhase !== event.phase)
        return { ok: false, error: { code: 'PHASE_LOCKED', message: '当前任务或正在查看的阶段不接受这份编辑。' } };
    if (!event.context || !matchesDraftContext(task, event.context))
        return { ok: false, error: { code: 'STALE_BASELINE', message: '忽略了其他任务或旧修订的组件事件，当前草稿未替换。' } };
    const invalid = { ok: false, error: { code: 'MISSING_INPUT', message: '组件草稿格式无效，当前编辑未替换。' } } as const;
    if (event.phase === 1) {
        const clean = normalizeTopicAnalysisDraft(event.draft);
        return clean ? { ok: true, value: editLocalTask(task, { topicAnalysis: { ...clean, ...(task.topicAnalysis.legacyDraft ? { legacyDraft: task.topicAnalysis.legacyDraft } : {}) } }, now) } : invalid;
    }
    const clean = normalizeResearchPlanDraft(event.draft);
    return clean ? { ok: true, value: editLocalTask(task, { researchPlan: { ...clean, ...(task.researchPlan.legacyDraft ? { legacyDraft: task.researchPlan.legacyDraft } : {}) } }, now) } : invalid;
}
export function applyQuestionnaireUpdate(task:LocalResearchTask,event:QuestionnaireDraftUpdate,now=Date.now()):ResearchResult<LocalResearchTask>{
 const allowed=task.workflowKind==='full-study'&&task.viewedPhase===3||task.workflowKind==='questionnaire-review'&&task.viewedPhase===0;
 if(!allowed)return {ok:false,error:{code:'PHASE_LOCKED',message:'当前任务或阶段不接受问卷编辑。'}};
 if(!event?.context||!matchesDraftContext(task,event.context))return {ok:false,error:{code:'STALE_BASELINE',message:'忽略了其他任务或旧修订的问卷事件。'}};
 const clean=normalizeQuestionnaireDraft(event.draft);
 return clean?{ok:true,value:editLocalTask(task,{questionnaire:clean},now)}:{ok:false,error:{code:'MISSING_INPUT',message:'问卷草稿格式无效，当前编辑未替换。'}};
}
export function emptyCollectionDraft(){return {channel:'',audience:'',startNote:'',stopRule:''}}
export function emptyReportDraft(){return {body:'',defenseNotes:'',sourceNotes:''}}
export type ReadinessLevel = 'ok' | 'risky' | 'blocked';
export interface StageReadiness { level: ReadinessLevel; reasons: string[]; }
export function precheckLaterStageReadiness(task: LocalResearchTask, phase: number): StageReadiness {
    if (task.workflowKind !== 'full-study') return { level: 'blocked', reasons: ['该入口不涉及正式调查或报告阶段。'] };
    if (phase === 4) {
        const fields: Array<[keyof LocalResearchTask['collection'], string]> = [['channel','发布渠道'],['audience','调查对象与招募说明'],['startNote','计划开始时间与发布条件'],['stopRule','停止收集条件']];
        const missing = fields.filter(([k]) => !(task.collection[k] ?? '').trim());
        if (missing.length === 0) return { level: 'ok', reasons: ['正式调查发布准备已完整填写。'] };
        if (missing.length === fields.length) return { level: 'blocked', reasons: ['尚未填写任何发布准备项。'] };
        return { level: 'risky', reasons: missing.map(([, label]) => '待补充：' + label) };
    }
    if (phase === 6) {
        const body = !!(task.report.body ?? '').trim();
        const source = !!(task.report.sourceNotes ?? '').trim();
        const defense = !!(task.report.defenseNotes ?? '').trim();
        const linked = !!task.sandboxRef;
        const reasons: string[] = [];
        if (!body) reasons.push('待补充：报告正文草稿');
        if (!source) reasons.push('待补充：来源与结果引用');
        if (!defense) reasons.push('待补充：答辩准备笔记');
        if (!linked) reasons.push('尚未关联本机分析结果（不能把未执行的统计写成已验证结论）');
        if (reasons.length === 0) return { level: 'ok', reasons: ['报告与答辩草稿完整，且已关联本机分析结果。'] };
        if (!body && !source && !defense) return { level: 'blocked', reasons };
        return { level: 'risky', reasons };
    }
    return { level: 'blocked', reasons: ['该阶段不支持就绪度判定。'] };
}
function stringDraft<T extends Record<string,string>>(value:unknown,empty:T):T|null {
 if(value===undefined)return empty;
 if(!value||typeof value!=='object'||Object.keys(empty).some(k=>typeof (value as Record<string,unknown>)[k]!=='string'))return null;
 return Object.fromEntries(Object.keys(empty).map(k=>[k,(value as T)[k]])) as T;
}
function cleanTask(v: any): LocalResearchTask | null {
    const collection=stringDraft(v?.collection,emptyCollectionDraft()),report=stringDraft(v?.report,emptyReportDraft());
    if(!collection||!report)return null;
    const competition = normalizeCompetitionDraft(v?.competition);
    const topicAnalysis = v?.topicAnalysis === undefined ? emptyTopicAnalysisDraft() : normalizeTopicAnalysisDraft(v.topicAnalysis);
    const researchPlan = v?.researchPlan === undefined ? emptyResearchPlanDraft() : normalizeResearchPlanDraft(v.researchPlan);
    const questionnaire=v?.questionnaire===undefined?emptyQuestionnaireDraft():normalizeQuestionnaireDraft(v.questionnaire);
    if (!topicAnalysis || !researchPlan || !questionnaire) return null;
    if (!v || v.schemaVersion !== 1 || typeof v.localTaskId !== 'string' || !v.localTaskId || typeof v.title !== 'string' || !kinds.includes(v.workflowKind) || !Number.isInteger(v.viewedPhase) || v.viewedPhase < 0 || v.viewedPhase >= stagesFor(v.workflowKind).length || !Number.isInteger(v.revision) || v.revision < 0 || !Number.isFinite(v.createdAt) || !Number.isFinite(v.updatedAt) || (v.savedAt !== null && !Number.isFinite(v.savedAt)) || !competition)
        return null;
    const inputFile = v.inputFile == null ? null : validFile(v.inputFile), sandboxRef = v.sandboxRef == null ? null : validRef(v.sandboxRef);
    if ((v.inputFile != null && !inputFile) || (v.sandboxRef != null && !sandboxRef) || (!['dataset-analysis','full-study'].includes(v.workflowKind) && (inputFile || sandboxRef)))
        return null;
    return { schemaVersion: 1, localTaskId: v.localTaskId, workflowKind: v.workflowKind, title: v.title, viewedPhase: v.viewedPhase, revision: v.revision, createdAt: v.createdAt, updatedAt: v.updatedAt, savedAt: v.savedAt, inputFile, sandboxRef, competition, topicAnalysis, researchPlan, questionnaire, collection, report };
}
function parseRegistry(raw: string): TaskRegistry {
    const v = JSON.parse(raw);
    if (v?.schemaVersion !== 1 || !v.tasks || typeof v.tasks !== 'object' || Array.isArray(v.tasks) || !v.lastByKind)
        throw Error('草稿目录格式无效');
    const entries = Object.entries(v.tasks).map(([id, value]) => { const task = cleanTask(value); if (!task || id !== task.localTaskId)
        throw Error('任务草稿格式无效'); return [id, task] as const; });
    const tasks = Object.fromEntries(entries), lastByKind: TaskRegistry['lastByKind'] = {};
    for (const kind of kinds) {
        const id = v.lastByKind[kind];
        if (id !== undefined) {
            if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(tasks, id) || tasks[id]?.workflowKind !== kind)
                throw Error('任务目录关联无效');
            lastByKind[kind] = id;
        }
    }
    return { schemaVersion: 1, tasks, lastByKind, baseline: raw };
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export function loadTaskRegistry(storage: Storage): {
    registry: TaskRegistry;
    error: string | null;
} {
    try {
        const raw = storage.getItem(TASK_STORAGE_KEY);
        if (raw !== null)
            return { registry: parseRegistry(raw), error: null };
        const registry = emptyTaskRegistry(), old = loadResearchIntakeDraft(storage);
        if (old && old.draftId) {
            const task = createLocalTask('dataset-analysis', old.draftId, old.createdAt);
            Object.assign(task, { title: old.title, inputFile: old.inputFile, updatedAt: old.updatedAt, savedAt: old.savedAt });
            try {
                task.sandboxRef = validRef(JSON.parse(storage.getItem('research-sandbox-ref') || 'null'));
            }
            catch { }
            registry.tasks[task.localTaskId] = task;
            registry.lastByKind['dataset-analysis'] = task.localTaskId;
        }
        return { registry, error: null };
    }
    catch {
        return { registry: emptyTaskRegistry(), error: '本机草稿目录不可读或已损坏，原记录已保留；当前编辑仅留在本页，请勿关闭。' };
    }
}
export function saveLocalTask(storage: Storage, registry: TaskRegistry, task: LocalResearchTask, now = Date.now()): TaskRegistry {
    const existing = registry.tasks[task.localTaskId];
    if (existing && existing.workflowKind !== task.workflowKind)
        throw Error('已有任务的流程类型不能改变');
    const clean = cleanTask(task);
    if (!clean)
        throw Error('本机草稿格式无效');
    const raw = storage.getItem(TASK_STORAGE_KEY);
    if (raw !== null) {
        try {
            parseRegistry(raw);
        }
        catch {
            throw Error('本机草稿目录已损坏，停止覆盖并保留当前编辑。');
        }
    }
    if (raw !== registry.baseline)
        throw Error('另一页面已更新本机草稿目录，本次停止覆盖；当前编辑仍保留，请先备份编辑再刷新核对。');
    const saved = { ...clean, savedAt: now }, next = { schemaVersion: 1 as const, tasks: { ...registry.tasks, [task.localTaskId]: saved }, lastByKind: { ...registry.lastByKind, [task.workflowKind]: registry.lastByKind[task.workflowKind] || task.localTaskId } };
    const serialized = JSON.stringify(next);
    storage.setItem(TASK_STORAGE_KEY, serialized);
    return { ...next, baseline: serialized };
}
/** 删除一条本机研究任务：与 saveLocalTask 相同的 baseline 并发保护，防止覆盖另一页面的修改。 */
export function removeLocalTask(storage: Storage, registry: TaskRegistry, localTaskId: string): TaskRegistry {
    const target = registry.tasks[localTaskId];
    if (!target) return registry;
    const raw = storage.getItem(TASK_STORAGE_KEY);
    if (raw !== null) { try { parseRegistry(raw); } catch { throw Error('本机草稿目录已损坏，停止覆盖并保留当前记录。'); } }
    if (raw !== registry.baseline) throw Error('另一页面已更新本机草稿目录，本次删除停止执行；请刷新后核对。');
    const kind = target.workflowKind, tasks = { ...registry.tasks };
    delete tasks[localTaskId];
    const lastByKind = { ...registry.lastByKind };
    if (lastByKind[kind] === localTaskId) delete lastByKind[kind];
    const next = { schemaVersion: 1 as const, tasks, lastByKind };
    const serialized = JSON.stringify(next);
    storage.setItem(TASK_STORAGE_KEY, serialized);
    return { ...next, baseline: serialized };
}
export function sandboxRefKey(localTaskId?: string) { return localTaskId ? 'research-sandbox-ref:task:' + localTaskId : 'research-sandbox-ref'; }
export function checkContestDraft(draft: CompetitionDraft): string[] {
    const issues: string[] = [];
    if (!draft.background.trim())
        issues.push('补充研究背景与可接触的调查条件。');
    if (!draft.edition.trim())
        issues.push('届次尚未明确。');
    if (!draft.group.trim())
        issues.push('组别尚未明确，需判断是否影响当前决定。');
    if (!draft.requirements.some(r => r.text.trim()))
        issues.push('尚未记录适用要求。');
    const sourceIds = new Set(draft.sources.filter(s => s.title.trim() && s.locator.trim()).map(s => s.sourceId));
    for (const r of draft.requirements) {
        if (!r.text.trim())
            issues.push('有要求正文为空，请填写或删除该条要求。');
        if (!r.sourceIds.length || r.sourceIds.some(id => !sourceIds.has(id)))
            issues.push('要求“' + r.text + '”缺少可定位来源。');
    }
    for (const u of draft.unknowns) {
        if (u.blocksDecision)
            issues.push('阻碍当前决定的未知项：' + u.text);
    }
    return issues;
}
export function syntheticContestDraft(): CompetitionDraft { return { background: '【合成样例】研究校园自习空间使用情况；尚未开展真实调查。', edition: '待核对正式通知', group: '', requirements: [{ id: 'req-demo', text: '【合成要求】明确研究对象与时间范围。', sourceIds: ['src-demo'] }], sources: [{ sourceId: 'src-demo', title: '【合成来源】组件联调说明', locator: '本机合成样例第 1 条，非赛事通知', evidenceStatus: 'unverified' }], unknowns: [{ id: 'unknown-demo', text: '适用组别和正式通知尚未取得', blocksDecision: true }] }; }
