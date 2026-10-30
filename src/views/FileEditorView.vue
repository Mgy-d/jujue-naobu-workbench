<template>
  <div class="editor-view">
    <div class="head">
      <h1>文件编辑与运行</h1>
      <p class="lead">
        改智能体生成的代码，<strong>就地跑一遍看结果</strong>，满意了再保存回产物目录。
        也可以打开 <code>.csv</code> / <code>.json</code> 这类数据文件修改 ——
        代码运行时能读到它们。单文件上限 2MB。
      </p>
    </div>

    <div class="split">
      <!-- 左：选文件 -->
      <div class="col pick-col">
        <div class="p-head">
          <span>产物文件</span>
          <span class="count">{{ files.length }}</span>
        </div>
        <ul class="tree">
          <li v-if="!files.length" class="empty-hint">
            这个会话还没有产物文件。
          </li>
          <li
            v-for="f in files"
            :key="f.path"
            class="node"
            :class="{ on: f.path === sandbox.selectedPath }"
          >
            <button type="button" class="file-choice" :aria-current="f.path === sandbox.selectedPath ? 'true' : undefined" @click="pick(f)">
            <span class="ext" :class="isRunnable(f.path) ? 'code' : 'data'">
              {{ isRunnable(f.path) ? '跑' : '数' }}
            </span>
            <span class="nm">{{ f.name }}</span>
            </button>
          </li>
        </ul>
        <div class="list-foot">
          <span class="lg code">跑</span> 可运行代码
          <span class="lg data">数</span> 数据/其它
        </div>
      </div>

      <!-- 右：编辑 + 运行 -->
      <div class="col edit-col">
        <div class="p-head">
          <span class="path">{{ sandbox.selectedPath || '（未选择文件）' }}</span>
          <span v-if="sandbox.dirty" class="dirty">未保存</span>
          <button
            v-if="sandbox.dirty"
            class="btn tiny"
            title="恢复成打开这个文件时的内容"
            @click="revert"
          >
            还原
          </button>
          <button
            v-if="canRun"
            class="btn run tiny"
            :disabled="sandbox.isRunning || !editable"
            @click="run"
          >
            {{ sandbox.isRunning ? '运行中…' : '运行' }}
          </button>
          <button
            class="btn primary tiny"
            :disabled="!editable || !sandbox.dirty || sandbox.saving"
            @click="askSave"
          >
            {{ sandbox.saving ? '保存中…' : '保存' }}
          </button>
        </div>

        <!-- 不可运行的文件：说明为什么，别让按钮消失得莫名其妙 -->
        <div v-if="sandbox.selectedPath && !canRun" class="norun">
          {{ notRunnableReason }}
        </div>

        <div v-if="!sandbox.selectedPath" class="empty-hint">
          从左侧选一个文件开始编辑。
        </div>
        <div v-else-if="sandbox.contentLoading" class="empty-hint">读取中…</div>
        <div v-else-if="sandbox.contentError" class="empty-hint" role="alert">
          {{ sandbox.contentError }}
          <button type="button" class="btn tiny" @click="retryOpen">重试</button>
        </div>
        <div v-else-if="unreadable" class="empty-hint">
          {{ sandbox.content?.reason || '这个文件没有可编辑的文本内容' }}
        </div>
        <template v-else>
          <textarea
            ref="editorEl"
            class="editor"
            :value="sandbox.content?.content ?? ''"
            spellcheck="false"
            wrap="off"
            @input="onInput"
            @keydown.ctrl.enter.prevent="run"
            @keydown.meta.enter.prevent="run"
          />

          <!-- 运行结果 -->
          <div v-if="latest" class="out">
            <div class="out-head">
              <span class="k">运行结果</span>
              <span class="meta">
                <b :class="latest.exitCode === 0 ? 'ok' : 'bad'">
                  {{ latest.exitCode === 0 ? '成功' : '退出码 ' + latest.exitCode }}
                </b>
                <span class="dim">· {{ latest.elapsedMs ?? '—' }} ms</span>
                <span class="dim">· 跑的是编辑器里的内容</span>
              </span>
              <button class="btn tiny" @click="sandbox.clearExecs()">清空</button>
            </div>
            <pre v-if="latest.stdout" class="std">{{ latest.stdout }}</pre>
            <pre v-if="latest.stderr" class="err">{{ latest.stderr }}</pre>
            <div v-if="!latest.stdout && !latest.stderr" class="none">（没有输出）</div>
          </div>

          <div v-if="msg" class="msg" :class="{ ok: saved }">{{ msg }}</div>
        </template>
      </div>
    </div>

    <!-- 覆盖确认：动的是智能体生成的原始文件，得让用户知道 -->
    <div v-if="confirming" class="mask" @click.self="closeConfirm">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title" @keydown="onDialogKeydown">
        <div id="save-dialog-title" class="d-ttl">覆盖智能体生成的文件？</div>
        <div class="d-body">
          保存会把 <code>{{ sandbox.selectedPath }}</code> 的内容替换为你改后的版本。
          原始版本不会自动留底 —— 需要留的话，先复制一份再改。
        </div>
        <div class="d-act">
          <button ref="cancelButton" class="btn" @click="closeConfirm">取消</button>
          <button class="btn primary" @click="doSave">确认覆盖</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { isRunnable, whyNotRunnable } from '@/engine/runnable'
