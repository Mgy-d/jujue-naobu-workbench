<template>
  <div class="member-page">
    <!-- 与其他页面一致：顶部主菜单常驻，管理员在这里也能进「会员管理」 -->
    <SiteNav active="member-center" />

    <header class="page-head">
      <div>
        <div class="eyebrow">MEMBER CENTER</div>
        <h1>积分中心</h1>
        <p class="sub">
          站内只有一套价：<b>1 元 = {{ pointsPerCny }} 积分</b>。真题
          {{ rules.price_paper ?? store.pricePaper }} 积分买断，新题
          {{ rules.price_new ?? store.priceNew }} 积分一次。
        </p>
      </div>
      <button class="ghost" @click="goHome">返回首页</button>
    </header>

    <div v-if="error" class="notice error">{{ error }}</div>

    <!-- 余额 -->
    <section class="wallet">
      <div class="wallet-main">
        <div class="lab">可用积分</div>
        <div class="num">{{ store.balance }}<small>积分</small></div>
        <div class="tip">累计获得 {{ store.overview?.earned ?? 0 }} · 累计消耗 {{ store.overview?.spent ?? 0 }}</div>
      </div>
      <div class="wallet-acts">
        <button class="solid" @click="tab = 'recharge'">去充值</button>
        <button class="ghost-light" @click="tab = 'invite'">邀请同学</button>
      </div>
    </section>

    <!-- tabs -->
    <nav class="tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        :class="['tab', { on: tab === item.key }]"
        @click="switchTab(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <!-- 积分明细 -->
    <section v-if="tab === 'ledger'" class="panel">
      <div class="panel-head">
        <h2>积分明细</h2>
        <span class="hint">
          每一笔都记来路，可逐笔核对；走团队额度的消费不扣个人积分，变动列显示团队额度实际扣除的积分
        </span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>类型</th>
            <th class="num">变动</th>
            <th class="num">变动后</th>
            <th>来路</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ledger" :key="row.id">
            <td class="muted">{{ formatTime(row.createdAt) }}</td>
            <td><span class="chip">{{ row.type }}</span></td>
            <!-- 团队额度支付时个人余额不动（delta=0），实际扣的是团队额度，这里显示 teamDelta -->
            <td
              :class="[
                'num',
                row.delta > 0 ? 'plus' : row.delta === 0 && !row.teamDelta ? 'zero' : 'minus',
              ]"
            >
              <template v-if="row.delta === 0 && row.teamDelta">
                {{ row.teamDelta }}
                <i class="tag-team">团队额度</i>
              </template>
              <template v-else>{{ row.delta > 0 ? '+' : '' }}{{ row.delta }}</template>
            </td>
            <td class="num">{{ row.balanceAfter }}</td>
            <td class="muted">{{ ledgerRemarkText(row.remark) || '—' }}</td>
          </tr>
          <tr v-if="!ledger.length">
            <td colspan="5" class="empty">还没有积分流水，登录即送 100 积分</td>
          </tr>
        </tbody>
      </table>
      <SimplePager
        :page="ledgerPage"
        :page-count="ledgerPageCount"
        :total="ledgerTotal"
        @change="gotoLedgerPage"
      />
    </section>

    <!-- 充值 -->
    <section v-else-if="tab === 'recharge'" class="panel">
      <div class="panel-head">
        <h2>充值积分</h2>
        <span class="hint">金额自填，不做档位、不做首充特惠；促销只能加在赠送侧，不动换算率</span>
      </div>
      <p v-if="rechargeMsg" class="notice ok">{{ rechargeMsg }}</p>

      <!-- 支付中：展示收银台链接/二维码，并轮询到账结果 -->
      <div v-if="paying && payParams" class="rcard pay-wait">
        <div class="rate">待支付 ¥{{ payParams.amountCny }}</div>
        <div class="req">到账 {{ payParams.points }} 积分 · {{ channelLabel(payParams.channel) }}</div>
        <p class="dev-note">{{ payParams.hint }}</p>
        <a
          v-if="payParams.payUrl"
          class="solid wide pay-open"
          :href="payParams.payUrl"
          target="_blank"
          rel="noopener"
        >
          打开收银台继续支付
        </a>
        <div v-if="payParams.qrCode" class="pay-code">
          <code>{{ payParams.qrCode }}</code>
          <button class="ghost" @click="copyPayCode">复制支付链接</button>
        </div>
        <p class="muted small">
          支付完成后本页会自动刷新到账结果（{{ polling ? '正在等待渠道确认…' : '已停止轮询' }}）；也可以稍后回来看「我的充值订单」。
        </p>
        <button class="ghost" @click="cancelPay">取消支付</button>
      </div>

      <div v-else class="recharge">
        <div class="rcard">
          <div class="rate">1 元 = {{ pointsPerCny }} 积分</div>
          <div class="rmoney">¥{{ amount }}</div>
          <div class="req">到账 {{ amount * pointsPerCny }} 积分</div>
          <label class="fl">充值金额（元）</label>
          <input v-model.number="amount" type="number" :min="rechargeMin" step="1" class="input" />
          <div class="quick">
            <button v-for="v in quickAmounts" :key="v" class="ghost" @click="amount = v">
              ¥{{ v }}
            </button>
          </div>
          <!-- 渠道由后端按配置下发：未开通时 payChannels 为空，自动退回人工审批流程 -->
          <template v-if="payChannels.length">
            <label class="fl">支付方式</label>
            <div class="quick">
              <button
                v-for="c in payChannels"
                :key="c.code"
                :class="['ghost', { on: payChannel === c.code }]"
                @click="payChannel = c.code"
              >
                {{ c.label }}
              </button>
            </div>
          </template>
          <button class="solid wide" :disabled="!canRecharge || submitting" @click="doRecharge">
            {{ submitLabel }}
          </button>
          <p v-if="payChannels.length" class="dev-note">
            支付成功后积分立即到账；未支付或支付失败不产生任何流水。
          </p>
          <!-- 未开通在线支付：充值必须由平台管理员审批，不能点一下就到自己账上 -->
          <p v-else class="dev-note">
            提交后进入「待审批」，平台管理员通过后积分才到账；驳回不产生任何流水。
          </p>
        </div>
        <div class="rcard side">
          <h3>充值说明</h3>
          <dl>
            <dt>金额</dt><dd>任意整数元，最低 {{ rechargeMin }} 元</dd>
            <dt>{{ payChannels.length ? '到账' : '审批' }}</dt>
            <dd>{{ payChannels.length ? '支付成功后积分立即到账' : '提交后由平台管理员审批，通过即到账' }}</dd>
            <dt>换算</dt><dd>1 元 = {{ pointsPerCny }} 积分</dd>
            <dt>用途</dt><dd>真题 {{ rules.price_paper ?? store.pricePaper }} 积分/道；新题演易 {{ rules.price_new ?? store.priceNew }} 积分/道</dd>
            <dt>有效期</dt><dd>积分永不过期</dd>
            <dt>不可提现</dt><dd>只兑换站内服务，不可转让</dd>
            <dt>退款</dt><dd>订单退款同步追回该笔积分与激励</dd>
            <dt>失败</dt>
            <dd>{{ payChannels.length ? '未支付或支付失败不产生任何流水' : '未通过审批不产生任何流水' }}</dd>
          </dl>
        </div>
      </div>

      <table class="table" style="margin-top: 16px">
        <thead>
          <tr>
            <th>我的充值订单</th><th class="num">金额（元）</th><th class="num">积分</th>
            <th>方式</th><th>状态</th><th>提交时间</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td class="mono small">{{ o.id.slice(0, 8) }}</td>
            <td class="num">¥{{ o.amountCny }}</td>
            <td class="num">{{ o.points }}</td>
            <td>{{ o.payChannel ? channelLabel(o.payChannel) : '人工审批' }}</td>
            <td>
              <span :class="['chip', o.status === 'PAID' ? 'ok' : o.status === 'REJECTED' ? 'bad' : '']">
                {{ orderStatusText(o) }}
              </span>
            </td>
            <td class="muted">{{ o.createdAt?.slice(0, 16).replace('T', ' ') }}</td>
            <td>
              <button
                v-if="o.status === 'PENDING' && o.payChannel && payChannels.length"
                class="ghost small"
                @click="resumePay(o)"
              >
                继续支付
              </button>
            </td>
          </tr>
          <tr v-if="!orders.length"><td colspan="7" class="empty">还没有充值订单</td></tr>
        </tbody>
      </table>
      <!-- 分页：充值是持续行为，订单会越积越多，不能一次性铺满整页 -->
      <SimplePager
        :page="ordersPage"
        :page-count="ordersPageCount"
        :total="ordersTotal"
        @change="gotoOrdersPage"
      />
    </section>

    <!-- 邀请 -->
    <section v-else-if="tab === 'invite'" class="panel">
      <div class="panel-head">
        <h2>邀请同学</h2>
        <span class="hint">严格一级，无入门费；被邀请人完成注册，双方各得 {{ invite?.bonusPerPerson ?? 100 }} 积分</span>
      </div>
      <div class="invite" v-if="invite">
        <div class="code-box">
          <div class="lab">我的专属邀请码</div>
          <div class="code">{{ invite.code }}</div>
          <button class="solid" @click="copyInvite">复制邀请内容</button>
        </div>
        <div class="prog">
          <div class="prog-top">
            <span>已邀请 {{ invite.invited }} 人</span>
            <span>本月剩余自动发放 {{ invite.monthRemaining }} / {{ invite.monthCap }} 人</span>
          </div>
          <div class="bar"><i :style="{ width: pct + '%' }" /></div>
        </div>
        <div class="share">{{ invite.shareText }}</div>
      </div>

      <div class="bind">
        <h3>填写邀请码</h3>
        <p class="hint">如果你是被邀请来的，在这里绑定邀请关系，双方各得积分。一个账号只能绑定一次。</p>
        <div class="bind-row">
          <input v-model="bindCode" class="input" placeholder="TJDC-XXXXXX" />
          <button class="solid" :disabled="!bindCode" @click="doBind">绑定</button>
        </div>
        <p v-if="bindMsg" class="bind-msg">{{ bindMsg }}</p>
      </div>
    </section>

    <!-- 佣金 -->
    <section v-else-if="tab === 'commission'" class="panel">
      <div class="panel-head">
        <h2>佣金与提现</h2>
        <span class="hint">被邀请人首充得 ¥{{ 20 }} 佣金，续充按 6%；T+7 解冻后可提</span>
      </div>
      <div class="stats" v-if="commission">
        <div class="stat"><div class="k">可提现</div><div class="v able">¥{{ commission.able.toFixed(2) }}</div><div class="s">门槛 ¥{{ commission.withdrawMin }}</div></div>
        <div class="stat"><div class="k">待解冻</div><div class="v">¥{{ commission.frozen.toFixed(2) }}</div><div class="s">T+7 后可提</div></div>
        <div class="stat"><div class="k">已提现</div><div class="v">¥{{ commission.paid.toFixed(2) }}</div><div class="s">本月已提 {{ commission.withdrawTimesThisMonth }} / {{ commission.withdrawMonthLimit }} 次</div></div>
      </div>
      <button class="solid" @click="doWithdraw">申请提现</button>
      <table class="table">
        <thead>
          <tr><th>类型</th><th class="num">金额</th><th>状态</th><th>解冻时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in commissionPageRows" :key="row.id">
            <td>{{ row.type === 'FIRST' ? '首充佣金' : '续充佣金' }}</td>
            <td class="num">¥{{ row.amount.toFixed(2) }}</td>
            <td><span class="chip">{{ statusText(row.status) }}</span></td>
            <td class="muted">{{ row.unfreezeAt ? formatTime(row.unfreezeAt) : '—' }}</td>
          </tr>
          <tr v-if="!commissionRecords.length">
            <td colspan="4" class="empty">还没有佣金记录，邀请同学并等他完成首充</td>
          </tr>
        </tbody>
      </table>
      <!-- 佣金接口是全量返回，本地切片分页即可；等后端加 page/size 再换服务端分页 -->
      <SimplePager
        :page="commissionPage"
        :page-count="commissionPageCount"
        :total="commissionRecords.length"
        @change="gotoCommissionPage"
      />
    </section>

    <!-- 规则 -->
    <section v-else class="panel">
      <div class="panel-head">
        <h2>规则公示</h2>
        <span class="hint">数值随平台配置实时变化，不是写死的文案</span>
      </div>
      <div class="rules">
        <h3>积分</h3>
        <p>积分是站内唯一货币，只兑换站内服务。<b>1 元 = {{ pointsPerCny }} 积分</b>，全站唯一换算率。</p>
        <h3>获得</h3>
        <ul>
          <li>注册成功：+{{ rules.register_bonus ?? 100 }} 积分（一次性）</li>
          <li>邀请同学注册：双方各 +{{ rules.invite_bonus_inviter ?? 100 }} 积分</li>
          <li>充值：1 元 = {{ pointsPerCny }} 积分</li>
          <li>被邀请人首充：邀请人额外 +{{ rules.first_charge_bonus ?? 200 }} 积分与 ¥{{ rules.first_charge_commission ?? 20 }} 佣金</li>
        </ul>
        <h3>消耗</h3>
        <ul>
          <li>历年真题：{{ rules.price_paper ?? 50 }} 积分/道，<b>解锁后无限次重做</b></li>
          <li>新题演易：{{ rules.price_new ?? 800 }} 积分/道，扣点在「读懂」走完、开始「拆解」的那一刻</li>
          <li>「读懂」免费：题意拆解、数据与约束、演示一都不扣积分，且不产出可导出成果</li>
        </ul>
        <h3>限制</h3>
        <p>积分永不过期；不可提现、不可转让、不可交易；任何情况下余额不会被扣成负数。</p>
        <p class="warn">积分与现金是两套东西：积分只换站内服务，现金佣金走提现通道。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import SiteNav from '@/components/site/SiteNav.vue'
