/**
 * 本机模拟沙箱客户端（演示用）
 *
 * 与 `researchSandbox.ts` 的真实客户端**同形**（方法签名、返回结构一致），
 * 但实现完全在浏览器内，不连 Docker、不需要访问令牌：
 *   - 工作区文件来自 `data/mockSandbox` 的 mock 产物树（已含可解析 CSV）
 *   - 上传的 CSV 在浏览器内读取，不离开本机
 *   - 解析/描述统计/受限代码**都在本页面用 `engine/localRunner` 跑**（受限 JavaScript）
 *
 * ⚠️ 仅用于演示：不保证与真实沙箱字节级一致，UI 必须显式标注“本机模拟”。
 */

import type { SandboxArtifact, SandboxFile, SandboxRun, SandboxWorkspace } from './researchSandbox'
import { sandboxClient } from './researchSandbox'
import { mockArtifactContent, mockArtifactTree } from '@/data/mockSandbox'
import { runLocalCode } from '@/engine/localRunner'

/** 把嵌套产物树摊平成文件列表（只取叶子文件） */
function flatten(nodes: ReturnType<typeof mockArtifactTree>): typeof nodes {
  const out: typeof nodes = []
  const walk = (list: typeof nodes): void => {
    for (const n of list) {
      if ('children' in n && n.children) walk(n.children)
      else out.push(n)
    }
  }
  walk(nodes)
  return out
}

async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败：' + file.name))
    reader.readAsText(file)
  })
}

/**
 * 生成一段描述统计脚本，交给浏览器内执行引擎跑。
 * 读 CSV → 逐列算 计数/均值/标准差/最小/最大，只认数值列。
 */
function statisticsScript(name: string, columns: string[]): string {
  const colsArg = columns.length ? JSON.stringify(columns) : 'null'
  const lines = [
    `const csv = sandbox.readFile(${JSON.stringify(name)})`,
    `const lines = csv.trim().split('\\n').filter(Boolean)`,
    `const header = lines[0].split(',')`,
    `const rows = lines.slice(1).map(l => l.split(','))`,
    `const cols = ${colsArg} && ${colsArg}.length ? ${colsArg} : header`,
    `console.log('样本行数(不含表头):', rows.length)`,
    `console.log('列:', header.join(' | '))`,
    `for (const c of cols) {`,
    `  const idx = header.indexOf(c)`,
    `  if (idx < 0) { console.log(c + ': 列不存在'); continue }`,
    `  const vals = rows.map(r => Number(r[idx])).filter(v => !Number.isNaN(v))`,
    `  if (!vals.length) { console.log(c + ': 无非数值数据'); continue }`,
    `  const n = vals.length`,
    `  const mean = vals.reduce((a, b) => a + b, 0) / n`,
    `  const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n`,
    `  const std = Math.sqrt(variance)`,
    `  const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals)`,
    `  console.log(c + ': n=' + n + ' 均值=' + mean.toFixed(4) + ' 标准差=' + std.toFixed(4) + ' 最小=' + min.toFixed(4) + ' 最大=' + max.toFixed(4))`,
    `}`,
  ]
  return lines.join('\n') + '\n'
}