import { useProblemSessionStore } from '@/stores/problemSession'
import { useSandboxStore } from '@/stores/sandbox'
import type { ArtifactNode } from '@/types/sandbox'

const props = defineProps<{ problemId: string }>()
const sandbox = useSandboxStore()
const ps = useProblemSessionStore()

const msg = ref('')
const saved = ref(false)
const confirming = ref(false)
const editorEl = ref<HTMLTextAreaElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
let dialogTrigger: HTMLElement | null = null

/** 只列文件（目录不参与编辑） */
const files = computed<ArtifactNode[]>(() => (sandbox.tree ?? []).filter((n) => n.type !== 'dir'))

/** 当前文件能否运行 —— 只看扩展名，与编辑器内容无关 */
const canRun = computed(() => !!sandbox.selectedPath && isRunnable(sandbox.selectedPath))
const notRunnableReason = computed(() =>
  sandbox.selectedPath ? whyNotRunnable(sandbox.selectedPath) : '',
)
/** 最近一次运行结果（本页只展示一份，不做历史栈） */
const latest = computed(() => sandbox.latestExec)

/** 不可预览/编辑（二进制 / 超限 / 非 UTF-8）：后端把 `content` 置 null 并给 `reason` */
const unreadable = computed(() => sandbox.content != null && sandbox.content.content == null)
const editable = computed(() => !!sandbox.content && sandbox.content.content != null && !sandbox.contentLoading && !sandbox.contentError)

async function bind(): Promise<void> {
  const tid = ps.enterProblem(props.problemId)
  if (sandbox.sessionId !== tid) await sandbox.attach(props.problemId, tid)
  else await sandbox.refreshTree()
  await autoOpenCarriedOver()
}

/**
 * 从产物面板「编辑并运行」跳过来时，store 里已经带着 selectedPath。
 * 这里把它接上，省得用户到了这一页还要在左栏重新点一次同一个文件。
 */
async function autoOpenCarriedOver(): Promise<void> {
  const want = sandbox.selectedPath
  if (!want) return
  const node = files.value.find((f) => f.path === want)
  // 已经加载过内容就别重复拉，避免把用户没保存的改动冲掉
  if (!node || sandbox.content) return
  await sandbox.openFile(node)
}