import SimplePager from '@/components/common/SimplePager.vue'
import {
  memberApi,
  type CommissionInfo,
  type InviteInfo,
  type LedgerItem,
  type PayChannelOption,
  type PayParams,
  type RechargeOrder,
} from '@/api/member'
import { useMemberStore } from '@/stores/member'
import { loadOutsourcedCases } from '@/stores/outsourcedCases'
import { ledgerRemarkText } from '@/utils/caseTitle'

type TabKey = 'ledger' | 'recharge' | 'invite' | 'commission' | 'rules'

const router = useRouter()
const store = useMemberStore()

const tab = ref<TabKey>('ledger')
const tabs: { key: TabKey; label: string }[] = [
  { key: 'ledger', label: '积分明细' },
  { key: 'recharge', label: '充值' },
  { key: 'invite', label: '邀请' },
  { key: 'commission', label: '佣金提现' },
  { key: 'rules', label: '规则' },
]

const error = computed(() => store.error)

const ledger = ref<LedgerItem[]>([])
const ledgerTotal = ref(0)
const ledgerPage = ref(0)
const LEDGER_PAGE_SIZE = 10
const ledgerPageCount = computed(() =>
  Math.max(1, Math.ceil(ledgerTotal.value / LEDGER_PAGE_SIZE)),
)