export function mockSandboxClient(_token = ''): ReturnType<typeof sandboxClient> {
  const treeFiles = flatten(mockArtifactTree())
  const files: SandboxFile[] = treeFiles.map((n, i) => ({
    fileId: 'mock-' + i,
    name: n.name,
    size: n.size ?? 0,
    sha256: 'mock',
    sandboxPath: n.path,
  }))
  const contentById = new Map<string, string>()
  treeFiles.forEach((n, i) => {
    contentById.set('mock-' + i, mockArtifactContent(n.path).content)
  })

  const workspace: SandboxWorkspace = {
    workspaceId: 'mock-workspace',
    title: '本机模拟工作区（演示）',
    files,
  }
  const runs = new Map<string, SandboxRun>()
  const artifactContents = new Map<string, string>()

  const contentOf = (f: SandboxFile): string => contentById.get(f.fileId) ?? ''

  return {
    async workspaces() {
      return [workspace]
    },
    async workspace() {
      return workspace
    },
    async create(title: string) {
      workspace.title = title || workspace.title
      return workspace
    },
    async upload(id: string, file: File) {
      const text = await readFileText(file)
      const fileId = 'up-' + crypto.randomUUID()
      const sf: SandboxFile = {
        fileId,
        name: file.name,
        size: file.size,
        sha256: 'mock',
        sandboxPath: file.name,
      }
      workspace.files = [...workspace.files, sf]
      contentById.set(fileId, text)
      return sf
    },
    async run(id: string) {
      return runs.get(id) ?? {
        workspaceId: workspace.workspaceId,
        runId: id,
        inputFingerprint: '',
        executionStatus: 'succeeded',
        outputStatus: 'available',
        error: null,
        log: '本机模拟（演示）',
        artifacts: [],
        inputs: [],
      }
    },
    async events() {
      return { events: [] }
    },
    async start(id: string, data: unknown, _key: string) {
      const { kind, fileIds, code, columns, timeoutSeconds } = data as {
        kind: string
        fileIds: string[]
        code?: string
        columns?: string[]
        timeoutSeconds?: number
      }
      const picked = workspace.files.filter((f) => fileIds.includes(f.fileId))
      const contents = picked.map((f) => ({ name: f.name, content: contentOf(f) }))
      const runId = 'mock-' + crypto.randomUUID()
      let content = ''
      let log = '本机模拟（演示）'

      if (kind === 'parse') {
        const f = contents[0]
        const rows = f.content.trim().split(/\r?\n/).filter(Boolean)
        const header = rows[0]?.split(',') ?? []
        const preview = rows.slice(1, 6)
        content = [
          '文件: ' + f.name,
          '行数(不含表头): ' + (rows.length - 1),
          '列(' + header.length + '): ' + header.join(' | '),
          '',
          '预览(前 5 行):',
          ...preview,
        ].join('\n')
        log = '本机模拟解析（演示）'
      } else if (kind === 'statistics') {
        const f = contents[0]
        const script = statisticsScript(f.name, columns ?? [])
        const out = await runLocalCode(script, {
          files: [{ path: f.name, content: f.content }],
          timeoutMs: Math.min((timeoutSeconds ?? 30) * 1000, 30000),
        })
        content = (out.result.stdout || '') + (out.result.stderr ? '\n' + out.result.stderr : '')
        log = '本机模拟执行（演示）· 耗时 ' + out.result.elapsedMs + 'ms · 退出码 ' + out.result.exitCode + (out.result.isError ? ' · 有错误' : '')
      } else {
        // python / 受限代码：浏览器内只能跑 JavaScript，如实标注
        const out = await runLocalCode(code ?? '', {
          files: contents.map((c) => ({ path: c.name, content: c.content })),
          timeoutMs: Math.min((timeoutSeconds ?? 30) * 1000, 30000),
        })
        content = (out.result.stdout || '') + (out.result.stderr ? '\n' + out.result.stderr : '')
        log = '本机模拟执行（演示，受限 JavaScript）· 耗时 ' + out.result.elapsedMs + 'ms · 退出码 ' + out.result.exitCode + (out.result.isError ? ' · 有错误' : '')
      }

      const hash = await sha256hex(content)
      const artifact: SandboxArtifact = {
        artifactId: runId + '-a1',
        versionId: 'v1',
        name: kind === 'parse' ? 'parse-preview.txt' : 'result.txt',
        size: content.length,
        sha256: hash,
      }
      artifactContents.set(artifact.artifactId, content)
      const run: SandboxRun = {
        workspaceId: id,
        runId,
        inputFingerprint: fileIds.join(',') + ':' + kind,
        executionStatus: 'succeeded',
        outputStatus: 'available',
        error: null,
        log,
        artifacts: [artifact],
        inputs: picked,
      }
      runs.set(runId, run)
      return run
    },
    async cancel(id: string) {
      return runs.get(id) ?? (await this.run(id))
    },
    async commit(id: string) {
      const run = runs.get(id)
      if (run) run.outputStatus = 'available'
      return run ?? (await this.run(id))
    },
    async download(_runId: string, item: SandboxArtifact) {
      const text = artifactContents.get(item.artifactId) ?? ''
      return new Blob([text], { type: 'text/plain;charset=utf-8' })
    },
  }
}
