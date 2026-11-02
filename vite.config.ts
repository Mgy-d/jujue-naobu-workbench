import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { createMockBusinessService } from './tests/fixtures/research-business-mock.mjs'

/**
 * 沙箱工作台 —— 只依赖 agent-platform 既有接口，零后端改动。
 *
 * 代理是必需品不是优化：agent-platform 未开放 CORS，
 * 浏览器直连 :8080 会被跨域拦死，所以前端一律写相对路径。
 * preview 也必须配同一份 proxy，否则预览构建产物时接口全 404。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:8080'

  const proxyOptions = {
    '/sandbox-api': { target: 'http://127.0.0.1:8766', changeOrigin: true },
    '/api': { target: backendTarget, changeOrigin: true },
    '/agui': { target: backendTarget, changeOrigin: true },
    /**
     * 首页题库封面：后端由 ProblemCoverController 生成、落在 workspace/hero-covers/，
     * 经 WebConfig 的静态映射暴露在 /covers/**。不代理的话 dev 下会去 public/ 找 → 404。
     * 不必带鉴权：后端那条路由在 /api 之外，本来就免鉴权。
     */
    '/covers': { target: backendTarget, changeOrigin: true },
  }

  /**
   * 演示/联调用合成业务服务：仅当 VITE_RESEARCH_BUSINESS_MODE=mock（本地 .env.local）时挂载，
   * 把 /__research_mock__ 转发给 tests/fixtures 的合成实现。生产构建不含此插件。
   */
  const businessMockPlugin: Plugin = {
    name: 'research-business-mock',
    configureServer(server) {
      const service = createMockBusinessService({ fullStudyChecks: true })
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/__research_mock__/')) return next()
        void (async () => {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const body = Buffer.concat(chunks)
            const request = new Request('http://127.0.0.1' + req.url, {
              method: req.method,
              headers: req.headers as Record<string, string>,
              ...(body.length ? { body, duplex: 'half' } : {}),
            } as RequestInit)
            const response = await service.handle(request)
            const headers: Record<string, string> = {}
            response.headers.forEach((value, key) => { headers[key] = value })
            res.writeHead(response.status, headers)
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch {
            res.statusCode = 500
            res.end('mock fixture error')
          }
        })()
      })
    },
  }

  return {
    plugins: [vue(), ...(env.VITE_RESEARCH_BUSINESS_MODE === 'mock' ? [businessMockPlugin] : [])],
    base: './',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5181,
      strictPort: true,
      open: true,
      host: true,
      proxy: proxyOptions,
    },
    preview: {
      port: 5181,
      strictPort: true,
      proxy: proxyOptions,
    },
    build: {
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 2048,
    },
  }
})
