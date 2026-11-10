<template>
  <div class="team-page">
    <!-- 原型：进站点就带顶部主菜单，团队管理为高亮项 -->
    <SiteNav active="member-team" />

    <header class="page-head">
      <div>
        <div class="eyebrow">TEAM QUOTA</div>
        <h1>团队额度</h1>
        <p class="sub">
          团队额度由平台发放，管理员分配到成员；成员消费<b>不扣个人积分</b>，两条账互不影响。
        </p>
      </div>
      <button class="ghost" @click="goHome">返回首页</button>
    </header>

    <div v-if="msg" :class="['notice', { error: isError }]">{{ msg }}</div>

    <!-- 未入队 -->
    <section v-if="!team || !team.id" class="panel empty-panel">
      <h2>还没有加入团队</h2>
      <p class="hint">向团队管理员要一个团队邀请码，输入后即可入队。入队不会自动获得积分，额度由管理员分配。</p>
      <div class="join-row">
        <input v-model="joinCode" class="input" placeholder="TEAM-XXXXXX" />
        <input v-model="joinName" class="input" placeholder="你的姓名（可选）" />
        <button class="solid" :disabled="!joinCode" @click="doJoin">加入团队</button>
      </div>
      <p v-if="isPlatform" class="hint" style="margin-top: 14px">
        你是平台管理员：请到「会员管理后台 → 团队」创建团队并指定团队管理员。
      </p>
    </section>

    <template v-else>
      <!-- 概览 -->
      <section class="panel">
        <div class="team-head">
          <div>
            <h2>{{ team.name }}</h2>
            <div class="meta">
              <span>{{ team.term || '未设期次' }}</span>
              <span class="dot">·</span>
              <span>{{ team.members.length }} 名成员</span>
              <span class="dot">·</span>
              <span class="role">{{ roleText }}</span>
            </div>
          </div>
          <div v-if="canManage" class="invite-code">
            <div class="lab">团队邀请码（发给同学即可入队）</div>
            <div class="code-line">
              <b>{{ team.inviteCode }}</b>
              <button class="ghost" @click="copyCode">复制</button>
            </div>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><div class="k">本期总额度</div><div class="v">{{ team.quotaTotal }}</div></div>
          <div class="stat"><div class="k">池内可分配</div><div class="v pool">{{ team.pool }}</div></div>
          <div class="stat"><div class="k">已分配未用</div><div class="v">{{ team.allocated }}</div></div>
          <div class="stat"><div class="k">已消费</div><div class="v used">{{ team.quotaUsed }}</div></div>
        </div>

        <div v-if="team.me" class="mine">
          我的额度：<b>{{ team.me.quota }}</b> ，已用 <b>{{ team.me.used }}</b> ，剩余
          <b class="pool">{{ team.me.remaining }}</b>
        </div>

        <!-- 原型：追加额度申请入口放在本期团队额度卡片底部 -->
        <div v-if="canManage" class="panel-foot">
          <button v-if="canApply" class="ghost" @click="openApply">申请追加额度</button>
          <p v-else class="hint apply-hint">
            追加额度只能由团队管理员提交，平台管理员只做审批。请让 {{ teamAdminName }} 提交申请。
          </p>
        </div>
      </section>

      <!-- 成员表 -->
      <section class="panel">
        <div class="panel-head">
          <h2>成员与额度</h2>
          <div v-if="canManage" class="acts">
            <button class="ghost" :disabled="!team.pool" @click="doAverage">池内平均分配</button>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>成员</th>
              <th>身份</th>
              <th class="num">额度</th>
              <th class="num">已用</th>
              <th class="num">剩余</th>
              <th v-if="canAllocate">调整</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in team.members" :key="m.id">
              <td>
                <!-- 成员列只放「谁」（姓名 / 占位），身份列才是角色；
                     以前 name 为空时直接把 user_id 顶上来，用户名与 UUID 混在一起看，很容易误读成两个管理员 -->
                <div class="who">
                  {{ m.name || '未命名成员' }}
                  <span v-if="team.me && m.id === team.me.id" class="me-tag">我</span>
                </div>
                <div v-if="m.studentNo" class="muted small">{{ m.studentNo }}</div>
              </td>
              <td><span class="chip">{{ m.role === 'team_admin' ? '团队管理员' : '成员' }}</span></td>
              <td class="num">{{ m.quota }}</td>
              <td class="num">{{ m.used }}</td>
              <td class="num remain">{{ m.remaining }}</td>
              <td v-if="canAllocate" class="adjust">
                <input v-model.number="drafts[m.id]" type="number" min="0" class="mini" />
                <button class="ghost mini-btn" @click="doAllocate(m)">保存</button>
              </td>
            </tr>
            <tr v-if="!team.members.length">
              <td :colspan="canAllocate ? 6 : 5" class="empty">还没有成员，把团队邀请码发给同学</td>
            </tr>
          </tbody>
        </table>
        <p v-if="canAllocate" class="hint" style="margin: 10px 0 0">
          约束：额度和不得低于该成员已用的 {{ ' ' }}积分；调高从池内扣，调低退回池内；池内为 0 时先把其他成员额度调低。
        </p>
      </section>

      <!-- 申请追加：按原型做成弹窗 -->
      <div v-if="canManage && showApply" class="modal-mask" @click.self="showApply = false">
        <div class="modal" role="dialog" aria-modal="true" aria-label="申请追加团队额度">
          <h2>申请追加团队额度</h2>
          <p class="modal-sub">本期额度不足时提交申请，审批结果在本页与管理后台同步。</p>

          <label class="fl" for="apply-quota">申请额度（积分）<i class="req">*</i></label>
          <input
            id="apply-quota"
            v-model.number="applyForm.quota"
            type="number"
            :min="minQuota"
            step="100"
            class="input apply-input"
          />

          <label class="fl" for="apply-purpose">用途说明<i class="req">*</i></label>
          <textarea
            id="apply-purpose"
            v-model="applyForm.purpose"
            class="input area apply-input"
            rows="3"
            placeholder="例如：2026 秋季集训的新题演易"
            @input="applyError = ''"
          ></textarea>

          <div class="ro-row">
            <span class="ro-lab">团队名称</span>
            <div class="ro-val">{{ team.name }}</div>
          </div>
          <div class="ro-row">
            <span class="ro-lab">团队编号</span>
            <div class="ro-val">{{ team.inviteCode }}</div>
          </div>
          <div class="ro-row">
            <span class="ro-lab">联系人</span>
            <div class="ro-val">{{ contactName }}</div>
          </div>

          <p v-if="applyError" class="modal-err">{{ applyError }}</p>

          <div class="modal-acts">
            <span class="req-hint"><i class="req">*</i> 为必填项</span>
            <div class="acts-right">
              <button class="ghost" @click="showApply = false">取消</button>
              <button class="solid" @click="doApply">提交申请</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 申请记录 -->
      <section class="panel">
        <div class="panel-head"><h2>额度申请记录</h2></div>
        <table class="table apps-table">
          <thead>
            <tr><th>申请额度</th><th>用途</th><th>期望到账</th><th>状态</th><th>提交时间</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in applications" :key="a.id">
              <td class="num">{{ a.quota }}</td>
              <td>{{ a.purpose }}</td>
              <td class="muted">{{ a.expectDate || '—' }}</td>
              <td><span :class="['chip', statusClass(a.status)]">{{ statusText(a.status) }}</span></td>
              <td class="muted">{{ a.createdAt?.slice(0, 16).replace('T', ' ') }}</td>
            </tr>
            <tr v-if="!applications.length">
              <td colspan="5" class="empty">还没有申请记录</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { memberApi, type QuotaApplication, type TeamInfo } from '@/api/member'