/** 换文件：清掉上一次的运行输出，避免看见的是别的文件的结果 */
function pick(node: ArtifactNode): void {
  if (node.path === sandbox.selectedPath || sandbox.saving) return
  if (sandbox.dirty && !window.confirm('当前文件有未保存的修改。确定放弃修改并切换文件吗？')) return
  sandbox.clearExecs()
  msg.value = ''
  void sandbox.openFile(node).then(async () => {
    await nextTick()
    editorEl.value?.focus()
  })
}

function onInput(ev: Event): void {
  sandbox.editContent((ev.target as HTMLTextAreaElement).value)
  msg.value = ''
}

async function run(): Promise<void> {
  if (!canRun.value || !editable.value || sandbox.isRunning) return
  // 有未保存改动时先跑，跑完提醒「这只是试跑，没落盘」
  await sandbox.runFile(sandbox.content?.content ?? '', sandbox.selectedPath)
  if (sandbox.dirty) {
    msg.value = '跑的是编辑器里的内容；要留档请点保存'
    saved.value = false
    window.setTimeout(() => (msg.value = ''), 4000)
  }
}

/** 保存前确认：覆盖的是智能体生成的原始文件 */
function askSave(): void {
  if (!editable.value || !sandbox.dirty || sandbox.saving) return
  dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  confirming.value = true
  void nextTick(() => cancelButton.value?.focus())
}

function closeConfirm(): void {
  confirming.value = false
  void nextTick(() => dialogTrigger?.focus())
}

function onDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { closeConfirm(); return }
  if (event.key !== 'Tab') return
  const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (event.shiftKey && index === 0) { event.preventDefault(); buttons.at(-1)?.focus() }
  if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus() }
}

function retryOpen(): void {
  const node = files.value.find((f) => f.path === sandbox.selectedPath)
  if (node) void sandbox.openFile(node)
}

/** 还原成打开时的内容（不落盘，仍需点保存才算数） */
function revert(): void {
  sandbox.revertFile()
  msg.value = '已还原为打开时的内容（未保存）'
  window.setTimeout(() => (msg.value = ''), 3000)
}

async function doSave(): Promise<void> {
  closeConfirm()
  const ok = await sandbox.saveFile()
  saved.value = ok
  msg.value = ok ? '已保存回产物目录' : '保存失败（只能覆盖已存在的文件）'
  window.setTimeout(() => {
    msg.value = ''
  }, 3000)
}

function allowLeave(): boolean {
  if (sandbox.saving) return false
  return !sandbox.dirty || window.confirm('当前文件有未保存的修改。确定离开并放弃修改吗？')
}

onBeforeRouteLeave(allowLeave)
onBeforeRouteUpdate(allowLeave)
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!sandbox.dirty && !sandbox.saving) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', onBeforeUnload)
watch(() => props.problemId, () => void bind(), { immediate: true })
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  sandbox.detach()
})
</script>

<style scoped lang="scss">
.editor-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 20px;
}

.head {
  max-width: 900px;
  margin-bottom: 14px;
  flex-shrink: 0;

  h1 {
    margin: 0 0 6px;
    font-size: 20px;
  }

  .lead {
    margin: 0;
    color: var(--c-muted);
    font-size: 13px;
    line-height: 1.8;

    strong {
      font-weight: 600;
      color: var(--c-primary-ink);
    }

    code {
      padding: 1px 5px;
      border-radius: var(--radius-sm);
      background: var(--c-primary-soft);
      color: var(--c-primary-ink);
      font-family: var(--font-mono);
      font-size: 12px;
    }
  }
}

.split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
}

.col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  overflow: hidden;
}

.p-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--c-line);
  background: var(--c-bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--c-ink-2);
  flex-shrink: 0;

  .count {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--c-surface);
    color: var(--c-muted);
    font-size: 11px;
    font-weight: 400;
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--c-ink-2);
  }

  .dirty {
    padding: 0 6px;
    border-radius: var(--radius-sm);
    background: var(--c-warn-soft);
    color: var(--c-warn-ink);
    font-size: 11px;
    font-weight: 600;
  }

  .btn.tiny {
    padding: 2px 10px;
    font-size: 12px;
  }

  .btn.run {
    background: var(--c-primary-soft);
    border-color: var(--c-primary);
    color: var(--c-primary-ink);
  }
}