const amount = ref(100)
const canRecharge = computed(() => Number.isInteger(amount.value) && amount.value >= rechargeMin.value)
const submitting = ref(false)
/** 提交后的提示：区分「已到账」「等待支付」「等待审批」三种口径 */
const rechargeMsg = ref('')
const orders = ref<RechargeOrder[]>([])
/** 订单分页：后端已支持 page/size，前端按页拉取，避免订单多了铺满整页 */
const ordersPage = ref(0)
const ordersTotal = ref(0)
const ORDERS_PAGE_SIZE = 10
const ordersPageCount = computed(() => Math.max(1, Math.ceil(ordersTotal.value / ORDERS_PAGE_SIZE)))

/* ---------------- 在线支付 ---------------- */

/** 后端按配置下发的可用渠道；为空说明在线支付未启用，走人工审批 */
const payChannels = ref<PayChannelOption[]>([])
const payChannel = ref('')
/** 支付中面板：拿到支付参数后展示收银台/二维码，并开始轮询 */
const paying = ref(false)
const payParams = ref<PayParams | null>(null)
const polling = ref(false)
/** 轮询定时器与已轮询次数（约 5 分钟后放弃，避免用户离开页面还在后台打接口） */
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollTicks = 0
const POLL_INTERVAL_MS = 3000
const POLL_MAX_TICKS = 100