import { useMemberStore } from '@/stores/member'
import { useUserStore } from '@/stores/user'
import SiteNav from '@/components/site/SiteNav.vue'

const router = useRouter()
const memberStore = useMemberStore()
const userStore = useUserStore()

/** 与其他会员页一致：右上角「返回首页」 */
function goHome(): void {
  void router.push({ name: 'home' })
}

const team = ref<TeamInfo | null>(null)
const applications = ref<QuotaApplication[]>([])
const drafts = reactive<Record<string, number>>({})
const joinCode = ref('')
const joinName = ref('')
const msg = ref('')
const isError = ref(false)
const showApply = ref(false)
/** 弹窗内的校验/提交错误：必须显示在弹窗里，页面级 notice 会被遮罩挡住 */
const applyError = ref('')
const minQuota = ref(1000)

const applyForm = reactive({
  quota: 1000,
  purpose: '',
  expectDate: new Date().toISOString().slice(0, 10),
  note: '',
})

/** 平台管理员视角：由权限码 admin:access 决定，不看角色名 */
const isPlatform = computed(() => (userStore.user?.permissions ?? []).includes('admin:access'))

const canManage = computed(() => team.value?.mode === 'leader' || team.value?.mode === 'platform')

/** 成员额度调整列：数据侧允许（团队管理员/平台视角）即可 */
const canAllocate = computed(() => canManage.value)

