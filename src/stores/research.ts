import { computed, ref } from 'vue';
import {AUTH_MODE} from '@/api/http';
import {researchCloud,researchCloudOwner,syncOwnedLocalRecords} from '@/api/researchCloud';
import {TASK_STORAGE_KEY,emptyTaskRegistry,cleanTask} from '@/utils/researchDrafts';
import { defineStore } from 'pinia';
import type { CompetitionDraft, DraftContext, LocalResearchTask, WorkflowKind, SandboxReference, SelectedInputMetadata, ResearchStageDraftUpdate, QuestionnaireDraftUpdate } from '../types/research-contracts';
import { createLocalTask, editLocalTask, loadTaskRegistry, applyResearchStageUpdate, applyQuestionnaireUpdate, matchesDraftContext, normalizeCompetitionDraft, saveLocalTask, removeLocalTask, sandboxRefKey } from '../utils/researchDrafts';
export const useResearchStore = defineStore('research-tasks', () => {
    const cloudOwner=ref(AUTH_MODE==='real'?researchCloudOwner():'');
    const cloudStatus=ref<'local'|'loading'|'ready'|'saving'|'error'>(cloudOwner.value?'loading':'local');
    const cloudError=ref('');
    const historySyncIssues=ref<string[]>([]);
    let connectionGeneration=0, connectedOwner='', connecting:Promise<void>|null=null;
    const pending=new Set<string>();
    const pendingKey=()=> 'shidiaoyanzhen.cloud-pending.v1:'+cloudOwner.value;
    const storageKey=(key:string)=>cloudOwner.value && key===TASK_STORAGE_KEY?key+':'+encodeURIComponent(cloudOwner.value):key;
    const storage = {
        getItem:(key:string)=>{
            const raw=localStorage.getItem(storageKey(key));
            if(cloudOwner.value && key===TASK_STORAGE_KEY && raw===null)return JSON.stringify(emptyTaskRegistry());
            return raw;
        },
        setItem:(key:string,value:string)=>localStorage.setItem(storageKey(key),value),
    };
    const loaded = loadTaskRegistry(storage), registry = ref(loaded.registry), draft = ref<LocalResearchTask | null>(null), feedback = ref(''), storageError = ref(loaded.error || '');
    const context = computed<DraftContext | null>(() => draft.value ? { localTaskId: draft.value.localTaskId, revision: draft.value.revision } : null);
    async function connectCloud(owner:string) {
        if(AUTH_MODE!=='real')return;
        if(connectedOwner===owner)return connecting || undefined;
        clearTimeout(autosaveTimer);
        const generation=++connectionGeneration;
        historySyncIssues.value=[];cloudOwner.value=owner;connectedOwner=owner;researchCloud.select(owner);pending.clear();draft.value=null;
        if(!owner){registry.value=emptyTaskRegistry();cloudStatus.value='local';return;}
        const cached=loadTaskRegistry(storage);registry.value=cached.registry;
        try{for(const id of JSON.parse(localStorage.getItem(pendingKey())||'[]'))pending.add(id);}catch{}
        // Only auto-import tasks with an existing, matching account/session binding.
        const legacy=loadTaskRegistry(localStorage).registry;
        for(const key of Object.keys(localStorage)){
            if(!key.startsWith('shidiaoyanzhen.agent-run.v1:'+encodeURIComponent(owner)+':'))continue;
            try{
                const identity=JSON.parse(localStorage.getItem(key)||'null');
                const task=identity?.ownerId===owner?legacy.tasks[identity.taskId]:undefined;
                if(task && !registry.value.tasks[task.localTaskId]){
                    registry.value=saveLocalTask(storage,registry.value,task);pending.add(task.localTaskId);
                }
            }catch{}
        }
        localStorage.setItem(pendingKey(),JSON.stringify([...pending]));
        cloudStatus.value='loading';cloudError.value='';
        connecting=(async()=>{
            try{
                const rows=await researchCloud.list<LocalResearchTask>('task',pending);
                if(generation!==connectionGeneration)return;
                const next=emptyTaskRegistry();
                for(const row of rows){const task=cleanTask(row.data);if(!task||task.localTaskId!==row.id)throw Error('服务器研究任务格式不完整');next.tasks[row.id]=task;}
                for(const id of pending)if(registry.value.tasks[id])next.tasks[id]=registry.value.tasks[id]!;
                const text=JSON.stringify(next);storage.setItem(TASK_STORAGE_KEY,text);next.baseline=text;registry.value=next;
                cloudStatus.value='ready';
                for(const id of [...pending]){await syncTask(id);if(generation!==connectionGeneration)return;}
                await syncLocalHistory();
            }catch(error){if(generation===connectionGeneration){cloudStatus.value='error';cloudError.value=error instanceof Error?error.message:'公司数据库读取失败';}}
        })();
        await connecting;
    }
    async function syncTask(id:string){
        if(!cloudOwner.value || !registry.value.tasks[id])return;
        const generation=connectionGeneration,task=JSON.parse(JSON.stringify(registry.value.tasks[id])) as LocalResearchTask;
        pending.add(id);cloudStatus.value='saving';
        try{
            localStorage.setItem(pendingKey(),JSON.stringify([...pending]));
            await researchCloud.save('task',id,task);
            if(generation!==connectionGeneration)return;
            if(JSON.stringify(registry.value.tasks[id])===JSON.stringify(task))pending.delete(id);
            localStorage.setItem(pendingKey(),JSON.stringify([...pending]));
            cloudStatus.value=pending.size?(cloudError.value?'error':'saving'):'ready';if(!pending.size)cloudError.value='';
        }catch(error){if(generation===connectionGeneration){cloudStatus.value='error';cloudError.value=error instanceof Error?error.message:'数据库保存失败，当前编辑仍保留';}}
    }
    async function flushCloud(){
        if(!cloudOwner.value)return;
        await Promise.all([...pending].map(syncTask));
        if(cloudStatus.value==='error')throw Error(cloudError.value);
    }
    const legacyTaskCount=computed(()=>{try{return Object.keys(loadTaskRegistry(localStorage).registry.tasks).filter(id=>!registry.value.tasks[id]).length;}catch{return 0;}});
    async function importLocalTasks(){
        if(!cloudOwner.value)return;
        const old=loadTaskRegistry(localStorage);
        for(const task of Object.values(old.registry.tasks)){
            if(registry.value.tasks[task.localTaskId])continue;
            registry.value.tasks[task.localTaskId]=task;
            registry.value=saveLocalTask(storage,registry.value,task);
            await syncTask(task.localTaskId);
            if(cloudStatus.value==='error')break;
        }
        await syncLocalHistory();
    }
    async function syncLocalHistory(){
        const owner=cloudOwner.value,generation=connectionGeneration;
        await flushCloud();if(generation!==connectionGeneration)return;
        const failures=await syncOwnedLocalRecords(owner,localStorage);
        if(generation!==connectionGeneration)return;
        const rows=await researchCloud.list<LocalResearchTask>('task',pending);
        if(generation!==connectionGeneration)return;
        for(const row of rows){if(!registry.value.tasks[row.id]){const task=cleanTask(row.data);if(task?.localTaskId===row.id)registry.value=saveLocalTask(storage,registry.value,task);}}
        historySyncIssues.value=failures;
        feedback.value=failures.length?'部分历史记录待补全；当前任务的保存不受影响。':'当前账号可确认归属的本机成果与对话已核对同步。';
    }
    function retryCloud(){
        if(pending.size)return flushCloud().then(syncLocalHistory);
        connectedOwner='';return connectCloud(cloudOwner.value);
    }
    let autosaveTimer:ReturnType<typeof setTimeout>|undefined;
    function scheduleCloudSave(){
        if(!cloudOwner.value)return;
        clearTimeout(autosaveTimer);
        const generation=connectionGeneration,id=draft.value?.localTaskId;
        autosaveTimer=setTimeout(()=>{if(generation===connectionGeneration && id===draft.value?.localTaskId)save();},600);
    }
    function keep() { if (draft.value)
        registry.value.tasks[draft.value.localTaskId] = draft.value; }
    function save() { if (!draft.value)
        return false; try {
        registry.value = saveLocalTask(storage, registry.value, draft.value);
        draft.value = registry.value.tasks[draft.value.localTaskId] ?? null;
        storageError.value = '';
        feedback.value = cloudOwner.value?'已保存缓存，正在同步公司数据库。':'已保存到本机浏览器；未保存为正式项目或候选版本。';
        if(cloudOwner.value)void syncTask(draft.value!.localTaskId);
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
    function update(patch: Partial<Pick<LocalResearchTask, 'title' | 'competition' | 'topicAnalysis' | 'researchPlan' | 'questionnaire' | 'inputFile' | 'sandboxRef' | 'viewedPhase' | 'collection' | 'report'>>) { if (!draft.value)
        return; draft.value = editLocalTask(draft.value, patch); feedback.value = '有未保存的本机编辑。'; keep(); scheduleCloudSave(); }
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
        scheduleCloudSave();
        return true;
    }
    function updateQuestionnaire(event:QuestionnaireDraftUpdate){
        if(!draft.value)return false;
        const result=applyQuestionnaireUpdate(draft.value,event);
        if(!result.ok){feedback.value=result.error.message;return false;}
        draft.value=result.value;feedback.value='有未保存的本机问卷编辑。';keep();scheduleCloudSave();return true;
    }
    function persistTaskPatch(localTaskId: string, patch: Partial<Pick<LocalResearchTask, 'sandboxRef' | 'inputFile'>>) {
        const previous = registry.value.tasks[localTaskId];
        if (!previous || !['dataset-analysis','full-study'].includes(previous.workflowKind))
            return;
        if (patch.sandboxRef && previous.sandboxRef?.workspaceId === patch.sandboxRef.workspaceId && previous.sandboxRef?.runId === patch.sandboxRef.runId)
            return;
        const updated = editLocalTask(previous, patch);
        registry.value.tasks[localTaskId] = updated;
        if (draft.value?.localTaskId === localTaskId)
            draft.value = updated;
        try {
            registry.value = saveLocalTask(storage, registry.value, updated);
            if(cloudOwner.value)void syncTask(localTaskId);
            if (draft.value?.localTaskId === localTaskId)
                draft.value = registry.value.tasks[localTaskId] ?? updated;
        }
        catch (error) {
            storageError.value = error instanceof Error && /另一页面|损坏/.test(error.message) ? error.message : '分析引用保存到本机失败；已登记的运行仍在当前页内存中，请勿关闭页面。';
        }
    }
    /** 注入一份演示任务（客户展示用）：写入本机登记并打开它。返回任务 id。 */
    function applySeed(task: LocalResearchTask) {
        draft.value = task
        keep()
        registry.value.lastByKind[task.workflowKind] = task.localTaskId
        save()
        return task.localTaskId
    }
    function recordSandboxReference(localTaskId: string, sandboxRef: SandboxReference) { persistTaskPatch(localTaskId, { sandboxRef }); }
    function recordInputFile(localTaskId: string, inputFile: SelectedInputMetadata) { persistTaskPatch(localTaskId, { inputFile }); }
    /** 删除一条本机任务（含草稿与沙箱引用登记）；若删的是当前任务，草稿置空，由页面负责重新打开。 */
    async function removeCloudTask(localTaskId:string){
        const generation=connectionGeneration;
        try{await researchCloud.remove('task',localTaskId);if(generation===connectionGeneration){pending.delete(localTaskId);localStorage.setItem(pendingKey(),JSON.stringify([...pending]));return remove(localTaskId,true);}}
        catch(error){cloudStatus.value='error';cloudError.value=error instanceof Error?error.message:'数据库删除失败';}
        return false;
    }
    function remove(localTaskId: string,cloudDeleted=false) {
        if(cloudOwner.value && !cloudDeleted){void removeCloudTask(localTaskId);return false;}
        if (!registry.value.tasks[localTaskId]) return false;
        try { registry.value = removeLocalTask(storage, registry.value, localTaskId); }
        catch (error) {
            storageError.value = error instanceof Error ? error.message : '本机删除失败，任务仍保留。';
            return false;
        }
        const wasCurrent = draft.value?.localTaskId === localTaskId;
        try { localStorage.removeItem(sandboxRefKey(localTaskId)); } catch { /* 清理引用失败不影响删除 */ }
        if (wasCurrent) draft.value = null;
        storageError.value = '';
        feedback.value = wasCurrent ? '已删除当前任务；请从列表选择或新建任务。' : '已删除该任务及其本机草稿。';
        return true;
    }
    return { retryCloud,historySyncIssues,cloudOwner,cloudStatus,cloudError,legacyTaskCount,connectCloud,flushCloud,syncLocalHistory,syncTask,importLocalTasks, registry, draft, context, feedback, storageError, open, create, update, updateCompetition, updateStage, updateQuestionnaire, save, recordSandboxReference, recordInputFile, remove, applySeed };
});
