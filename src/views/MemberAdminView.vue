<template>
  <div class="admin-page">
    <!-- 与其他页面一致：顶部主菜单常驻，「会员管理」高亮 -->
    <SiteNav active="member-admin" />

    <header class="page-head">
      <div>
        <div class="eyebrow">MEMBER CONSOLE</div>
        <h1>会员管理后台</h1>
        <p class="sub">仅平台管理员可见。涉及资金的操作都会留操作人与原因。</p>
      </div>
      <button class="ghost" @click="router.push({ name: 'home' })">返回首页</button>
    </header>

    <div v-if="msg" :class="['notice', { error: isError }]">{{ msg }}</div>

    <nav v-if="tabs.length" class="tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        :class="['tab', { on: tab === item.key }]"
        @click="switchTab(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>
    <div v-else class="notice warn">
      当前账号没有任何会员后台查看权限（member:ledger:view / member:rule:view / member:invite:view /
      member:commission:view / member:recharge:view / member:team:view），请联系管理员授权。
    </div>

    <!-- 台账 -->
    <section v-if="tab === 'ledger'">
      <div class="stats">
        <div class="stat"><div class="k">累计发放</div><div class="v">{{ summary?.totalGranted ?? 0 }}</div></div>
        <div class="stat"><div class="k">累计消耗</div><div class="v used">{{ summary?.totalSpent ?? 0 }}</div></div>
        <div class="stat"><div class="k">沉淀未消耗</div><div class="v pool">{{ summary?.pending ?? 0 }}</div></div>
        <div class="stat"><div class="k">人工调账次数</div><div class="v">{{ summary?.manualOps ?? 0 }}</div></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>人工调账</h2>
          <span class="hint">原因必填；扣回不会把余额扣成负数（只扣到 0）</span>
        </div>
        <div class="grant">
          <input v-model="grantForm.userId" class="input" placeholder="目标用户 ID（JWT sub）" />
          <input v-model.number="grantForm.points" type="number" class="input" placeholder="数量，负数为扣回" />
          <input v-model="grantForm.reason" class="input" placeholder="原因（必填）" />
          <button v-if="canOrAdmin(PERM.MEMBER_LEDGER_GRANT)" class="solid" @click="doGrant">提交</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>最近流水</h2>
          <span class="hint">支持按用户 ID 前缀与流水类型过滤，可组合使用</span>
        </div>
        <!-- 查询条件：点「查询」才生效，输入即查会让手慢的用户看到中间态结果 -->
        <div class="ledger-filter">
          <input
            v-model="ledgerQuery.userId"
            class="input"
            placeholder="用户 ID 前缀（可留空）"
            @keyup.enter="searchLedger"
          />
          <select v-model="ledgerQuery.type" class="input">
            <option value="">全部类型</option>
            <option v-for="t in memberAdminApi.ledgerTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <button class="solid" @click="searchLedger">查询</button>
          <button class="ghost" @click="resetLedgerFilter">重置</button>
        </div>
        <table class="table">
          <thead>
            <tr><th>时间</th><th>姓名</th><th>用户 ID</th><th>类型</th><th class="num">变动</th><th class="num">变动后</th><th>操作人</th><th>备注</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in ledger" :key="row.id">
              <td class="muted">{{ short(row.createdAt) }}</td>
              <td class="who">{{ row.userName || '—' }}</td>
              <td class="mono small">{{ row.userId }}</td>
              <td><span class="chip">{{ row.type }}</span></td>
              <!-- 团队额度支付时个人余额不动，变动列显示团队额度实际扣除的积分 -->
              <td :class="['num', row.delta > 0 ? 'plus' : row.delta === 0 && !row.teamDelta ? 'muted' : 'minus']">
                <template v-if="row.delta === 0 && row.teamDelta">
                  {{ row.teamDelta }}
                  <i class="tag-team">团队额度</i>
                </template>
                <template v-else>{{ row.delta > 0 ? '+' : '' }}{{ row.delta }}</template>
              </td>
              <td class="num">{{ row.balanceAfter }}</td>
              <td class="muted">{{ row.operator || '系统' }}</td>
              <td class="muted">{{ ledgerRemarkText(row.remark) || '—' }}</td>
            </tr>
            <tr v-if="!ledger.length"><td colspan="8" class="empty">暂无符合条件的流水</td></tr>
          </tbody>
        </table>
        <SimplePager
          :page="ledgerPage"
          :page-count="ledgerPageCount"
          :total="ledgerTotal"
          @change="gotoLedgerPage"
        />
      </div>
    </section>

    <!-- 规则配置 -->
    <section v-else-if="tab === 'rules'">
      <div class="panel">
        <div class="panel-head">
          <h2>积分配置</h2>
          <span class="hint">
            改价只影响之后的行为，已解锁真题 / 已扣费新题不追溯；<b>1 元 = 10 积分不可改</b>
          </span>
        </div>
        <table class="table">
          <thead>
            <tr><th>配置项</th><th class="num">当前值</th><th class="num">范围</th><th>新值</th><th>原因</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.key">
              <td>
                <div class="who">{{ rule.label }}</div>
                <div class="mono small">{{ rule.key }}</div>
              </td>
              <td class="num">{{ rule.value }}</td>
              <td class="num muted">{{ rule.min }} ~ {{ rule.max }}</td>
              <td><input v-model.number="ruleDrafts[rule.key]" type="number" class="mini" /></td>
              <td><input v-model="ruleReasons[rule.key]" class="mini wide" placeholder="必填" /></td>
              <td>
            <button v-if="canOrAdmin(PERM.MEMBER_RULE_UPDATE)" class="ghost mini-btn" @click="saveRule(rule)">保存</button>
            <span v-else class="hint">只读</span>
          </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 邀请风控 -->
    <section v-else-if="tab === 'invite'">
      <div class="stats">
        <div class="stat"><div class="k">本月邀请</div><div class="v">{{ summary?.monthInvited ?? 0 }}</div></div>
        <div class="stat"><div class="k">已发放积分</div><div class="v pool">{{ summary?.inviteGranted ?? 0 }}</div></div>
        <div class="stat"><div class="k">已拦截</div><div class="v used">{{ summary?.blockedInvites ?? 0 }}</div></div>
        <div class="stat"><div class="k">转人工（超月上限）</div><div class="v">{{ summary?.pendingInvites ?? 0 }}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>邀请明细</h2></div>
        <table class="table">
          <thead><tr><th>时间</th><th>邀请人</th><th>被邀请人</th><th>邀请码</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in invites" :key="row.id">
              <td class="muted">{{ short(row.createdAt) }}</td>
              <td class="mono">{{ row.inviterId }}</td>
              <td class="mono">{{ row.inviteeId }}</td>
              <td class="mono">{{ row.code }}</td>
              <td><span :class="['chip', row.status === 'BLOCKED' ? 'bad' : row.status === 'PENDING' ? 'warn' : 'ok']">{{ inviteStatus(row.status) }}</span></td>
            </tr>
            <tr v-if="!invites.length"><td colspan="5" class="empty">暂无邀请记录</td></tr>
          </tbody>
        </table>
        <SimplePager
          :page="invitesPage"
          :page-count="invitesPageCount"
          :total="invitesTotal"
          @change="gotoInvitesPage"
        />
      </div>
    </section>

    <!-- 佣金 -->
    <section v-else-if="tab === 'commission'">
      <div class="panel">
        <div class="panel-head">
          <h2>佣金结算</h2>
          <span class="hint">共 {{ summary?.commissionCount ?? 0 }} 条；T+7 解冻后进入可提现</span>
        </div>
        <table class="table">
          <thead><tr><th>邀请人</th><th>被邀请人</th><th>类型</th><th class="num">金额</th><th>状态</th><th>解冻时间</th></tr></thead>
          <tbody>
            <tr v-for="row in commissions" :key="row.id">
              <td class="mono">{{ row.inviterId }}</td>
              <td class="mono">{{ row.inviteeId }}</td>
              <td>{{ row.type === 'FIRST' ? '首充' : '续充 6%' }}</td>
              <td class="num">¥{{ row.amount }}</td>
              <td><span class="chip">{{ row.status }}</span></td>
              <td class="muted">{{ short(row.unfreezeAt) }}</td>
            </tr>
            <tr v-if="!commissions.length"><td colspan="6" class="empty">暂无佣金记录</td></tr>
          </tbody>
        </table>
        <SimplePager
          :page="commissionsPage"
          :page-count="commissionsPageCount"
          :total="commissionsTotal"
          @change="gotoCommissionsPage"
        />
      </div>
    </section>

    <!-- 充值审批 -->
    <section v-else-if="tab === 'recharge'">
      <div class="panel">
        <div class="panel-head">
          <h2>充值审批</h2>
          <span class="hint">只有通过才会入账；驳回不产生任何流水</span>
          <select v-model="rechargeStatus" class="input status-filter" @change="loadRechargeOrders(0)">
            <option value="PENDING">待审批</option>
            <option value="PAID">已通过</option>
            <option value="REJECTED">已驳回</option>
            <option value="">全部</option>
          </select>
        </div>
        <table class="table rch-table">
          <thead>
            <tr><th>姓名</th><th>用户 ID</th><th class="num">金额（元）</th><th class="num">积分</th><th>方式</th><th>状态</th><th>提交时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="o in rechargeOrders" :key="o.id">
              <td class="who">{{ o.userName || '—' }}</td>
              <td class="mono small">{{ o.userId }}</td>
              <td class="num">¥{{ o.amountCny }}</td>
              <td class="num">{{ o.points }}</td>
              <td class="small" :title="o.transactionId || ''">{{ o.payChannel ? channelText(o.payChannel) : '人工审批' }}</td>
              <td>
                <span :class="['chip', o.status === 'PAID' ? 'ok' : o.status === 'REJECTED' ? 'bad' : 'warn']">
                  {{ orderStatus(o.status) }}
                </span>
              </td>
              <td class="muted">{{ short(o.createdAt) }}</td>
              <td>
                <template v-if="o.status === 'PENDING'">
                  <button v-if="canOrAdmin(PERM.MEMBER_RECHARGE_REVIEW)" class="ghost mini-btn" @click="reviewRecharge(o.id, true)">通过</button>
                  <button v-if="canOrAdmin(PERM.MEMBER_RECHARGE_REVIEW)" class="ghost mini-btn" @click="reviewRecharge(o.id, false)">驳回</button>
                </template>
                <span v-else class="muted">已处理</span>
              </td>
            </tr>
            <tr v-if="!rechargeOrders.length">
              <td colspan="8" class="empty">{{ rechargeStatus === 'PENDING' ? '没有待处理的充值申请' : '该状态下没有充值申请' }}</td>
            </tr>
          </tbody>
        </table>
        <SimplePager
          :page="rechargeOrdersPage"
          :page-count="rechargeOrdersPageCount"
          :total="rechargeOrdersTotal"
          @change="gotoRechargeOrdersPage"
        />
      </div>
    </section>

    <!-- 团队与审批 -->
    <section v-else>
      <div class="panel">
        <div class="panel-head">
          <h2>额度申请审批</h2>
          <span class="hint">仅平台管理员可批；通过后额度直接进团队池</span>
        </div>
        <table class="table apps-table">
          <thead>
            <tr><th>申请团队</th><th>申请额度</th><th>用途</th><th>联系人</th><th>期望到账</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in applicationRows" :key="row.app.id">
              <td>
                <template v-if="row.team">
                  <div class="team-cell">
                    <span class="who">{{ row.team.name }}</span>
                    <span class="mono small">邀请码 {{ row.team.inviteCode }}</span>
                  </div>
                </template>
                <span v-else class="muted">{{ row.app.teamId ? `未知团队 ${row.app.teamId.slice(0, 8)}` : '—' }}</span>
              </td>
              <td class="num">{{ row.app.quota }}</td>
              <td>{{ row.app.purpose }}</td>
              <td class="muted">{{ row.app.contact || '—' }}</td>
              <td class="muted">{{ row.app.expectDate || '—' }}</td>
              <td><span :class="['chip', row.app.status === 'APPROVED' ? 'ok' : row.app.status === 'REJECTED' ? 'bad' : 'warn']">{{ appStatus(row.app.status) }}</span></td>
              <td>
                <template v-if="row.app.status === 'PENDING'">
                  <button v-if="canOrAdmin(PERM.MEMBER_TEAM_REVIEW)" class="ghost mini-btn" @click="review(row.app.id, true)">通过</button>
                  <button v-if="canOrAdmin(PERM.MEMBER_TEAM_REVIEW)" class="ghost mini-btn" @click="review(row.app.id, false)">驳回</button>
                </template>
                <span v-else class="muted">已处理</span>
              </td>
            </tr>
            <tr v-if="!applicationRows.length"><td colspan="7" class="empty">暂无额度申请</td></tr>
          </tbody>
        </table>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>团队</h2>
          <span class="hint">创建团队时需指定团队管理员（该账号会成为 team_admin 并占一个成员名额）</span>
        </div>
        <div class="grant">
          <input v-model="teamForm.name" class="input" placeholder="团队名称" />
          <input v-model="teamForm.adminUser" class="input" placeholder="团队管理员用户名（如 zhangsan）" />
          <input v-model="teamForm.term" class="input" placeholder="期次，如 2026 秋季" />
          <input v-model.number="teamForm.quotaTotal" type="number" class="input" placeholder="初始额度" />
          <button v-if="canOrAdmin(PERM.MEMBER_TEAM_CREATE)" class="solid" @click="createTeam">创建团队</button>
        </div>
        <table class="table" style="margin-top: 14px">
          <thead><tr><th>团队</th><th>邀请码</th><th class="num">总额度</th><th class="num">池内</th><th class="num">已消费</th><th>管理员</th></tr></thead>
          <tbody>
            <tr v-for="t in teams" :key="String(t.id)">
              <td class="who">{{ t.name }}</td>
              <td class="mono">{{ t.inviteCode }}</td>
              <td class="num">{{ t.quotaTotal }}</td>
              <td class="num pool">{{ t.pool }}</td>
              <td class="num">{{ t.quotaUsed }}</td>
              <td class="small">{{ t.adminName || t.adminUserId }}</td>
            </tr>
            <tr v-if="!teams.length"><td colspan="6" class="empty">还没有团队</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import SiteNav from '@/components/site/SiteNav.vue'