/**
 * 能否提交追加额度申请：后端只认「本团队成员且 role=team_admin」（平台管理员只批不申）。
 * canManage 包含平台管理员，用它当申请入口会让平台管理员点进一个必然 403 的弹窗。
 */
const canApply = computed(() => team.value?.me?.role === 'team_admin')

/** 本团队的团队管理员姓名：非团队管理员时用它说明该找谁提交。 */
const teamAdminName = computed(
  () => team.value?.members.find((m) => m.role === 'team_admin')?.name || '团队管理员',
)

const roleText = computed(() => {
  if (team.value?.mode === 'leader') return '你是团队管理员'
  if (team.value?.mode === 'platform') return '平台管理员视角'
  return '成员（只读）'
})

/** 追加申请的联系人：优先团队管理员，取不到时回落到当前登录用户。 */
const contactName = computed(
  () => team.value?.members.find((m) => m.role === 'team_admin')?.name || userStore.displayName || '—',
)

function notify(text: string, error = false): void {
  msg.value = text
  isError.value = error
  window.setTimeout(() => {
    if (msg.value === text) msg.value = ''
  }, 4000)
}

function statusText(status: string): string {
  if (status === 'PENDING') return '待审批'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return status
}

function statusClass(status: string): string {
  if (status === 'APPROVED') return 'ok'
  if (status === 'REJECTED') return 'bad'
  return ''
}

async function load(): Promise<void> {
  try {
    const data = await memberApi.team()
    team.value = data
    if (data?.members) {
      for (const m of data.members) drafts[m.id] = m.quota
    }
    if (data?.id && canManage.value) {
      applications.value = await memberApi.myApplications()
    }
  } catch (e) {
    notify(e instanceof Error ? e.message : '团队信息加载失败', true)
  }
}

async function doJoin(): Promise<void> {
  if (!joinCode.value) return
  try {
    await memberApi.joinTeam(joinCode.value.trim().toUpperCase(), joinName.value || undefined)
    joinCode.value = ''
    await load()
    notify('已加入团队，等待管理员分配额度')
  } catch (e) {
    notify(e instanceof Error ? e.message : '加入失败', true)
  }
}

async function doAllocate(member: { id: string; quota: number }): Promise<void> {
  const next = drafts[member.id]
  if (next === undefined || Number.isNaN(next)) return
  try {
    await memberApi.allocate(member.id, next)
    await load()
    notify('额度已调整')
  } catch (e) {
    notify(e instanceof Error ? e.message : '调整失败', true)
  }
}

async function doAverage(): Promise<void> {
  if (!team.value?.id) return
  try {
    await memberApi.allocateAverage(team.value.id)
    await load()
    notify('已平均分配')
  } catch (e) {
    notify(e instanceof Error ? e.message : '分配失败', true)
  }
}

/** 打开追加额度弹窗：清空上一次的报错，避免旧提示残留。 */
function openApply(): void {
  applyError.value = ''
  showApply.value = true
}

async function doApply(): Promise<void> {
  applyError.value = ''
  if (!Number.isFinite(applyForm.quota) || applyForm.quota < minQuota.value) {
    applyError.value = `申请额度不能低于 ${minQuota.value} 积分`
    return
  }
  if (!applyForm.purpose.trim()) {
    applyError.value = '请填写用途说明'
    return
  }
  try {
    await memberApi.applyQuota({
      quota: applyForm.quota,
      purpose: applyForm.purpose,
      expectDate: applyForm.expectDate,
      note: applyForm.note,
    })
    applyForm.purpose = ''
    applyForm.note = ''
    applyError.value = ''
    showApply.value = false
    await load()
    notify('申请已提交，等待平台管理员审批')
  } catch (e) {
    /* 提交失败也留在弹窗里显示，不能甩到弹窗后面的页面提示上 */
    applyError.value = e instanceof Error ? e.message : '提交失败'
  }
}