const submitLabel = computed(() => {
  if (submitting.value) return '处理中…'
  if (amount.value <= 0) return '请先填写充值金额'
  const points = amount.value * pointsPerCny.value
  return payChannels.value.length
    ? `去支付 ¥${amount.value}（${points} 积分）`
    : `提交充值申请 ¥${amount.value}（${points} 积分）`
})

/** 渠道名称：后端下发的标签优先，列表未加载时退回渠道码 */
function channelLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return payChannels.value.find((c) => c.code === code)?.label ?? code
}

/**
 * 订单状态文案。
 * PENDING 有两种含义：渠道支付单是「待支付」，人工审批单是「待审批」，
 * 靠 payChannel 是否有值区分——不区分会让用户以为付过钱还在等审核。
 */
function orderStatusText(order: RechargeOrder): string {
  if (order.status === 'PENDING') return order.payChannel ? '待支付' : '待审批'
  if (order.status === 'PAID') return '已到账'
  if (order.status === 'REJECTED') return '已驳回'
  if (order.status === 'REFUNDED') return '已退款'
  return order.status
}

const invite = ref<InviteInfo | null>(null)
const bindCode = ref('')
const bindMsg = ref('')

const commission = ref<CommissionInfo | null>(null)
/* 佣金记录本地分页：接口全量返回、单用户条数有限，不值得为它加后端分页参数 */
const COMMISSION_PAGE_SIZE = 10
const commissionPage = ref(0)
const commissionRecords = computed(() => commission.value?.records ?? [])
const commissionPageCount = computed(() =>
  Math.max(1, Math.ceil(commissionRecords.value.length / COMMISSION_PAGE_SIZE)),
)
const commissionPageRows = computed(() =>
  commissionRecords.value.slice(
    commissionPage.value * COMMISSION_PAGE_SIZE,
    (commissionPage.value + 1) * COMMISSION_PAGE_SIZE,
  ),
)