.norun {
  padding: 5px 12px;
  background: var(--c-warn-soft);
  border-bottom: 1px solid var(--c-line);
  color: var(--c-warn-ink);
  font-size: 11.5px;
  line-height: 1.6;
  flex-shrink: 0;
}

.tree {
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.node {
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-mono);

  &:hover {
    background: var(--c-bg);
  }

  &.on {
    background: var(--c-primary-soft);
    color: var(--c-primary-ink);
  }

  .file-choice {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 7px 8px;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }

  .file-choice:focus-visible {
    outline: 2px solid var(--c-primary);
    outline-offset: -2px;
  }

  .ext {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-family: var(--font-sans);

    &.code {
      background: var(--c-primary);
      color: #fff;
    }

    &.data {
      background: var(--c-line);
      color: var(--c-ink-2);
    }
  }

  .nm {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.list-foot {
  padding: 6px 10px;
  border-top: 1px solid var(--c-line);
  background: var(--c-bg);
  color: var(--c-muted);
  font-size: 11px;
  flex-shrink: 0;

  .lg {
    display: inline-grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    margin: 0 3px 0 6px;
    font-size: 9px;

    &:first-child {
      margin-left: 0;
    }

    &.code {
      background: var(--c-primary);
      color: #fff;
    }

    &.data {
      background: var(--c-line);
      color: var(--c-ink-2);
    }
  }
}

.editor {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 12px 14px;
  border: none;
  resize: none;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--c-ink);
  background: var(--c-surface);
  white-space: pre;
  overflow: auto;
  tab-size: 2;

  &:focus {
    outline: none;
  }
}

.out {
  flex-shrink: 0;
  max-height: 240px;
  overflow-y: auto;
  border-top: 1px solid var(--c-line);
  background: #0b2e36;
  padding: 8px 12px 10px;

  pre {
    margin: 0 0 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .std {
    color: #d6ece8;
  }

  .err {
    color: #ffc9c0;
  }

  .none {
    color: #7fa3a8;
    font-size: 12px;
    font-family: var(--font-mono);
  }
}

.out-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(214, 236, 232, 0.15);

  .k {
    color: #9fc9c3;
    font-size: 11.5px;
    font-weight: 600;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #7fa3a8;

    b.ok {
      color: #6fd6c3;
    }

    b.bad {
      color: #ff9d8f;
    }
  }

  .btn.tiny {
    margin-left: auto;
    padding: 1px 9px;
    font-size: 11px;
    background: transparent;
    border-color: rgba(214, 236, 232, 0.3);
    color: #9fc9c3;
  }
}

.msg {
  padding: 6px 12px;
  border-top: 1px solid var(--c-line);
  font-size: 12px;
  color: var(--c-error);
  flex-shrink: 0;

  &.ok {
    color: var(--c-primary-ink);
  }
}

.empty-hint {
  padding: 20px 16px;
  color: var(--c-muted);
  font-size: 12.5px;
  line-height: 1.8;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(11, 46, 54, 0.35);
  display: grid;
  place-items: center;
  z-index: 50;
}

.dialog {
  width: min(460px, 90vw);
  background: var(--c-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: 18px 20px 14px;

  .d-ttl {
    font-size: 15px;
    font-weight: 600;
    color: var(--c-ink);
    margin-bottom: 8px;
  }

  .d-body {
    font-size: 13px;
    line-height: 1.8;
    color: var(--c-ink-2);

    code {
      padding: 1px 5px;
      border-radius: var(--radius-sm);
      background: var(--c-bg);
      font-family: var(--font-mono);
      font-size: 12px;
      word-break: break-all;
    }
  }

  .d-act {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
}

@media (max-width: 900px) {
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