import SimplePager from '@/components/common/SimplePager.vue'
import { PERM, type PermissionCode } from '@/config/permissions'
import { usePermission } from '@/hooks/usePermission'
import {
  memberAdminApi,
  type AdminSummary,
  type AdminTeamRow,
  type QuotaApplication,
  type RechargeOrder,
  type RuleItem,
} from '@/api/member'
import { loadOutsourcedCases } from '@/stores/outsourcedCases'
import { ledgerRemarkText } from '@/utils/caseTitle'

type TabKey = 'ledger' | 'rules' | 'invite' | 'commission' | 'recharge' | 'team'

const router = useRouter()
const { canOrAdmin } = usePermission()

/**
 * 页签 = 二级菜单，逐个挂权限码（与 `docs/tjdc-权限码清单.xlsx` 一致）。
 * 只渲染当前账号有 `*:view` 码的页签，一个都没有时页面给出「无权限」提示，
 * 不再靠角色名判断能不能进后台。
 */
const TAB_DEFS: { key: TabKey; label: string; permission: PermissionCode }[] = [
  { key: 'ledger', label: '积分台账', permission: PERM.MEMBER_LEDGER_VIEW },
  { key: 'rules', label: '积分配置', permission: PERM.MEMBER_RULE_VIEW },
  { key: 'invite', label: '邀请风控', permission: PERM.MEMBER_INVITE_VIEW },
  { key: 'commission', label: '佣金结算', permission: PERM.MEMBER_COMMISSION_VIEW },
  { key: 'recharge', label: '充值审批', permission: PERM.MEMBER_RECHARGE_VIEW },
  { key: 'team', label: '团队审批', permission: PERM.MEMBER_TEAM_VIEW },
]

