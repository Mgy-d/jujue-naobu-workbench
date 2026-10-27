import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { CompetitionDraft, DraftContext, LocalResearchTask, WorkflowKind, SandboxReference, SelectedInputMetadata, ResearchStageDraftUpdate } from '../types/research-contracts';
import { createLocalTask, editLocalTask, loadTaskRegistry, applyResearchStageUpdate, matchesDraftContext, normalizeCompetitionDraft, saveLocalTask } from '../utils/researchDrafts';
export const useResearchStore = defineStore('research-tasks', () => {
    const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
    const loaded = loadTaskRegistry(storage), registry = ref(loaded.registry), draft = ref<LocalResearchTask | null>(null), feedback = ref(''), storageError = ref(loaded.error || '');
    const context = computed<DraftContext | null>(() => draft.value ? { localTaskId: draft.value.localTaskId, revision: draft.value.revision } : null);
    function keep() { if (draft.value)
        registry.value.tasks[draft.value.localTaskId] = draft.value; }
    function save() { if (!draft.value)
        return false; try {
        registry.value = saveLocalTask(storage, registry.value, draft.value);
        draft.value = registry.value.tasks[draft.value.localTaskId] ?? null;
        storageError.value = '';
        feedback.value = '已保存到本机浏览器；未保存为正式项目或候选版本。';
        return true;
    }
    catch (error) {
        storageError.value = error instanceof Error && /另一页面|损坏/.test(error.message) ? error.message : '本机保存失败，编辑仍保留在本页；请勿关闭页面。原有记录未主动删除。';
        keep();
        return false;
    } }
    function open(kind: WorkflowKind, id?: string) {
        keep();
        const selected = id || registry.value.lastByKind[kind], existing = selected ? registry.value.tasks[selected] : undefined;
        if (id && (!existing || existing.workflowKind !== kind)) {
            feedback.value = '任务链接与入口不匹配，已保留原任务并打开该入口自己的草稿。';
            return open(kind);
        }
        draft.value = existing || createLocalTask(kind);
        registry.value.lastByKind[kind] = draft.value.localTaskId;
        keep();
        save();
        return draft.value;
    }
    function create(kind: WorkflowKind) { keep(); draft.value = createLocalTask(kind); keep(); registry.value.lastByKind[kind] = draft.value.localTaskId; save(); return draft.value; }
    function update(patch: Partial<Pick<LocalResearchTask, 'title' | 'competition' | 'topicAnalysis' | 'researchPlan' | 'inputFile' | 'sandboxRef' | 'viewedPhase'>>) { if (!draft.value)
        return; draft.value = editLocalTask(draft.value, patch); feedback.value = '有未保存的本机编辑。'; keep(); }
    function updateCompetition(event: {
        context: DraftContext;
        draft: CompetitionDraft;
    }) { if (!draft.value || !matchesDraftContext(draft.value, event.context)) {
        feedback.value = '忽略了其他任务或旧修订的组件事件。';
        return false;
    } const clean = normalizeCompetitionDraft(event.draft); if (!clean) {
        feedback.value = '组件草稿格式不完整，当前编辑未替换。';
        return false;
    } update({ competition: clean }); return true; }
    function updateStage(event: ResearchStageDraftUpdate) {
        if (!draft.value) return false;
        const result = applyResearchStageUpdate(draft.value, event);
        if (!result.ok) { feedback.value = result.error.message; return false; }
        draft.value = result.value;
        feedback.value = '有未保存的本机编辑。';
        keep();
        return true;
    }
    function persistTaskPatch(localTaskId: string, patch: Partial<Pick<LocalResearchTask, 'sandboxRef' | 'inputFile'>>) {
        const previous = registry.value.tasks[localTaskId];
        if (!previous || previous.workflowKind !== 'dataset-analysis')
            return;
        if (patch.sandboxRef && previous.sandboxRef?.workspaceId === patch.sandboxRef.workspaceId && previous.sandboxRef?.runId === patch.sandboxRef.runId)
            return;
        const updated = editLocalTask(previous, patch);
        registry.value.tasks[localTaskId] = updated;
        if (draft.value?.localTaskId === localTaskId)
            draft.value = updated;
        try {
            registry.value = saveLocalTask(storage, registry.value, updated);
            if (draft.value?.localTaskId === localTaskId)
                draft.value = registry.value.tasks[localTaskId] ?? updated;
        }
        catch (error) {
            storageError.value = error instanceof Error && /另一页面|损坏/.test(error.message) ? error.message : '分析引用保存到本机失败；已登记的运行仍在当前页内存中，请勿关闭页面。';
        }
    }
    function recordSandboxReference(localTaskId: string, sandboxRef: SandboxReference) { persistTaskPatch(localTaskId, { sandboxRef }); }
    function recordInputFile(localTaskId: string, inputFile: SelectedInputMetadata) { persistTaskPatch(localTaskId, { inputFile }); }
    return { registry, draft, context, feedback, storageError, open, create, update, updateCompetition, updateStage, save, recordSandboxReference, recordInputFile };
});
