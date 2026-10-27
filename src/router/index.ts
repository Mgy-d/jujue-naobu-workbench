import { createRouter, createWebHashHistory } from 'vue-router'

import { useUserStore, type UserInfo } from '@/stores/user'

function isAdminUser(user: UserInfo | null): boolean {
  return user?.permissions?.includes('admin:access') === true || user?.role?.toLowerCase().includes('admin') === true
}

/**
 * 站点路由
 *
 * 两套东西并存，边界要说清：
 *  1. 站点四视图（首页 / 题目详情 / 工作台 / 我的成果）—— 由 `PrototypeShell`
 *     一个组件承载。原型本来就是一页里靠 `go(v)` 切 `.view` 类名，四个 section
 *     必须同时在 DOM 里（162 个原型函数就是靠 id 找它们的），所以不能拆成四个
 *     路由组件。路由在这里的作用是「可分享、可刷新、可前进后退」，
 *     视图切换仍由原型逻辑驱动（go() 里同步 URL，见 legacy/prototype/hooks.ts）。
 *  2. 沙箱模块（/sandbox/*）—— 独立多页模块，路径与改造前完全一致。
     它内部全部用路径跳转（没有命名路由依赖），所以合表不会影响它。

  沙箱工作台**不再有独立路由**：它以「站点内全屏层」的形态从首页里打开
  （见 PrototypeShell.vue 的 .sb-layer），进入方式只有一个 —— 对话里生成
  解题代码后点「进入沙箱运行」。这里只留两个可以被直接打开的沙箱子页：
  产物浏览与文件编辑，供对话回执里的「在沙箱中查看产物」落脚。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/ResearchHomeView.vue') },
    { path: '/research/work', name: 'research-workspace', component: () => import('@/views/ResearchWorkspaceView.vue') },
    ...(import.meta.env.DEV ? [{ path: '/dev/research/contest', component: () => import('@/dev/ResearchComponentHarness.vue') }, { path: '/dev/research/stages', component: () => import('@/dev/ResearchStageHarness.vue') }] : []),
    { path: '/legacy/prototype', name: 'legacy-prototype', component: () => import('@/views/PrototypeShell.vue') },
    {
      path: '/mine',
      name: 'mine',
      component: () => import('@/views/PrototypeShell.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/work',
      name: 'work',
      component: () => import('@/views/PrototypeShell.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/p/:id', name: 'problem', component: () => import('@/views/PrototypeShell.vue') },
    {
      path: '/case-admin',
      name: 'case-admin',
      component: () => import('@/views/CaseManagementView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },

    { path: '/research/sandbox', name: 'research-sandbox', component: () => import('@/views/ResearchSandboxView.vue') },

    { path: '/research/intake', name: 'research-intake', redirect: '/research/work?mode=analysis' },

    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },

    // ── 沙箱模块（路径原样保留；requiresAuth 是接入站点登录体系时新加的） ──
    // 沙箱的每个请求都带 Bearer 直连后端，未登录进来只会满屏 401，
    // 所以统一交给路由守卫拦在门口 —— 与 /mine、/work 同款，不在按钮上各自判断。
    // 环境列表页与代码台已随「删掉沙箱预留题目数据」一并移除；
    // 工作台改由站点内全屏层承载，也没有独立路由。
    // 工作台由代码生成后的「进入沙箱运行」按钮进入；problemId 使用当前
    // 分析 CaseRef 的 caseId，确保与 S1/S2/S3 复用同一会话。
    {
      path: '/sandbox/work/:problemId',
      name: 'sandbox-work',
      component: () => import('@/views/WorkbenchView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/sandbox/artifacts/:problemId',
      name: 'artifacts',
      component: () => import('@/views/ArtifactView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/sandbox/editor/:problemId',
      name: 'editor',
      component: () => import('@/views/FileEditorView.vue'),
      props: true,
      meta: { requiresAuth: true },
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * 受保护路由的守卫（kuaike 范式）。
 * real 模式必须先等会话恢复完成（拿 token 换用户信息），
 * 否则刷新页面时会把已登录用户误判成未登录、直接踢回登录页。
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  const userStore = useUserStore()
  await userStore.ensureRestored()
  if (!userStore.isLogged) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !isAdminUser(userStore.user)) {
    return { name: 'home' }
  }
  return true
})

// A cached homepage can outlive its local server. Explain a failed lazy route
// instead of leaving a clickable entry apparently unresponsive.
router.onError((error) => {
  if(!/dynamically imported module|Importing a module script failed|Loading chunk|Unable to preload CSS/i.test(error.message)) return
  if(document.getElementById('research-page-load-error')) return
  const notice=document.createElement('div')
  notice.id='research-page-load-error';notice.setAttribute('role','alert')
  notice.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;max-width:680px;padding:16px 20px;border:1px solid #c9a36b;border-radius:10px;background:#fff8ec;color:#493419;box-shadow:0 6px 24px #0002'
  const text=document.createElement('p')
  text.textContent='页面文件未能加载，请确认网页服务已启动，再刷新页面。若刚更新过版本，也请刷新后重新进入；本机草稿仍保留。'
  const button=document.createElement('button')
  button.type='button';button.textContent='刷新页面';button.onclick=()=>window.location.reload()
  notice.append(text,button);document.body.append(notice)
})
router.afterEach((_to,_from,failure)=>{if(!failure)document.getElementById('research-page-load-error')?.remove()})

export default router