function gotoCommissionPage(next: number): void {
  if (next < 0 || next >= commissionPageCount.value) return
  commissionPage.value = next
}
const rules = ref<Record<string, number>>({})

/*
 * 金额相关全部来自后端规则快照（GET /member/rules），前端不再写死 10 / 1 这类数字：
 * - points_per_cny：只读换算率（后端刻意不放可配表，历史流水以它为锚点）；
 * - recharge_min：可配的单次充值门槛，后台「积分配置」改了这里立刻跟着变。
 * 这里的缺省值只是接口还没回来时的占位，与后端默认值保持一致。
 */
const pointsPerCny = computed(() => rules.value.points_per_cny ?? 10)
const rechargeMin = computed(() => Math.max(1, rules.value.recharge_min ?? 1))
/** 快捷充值档位：低于门槛的档位直接不显示，免得点一个必然被拒的按钮 */
const quickAmounts = computed(() => {
  const list = [10, 50, 100, 300, 800].filter((v) => v >= rechargeMin.value)
  return list.length ? list : [rechargeMin.value]
})

const pct = computed(() => {
  if (!invite.value || !invite.value.monthCap) return 0
  return Math.min(100, Math.round((invite.value.monthInvited / invite.value.monthCap) * 100))
})

function formatTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusText(status: string): string {
  if (status === 'FROZEN') return '待解冻'
  if (status === 'AVAILABLE') return '可提现'
  if (status === 'WITHDRAWN') return '已提现'
  if (status === 'PENDING') return '处理中'
  return status
}

/** 积分明细改为整页翻页：流水会持续累积，「加载更多」翻几页后顶部就找不到了 */
async function loadLedger(page = ledgerPage.value): Promise<void> {
  try {
    const result = await memberApi.ledger(page, LEDGER_PAGE_SIZE)
    ledger.value = result.items
    ledgerPage.value = page
    ledgerTotal.value = result.total
  } catch (e) {
    store.error = e instanceof Error ? e.message : '流水加载失败'
  }
}

function gotoLedgerPage(next: number): void {
  if (next < 0 || next >= ledgerPageCount.value) return
  void loadLedger(next)
}

async function loadInvite(): Promise<void> {
  invite.value = await memberApi.invite()
}

async function loadCommission(): Promise<void> {
  commission.value = await memberApi.commission()
}

async function loadRules(): Promise<void> {
  rules.value = await memberApi.rules()
}

async function switchTab(next: TabKey): Promise<void> {
  tab.value = next
  /* 进入列表 tab 一律回第 1 页：积分明细/充值订单是持续产生新数据的，停留旧页会误以为没到账 */
  if (next === 'ledger') await loadLedger(0)
  if (next === 'recharge') await Promise.all([loadOrders(0), loadChannels()])
  if (next === 'invite') await loadInvite()
  if (next === 'commission') await loadCommission()
  if (next === 'rules') await loadRules()
}