const tabs = computed(() => TAB_DEFS.filter((item) => canOrAdmin(item.permission)))
/** 默认落在第一个有权限的页签；一个都没有时留空，靠模板的空态提示 */
const tab = ref<TabKey | ''>(TAB_DEFS.find((item) => canOrAdmin(item.permission))?.key ?? '')

interface AdminLedgerRow {
  id: string
  userId: string
  /** 用户姓名：团队成员名优先，其次账户显示名，都没有时为空 */
  userName?: string
  type: string
  delta: number
  /** 团队额度侧消耗（负数），delta=0 时表示这笔走的是团队额度 */
  teamDelta?: number
  balanceAfter: number
  remark: string | null
  operator: string | null
  createdAt: string
}

const summary = ref<AdminSummary | null>(null)
const ledger = ref<AdminLedgerRow[]>([])
/* 台账分页与查询：ledgerQuery 是输入框草稿，ledgerApplied 是点「查询」后生效的条件，
   两者分开，避免用户输入到一半结果就开始变 */
const ledgerPage = ref(0)
const ledgerTotal = ref(0)
const ledgerPageCount = computed(() => Math.max(1, Math.ceil(ledgerTotal.value / ADMIN_PAGE_SIZE)))
const ledgerQuery = reactive({ userId: '', type: '' })
const ledgerApplied = reactive({ userId: '', type: '' })
const rules = ref<RuleItem[]>([])
const invites = ref<Record<string, string>[]>([])
const commissions = ref<Record<string, string>[]>([])
const applications = ref<QuotaApplication[]>([])
const teams = ref<AdminTeamRow[]>([])
const rechargeOrders = ref<RechargeOrder[]>([])
/** 充值审批列表的筛选：默认只看待审批，处理完的留在「已通过 / 已驳回」里可查 */
const rechargeStatus = ref('PENDING')

