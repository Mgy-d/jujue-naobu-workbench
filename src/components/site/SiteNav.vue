<!--
  站点顶部导航（原型 .nav 的独立版本）。

  为什么单独做一份：原型那套 .nav 样式随 PrototypeShell 按需挂载/卸载，
  会员中心 / 团队管理这些独立路由页拿不到那份 CSS，也没有入口逻辑。
  这里把「品牌 + 主入口 + 充值/积分/用户/退出」按原型外观重画一遍，
  颜色写死不依赖 --blue-* 变量，进任何页面都不会掉样式。

  版式：position:fixed + 66px 高，与原型一致；各会员页已预留 96px 顶部内边距。
-->
<template>
  <header class="site-nav">
    <div class="nav-inner">
      <RouterLink class="brand" :to="{ name: 'home' }" title="返回首页">
        <Transition name="brand-logo" appear>
          <span class="brand-lockup">
            <span class="brand-artwork" aria-hidden="true">
              <img :src="brandMarkUrl" width="26" height="26" alt="" />
            </span>
            <span class="brand-txt">
              <span class="brand-name"><span>市</span><span>调</span><span>演</span><span>真</span></span>

            </span>
          </span>
        </Transition>
      </RouterLink>

      <TransitionGroup name="nav-item" tag="nav" class="nav-links" appear>
        <RouterLink
          v-for="item in links"
          :key="item.name"
          :to="{ name: item.name }"
          class="nav-link"
          :class="{ on: activeName === item.name }"
        >
          {{ item.label }}
        </RouterLink>
      </TransitionGroup>

      <div class="nav-right">
        <!-- 充值入口与积分胶囊指向同一页面（积分中心里就有充值 tab），只保留积分这一个 -->
        <button class="nav-pts" title="打开积分中心" @click="goMember">{{ memberStore.balance }} 积分</button>

        <!-- 账号下拉：后台管理（原「会员管理」）收进这里，避免顶栏平铺两个管理员入口。
             每个页面都挂这条导航，所以从任何页面都能进后台，不再是只有首页才点得到 -->
        <div v-if="userStore.isLogged" ref="menuEl" class="nav-user-menu">
          <button
            class="nav-user"
            :class="{ on: menuOpen }"
            :title="userStore.displayName"
            @click="menuOpen = !menuOpen"
          >
            <span class="nav-user-name">{{ userStore.displayName }}</span>
            <i class="caret" :class="{ up: menuOpen }"></i>
          </button>
          <div v-if="menuOpen" class="nav-menu">
            <RouterLink
              v-if="canAdminConsole"
              class="nav-menu-item"
              :class="{ on: activeName === 'member-admin' }"
              :to="{ name: 'member-admin' }"
              @click="menuOpen = false"
            >
              后台管理
            </RouterLink>
            <button class="nav-menu-item" @click="onLogout">退出登录</button>
          </div>
        </div>
        <button v-else class="nav-quit" @click="goLogin">登录</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { ADMIN_CONSOLE_ENTRY, SITE_NAV } from '@/config/permissions'
import { usePermission } from '@/hooks/usePermission'
import { useMemberStore } from '@/stores/member'
import { useUserStore } from '@/stores/user'

const brandMarkUrl = `${import.meta.env.BASE_URL}brand/mms-symbol.png`

const props = defineProps<{
  /** 当前页标识；不传就按路由名判断高亮 */
  active?: string
}>()

const route = useRoute()
const router = useRouter()
const memberStore = useMemberStore()
const userStore = useUserStore()

const { canAll } = usePermission()

/**
 * 主入口：首页 / 我的成果 / 案例管理 / 团队管理。
 * 列表本身在 `config/permissions.ts` 的 SITE_NAV（全站唯一来源），
 * 这里只按「登录态 + 权限码」过滤，不再写死任何角色名。
 * 已有任务统一从「我的成果」进入；后台管理收在账号下拉里。
 */
const links = computed(() =>
  SITE_NAV.filter(
    (item) => (!item.requiresLogin || userStore.isLogged) && canAll(item.permissions),
  ),
)

/** 账号下拉里的「后台管理」：同样由 admin:access 决定 */
const canAdminConsole = computed(() => canAll(ADMIN_CONSOLE_ENTRY.permissions))

/** 高亮项：显式传入优先，否则取路由名 */
const activeName = computed(() => props.active || String(route.name ?? ''))

/** 账号下拉：点外部/换页都要收起来，否则会一直悬在内容上 */
const menuOpen = ref(false)
const menuEl = ref<HTMLElement | null>(null)

function onDocClick(event: MouseEvent): void {
  if (!menuOpen.value) return
  const target = event.target as Node | null
  if (menuEl.value && target && !menuEl.value.contains(target)) menuOpen.value = false
}

watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function goMember(): void {
  void router.push({ name: 'member-center' })
}

function goLogin(): void {
  void router.push({ name: 'login' })
}

async function onLogout(): Promise<void> {
  await userStore.logout()
  void router.push({ name: 'home' })
}

watch(()=>userStore.isLogged ? userStore.user?.userId || userStore.displayName : '',()=>{
  memberStore.reset()
  if(userStore.isLogged)void memberStore.ensureLoaded()
},{immediate:true})

onMounted(() => {
  /* 余额是导航上常驻的数字，进页面就拉一次；已缓存则为空操作 */
  if(userStore.isLogged)void memberStore.ensureLoaded()
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.site-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid #dcedee;
}
.nav-inner {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 0 40px;
  height: 66px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}
.brand-lockup {
  display: flex;
  align-items: center;
  gap: 11px;
  transition: transform 0.2s ease;
}
.brand-artwork {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, #effaf8, #e2f4f0);
  box-shadow: inset 0 0 0 1px rgba(18, 165, 148, 0.08);
}
.brand-artwork img {
  display: block;
  object-fit: contain;
}
.brand-txt {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif;
}
.brand-name {
  display: grid;
  grid-template-columns: repeat(4, 1.05em);
  text-align: center;
  color: #0b6e68;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
}
.brand-sub {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  text-align: center;
  color: #7c99a1;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0;
}
.brand-sub > span {
  grid-column: span 2;
}
.brand-sub > span:first-child {
  grid-column: 2 / span 2;
}
.brand:hover .brand-lockup {
  transform: translateY(-1px) scale(1.02);
}
.brand:active .brand-lockup {
  transform: scale(0.96);
}
.brand-logo-enter-active,
.brand-logo-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.brand-logo-enter-from,
.brand-logo-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
@media (prefers-reduced-motion: reduce) {
  .brand-lockup,
  .brand-logo-enter-active,
  .brand-logo-leave-active {
    transition: none;
  }
  .brand:hover .brand-lockup,
  .brand:active .brand-lockup,
  .brand-logo-enter-from,
  .brand-logo-leave-to {
    transform: none;
  }
}
.nav-links {
  position: relative;
  display: flex;
  gap: 8px;
  margin-left: 28px;
  flex-shrink: 0;
}
.nav-link {
  padding: 7px 14px;
  border-radius: 9px;
  color: #3d6570;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: 0.18s;
  white-space: nowrap;
}
.nav-link:hover {
  background: #effaf8;
  color: #12a594;
  transform: translateY(-1px) scale(1.02);
}
.nav-link:active {
  transform: scale(0.97);
}
.nav-item-move,
.nav-item-enter-active,
.nav-item-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.nav-item-enter-from,
.nav-item-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.nav-item-leave-active {
  position: absolute;
}
.nav-link.on {
  background: #dff4f1;
  color: #0e8f84;
}
.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.nav-pts {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: #effaf8;
  color: #0b6e68;
  font-size: 12.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.16s ease;
}
.nav-pts:hover {
  background: #d9f3ef;
}
/* 账号下拉：触发器沿用原来的用户名位置，菜单挂在它下面 */
.nav-user-menu {
  position: relative;
}
.nav-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
  padding: 6px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #0b6e68;
  cursor: pointer;
  transition: 0.16s;
}
.nav-user:hover,
.nav-user.on {
  background: #effaf8;
}
.nav-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  transition: transform 0.16s ease;
}
.caret.up {
  transform: rotate(180deg);
}
.nav-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 70;
  min-width: 132px;
  padding: 6px;
  border: 1px solid #dcedee;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(11, 110, 104, 0.16);
}
.nav-menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #3d6570;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: 0.16s;
}
.nav-menu-item:hover {
  background: #effaf8;
  color: #12a594;
}
.nav-menu-item.on {
  background: #dff4f1;
  color: #0e8f84;
}
.nav-quit {
  padding: 6px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #7c99a1;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.16s;
}
.nav-quit:hover {
  background: #f3fafa;
  color: #0b6e68;
}

@media (max-width: 820px) {
  .nav-inner {
    height: 60px;
    gap: 8px;
    padding: 0 12px;
  }
  .brand-txt {
    display: none;
  }
  .nav-links {
    margin-left: 0;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-link {
    padding: 8px 9px;
    font-size: 12.5px;
  }
  .nav-right {
    gap: 6px;
  }
  /* 账号下拉在窄屏必须留着：「后台管理 / 退出登录」都在里面 */
  .nav-user {
    padding: 6px 8px;
    max-width: 96px;
    font-size: 12.5px;
  }
}
</style>