/**
 * 提交充值：先建单，再决定走哪条路。
 * 有可用渠道 → 发起支付拿收银台参数；没有渠道 → 退回人工审批申请。
 * 两条路径都不在前端加积分：钱到账由后端校验渠道回调后写入。
 */
async function doRecharge(): Promise<void> {
  if (!canRecharge.value || submitting.value) return
  submitting.value = true
  rechargeMsg.value = ''
  try {
    const order = await memberApi.createOrder(amount.value)
    if (payChannels.value.length && payChannel.value) {
      await startPay(order.id, payChannel.value)
    } else {
      rechargeMsg.value = `已提交 ¥${amount.value}（${amount.value * pointsPerCny.value} 积分）的充值申请，等待平台管理员审批`
      await loadOrders(0)
    }
  } catch (e) {
    store.error = e instanceof Error ? e.message : '提交充值订单失败'
  } finally {
    submitting.value = false
  }
}

/** 发起支付：拿到参数后展示收银台，并开始轮询到账 */
async function startPay(orderId: string, channel: string): Promise<void> {
  const params = await memberApi.prepay(orderId, channel)
  payParams.value = params
  paying.value = true
  rechargeMsg.value = ''
  // 支付宝给的是可直接打开的收银台链接；微信给的是二维码内容，留在页面上
  if (params.payUrl) window.open(params.payUrl, '_blank', 'noopener')
  startPolling(orderId)
}

function startPolling(orderId: string): void {
  stopPolling()
  pollTicks = 0
  polling.value = true
  pollTimer = setInterval(() => {
    void pollOnce(orderId)
  }, POLL_INTERVAL_MS)
}

/** 轮询一次：到账即刷新余额，非 PENDING 即收摊 */
async function pollOnce(orderId: string): Promise<void> {
  pollTicks += 1
  if (pollTicks > POLL_MAX_TICKS) {
    stopPolling()
    return
  }
  try {
    const status = await memberApi.payStatus(orderId)
    if (status.status === 'PAID') {
      stopPolling()
      paying.value = false
      payParams.value = null
      rechargeMsg.value = `支付成功，积分已到账（当前余额 ${status.balance}）`
      /* 到账必产生流水，积分明细同步回第 1 页，与充值订单的刷新行为保持一致 */
      await Promise.all([store.refresh(), loadOrders(0), loadLedger(0)])
      return
    }
    if (status.status !== 'PENDING') {
      stopPolling()
      paying.value = false
      payParams.value = null
      rechargeMsg.value = '订单已关闭或已处理，请查看充值订单列表'
      await loadOrders(0)
    }
  } catch {
    /* 轮询失败按下一轮再试：网络抖动不该打断用户支付 */
  }
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling.value = false
}

/** 取消支付：只停止本地轮询，订单仍是待支付，可稍后「继续支付」 */
function cancelPay(): void {
  stopPolling()
  paying.value = false
  payParams.value = null
  void loadOrders(0)
}

/** 复制微信二维码内容：本服务不生成二维码图片，交给用户在手机微信里打开 */
async function copyPayCode(): Promise<void> {
  const code = payParams.value?.qrCode
  if (!code) return
  await navigator.clipboard?.writeText(code)
  rechargeMsg.value = '支付链接已复制，可在手机微信中打开完成支付'
}

/** 列表里继续支付：渠道沿用下单时选的那个 */
async function resumePay(order: RechargeOrder): Promise<void> {
  if (!order.payChannel) return
  submitting.value = true
  try {
    await startPay(order.id, order.payChannel)
  } catch (e) {
    store.error = e instanceof Error ? e.message : '继续支付失败'
  } finally {
    submitting.value = false
  }
}

/** 可用渠道：拉不到按「未开通在线支付」处理，不让充值入口消失 */
async function loadChannels(): Promise<void> {
  try {
    const list = await memberApi.rechargeChannels()
    payChannels.value = list
    if (list.length && !payChannel.value) {
      payChannel.value = list[0].code
    }
  } catch (e) {
    // 静默降级为人工审批是产品口径，但控制台要留痕：渠道为空时最可能的原因是后端未开通/未重启
    console.warn('[member] 支付渠道拉取失败，退回人工审批流程', e)
    payChannels.value = []
  }
}