/*
 * 列表分页：invites / commissions / recharge-orders 的后端接口本来就带 page/size，
 * 之前前端一次性拉 50 条，量大了既慢又看不过来。统一 20 条一页。
 */
const ADMIN_PAGE_SIZE = 10
const invitesPage = ref(0)
const invitesTotal = ref(0)
const invitesPageCount = computed(() => Math.max(1, Math.ceil(invitesTotal.value / ADMIN_PAGE_SIZE)))
const commissionsPage = ref(0)
const commissionsTotal = ref(0)
const commissionsPageCount = computed(() =>
  Math.max(1, Math.ceil(commissionsTotal.value / ADMIN_PAGE_SIZE)),
)
const rechargeOrdersPage = ref(0)
const rechargeOrdersTotal = ref(0)
const rechargeOrdersPageCount = computed(() =>
  Math.max(1, Math.ceil(rechargeOrdersTotal.value / ADMIN_PAGE_SIZE)),
)

/**
 * 额度申请审批表的行数据：申请单本身只存 teamId，
 * 团队名称/邀请码在同页签的团队列表里，这里预先拼好，模板里不用重复查表。
 */
const applicationRows = computed(() => {
  const byId = new Map(teams.value.map((team) => [team.id, team]))
  return applications.value.map((app) => ({
    app,
    team: app.teamId ? byId.get(app.teamId) ?? null : null,
  }))
})