function copyCode(): void {
  if (!team.value) return
  navigator.clipboard
    ?.writeText(team.value.inviteCode)
    .then(() => notify('团队邀请码已复制'))
    .catch(() => notify('复制失败，请手动选择', true))
}

onMounted(async () => {
  await memberStore.ensureLoaded()
  await load()
})
</script>

<style scoped>
.team-page {
  min-height: 100vh;
  padding: 96px 40px 64px;
  /* 与 SiteNav 的 1680px 容器同宽：大屏下内容不再缩在中间一小条 */
  max-width: 1680px;
  margin: 0 auto;
  color: #0b2e36;
  font-family: Inter, 'Microsoft YaHei', sans-serif;
}
.page-head {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 22px;
}
.page-head h1 {
  margin: 6px 0;
  font-size: 30px;
  font-weight: 800;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  color: #7c99a1;
  font-weight: 700;
}
.sub {
  margin: 0;
  font-size: 13.5px;
  color: #4a6572;
  line-height: 1.7;
}
.sub b {
  color: #0b6e68;
}
.page-head .ghost {
  margin-left: auto;
}
.panel {
  background: #fff;
  border: 1px solid #dcede0;
  border-radius: 16px;
  padding: 22px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(11, 110, 104, 0.06);
}
.empty-panel h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 800;
}
.team-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}
.team-head h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 800;
}
.meta {
  font-size: 12.5px;
  color: #7c99a1;
}
.meta .dot {
  margin: 0 6px;
}
.meta .role {
  color: #0b6e68;
  font-weight: 700;
}
.invite-code {
  margin-left: auto;
  text-align: right;
}
.invite-code .lab {
  font-size: 12px;
  color: #7c99a1;
}
.code-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.code-line b {
  font-size: 16px;
  letter-spacing: 2px;
  color: #0b6e68;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  border: 1px solid #dcede0;
  border-radius: 14px;
  padding: 14px 16px;
}
.stat .k {
  font-size: 12.5px;
  color: #7c99a1;
}
.stat .v {
  font-size: 24px;
  font-weight: 800;
  margin-top: 4px;
}
.stat .v.pool {
  color: #12a594;
}
.stat .v.used {
  color: #1e9fc4;
}
.mine {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #effaf8;
  font-size: 13px;
  color: #4a6572;
}
.mine b {
  color: #0b6e68;
}
.mine b.pool {
  color: #12a594;
}
/* 额度卡片底部操作区（原型：追加额度申请入口左对齐、位于说明下方） */
.panel-foot {
  margin-top: 14px;
  display: flex;
  justify-content: flex-start;
}
/* 非团队管理员看到的说明：占位与原按钮同高，避免卡片底部跳动 */
.apply-hint {
  margin: 0;
  padding: 8px 0;
  font-size: 13px;
}

/* 追加额度弹窗（原型：居中卡片 + 半透明遮罩） */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(12, 43, 42, 0.45);
  backdrop-filter: blur(2px);
}

.modal {
  width: 100%;
  max-width: 460px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 26px 28px 22px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(12, 43, 42, 0.28);

  h2 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 800;
    text-align: center;
    color: #123b3a;
  }

  .modal-sub {
    margin: 0 0 18px;
    font-size: 12.5px;
    line-height: 1.6;
    text-align: center;
    color: #7c9490;
  }

  /* 按原型：字段名加粗、字号略大，必填星号紧跟其后 */
  .fl {
    display: block;
    margin: 18px 0 8px;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.4;
    color: #1d3532;
  }

  /* 按原型：输入框用浅薄荷底 + 浅绿描边，与白底弹窗区分 */
  .apply-input {
    display: block;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d5e9de;
    border-radius: 10px;
    background: #eaf6ef;
    font-size: 14px;
    color: #22322f;
  }

  .apply-input::placeholder {
    color: #a8bdb7;
  }

  .apply-input:focus {
    border-color: #12a594;
    background: #eaf6ef;
  }

  .area {
    resize: vertical;
    min-height: 96px;
    line-height: 1.6;
    font-family: inherit;
  }

  .ro-row {
    margin-top: 12px;

    .ro-lab {
      display: block;
      margin-bottom: 6px;
      font-size: 12.5px;
      font-weight: 600;
      color: #3d5a57;
    }

    .ro-val {
      padding: 10px 12px;
      border: 1px solid #dcede0;
      border-radius: 10px;
      background: #f6faf8;
      font-size: 13px;
      color: #4a6572;
    }
  }

  .modal-acts {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 22px;

    .acts-right {
      display: flex;
      gap: 10px;
    }
  }
}