/**
 * 拉取充值订单：默认刷新当前页；建单/到账后传 0，让最新订单立刻可见。
 *
 * @param page 目标页码，从 0 开始，缺省保持当前页
 */
async function loadOrders(page = ordersPage.value): Promise<void> {
  try {
    const result = await memberApi.orders(page, ORDERS_PAGE_SIZE)
    orders.value = result.items
    ordersPage.value = page
    ordersTotal.value = result.total
  } catch {
    /* 列表拉不到不影响提交结果，静默即可 */
  }
}

/** 翻页：越界直接忽略，不用弹提示 */
function gotoOrdersPage(next: number): void {
  if (next < 0 || next >= ordersPageCount.value) return
  void loadOrders(next)
}

function copyInvite(): void {
  if (!invite.value) return
  navigator.clipboard
    ?.writeText(invite.value.shareText)
    .then(() => {
      bindMsg.value = '邀请内容已复制，发给同学即可'
    })
    .catch(() => {
      bindMsg.value = '复制失败，请手动选择上方文本'
    })
}

async function doBind(): Promise<void> {
  if (!bindCode.value) return
  try {
    const result = await memberApi.bindInvite(bindCode.value.trim())
    bindMsg.value = result.message
    await store.refresh()
    await loadInvite()
  } catch (e) {
    bindMsg.value = e instanceof Error ? e.message : '绑定失败'
  }
}

async function doWithdraw(): Promise<void> {
  try {
    await memberApi.withdraw()
    /* 提现会产生新佣金记录，回第 1 页让用户立刻看到，与其他列表的刷新口径一致 */
    commissionPage.value = 0
    await loadCommission()
    await store.refresh()
  } catch (e) {
    store.error = e instanceof Error ? e.message : '提现失败'
  }
}

function goHome(): void {
  void router.push({ name: 'home' })
}

watch(
  () => store.overview?.balance,
  () => {
    /* 余额变化后佣金/邀请页无需立刻刷新，切 tab 时会重新拉 */
  },
)

onMounted(async () => {
  /* 台账备注要把案例编号换成真题名称，案例库得先在手上（已加载则直接用缓存） */
  void loadOutsourcedCases()
  await store.ensureLoaded()
  await Promise.all([loadLedger(), loadRules(), loadChannels()])
})

/* 离开页面必须停掉轮询：否则用户走了还在按 3 秒一次打支付状态接口 */
onUnmounted(stopPolling)
</script>