const ruleDrafts = reactive<Record<string, number>>({})
const ruleReasons = reactive<Record<string, string>>({})

const grantForm = reactive({ userId: '', points: 0, reason: '' })
/** adminUser：可填用户名或用户 ID，后端按用户名解析成用户 ID */
const teamForm = reactive({ name: '', adminUser: '', term: '', quotaTotal: 20000 })

/* 人工调账的幂等单号：同一次提交（双击 / 重试）复用，成功后换新 */
let grantRequestId = crypto.randomUUID()

const msg = ref('')
const isError = ref(false)

function notify(text: string, error = false): void {
  msg.value = text
  isError.value = error
  window.setTimeout(() => {
    if (msg.value === text) msg.value = ''
  }, 4000)
}

function short(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function inviteStatus(status: string): string {
  if (status === 'ACTIVE') return '已发放'
  if (status === 'PENDING') return '待复核'
  if (status === 'BLOCKED') return '已拦截'
  return status
}

function appStatus(status: string): string {
  if (status === 'PENDING') return '待审批'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return status
}

async function loadSummary(): Promise<void> {
  // 台账汇总同样受 member:ledger:view 控制：没有该码的账号审批完顺带刷新汇总会拿到 403，
  // 把一个已经成功的审批渲染成报错，容易误导。
  if (!canOrAdmin(PERM.MEMBER_LEDGER_VIEW)) return
  summary.value = await memberAdminApi.summary()
}

async function loadLedger(page = ledgerPage.value): Promise<void> {
  const data = await memberAdminApi.ledger(page, ADMIN_PAGE_SIZE, ledgerApplied.userId, ledgerApplied.type)
  ledger.value = data.items
  ledgerPage.value = page
  ledgerTotal.value = data.total
}

function gotoLedgerPage(next: number): void {
  if (next < 0 || next >= ledgerPageCount.value) return
  void loadLedger(next)
}

/** 应用查询条件并回第 1 页 */
function searchLedger(): void {
  ledgerApplied.userId = ledgerQuery.userId.trim()
  ledgerApplied.type = ledgerQuery.type
  void loadLedger(0)
}

/** 清空条件：草稿与生效值一起清，避免出现「输入框已空但结果还是过滤后的」 */
function resetLedgerFilter(): void {
  ledgerQuery.userId = ''
  ledgerQuery.type = ''
  ledgerApplied.userId = ''
  ledgerApplied.type = ''
  void loadLedger(0)
}

async function loadRules(): Promise<void> {
  rules.value = await memberAdminApi.rules()
  for (const rule of rules.value) ruleDrafts[rule.key] = rule.value
}

async function loadInvites(page = invitesPage.value): Promise<void> {
  const result = await memberAdminApi.invites(page, ADMIN_PAGE_SIZE)
  invites.value = result.items
  invitesPage.value = page
  invitesTotal.value = result.total
}

function gotoInvitesPage(next: number): void {
  if (next < 0 || next >= invitesPageCount.value) return
  void loadInvites(next)
}

async function loadCommissions(page = commissionsPage.value): Promise<void> {
  const result = await memberAdminApi.commissions(page, ADMIN_PAGE_SIZE)
  commissions.value = result.items
  commissionsPage.value = page
  commissionsTotal.value = result.total
}

function gotoCommissionsPage(next: number): void {
  if (next < 0 || next >= commissionsPageCount.value) return
  void loadCommissions(next)
}

async function loadTeamTab(): Promise<void> {
  applications.value = await memberAdminApi.applications()
  teams.value = await memberAdminApi.teams()
}

/** 支付渠道文案：后台要能一眼看出这笔钱走的哪条路，未识别的原样显示 */
function channelText(code: string): string {
  if (code === 'alipay') return '支付宝'
  if (code === 'wechat') return '微信支付'
  if (code === 'mock') return '模拟支付'
  return code
}

async function loadRechargeOrders(page = rechargeOrdersPage.value): Promise<void> {
  try {
    const result = await memberAdminApi.rechargeOrders(rechargeStatus.value, page, ADMIN_PAGE_SIZE)
    rechargeOrders.value = result.items
    rechargeOrdersPage.value = page
    rechargeOrdersTotal.value = result.total
  } catch (e) {
    notify(e instanceof Error ? e.message : '加载充值申请失败', true)
  }
}

function gotoRechargeOrdersPage(next: number): void {
  if (next < 0 || next >= rechargeOrdersPageCount.value) return
  void loadRechargeOrders(next)
}

/** 审批充值：通过即入账（后端同一套入账逻辑），驳回不动余额 */
async function reviewRecharge(id: string, approve: boolean): Promise<void> {
  if (!canOrAdmin(PERM.MEMBER_RECHARGE_REVIEW)) {
    notify('当前账号没有 member:recharge:review 权限，无法审批充值', true)
    return
  }
  try {
    await memberAdminApi.reviewRecharge(id, approve)
    /* 审批掉的行会从当前筛选里消失，回第 1 页避免停留在空页 */
    await Promise.all([loadRechargeOrders(0), loadSummary()])
    notify(approve ? '已通过，积分已入账' : '已驳回')
  } catch (e) {
    notify(e instanceof Error ? e.message : '审批失败', true)
  }
}

function orderStatus(status: string): string {
  if (status === 'PENDING') return '待审批'
  if (status === 'PAID') return '已到账'
  if (status === 'REJECTED') return '已驳回'
  if (status === 'REFUNDED') return '已退款'
  return status
}

async function switchTab(next: TabKey): Promise<void> {
  // 页签是权限码驱动的，无权限的页签既渲染不出来也切不进去
  if (!tabs.value.some((item) => item.key === next)) return
  tab.value = next
  try {
    /* 进入列表 tab 一律回第 1 页：审批动作随时可能发生，停留旧页会看不到最新数据 */
    if (next === 'ledger') await loadLedger()
    if (next === 'rules') await loadRules()
    if (next === 'invite') await loadInvites(0)
    if (next === 'commission') await loadCommissions(0)
    if (next === 'recharge') await loadRechargeOrders(0)
    if (next === 'team') await loadTeamTab()
  } catch (e) {
    notify(e instanceof Error ? e.message : '加载失败', true)
  }
}

async function doGrant(): Promise<void> {
  if (!canOrAdmin(PERM.MEMBER_LEDGER_GRANT)) {
    notify('当前账号没有 member:ledger:grant 权限，无法人工调账', true)
    return
  }
  if (!grantForm.userId.trim() || !grantForm.reason.trim()) {
    notify('目标用户与原因都必须填写', true)
    return
  }
  try {
    const result = await memberAdminApi.grant({
      userId: grantForm.userId.trim(),
      points: grantForm.points,
      reason: grantForm.reason.trim(),
      requestId: grantRequestId,
    })
    notify(`已调整，目标余额 ${result.balance}`)
    grantForm.points = 0
    grantForm.reason = ''
    /* 提交成功后换新幂等单号：下一次调账是独立的一笔 */
    grantRequestId = crypto.randomUUID()
    await Promise.all([loadSummary(), loadLedger()])
  } catch (e) {
    notify(e instanceof Error ? e.message : '调账失败', true)
  }
}

async function saveRule(rule: RuleItem): Promise<void> {
  if (!canOrAdmin(PERM.MEMBER_RULE_UPDATE)) {
    notify('当前账号没有 member:rule:update 权限，无法修改积分配置', true)
    return
  }
  const reason = (ruleReasons[rule.key] ?? '').trim()
  if (!reason) {
    notify('修改配置必须填写原因', true)
    return
  }
  try {
    await memberAdminApi.updateRule(rule.key, ruleDrafts[rule.key], reason)
    ruleReasons[rule.key] = ''
    await loadRules()
    notify('已保存，对之后的行为生效')
  } catch (e) {
    notify(e instanceof Error ? e.message : '保存失败', true)
  }
}

async function review(id: string, approve: boolean): Promise<void> {
  if (!canOrAdmin(PERM.MEMBER_TEAM_REVIEW)) {
    notify('当前账号没有 member:team:review 权限，无法审批额度申请', true)
    return
  }
  try {
    await memberAdminApi.review(id, approve)
    await loadTeamTab()
    await loadSummary()
    notify(approve ? '已通过，额度已进团队池' : '已驳回')
  } catch (e) {
    notify(e instanceof Error ? e.message : '审批失败', true)
  }
}

async function createTeam(): Promise<void> {
  if (!canOrAdmin(PERM.MEMBER_TEAM_CREATE)) {
    notify('当前账号没有 member:team:create 权限，无法创建团队', true)
    return
  }
  if (!teamForm.name.trim() || !teamForm.adminUser.trim()) {
    notify('团队名称与团队管理员必填', true)
    return
  }
  try {
    const result = await memberAdminApi.createTeam({
      name: teamForm.name.trim(),
      adminUser: teamForm.adminUser.trim(),
      term: teamForm.term,
      quotaTotal: teamForm.quotaTotal,
    })
    notify(`团队已创建，邀请码 ${result.inviteCode}`)
    teamForm.name = ''
    teamForm.adminUser = ''
    await loadTeamTab()
  } catch (e) {
    notify(e instanceof Error ? e.message : '创建失败', true)
  }
}

onMounted(async () => {
  try {
    /* 台账备注里的案例编号要换成真题名称（案例库是名称来源，已加载则走缓存） */
    void loadOutsourcedCases()
    // 只拉有权限的页签数据：没有 member:ledger:view 还去请求台账，后端会 403，
    // 页面一进来就报错，反而盖住了「没有权限」这个真实原因。
    const jobs: Promise<void>[] = []
    if (canOrAdmin(PERM.MEMBER_LEDGER_VIEW)) {
      jobs.push(loadSummary(), loadLedger())
    }
    if (canOrAdmin(PERM.MEMBER_RULE_VIEW)) jobs.push(loadRules())
    await Promise.all(jobs)
  } catch (e) {
    notify(e instanceof Error ? e.message : '加载失败', true)
  }
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: 96px 40px 64px;
  /* 与 SiteNav 的 1680px 容器同宽，表格不再挤在中间 */
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
}
.page-head .ghost {
  margin-left: auto;
}
.tabs {
  display: flex;
  gap: 6px;
  margin: 18px 0;
  border-bottom: 1px solid #dcede0;
}
.tab {
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 700;
  color: #4a6572;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-family: inherit;
}
.tab.on {
  color: #0b6e68;
  border-bottom-color: #12a594;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  background: #fff;
  border: 1px solid #dcede0;
  border-radius: 14px;
  padding: 16px;
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
.panel {
  background: #fff;
  border: 1px solid #dcede0;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(11, 110, 104, 0.06);
}
.panel-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.panel-head h2 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 800;
}
.hint {
  font-size: 12.5px;
  color: #7c99a1;
  line-height: 1.7;
}
.grant {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
  padding: 10px;
  border-bottom: 1px solid #f3fafa;
}
.table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* 申请审批表：除「用途」外都按内容定宽，富余宽度全留给用途；
   自动布局会把额度列撑到近 200px，数字右对齐后与表头离得很远 */
.apps-table {
  table-layout: fixed;
}
.apps-table th:nth-child(1) {
  width: 200px;
}
.apps-table th:nth-child(2) {
  width: 110px;
}
.apps-table th:nth-child(4) {
  width: 90px;
}
.apps-table th:nth-child(5) {
  width: 110px;
}
.apps-table th:nth-child(6) {
  width: 90px;
}
.apps-table th:nth-child(7) {
  width: 150px;
}
.apps-table td.num {
  text-align: left;
}
.apps-table td {
  overflow-wrap: anywhere;
}
/* 充值审批：右侧状态筛选 + 按内容定宽，金额不再被撑出一大截空档 */
.status-filter {
  margin-left: auto;
  flex: 0 0 auto;
  max-width: 140px;
}
/* 台账查询条：与面板留白对齐，输入框加宽以便粘贴完整用户 ID */
.ledger-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.ledger-filter .input:first-child {
  flex: 1 1 280px;
}
.ledger-filter select {
  flex: 0 0 150px;
}
.rch-table {
  table-layout: fixed;
}
/* 列布局：姓名（定宽）+ 用户 ID（弹性，放得下完整 UUID）+ 两个窄数值列 + 状态 / 时间 / 操作 */
.rch-table th:nth-child(1) {
  width: 150px;
}
.rch-table th:nth-child(3) {
  width: 80px;
}
.rch-table th:nth-child(4) {
  width: 62px;
}
/* 两个数值列居中：表头与数值都不贴边，窄列看起来才不空 */
.rch-table th:nth-child(3),
.rch-table th:nth-child(4),
.rch-table td.num {
  text-align: center;
}
.rch-table th:nth-child(5) {
  width: 82px;
}
.rch-table th:nth-child(6) {
  width: 140px;
}
/* 操作列要能并排放下「通过 / 驳回」两个按钮，窄了就会折成两行 */
.rch-table th:nth-child(7) {
  width: 148px;
}
.rch-table td:nth-child(7) {
  white-space: nowrap;
}
.rch-table td {
  overflow-wrap: anywhere;
}
.muted {
  color: #7c99a1;
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
}
.small {
  font-size: 11.5px;
}
/* 团队额度消耗标记：说明这笔扣的是团队额度、不是个人积分 */
.tag-team {
  margin-left: 5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #effaf8;
  color: #0b6e68;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
  vertical-align: 1px;
}
.who {
  font-weight: 700;
}
/* 申请审批表的团队列：团队名 + 邀请码上下两行，窄列里也读得清 */
.team-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}
.plus {
  color: #1f8a5f;
  font-weight: 700;
}
.minus {
  color: #d95c45;
  font-weight: 700;
}
.pool {
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
.chip.ok {
  background: #eaf7ee;
  color: #1f8a5f;
}
.chip.bad {
  background: #fdf1ee;
  color: #a8402b;
}
.chip.warn {
  background: #fff8e6;
  color: #8a6116;
}
.empty {
  text-align: center;
  color: #a9bec2;
  padding: 24px 0;
}
.input {
  flex: 1;
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid #dcede0;
  border-radius: 10px;
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.input:focus {
  border-color: #12a594;
}
.mini {
  width: 92px;
  padding: 6px 8px;
  border: 1px solid #dcede0;
  border-radius: 8px;
  font-size: 12.5px;
  font-family: inherit;
  outline: none;
}
.mini.wide {
  width: 180px;
}
.mini-btn {
  padding: 6px 10px;
  font-size: 12px;
  margin-right: 6px;
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
  .admin-page {
    padding: 88px 18px 48px;
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* 窄屏放不下固定列宽：回到自动布局 */
  .apps-table,
  .rch-table {
    table-layout: auto;
  }
  .apps-table th:nth-child(n),
  .rch-table th:nth-child(n) {
    width: auto;
  }
}
</style>
