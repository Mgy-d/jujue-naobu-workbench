const STORAGE_KEY = 'refuse-naobu.research-intake.v1'

export const RESEARCH_INTAKE_CAPABILITIES = Object.freeze({
  projectCreation: Object.freeze({ available: false, message: '市调项目创建接口尚未接入，当前只建立本机草稿。' }),
  projectUpload: Object.freeze({ available: false, message: '市调项目附件接口尚未接入；所选文件没有上传到数模会话或服务器。' }),
  analysisRun: Object.freeze({ available: false, message: '真实解析与统计由后端执行；当前没有可调用的市调运行接口。' }),
  serverSave: Object.freeze({ available: false, message: '服务端候选成果与版本保存接口尚未接入。' }),
})

export function newResearchIntakeDraftId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return 'local-' + uuid
  return 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

export function createResearchIntakeDraft(draftId, now = Date.now()) {
  return {
    schemaVersion: 1,
    draftId: String(draftId),
    title: '新的数据分析任务',
    workflowKind: 'dataset-analysis',
    activePhase: 0,
    createdAt: Number(now),
    updatedAt: Number(now),
    inputFile: null,
  }
}

export function recordSelectedInput(draft, file, now = Date.now()) {
  const name = String(file?.name ?? '')
  const size = Number(file?.size)
  const lastModified = Number(file?.lastModified)
  if (!name || !Number.isFinite(size) || size < 0 || !Number.isFinite(lastModified) || lastModified < 0) {
    throw new TypeError('所选文件元数据无效')
  }
  return {
    ...draft,
    inputFile: { name, size, lastModified },
    updatedAt: Number(now),
  }
}

function normalizedDraft(draft) {
  if (
    !draft ||
    draft.schemaVersion !== 1 ||
    typeof draft.draftId !== 'string' ||
    typeof draft.title !== 'string' ||
    draft.workflowKind !== 'dataset-analysis' ||
    draft.activePhase !== 0 ||
    !Number.isFinite(draft.createdAt) ||
    !Number.isFinite(draft.updatedAt)
  ) return null

  let inputFile = null
  if (draft.inputFile != null) {
    const name = String(draft.inputFile.name ?? '')
    const size = Number(draft.inputFile.size)
    const lastModified = Number(draft.inputFile.lastModified)
    if (!name || !Number.isFinite(size) || size < 0 || !Number.isFinite(lastModified) || lastModified < 0) {
      return null
    }
    inputFile = { name, size, lastModified }
  }

  return {
    schemaVersion: 1,
    draftId: draft.draftId,
    title: draft.title,
    workflowKind: 'dataset-analysis',
    activePhase: 0,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    inputFile,
  }
}

export function saveResearchIntakeDraft(storage, draft, savedAt = Date.now()) {
  const clean = normalizedDraft(draft)
  if (!clean || !Number.isFinite(Number(savedAt))) throw new TypeError('本机草稿格式无效')
  const saved = { ...clean, savedAt: Number(savedAt) }
  storage.setItem(STORAGE_KEY, JSON.stringify(saved))
  return saved
}

export function loadResearchIntakeDraft(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw == null) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Number.isFinite(parsed?.savedAt)) return null
    const clean = normalizedDraft(parsed)
    return clean ? { ...clean, savedAt: parsed.savedAt } : null
  } catch {
    return null
  }
}