/* 弹窗内的校验/提交错误 */
.modal-err {
  margin: 14px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fdeceb;
  font-size: 12.5px;
  line-height: 1.5;
  color: #d93a3f;
}

/* 必填标记：红色星号 + 弹窗内提示 */
.req {
  margin-left: 2px;
  color: #e5484d;
  font-style: normal;
}

.req-hint {
  margin: 0;
  font-size: 12px;
  color: #7c9490;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.panel-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th {
  text-align: left;
  font-size: 12px;
  color: #7c99a1;
  font-weight: 700;
  padding: 8px 10px;
  border-bottom: 1px solid #eaf5f5;
}
.table td {
  padding: 11px 10px;
  border-bottom: 1px solid #f3fafa;
  vertical-align: middle;
}
.table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.who {
  font-weight: 700;
}
/* 标出「这一行是我」，省得对着用户名猜哪个身份属于自己 */
.me-tag {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e6f4ff;
  color: #1e6fa8;
  font-size: 11px;
  font-weight: 700;
  vertical-align: 1px;
}
.small {
  font-size: 11.5px;
}
.muted {
  color: #7c99a1;
}
.remain {
  color: #12a594;
  font-weight: 700;
}
.chip {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  background: #effaf8;
  color: #0b6e68;
  font-size: 12px;
  font-weight: 700;
}
/* 申请记录表：额度列按内容定宽，多出来的横向空间留给「用途」，
   否则自动布局会把额度列撑到 200px，数字右对齐后与表头拉出很远一截。 */
.apps-table {
  table-layout: fixed;
}
.apps-table th:nth-child(1) {
  width: 120px;
}
.apps-table th:nth-child(3) {
  width: 130px;
}
.apps-table th:nth-child(4) {
  width: 110px;
}
.apps-table th:nth-child(5) {
  width: 170px;
}
/* 表头左对齐，金额也跟着左对齐，两者靠在一起才好读 */
.apps-table td.num {
  text-align: left;
}
.apps-table td {
  overflow-wrap: anywhere;
}
.chip.ok {
  background: #eaf7ee;
  color: #1f8a5f;
}
.chip.bad {
  background: #fdf1ee;
  color: #a8402b;
}
.adjust {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}
.mini {
  width: 90px;
  padding: 6px 8px;
  border: 1px solid #dcede0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12.5px;
  outline: none;
}
.mini-btn {
  padding: 6px 10px;
  font-size: 12px;
}
.empty {
  text-align: center;
  color: #a9bec2;
  padding: 24px 0;
}
.hint {
  font-size: 12.5px;
  color: #7c99a1;
  line-height: 1.7;
  margin: 0;
}
.join-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.input {
  flex: 1;
  min-width: 150px;
  padding: 10px 12px;
  border: 1px solid #dcede0;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: #12a594;
}
.form {
  display: grid;
  gap: 8px;
  max-width: 520px;
}
.form label {
  font-size: 12.5px;
  font-weight: 700;
  color: #4a6572;
  margin-top: 6px;
}
.solid {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(120deg, #12a594, #1e9fc4);
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  margin-top: 8px;
}
.solid:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ghost {
  padding: 8px 14px;
  border: 1px solid #dcede0;
  border-radius: 10px;
  background: #fff;
  color: #0b6e68;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 14px;
  background: #effaf8;
  border: 1px solid #b8e8e2;
  color: #0b6e68;
}
.notice.error {
  background: #fdf1ee;
  border-color: #f0c0b5;
  color: #a8402b;
}
@media (max-width: 900px) {
  .team-page {
    padding: 88px 18px 48px;
  }
  /* 窄屏放不下固定列宽：回到自动布局，让内容自己撑 */
  .apps-table {
    table-layout: auto;
  }
  .apps-table th:nth-child(n) {
    width: auto;
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .team-head {
    flex-direction: column;
  }
  .invite-code {
    margin-left: 0;
    text-align: left;
  }
}
</style>