<style scoped>
.member-page {
  min-height: 100vh;
  padding: 96px 40px 64px;
  /* 与 SiteNav 的 1680px 容器同宽，和团队额度/后台/案例管理保持一致 */
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
  margin: 6px 0 6px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.4px;
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
.wallet {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 26px 28px;
  border-radius: 18px;
  background: linear-gradient(120deg, #12a594 0%, #1e9fc4 100%);
  color: #fff;
  box-shadow: 0 12px 32px rgba(11, 110, 104, 0.22);
}
.wallet-main .lab {
  font-size: 13px;
  opacity: 0.9;
}
.wallet-main .num {
  font-size: 44px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -1px;
}
.wallet-main .num small {
  font-size: 15px;
  font-weight: 600;
  margin-left: 6px;
  opacity: 0.85;
}
.wallet-main .tip {
  font-size: 12.5px;
  opacity: 0.9;
}
.wallet-acts {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.tabs {
  display: flex;
  gap: 6px;
  margin: 22px 0 18px;
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
}
.tab.on {
  color: #0b6e68;
  border-bottom-color: #12a594;
}
.panel {
  background: #fff;
  border: 1px solid #dcede0;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 2px 8px rgba(11, 110, 104, 0.06);
}
.panel-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}
.panel-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
}
.hint {
  font-size: 12.5px;
  color: #7c99a1;
  line-height: 1.7;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th {
  text-align: left;
  font-weight: 700;
  color: #7c99a1;
  font-size: 12px;
  padding: 8px 10px;
  border-bottom: 1px solid #eaf5f5;
}
.table td {
  padding: 11px 10px;
  border-bottom: 1px solid #f3fafa;
}
.table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.plus {
  color: #1f8a5f;
  font-weight: 700;
}
.minus {
  color: #d95c45;
  font-weight: 700;
}
.zero {
  color: #a9bec2;
}
.muted {
  color: #7c99a1;
}
.empty {
  text-align: center;
  color: #a9bec2;
  padding: 26px 0;
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
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.small {
  font-size: 11.5px;
}
.more {
  margin-top: 12px;
  text-align: center;
}
.recharge {
  display: grid;
  /* 页面变宽后表单卡不再跟着拉长：左侧定宽 520，剩余给说明卡 */
  grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
  gap: 16px;
}
.rcard {
  border: 1px solid #dcede0;
  border-radius: 14px;
  padding: 20px;
}
.rcard.side {
  background: #f7fbfb;
}
.rcard.side h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 800;
}
.rcard.side dl {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.9;
}
.rcard.side dt {
  color: #7c99a1;
  font-weight: 700;
}
.rcard.side dd {
  margin: 0 0 8px;
  color: #4a6572;
}
.rate {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: #effaf8;
  color: #0b6e68;
  font-size: 12px;
  font-weight: 700;
}
.rmoney {
  margin-top: 14px;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.req {
  color: #12a594;
  font-weight: 700;
  margin-bottom: 14px;
}
.fl {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  color: #4a6572;
  margin-bottom: 6px;
}
.input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #dcede0;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.input:focus {
  border-color: #12a594;
}
.quick {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0 16px;
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
.solid:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.solid.wide {
  width: 100%;
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
.ghost-light {
  padding: 9px 18px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.dev-note {
  margin: 12px 0 0;
  font-size: 12px;
  color: #a9bec2;
  line-height: 1.7;
}
/* 支付方式选中态：与 quick 档位按钮共用骨架，只换配色 */
.ghost.on {
  border-color: #12a594;
  background: #effaf8;
  color: #0b6e68;
}
.ghost.small {
  padding: 4px 10px;
  font-size: 12px;
}
.pay-wait {
  max-width: 520px;
}
.pay-open {
  display: block;
  margin: 12px 0;
  text-align: center;
  text-decoration: none;
  line-height: 1.6;
}
.pay-code {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px dashed #b8e8e2;
  border-radius: 10px;
  background: #f7fbfb;
}
.pay-code code {
  flex: 1;
  font-size: 12px;
  word-break: break-all;
  color: #0b6e68;
}
.invite .code-box {
  border: 1px dashed #b8e8e2;
  border-radius: 14px;
  padding: 18px;
  background: #effaf8;
  text-align: center;
}
.invite .lab {
  font-size: 12.5px;
  color: #4a6572;
  font-weight: 700;
}
.invite .code {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 3px;
  color: #0b6e68;
  margin: 8px 0 12px;
}
.prog {
  margin-top: 16px;
}
.prog-top {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: #7c99a1;
  margin-bottom: 6px;
}
.bar {
  height: 8px;
  border-radius: 999px;
  background: #eaf5f5;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(120deg, #12a594, #1e9fc4);
}
.share {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7fbfb;
  font-size: 12.5px;
  color: #4a6572;
  line-height: 1.8;
}
.bind {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed #dcede0;
}
.bind h3 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 800;
}
.bind-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.bind-msg {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: #0b6e68;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.stat {
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
  margin: 4px 0;
}
.stat .v.able {
  color: #12a594;
}
.stat .s {
  font-size: 12px;
  color: #a9bec2;
}
.rules h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 18px 0 6px;
}
.rules h3:first-child {
  margin-top: 0;
}
.rules p,
.rules li {
  font-size: 13px;
  color: #4a6572;
  line-height: 1.9;
}
.rules ul {
  margin: 0;
  padding-left: 20px;
}
.rules .warn {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff8e6;
  border: 1px solid #f0c36d;
  color: #8a6116;
  font-size: 12.5px;
}
.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 14px;
}
.notice.error {
  background: #fdf1ee;
  border: 1px solid #f0c0b5;
  color: #a8402b;
}
.notice.ok {
  background: #eaf7ee;
  border: 1px solid #bfe6cd;
  color: #1f8a5f;
}
@media (max-width: 900px) {
  .member-page {
    padding: 88px 18px 48px;
  }
  .recharge,
  .stats {
    grid-template-columns: 1fr;
  }
  .wallet {
    flex-direction: column;
    align-items: flex-start;
  }
  .wallet-acts {
    margin-left: 0;
  }
}
</style>
