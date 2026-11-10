<template>
  <div class="case-admin">
    <!-- 与站点其他页面一致：顶部主菜单，案例管理为高亮项 -->
    <SiteNav active="case-admin" />

    <div class="case-admin-head">
      <div>
        <div class="eyebrow">OUTSOURCED CASE LIBRARY</div>
        <h1>案例管理</h1>
        <p>管理用于对外展示的完整案例，与智能体运行结果库隔离。</p>
      </div>
      <div class="head-actions">
        <button class="btn secondary" @click="goHome">返回主站</button>
        <button v-if="canOrAdmin(PERM.CASE_CREATE)" class="btn primary" @click="openNew">提交案例</button>
      </div>
    </div>

    <div v-if="flash" class="notice ok">{{ flash }}</div>
    <div v-if="error" class="notice error">{{ error }}</div>
    <div v-if="!canManage" class="notice warn">
      当前账号只能查看案例：提交 / 编辑 / 删除 / 置顶需要对应的权限码（case:create、case:update、case:delete、case:pin）。
    </div>

    <div class="case-grid">
      <article v-for="item in cases" :key="item.protoId" class="case-card" :class="{ 'is-pinned': item.pinned }">
        <div class="case-card-cover">
          <img
            v-if="caseCoverOf(item) && !brokenCovers.has(item.protoId)"
            :src="caseCoverOf(item)"
            :alt="`${item.title} 封面`"
            @error="markCoverBroken(item.protoId)"
          />
          <div v-else class="cover-empty">无封面</div>
          <span v-if="!item.coverImage && caseCoverOf(item)" class="cover-badge">内置封面</span>
        </div>
        <div class="case-card-top">
          <span class="case-id">{{ item.protoId }}</span>
          <span class="card-flags">
            <span v-if="item.pinned" class="pin-flag">置顶</span>
            <span class="status" :class="item.status.toLowerCase()">{{ statusText(item.status) }}</span>
          </span>
        </div>
        <h2>{{ item.title }}</h2>
        <p class="meta">{{ metaLine(item) }}</p>
        <p class="summary" :class="{ missing: !item.summary }">
          {{ item.summary || '未填写简介 —— 编辑案例补上，首页卡片会显示这句' }}
        </p>
        <div class="section-chips">
          <span v-for="section in sectionList" :key="section.key" :class="{ empty: !sectionValue(item, section.key) }">
            {{ section.label }} {{ sectionValue(item, section.key) ? '已录入' : '空白' }}
          </span>
        </div>
        <div class="card-actions">
          <button
            v-if="canOrAdmin(PERM.CASE_PIN)"
            class="btn secondary"
            :disabled="!!pinBusy"
            @click="togglePin(item)"
          >
            {{ pinBusy === item.protoId ? '处理中…' : item.pinned ? '取消置顶' : '置顶到轮播' }}
          </button>
          <button v-if="canOrAdmin(PERM.CASE_UPDATE)" class="btn secondary" @click="openEdit(item)">编辑 / 替换</button>
          <button v-if="canOrAdmin(PERM.CASE_DELETE)" class="text-danger" @click="removeCase(item)">删除</button>
        </div>
      </article>
      <div v-if="!cases.length && !loading" class="empty">暂无外包案例。</div>
    </div>

    <div v-if="dialogOpen" class="modal-backdrop" @click.self="closeDialog">
      <form class="case-form" @submit.prevent="submit">
        <div class="form-head">
          <div>
            <div class="eyebrow">CASE SUBMISSION</div>
            <h2>{{ editing ? '编辑案例' : '提交案例' }}</h2>
          </div>
          <button type="button" class="close" @click="closeDialog">×</button>
        </div>

        <!-- 只有这块滚动：头部与底部按钮始终可见 -->
        <div class="form-scroll">
          <div class="form-grid">
            <div class="field">
              <span class="field-label">题目编号</span>
              <div class="static-field" :class="{ muted: !editing }">{{ editing ? form.protoId : `自动分配 · ${nextProtoId}` }}</div>
              <small class="hint">按案例库顺序生成，与数据库一一对应，无需手填</small>
            </div>
            <label class="field">
              <span class="field-label">案例名称</span>
              <input v-model.trim="form.title" required maxlength="200" placeholder="例如：SEM 广告投放策略优化" />
            </label>

            <label class="field span-2">
              <span class="field-label">简介 <em class="required">必填</em></span>
              <textarea
                v-model="form.summary"
                rows="3"
                maxlength="500"
                placeholder="一两句话说明这道题要解决什么，会显示在首页案例卡片上"
              ></textarea>
              <small class="hint">
                首页每张案例卡片都显示这句简介，之前没有这个输入框，库里 11 条案例全是空的 —— 现在已经补全存量。
                还可以输入 {{ 500 - form.summary.length }} 字
              </small>
            </label>

            <label class="field">
              <span class="field-label">年份</span>
              <input
                v-model.trim="form.year"
                maxlength="4"
                inputmode="numeric"
                placeholder="例如：2026"
                :class="{ invalid: !!yearError }"
                @blur="validateYear()"
              />
              <small v-if="yearError" class="err">{{ yearError }}</small>
              <small v-else class="hint">{{ dicts.yearMin }}–{{ dicts.yearMax }}；最早为 {{ dicts.yearMin }} 年美赛，上限随当前年份自动更新</small>
            </label>
            <div class="field">
              <span class="field-label">题号</span>
              <SiteSelect v-model="form.problemCode" :options="dicts.problemCodes" placeholder="不选择题号" allow-empty empty-label="不选择题号" />
              <small class="hint">选填，取自字典表 PROBLEM_CODE</small>
            </div>

            <div class="field">
              <span class="field-label">赛别</span>
              <div v-if="manual.category" class="manual-row">
                <input
                  v-model.trim="form.category"
                  maxlength="80"
                  placeholder="例如：国赛本科"
                  :class="{ invalid: !!dictError.category }"
                  @blur="validateDict('category')"
                />
                <button type="button" class="link-btn" @click="backToDict('category')">从选项选</button>
              </div>
              <SiteSelect
                v-else
                v-model="form.category"
                :options="dicts.categories"
                placeholder="选择赛别"
                allow-custom
                custom-label="手动输入赛别"
                @custom="manual.category = true"
              />
              <small v-if="dictError.category" class="err">{{ dictError.category }}</small>
              <small v-else class="hint">字典表 CATEGORY；手动输入的赛别也必须已在表中</small>
            </div>
            <div class="field">
              <span class="field-label">题型</span>
              <div v-if="manual.problemType" class="manual-row">
                <input
                  v-model.trim="form.problemType"
                  maxlength="80"
                  placeholder="例如：优化决策"
                  :class="{ invalid: !!dictError.problemType }"
                  @blur="validateDict('problemType')"
                />
                <button type="button" class="link-btn" @click="backToDict('problemType')">从选项选</button>
              </div>
              <SiteSelect
                v-else
                v-model="form.problemType"
                :options="dicts.problemTypes"
                placeholder="选择题型"
                allow-custom
                custom-label="手动输入题型"
                @custom="manual.problemType = true"
              />
              <small v-if="dictError.problemType" class="err">{{ dictError.problemType }}</small>
              <small v-else class="hint">字典表 PROBLEM_TYPE；手动输入的题型也必须已在表中</small>
            </div>
          </div>

          <div class="pin-row" :class="{ on: form.pinned }">
            <button
              type="button"
              class="switch"
              :class="{ on: form.pinned }"
              role="switch"
              :aria-checked="form.pinned"
              aria-label="置顶到首页轮播"
              @click="form.pinned = !form.pinned"
            >
              <i></i>
            </button>
            <div class="pin-text">
              <b>置顶到首页轮播</b>
              <small>{{ form.pinned ? '会出现在首页顶部轮播位，同时也留在「全部赛题」里' : '只在首页下方「全部赛题」展示，不进轮播' }}</small>
            </div>
          </div>

          <div class="cover-section">
            <div class="cover-preview">
              <img
                v-if="coverPreview && !coverBroken"
                :src="coverPreview"
                alt="案例封面预览"
                @error="coverBroken = true"
              />
              <div v-else class="cover-empty">暂无封面</div>
              <span v-if="coverPreview && !form.coverImage" class="cover-badge">内置封面</span>
            </div>
            <div class="cover-info">
              <strong>首页封面</strong>
              <small>这张图就是首页卡片上的封面。可以上传本地图片，也可以让后端调生图模型按题目重新画一张。</small>
              <p v-if="coverPreview && !form.coverImage" class="hint ok-hint">
                当前显示的是随前端发布的内置封面（<code>/cases/{{ normalizeCaseId(form.protoId, editing?.slug) }}/cover/cover.jpg</code>）。上传或生成后会换成新图。
              </p>
              <div class="cover-actions">
                <label v-if="canOrAdmin(PERM.CASE_COVER_UPLOAD)" class="btn secondary" :class="{ disabled: coverBusy }">
                  {{ coverBusy ? '上传中…' : '上传图片' }}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden @change="pickCover" />
                </label>
                <button
                  v-if="canOrAdmin(PERM.CASE_COVER_GENERATE)"
                  type="button"
                  class="btn secondary"
                  :disabled="coverGenBusy || coverBusy"
                  @click="regenerateCover"
                >
                  {{ coverGenBusy ? '生成中，请稍候…' : '重新调用生图模型生成' }}
                </button>
              </div>
              <p v-if="coverError" class="err">{{ coverError }}</p>
              <p v-else-if="!editing" class="hint">新案例要先保存一次才能上传或生成封面（封面落在 <code>&lt;编号&gt;/cover/</code>）。</p>
              <p v-else-if="coverModel.checked && !coverModel.available" class="hint">{{ coverModel.hint }}</p>
            </div>
          </div>

          <div class="upload-section">
            <div class="upload-section-head">
              <div><strong>实训指导书</strong><small>HTML / Markdown / TXT，上传后会在案例中按文档预览</small></div>
              <span class="upload-state" :class="{ ready: sectionReady('guide') }">{{ sectionState('guide') }}</span>
            </div>
            <label class="upload-zone" @dragover.prevent @drop.prevent="dropSectionFiles($event, 'guide')">
              <input type="file" multiple accept=".html,.htm,.md,.txt,text/html,text/plain,text/markdown" @change="readSectionFiles($event, 'guide')" />
              <span class="upload-icon">↑</span><span class="upload-main">点击选择或拖入指导书文件</span><span class="upload-sub">支持同时选择多个 HTML、Markdown、TXT 文件</span>
            </label>
            <div v-if="formFiles.guide.length" class="selected-file-list">
              <div v-for="(file, index) in formFiles.guide" :key="`${file.name}-${index}`" class="selected-file">
                <span>文件</span><b>{{ file.name }}</b><em>{{ formatBytes(file.size) }}</em>
                <button type="button" @click="removeSectionFile('guide', index)">移除</button>
              </div>
            </div>
          </div>

          <div class="upload-section animation-upload">
            <div class="upload-section-head">
              <div><strong>可视化演示</strong><small>每段上传一个独立 HTML，案例页会直接运行预览，不显示源码</small></div>
              <button type="button" class="btn secondary" @click="addAnimationSegment">＋ 添加问题章节</button>
            </div>
            <div v-for="(segment, index) in animationSegments" :key="segment.id" class="animation-segment">
              <div class="segment-head">
                <div class="segment-index">{{ String(index + 1).padStart(2, '0') }}</div>
                <input v-model="segment.label" :aria-label="`第 ${index + 1} 段标题`" placeholder="全局分析 / 问题一" />
                <button v-if="animationSegments.length > 1" type="button" class="text-danger" @click="removeAnimationSegment(segment.id)">移除</button>
              </div>
              <label class="upload-zone compact" @dragover.prevent @drop.prevent="dropAnimationFile($event, segment.id)">
                <input type="file" accept=".html,.htm,text/html" @change="readAnimationFile($event, segment.id)" />
                <span class="upload-icon">◇</span><span class="upload-main">{{ segment.fileName || '选择本段 HTML 文件' }}</span><span class="upload-sub">支持独立 HTML、内嵌 CSS / JavaScript</span>
              </label>
            </div>
          </div>

          <div class="upload-section">
            <div class="upload-section-head">
              <div>
                <strong>题目附件</strong>
                <small>题目给的原始材料（数据表 / 说明 PDF / 压缩包），会落盘到 <code>&lt;编号&gt;/attachments/</code>，沙箱运行代码时从这里读输入</small>
              </div>
              <span class="upload-state" :class="{ ready: sectionReady('attachments') }">{{ sectionState('attachments') }}</span>
            </div>
            <label class="upload-zone compact" @dragover.prevent @drop.prevent="dropAttachmentFiles($event)">
              <input type="file" multiple :accept="ATTACHMENT_ACCEPT" @change="pickAttachmentFiles" />
              <span class="upload-icon">▣</span>
              <span class="upload-main">点击选择或拖入题目附件</span>
              <span class="upload-sub">任意格式，可多选；单文件不超过 {{ ATTACHMENT_MAX_MB }}MB</span>
            </label>
            <div v-if="formFiles.attachments.length" class="selected-file-list">
              <div v-for="file in formFiles.attachments" :key="file.key" class="selected-file">
                <span>附件</span><b>{{ file.name }}</b><em>{{ formatBytes(file.size) }}</em>
                <i v-if="file.uploading" class="uploading">上传中…</i>
                <button type="button" :disabled="file.uploading" @click="removeAttachmentFile(file.key)">移除</button>
              </div>
            </div>
            <p v-else-if="stored.attachments" class="hint">库里已有附件，本次不选则保持原样。</p>
          </div>

          <div class="upload-section">
            <div class="upload-section-head">
              <div>
                <strong>代码</strong>
                <small>按题分组，每题可以放多个文件；落盘到 <code>&lt;编号&gt;/code/&lt;题号&gt;/</code>，文件名保留你上传的原名</small>
              </div>
              <button type="button" class="btn secondary" @click="addCodeGroup">＋ 添加问题章节</button>
            </div>
            <div class="code-group-summary">
              <span class="upload-state" :class="{ ready: sectionReady('code') }">{{ sectionState('code') }}</span>
              <span class="hint">共 {{ sectionCount('code') }} 个代码文件</span>
            </div>

            <div v-for="(group, groupIndex) in codeGroups" :key="group.id" class="animation-segment code-group">
              <div class="segment-head">
                <div class="segment-index">{{ String(groupIndex + 1).padStart(2, '0') }}</div>
                <input v-model="group.label" :aria-label="`第 ${groupIndex + 1} 组标题`" placeholder="全局 / 预处理 / 问题一" />
                <span class="code-dir">{{ group.step }}/</span>
                <button type="button" class="code-move" :disabled="groupIndex === 0" title="上移" @click="moveCodeGroup(group.id, -1)">↑</button>
                <button
                  type="button"
                  class="code-move"
                  :disabled="groupIndex === codeGroups.length - 1"
                  title="下移"
                  @click="moveCodeGroup(group.id, 1)"
                >↓</button>
                <button v-if="codeGroups.length > 1" type="button" class="text-danger" @click="removeCodeGroup(group.id)">移除</button>
              </div>

              <label class="upload-zone compact" @dragover.prevent @drop.prevent="dropCodeFiles($event, group.id)">
                <input type="file" multiple accept=".py,.txt,.r,.m,.js,.ts,.java,.ipynb,.sh,text/plain" @change="addCodeFiles($event, group.id)" />
                <span class="upload-icon">&lt;/&gt;</span>
                <span class="upload-main">给「{{ group.label }}」添加代码文件</span>
                <span class="upload-sub">可以一次选多个；同名文件再次上传会覆盖</span>
              </label>

              <div v-if="group.files.length" class="code-order-list">
                <div v-for="(file, index) in group.files" :key="`${file.name}-${index}`" class="code-order-item">
                  <span class="step-no">{{ index + 1 }}</span>
                  <div class="code-order-main">
                    <div class="code-order-row">
                      <b>{{ file.name }}</b>
                      <em>{{ formatBytes(file.size) }}</em>
                    </div>
                    <input v-model="file.title" type="text" maxlength="40" placeholder="步骤标题（选填），如：数据预处理" />
                    <input v-model="file.note" type="text" maxlength="120" placeholder="一句话说明（选填），如：读附件1，产出 clean.xlsx" />
                  </div>
                  <div class="code-order-actions">
                    <button type="button" :disabled="index === 0" title="上移" @click="moveCodeFile(group.id, index, -1)">↑</button>
                    <button type="button" :disabled="index === group.files.length - 1" title="下移" @click="moveCodeFile(group.id, index, 1)">↓</button>
                    <button type="button" @click="removeCodeFile(group.id, index)">移除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="upload-section">
            <div class="upload-section-head">
              <div><strong>成果与数据</strong><small>默认提交论文；表格 / 代码 / 图片 / 数据文件按需添加入口</small></div>
              <span class="upload-state" :class="{ ready: sectionReady('result') }">{{ sectionState('result') }}</span>
            </div>

            <div v-for="cat in enabledResultCategories" :key="cat.key" class="result-category">
              <div class="result-category-head">
                <b>{{ cat.label }}</b>
                <small>{{ cat.hint }} · 单文件不超过 {{ cat.maxMB }}MB</small>
                <span class="grow"></span>
                <button
                  v-if="cat.key !== 'paper'"
                  type="button"
                  class="link-btn"
                  @click="removeResultCategory(cat.key)"
                >移除该入口</button>
              </div>
              <label class="upload-zone compact" @dragover.prevent @drop.prevent="dropResultFiles($event, cat.key)">
                <input type="file" multiple :accept="cat.accept" @change="pickResultFiles($event, cat.key)" />
                <span class="upload-icon">▤</span>
                <span class="upload-main">点击选择或拖入{{ cat.label }}文件</span>
                <span class="upload-sub">{{ cat.hint }}，可多选；选完即上传到暂存区，提交时归入本案例</span>
              </label>
              <div v-if="resultFilesOf(cat.key).length" class="selected-file-list">
                <div v-for="file in resultFilesOf(cat.key)" :key="file.key" class="selected-file">
                  <span>{{ cat.label }}</span><b>{{ file.name }}</b><em>{{ formatBytes(file.size) }}</em>
                  <i v-if="file.uploading" class="uploading">上传中…</i>
                  <button type="button" :disabled="file.uploading" @click="removeResultFile(file.key)">移除</button>
                </div>
              </div>
            </div>

            <div class="result-add-row">
              <button
                v-for="cat in addableResultCategories"
                :key="cat.key"
                type="button"
                class="btn secondary"
                @click="addResultCategory(cat.key)"
              >＋ 添加{{ cat.label }}入口</button>
              <span class="result-total">
                已选 {{ formFiles.result.length }} 个文件<template v-if="resultTotalSize">，合计 {{ formatBytes(resultTotalSize) }}</template>
              </span>
            </div>
          </div>

          <div class="upload-section">
            <div class="upload-section-head">
              <div><strong>复现</strong><small>单个 HTML，案例页「在平台复现一遍」会全屏运行该交互演示</small></div>
              <span class="upload-state" :class="{ ready: sectionReady('replay') }">{{ sectionState('replay') }}</span>
            </div>
            <label class="upload-zone" @dragover.prevent @drop.prevent="dropSectionFiles($event, 'replay')">
              <input type="file" accept=".html,.htm,text/html" @change="readSectionFiles($event, 'replay')" />
              <span class="upload-icon">⟳</span><span class="upload-main">点击选择或拖入复现 HTML</span><span class="upload-sub">支持独立 HTML、内嵌 CSS / JavaScript 的完整交互复现页</span>
            </label>
            <div v-if="formFiles.replay.length" class="selected-file-list">
              <div v-for="(file, index) in formFiles.replay" :key="`${file.name}-${index}`" class="selected-file">
                <span>复现</span><b>{{ file.name }}</b><em>{{ formatBytes(file.size) }}</em>
                <button type="button" @click="removeSectionFile('replay', index)">移除</button>
              </div>
            </div>
          </div>

          <div v-if="formError" class="notice error form-error">{{ formError }}</div>
        </div>

        <!-- 冻结在弹窗底部：滚到哪都能点保存 -->
        <div class="form-actions">
          <span class="form-tip">{{ editing ? '编辑时未重新上传的板块会保留库里原文件' : '五个板块都至少上传 1 个文件后才能创建案例' }}</span>
          <div class="grow"></div>
          <button type="button" class="btn secondary" @click="closeDialog">取消</button>
          <button class="btn primary" :disabled="saving">{{ saving ? '保存中…' : '保存案例' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import SiteSelect from '@/components/common/SiteSelect.vue'
import SiteNav from '@/components/site/SiteNav.vue'
import { caseCoverOf, normalizeCaseId, staticCaseCover } from '@/utils/caseCover'
import {
  outsourcedCaseApi,
  type CaseDicts,
  type CaseSection,
  type OutsourcedCase,
  type ResultCategory,
} from '@/api/outsourcedCases'
import {
  loadCaseDicts,
  loadOutsourcedCases,
  outsourcedCaseState,
  reloadOutsourcedCases,
} from '@/stores/outsourcedCases'
import { ApiError } from '@/api/http'
import { PERM } from '@/config/permissions'
import { usePermission } from '@/hooks/usePermission'
import { type AnimationSegmentSeed } from '@/data/outsourcedCaseSeeds'

const router = useRouter()
const state = outsourcedCaseState()
const cases = computed(() => state.cases.value)
const loading = computed(() => state.loading.value)
const error = computed(() => state.error.value)
/**
 * 权限判定全部走权限码（`config/permissions.ts`），不看角色名。
 * 路由 meta 已经挡住了没有 case:menu 的账号，这里的每一处 can() 是给
 * 「进得来、但只有部分操作权」的账号做按钮级显隐与兜底。
 */
const { canOrAdmin } = usePermission()
const canManage = computed(() =>
  [PERM.CASE_CREATE, PERM.CASE_UPDATE, PERM.CASE_DELETE, PERM.CASE_PIN].some((code) => canOrAdmin(code)),
)

/** 后端字典没取到时的兜底：与 tjdc_case_dict 的初始值一致，保证表单可用 */
const FALLBACK_DICTS: CaseDicts = {
  categories: ['国赛本科', '国赛专科', '美赛MCM', '美赛ICM'],
  problemTypes: ['机理建模', '优化决策', '数据分析', '组合优化', '搜索仿真', '评价预测'],
  problemCodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  yearMin: 1985,
  yearMax: new Date().getFullYear(),
}
const dicts = reactive<CaseDicts>({ ...FALLBACK_DICTS })

const sectionList: { key: CaseSection; label: string }[] = [
  { key: 'guide', label: '实训指导书' },
  { key: 'animation', label: '可视化演示' },
  { key: 'code', label: '代码' },
  { key: 'result', label: '成果' },
  { key: 'replay', label: '复现' },
]

const dialogOpen = ref(false)
const editing = ref<OutsourcedCase | null>(null)
const saving = ref(false)
const formError = ref('')
const flash = ref('')
const pinBusy = ref('')
const yearError = ref('')
const dictError = reactive({ category: '', problemType: '' })
const manual = reactive({ category: false, problemType: false })

/**
 * 板块文件。
 *
 * order / title / note 是 2026-10-23 新增的运行顺序元数据（代码板块用）：
 * 小白打开案例页要能看出「先跑哪个、这一步干什么」，所以除了文件名还要标题与说明。
 * 后端 storeFiles 会把它们原样存进 filesJson（见 copyExtraFields）。
 */
type UploadFile = {
  name: string
  text: string
  size: number
  /** 运行顺序（1 基）。提交时按列表顺序重排，编辑时按它还原顺序 */
  order?: number
  /** 代码分组（global / problem1..4）：决定落盘子目录，也决定页面上归到哪一题 */
  step?: string
  /** 给人看的步骤标题，如「数据预处理」；空则显示文件名 */
  title?: string
  /** 一句话说明，如「读附件1，产出 clean.xlsx」 */
  note?: string
  path?: string
  url?: string
}
/**
 * 走「前端读成文本 → JSON 提交」通道的板块。
 *
 * 代码自 2026-10-26 起改为按题分组（codeGroups），不再走这条平铺通道；
 * 附件走二进制暂存 + attachmentFiles。这里只剩指导书和复现。
 */
type UploadSection = 'guide' | 'replay'

/**
 * 成果分类定义（2026-10-23）。
 *
 * 与后端 TjdcCaseAssetService 的 ALLOWED_EXTENSIONS / MAX_BYTES 严格对应；
 * 论文常开，表格 / 代码 / 图片按需添加。单文件上限：表格 50MB，其余 30MB。
 */
interface ResultCategoryDef {
  key: ResultCategory
  label: string
  hint: string
  exts: string[]
  accept: string
  maxMB: number
}

const RESULT_CATEGORY_DEFS: ResultCategoryDef[] = [
  {
    key: 'paper',
    label: '论文',
    hint: 'PDF / HTML / TXT / Markdown / Word',
    exts: ['pdf', 'html', 'htm', 'txt', 'md', 'markdown', 'docx'],
    accept: '.pdf,.html,.htm,.txt,.md,.markdown,.docx',
    maxMB: 30,
  },
  {
    key: 'table',
    label: '表格成果',
    hint: 'Excel / CSV',
    exts: ['xlsx', 'xls', 'csv'],
    accept: '.xlsx,.xls,.csv',
    maxMB: 50,
  },
  {
    key: 'code',
    label: '代码成果',
    hint: 'PY / R / M / JS / TS / Java / IPYNB / SH',
    exts: ['py', 'r', 'm', 'js', 'ts', 'java', 'ipynb', 'sh', 'txt'],
    accept: '.py,.r,.m,.js,.ts,.java,.ipynb,.sh,.txt',
    maxMB: 30,
  },
  {
    key: 'image',
    label: '图片成果',
    hint: 'PNG / JPG / WEBP / GIF / SVG',
    exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
    accept: '.png,.jpg,.jpeg,.webp,.gif,.svg',
    maxMB: 30,
  },
  {
    key: 'data',
    label: '数据文件',
    hint: 'CSV / Excel / JSON / DAT / MAT / ZIP，赛题附件放这里',
    exts: ['csv', 'xlsx', 'xls', 'json', 'txt', 'dat', 'mat', 'zip', 'rar', '7z', 'parquet'],
    accept: '.csv,.xlsx,.xls,.json,.txt,.dat,.mat,.zip,.rar,.7z,.parquet',
    maxMB: 100,
  },
]

/** 直接读成文本的扩展名；其余走二进制暂存上传。 */
const TEXT_EXTS = ['html', 'htm', 'txt', 'md', 'markdown']

/** 其他板块（指导书 / 代码 / 复现 / 演示）的单文件上限：与「单文件 30MB」一致。 */
const SECTION_MAX_MB = 30

/** 成果条目：text 用于文本类，token 用于本轮新上传的二进制，path 用于库里已有的文件。 */
interface ResultFile {
  key: string
  name: string
  size: number
  category: ResultCategory
  kind: 'text' | 'binary'
  text?: string
  token?: string
  path?: string
  url?: string
  mime?: string
  uploading?: boolean
}

/**
 * 题目附件条目（2026-10-26）。
 *
 * 与成果条目的区别：附件没有「分类」概念（它就是题目给的输入），
 * 所以不套 ResultCategory，字段也更少；三种形态与成果一致：
 * text（纯文本）、token（本轮新上传的二进制）、path（库里已有的）。
 */
interface AttachmentFile {
  key: string
  name: string
  size: number
  kind: 'text' | 'binary'
  text?: string
  token?: string
  path?: string
  url?: string
  mime?: string
  uploading?: boolean
}

const form = reactive({
  protoId: 'auto',
  title: '',
  /** 简介：首页每张案例卡片都会显示，2026-10-26 起必填（此前根本没这个输入框，库里全是 NULL）。 */
  summary: '',
  /** 封面：已存在的封面 URL（编辑回显）或本轮上传后后端返回的新 URL。 */
  coverImage: '',
  year: String(FALLBACK_DICTS.yearMax),
  category: '',
  problemType: '',
  problemCode: '',
  pinned: false,
  sections: { guide: '', animation: '', code: '', result: '', replay: '' } as Record<CaseSection, string>,
})
const formFiles = reactive<{ guide: UploadFile[]; result: ResultFile[]; replay: UploadFile[]; attachments: AttachmentFile[] }>({
  guide: [],
  result: [],
  replay: [],
  attachments: [],
})

/**
 * 代码按题分组（2026-10-26）。
 *
 * 为什么改成分组：原来代码是一个平铺列表 + 一次多选，提交时按序号自动命名
 * p3_case_code_02_v21.py，谁也看不出这是哪一题的、干什么用的。
 * 现在和「可视化演示」一样按题分块（全局 / 问题一…），每题可以放多个文件，
 * 后端落盘到 <protoId>/code/<step>/，目录与页面结构一一对应。
 */
interface CodeGroup {
  id: number
  /** 落盘子目录名：global / problem1..problem9 */
  step: string
  /** 给人看的组标题，如「全局 / 预处理」「问题一」 */
  label: string
  files: UploadFile[]
}
const codeGroups = ref<CodeGroup[]>([])
let nextCodeGroupId = 1

/** 代码分组候选题号；与 animationSegments 的 key 口径一致。 */
function codeStepOf(index: number): string {
  return index === 0 ? 'global' : `problem${index}`
}

function createCodeGroup(index: number): CodeGroup {
  return {
    id: nextCodeGroupId++,
    step: codeStepOf(index),
    label: index === 0 ? '全局 / 预处理' : `问题${toChineseNumber(index)}`,
    files: [],
  }
}
/** 已开启的成果入口，论文常开。 */
const enabledResultKeys = ref<ResultCategory[]>(['paper'])
const enabledResultCategories = computed(() =>
  RESULT_CATEGORY_DEFS.filter((cat) => enabledResultKeys.value.includes(cat.key)),
)
const addableResultCategories = computed(() =>
  RESULT_CATEGORY_DEFS.filter((cat) => !enabledResultKeys.value.includes(cat.key)),
)
const resultTotalSize = computed(() => formFiles.result.reduce((sum, file) => sum + (file.size || 0), 0))
/** 各板块数据库原值（打开编辑时记录），移除本次选择后回落到此，避免误清空已存内容 */
const originalSections = reactive<Record<UploadSection | 'result', string>>({ guide: '', result: '', replay: '' })
/** 板块状态键：五个正文板块 + 题目附件 */
type SectionKey = 'guide' | 'animation' | 'code' | 'result' | 'replay' | 'attachments'
/** 各板块数据库是否已有内容，用于状态标签区分「已上传」与「已准备」 */
const stored = reactive<Record<SectionKey, boolean>>({
  guide: false,
  animation: false,
  code: false,
  result: false,
  replay: false,
  attachments: false,
})
const animationSegments = ref<(AnimationSegmentSeed & { id: number })[]>([
  { id: 1, key: 'global', label: '全局分析', fileName: '', html: '' },
])
let nextSegmentId = 2

/** 新建时后端分配的编号（取现有最大数字 + 1，仅用于展示与文件命名） */
const nextProtoId = computed(() => {
  let max = 0
  for (const item of cases.value) {
    const matched = /^p(\d+)$/.exec(item.protoId)
    if (matched) max = Math.max(max, Number(matched[1]))
  }
  return `p${max + 1}`
})

function flashFor(message: string) {
  flash.value = message
  window.setTimeout(() => {
    if (flash.value === message) flash.value = ''
  }, 3200)
}

async function loadDicts() {
  const remote = await loadCaseDicts()
  if (!remote) return
  dicts.categories = remote.categories?.length ? remote.categories : dicts.categories
  dicts.problemTypes = remote.problemTypes?.length ? remote.problemTypes : dicts.problemTypes
  dicts.problemCodes = remote.problemCodes?.length ? remote.problemCodes : dicts.problemCodes
  dicts.yearMin = remote.yearMin || dicts.yearMin
  dicts.yearMax = remote.yearMax || dicts.yearMax
  // 编辑态下重新判定「是否只能手动输入」：后端字典到位后，标准值应落回下拉
  if (editing.value) {
    manual.category = !!form.category && !dicts.categories.includes(form.category)
    manual.problemType = !!form.problemType && !dicts.problemTypes.includes(form.problemType)
  }
}

onMounted(async () => {
  // 路由 meta 已拦过 case:menu（这里只是组件被复用/热更时的兜底）
  if (!canOrAdmin(PERM.CASE_MENU)) {
    void router.replace({ name: 'home' })
    return
  }
  await Promise.all([loadOutsourcedCases(true), loadDicts(), loadCoverAvailability()])
})

function resetForm(item?: OutsourcedCase) {
  animationSegments.value = [{ id: 1, key: 'global', label: '全局分析', fileName: '', html: '' }]
  nextSegmentId = 2
  codeGroups.value = [createCodeGroup(0)]
  coverError.value = ''

  editing.value = item || null
  form.protoId = item?.protoId || 'auto'
  form.title = item?.title || ''
  form.summary = item?.summary || ''
  form.coverImage = item?.coverImage || ''
  /* 换案例时清掉上一张的破图标记，否则新案例会沿用「已损坏」状态一直显示占位 */
  coverBroken.value = false
  form.year = item?.year || String(dicts.yearMax)
  form.category = item?.category || ''
  form.problemType = item?.problemType || ''
  form.problemCode = item?.problemCode || ''
  form.pinned = item ? !!item.pinned : false
  manual.category = !!item?.category && !dicts.categories.includes(item.category)
  manual.problemType = !!item?.problemType && !dicts.problemTypes.includes(item.problemType)
  yearError.value = ''
  dictError.category = ''
  dictError.problemType = ''

  form.sections.guide = item?.guideHtml || ''
  form.sections.animation = item?.animationHtml || ''
  form.sections.code = item?.codeText || ''
  form.sections.result = item?.resultHtml || ''
  form.sections.replay = item?.replayHtml || ''
  originalSections.guide = form.sections.guide
  originalSections.result = form.sections.result
  originalSections.replay = form.sections.replay
  // 正文外置后 content 列多为 NULL，判断「已上传」必须同时看文件引用，否则编辑态会误显示「待上传」
  stored.guide = !!form.sections.guide || hasFilesJson(item?.guideFilesJson)
  stored.code = !!form.sections.code || hasFilesJson(item?.codeFilesJson)
  stored.result = !!form.sections.result || hasFilesJson(item?.resultFilesJson)
  stored.replay = !!form.sections.replay || !!item?.replayFileName
  stored.attachments = hasFilesJson(item?.attachmentFilesJson)
  formFiles.guide = []
  formFiles.replay = []
  formFiles.attachments = []
  restoreFiles(formFiles.guide, item?.guideFilesJson, item?.guideFileName, item?.guideHtml)
  restoreCodeGroups(item)
  restoreAttachmentFiles(item)
  // 复现板块库里只存单个 HTML 文本（replayHtml），无独立列表字段，重建一个文件对象用于显示已上传文件名
  if (item?.replayHtml) {
    formFiles.replay = [{ name: item.replayFileName?.split('/').pop() || 'replay.html', text: item.replayHtml, size: item.replayHtml.length }]
  }
  restoreResultFiles(item)
  if (item?.animationSegmentsJson) {
    try {
      const parsed = JSON.parse(item.animationSegmentsJson) as AnimationSegmentSeed[]
      animationSegments.value = parsed.map((segment) => ({ ...segment, id: nextSegmentId++ }))
      form.sections.animation = animationSegments.value[0]?.html || form.sections.animation
    } catch {
      animationSegments.value = [
        { id: 1, key: 'global', label: '全局分析', fileName: item.animationFileName || '', html: form.sections.animation },
      ]
      nextSegmentId = 2
    }
  } else if (form.sections.animation) {
    animationSegments.value = [
      { id: 1, key: 'global', label: '全局分析', fileName: item?.animationFileName || '', html: form.sections.animation },
    ]
    nextSegmentId = 2
  }
  formError.value = ''
}

function backToDict(kind: 'category' | 'problemType') {
  manual[kind] = false
  dictError[kind] = ''
}

function validateYear(): boolean {
  const value = form.year.trim()
  if (!value) {
    yearError.value = '年份必填，例如 2026'
    return false
  }
  if (!/^\d{4}$/.test(value)) {
    yearError.value = '年份必须是 4 位数字，例如 2026'
    return false
  }
  const year = Number(value)
  if (year < dicts.yearMin || year > dicts.yearMax) {
    yearError.value = `年份必须在 ${dicts.yearMin} 至 ${dicts.yearMax} 之间（美赛最早 ${dicts.yearMin} 年，最晚不能超过今年），请重新输入`
    return false
  }
  yearError.value = ''
  return true
}

function validateDict(kind: 'category' | 'problemType'): boolean {
  const label = kind === 'category' ? '赛别' : '题型'
  const value = (kind === 'category' ? form.category : form.problemType).trim()
  const list = kind === 'category' ? dicts.categories : dicts.problemTypes
  const dictType = kind === 'category' ? 'CATEGORY' : 'PROBLEM_TYPE'
  if (!value) {
    dictError[kind] = `${label}必填，请从选项中选择或手动输入`
    return false
  }
  if (!list.includes(value)) {
    dictError[kind] = `${label}「${value}」不在字典表内，请从选项中选择，或先在 tjdc_case_dict 增加 dict_type=${dictType} 的条目`
    return false
  }
  dictError[kind] = ''
  return true
}

function makeSegmentKey(index: number) {
  if (index === 0) return 'global'
  return `problem${index}`
}

function syncAnimationSection() {
  form.sections.animation = animationSegments.value[0]?.html || ''
}

function addAnimationSegment() {
  const index = animationSegments.value.length
  animationSegments.value.push({
    id: nextSegmentId++,
    key: makeSegmentKey(index),
    label: `问题${toChineseNumber(index)}`,
    fileName: '',
    html: '',
  })
}

function removeAnimationSegment(id: number) {
  animationSegments.value = animationSegments.value.filter((segment) => segment.id !== id)
  syncAnimationSection()
}

function toChineseNumber(value: number) {
  return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][value] || String(value)
}

function restoreFiles(
  target: UploadFile[],
  json: string | null | undefined,
  fallbackName: string | null | undefined,
  fallbackText: string | null | undefined,
) {
  if (json) {
    try {
      const parsed = JSON.parse(json) as UploadFile[]
      if (Array.isArray(parsed)) {
        const list = parsed.filter((file) => file?.name && typeof file.text === 'string')
        /* 按 order 还原顺序；没有 order 的老数据保持原数组顺序（order 默认为 0，稳定排序不改变相对次序） */
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        target.push(...list)
      }
    } catch {
      // 旧数据格式不影响编辑
    }
  }
  if (!target.length && fallbackName && fallbackText) target.push({ name: fallbackName, text: fallbackText, size: fallbackText.length })
}

/* ── 代码：按题分组 ────────────────────────────────────────────── */

/**
 * 编辑态还原代码分组。
 *
 * 老数据没有 step 字段（全部平铺在 code/ 下），统一归到「全局 / 预处理」；
 * 新数据按 step 建组并按 order 排序。组内顺序保留 order，组间按 global → problemN。
 */
function restoreCodeGroups(item?: OutsourcedCase) {
  codeGroups.value = []
  const raw = item?.codeFilesJson
  let parsed: UploadFile[] = []
  if (raw) {
    try {
      const json = JSON.parse(raw)
      if (Array.isArray(json)) parsed = json.filter((file) => file?.name)
    } catch {
      parsed = []
    }
  }
  if (!parsed.length && item?.codeText) {
    parsed = [
      {
        name: item.codeFileName?.split('/').pop() || 'main.py',
        text: item.codeText,
        size: item.codeText.length,
      },
    ]
  }
  if (!parsed.length) {
    codeGroups.value = [createCodeGroup(0)]
    return
  }
  const buckets = new Map<string, UploadFile[]>()
  for (const file of parsed) {
    const step = file.step && /^(global|problem[1-9])$/.test(file.step) ? file.step : 'global'
    if (!buckets.has(step)) buckets.set(step, [])
    buckets.get(step)!.push(file)
  }
  const order = (step: string) => (step === 'global' ? 0 : Number(step.replace('problem', '')) || 99)
  for (const step of [...buckets.keys()].sort((a, b) => order(a) - order(b))) {
    const index = order(step)
    const group = createCodeGroup(index)
    group.step = step
    group.label = step === 'global' ? '全局 / 预处理' : `问题${toChineseNumber(index)}`
    group.files = buckets
      .get(step)!
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((file) => ({ ...file, step }))
    codeGroups.value.push(group)
  }
}

function addCodeGroup() {
  if (codeGroups.value.length >= 10) {
    formError.value = '代码最多分 10 组（全局 + 问题一至九）'
    return
  }
  codeGroups.value.push(createCodeGroup(codeGroups.value.length))
}

function removeCodeGroup(id: number) {
  if (codeGroups.value.length <= 1) return
  codeGroups.value = codeGroups.value.filter((group) => group.id !== id)
}

function moveCodeGroup(id: number, delta: number) {
  const index = codeGroups.value.findIndex((group) => group.id === id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= codeGroups.value.length) return
  const [moved] = codeGroups.value.splice(index, 1)
  codeGroups.value.splice(target, 0, moved)
  // 分组顺序变了，step 跟着重排，落盘目录才与页面顺序一致
  codeGroups.value.forEach((group, i) => {
    if (i > 0 || group.step === 'global') group.step = codeStepOf(i)
  })
}

/** 读文件成文本（代码/指导书/复现都走这条）；单文件 30MB 上限。 */
async function readAsUploadFiles(files: File[]): Promise<UploadFile[]> {
  const accepted = acceptWithinSectionLimit(files)
  return Promise.all(
    accepted.map(async (file) => ({ name: file.name, text: await file.text(), size: file.size })),
  )
}

async function addCodeFiles(event: Event, groupId: number) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files || [])
  input.value = ''
  const group = codeGroups.value.find((item) => item.id === groupId)
  if (!group) return
  try {
    group.files.push(...(await readAsUploadFiles(selected)))
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '文件读取失败'
  }
}

async function dropCodeFiles(event: DragEvent, groupId: number) {
  const group = codeGroups.value.find((item) => item.id === groupId)
  if (!group) return
  try {
    group.files.push(...(await readAsUploadFiles(Array.from(event.dataTransfer?.files || []))))
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '文件读取失败'
  }
}

function removeCodeFile(groupId: number, index: number) {
  const group = codeGroups.value.find((item) => item.id === groupId)
  group?.files.splice(index, 1)
}

function moveCodeFile(groupId: number, index: number, delta: number) {
  const group = codeGroups.value.find((item) => item.id === groupId)
  if (!group) return
  const target = index + delta
  if (target < 0 || target >= group.files.length) return
  const [moved] = group.files.splice(index, 1)
  group.files.splice(target, 0, moved)
}

/** 分组里的文件铺平成提交用的 codeFiles，每条带 step + order。 */
function flattenCodeFiles(): UploadFile[] {
  const out: UploadFile[] = []
  codeGroups.value.forEach((group) => {
    group.files.forEach((file) => {
      out.push({ ...file, step: group.step, order: out.length + 1 })
    })
  })
  return out
}

/* ── 题目附件 ──────────────────────────────────────────────────── */

function newAttachmentKey(): string {
  return `at-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 附件支持全格式（赛题附件很杂），单文件 100MB。 */
const ATTACHMENT_MAX_MB = 100
const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.dat,.mat,.zip,.rar,.7z,.tar,.gz,.png,.jpg,.jpeg,.webp,.gif,.bmp,.py,.m,.r,.sav,.dta,.parquet,.html,.htm'
const ATTACHMENT_TEXTS = ['txt', 'md', 'csv', 'json', 'html', 'htm']

async function ingestAttachmentFiles(files: File[]) {
  const errors: string[] = []
  for (const file of files) {
    if (file.size > ATTACHMENT_MAX_MB * 1024 * 1024) {
      errors.push(`「${file.name}」超过 ${ATTACHMENT_MAX_MB}MB 上限`)
      continue
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const isText = ATTACHMENT_TEXTS.includes(ext)
    const entry: AttachmentFile = {
      key: newAttachmentKey(),
      name: file.name,
      size: file.size,
      kind: isText ? 'text' : 'binary',
    }
    formFiles.attachments.push(entry)
    if (isText) {
      try {
        entry.text = await file.text()
      } catch {
        formFiles.attachments = formFiles.attachments.filter((item) => item.key !== entry.key)
        errors.push(`「${file.name}」读取失败`)
      }
      continue
    }
    entry.uploading = true
    try {
      // 附件与成果共用同一套暂存通道，只是分类固定为 attachment
      const staged = await outsourcedCaseApi.uploadResultAsset(file, 'attachment')
      entry.token = staged.token
      entry.mime = staged.mime
      entry.size = staged.size || entry.size
    } catch (e) {
      formFiles.attachments = formFiles.attachments.filter((item) => item.key !== entry.key)
      errors.push(e instanceof Error ? e.message : `「${file.name}」上传失败`)
    } finally {
      entry.uploading = false
    }
  }
  formError.value = errors.join('；')
}

async function pickAttachmentFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files || [])
  input.value = ''
  await ingestAttachmentFiles(selected)
}

async function dropAttachmentFiles(event: DragEvent) {
  await ingestAttachmentFiles(Array.from(event.dataTransfer?.files || []))
}

function removeAttachmentFile(key: string) {
  formFiles.attachments = formFiles.attachments.filter((file) => file.key !== key)
}

function restoreAttachmentFiles(item?: OutsourcedCase) {
  formFiles.attachments = []
  const raw = item?.attachmentFilesJson
  if (!raw) {
    stored.attachments = false
    return
  }
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    parsed.forEach((file, index) => {
      const name = typeof file?.name === 'string' ? file.name : ''
      if (!name) return
      formFiles.attachments.push({
        key: `stored-at-${index}`,
        name,
        size: Number(file.size ?? 0),
        kind: file.kind === 'binary' ? 'binary' : 'text',
        text: typeof file.text === 'string' ? file.text : undefined,
        path: typeof file.path === 'string' ? file.path : undefined,
        url: typeof file.url === 'string' ? file.url : undefined,
        mime: typeof file.mime === 'string' ? file.mime : undefined,
      })
    })
  } catch {
    // 旧数据忽略
  }
  stored.attachments = formFiles.attachments.length > 0
}

/**
 * 附件提交体：库里已有的带 path 原样带回，新上传的带 token，纯文本带 text。
 * 三种形态与成果同构，后端 applyAttachmentFiles 按形态分流。
 */
function attachmentFilesPayload(): string | null {
  if (!formFiles.attachments.length) return null
  return JSON.stringify(
    formFiles.attachments.map((file) => {
      if (file.token) {
        return { name: file.name, kind: file.kind, token: file.token, size: file.size, mime: file.mime }
      }
      if (file.kind === 'text' && typeof file.text === 'string') {
        return { name: file.name, kind: 'text', text: file.text, size: file.size }
      }
      return { name: file.name, kind: file.kind, path: file.path, url: file.url, size: file.size, mime: file.mime }
    }),
  )
}

/* ── 封面 ──────────────────────────────────────────────────────── */

const coverError = ref('')
const coverBusy = ref(false)
const coverGenBusy = ref(false)
const coverModel = reactive({ checked: false, available: false, hint: '' })

/** 卡片缩略图加载失败时回落到占位，不显示浏览器的碎图图标。 */
const coverBroken = ref(false)
/** 列表里逐个案例记录封面加载失败，避免一张 404 让整列表反复重试。 */
const brokenCovers = ref<Set<string>>(new Set())

/**
 * 编辑表单的封面预览。
 * 库里没传过封面时（当前 11 个案例几乎都是），回落到内置静态封面 ——
 * 否则这里会一直显示「暂无封面」，而首页其实有图，看着像功能坏了。
 * 新建案例（protoId='auto'）识别不出编号，`staticCaseCover` 会返回空串，符合预期。
 */
const coverPreview = computed(() => {
  if (form.coverImage) return form.coverImage
  return staticCaseCover(form.protoId, editing.value?.slug)
})

function markCoverBroken(protoId: string) {
  const next = new Set(brokenCovers.value)
  next.add(protoId)
  brokenCovers.value = next
}

/**
 * 封面接口的失败文案。
 *
 * 后端封面能力（上传 / 生图 / 能力探测）是随新版 jar 一起上的，旧的线上 jar 里没有这三条路由，
 * 直接透传后端文案会显示成「接口不存在」—— 看着像前端调错了地址，实际只是后端没更新。
 * 这里把 404 单独翻译成实话，避免误判。
 */
function coverFailure(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status === 404) {
    return '当前后端还没有封面接口（新版后端 jar 尚未部署）。部署后即可上传或生成封面。'
  }
  return e instanceof Error ? e.message : fallback
}

async function loadCoverAvailability() {
  if (coverModel.checked) return
  coverModel.checked = true
  try {
    const info = await outsourcedCaseApi.coverAvailable()
    coverModel.available = !!info.available
    coverModel.hint = info.hint || ''
  } catch (e) {
    coverModel.available = false
    coverModel.hint = coverFailure(e, '无法获取生图能力状态')
  }
}

/** 手动上传一张封面（改完立刻生效，不依赖生图模型）。 */
async function pickCover(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const protoId = editing.value?.protoId
  if (!protoId) {
    coverError.value = '请先保存案例，再上传封面（新案例还没有编号）'
    return
  }
  coverBusy.value = true
  coverError.value = ''
  try {
    const updated = await outsourcedCaseApi.uploadCover(protoId, file)
    form.coverImage = updated.coverImage || ''
    coverBroken.value = false
    applyCasePatch(protoId, updated)
    flashFor('封面已更新')
  } catch (e) {
    coverError.value = coverFailure(e, '封面上传失败')
  } finally {
    coverBusy.value = false
  }
}

/** 调生图模型重新生成封面。 */
async function regenerateCover() {
  const protoId = editing.value?.protoId
  if (!protoId) {
    coverError.value = '请先保存案例，再生成封面（新案例还没有编号）'
    return
  }
  coverGenBusy.value = true
  coverError.value = ''
  try {
    await loadCoverAvailability()
    if (!coverModel.available) {
      coverError.value = coverModel.hint || '后端未配置生图模型'
      return
    }
    const updated = await outsourcedCaseApi.generateCover(protoId)
    form.coverImage = updated.coverImage || ''
    coverBroken.value = false
    applyCasePatch(protoId, updated)
    flashFor('封面已重新生成')
  } catch (e) {
    coverError.value = coverFailure(e, '封面生成失败')
  } finally {
    coverGenBusy.value = false
  }
}

/** 把后端返回的最新案例合并回列表，避免整页重载把表单关掉。 */
function applyCasePatch(protoId: string, updated: OutsourcedCase) {
  state.cases.value = state.cases.value.map((row) =>
    row.protoId === protoId ? { ...row, coverImage: updated.coverImage, summary: updated.summary } : row,
  )
}

async function applySectionFiles(files: UploadFile[], section: UploadSection) {  // 复现只认单个 HTML：多选/多拖时只取第一个，避免库里出现半截数据
  if (section === 'replay') {
    if (!files.length) return
    formFiles.replay = [files[0]]
    form.sections.replay = files[0].text
    return
  }
  formFiles[section].push(...files)
  form.sections[section] = formFiles[section][0]?.text || ''
}

/** 非成果板块的体积闸门：单文件 30MB（与后端 MAX_SECTION_CHARS 对齐）。 */
function acceptWithinSectionLimit(files: File[]): File[] {
  const limit = SECTION_MAX_MB * 1024 * 1024
  const accepted: File[] = []
  const errors: string[] = []
  for (const file of files) {
    if (file.size > limit) {
      errors.push(`「${file.name}」${formatBytes(file.size)}，超过 ${SECTION_MAX_MB}MB 上限`)
    } else {
      accepted.push(file)
    }
  }
  if (errors.length) formError.value = errors.join('；')
  return accepted
}

async function readSectionFiles(event: Event, section: UploadSection) {
  try {
    const input = event.target as HTMLInputElement
    const selected = acceptWithinSectionLimit(Array.from(input.files || []))
    input.value = ''
    await applySectionFiles(
      await Promise.all(selected.map(async (file) => ({ name: file.name, text: await file.text(), size: file.size }))),
      section,
    )
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '文件读取失败'
  }
}

async function dropSectionFiles(event: DragEvent, section: UploadSection) {
  const selected = acceptWithinSectionLimit(Array.from(event.dataTransfer?.files || []))
  try {
    await applySectionFiles(
      await Promise.all(selected.map(async (file) => ({ name: file.name, text: await file.text(), size: file.size }))),
      section,
    )
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '文件读取失败'
  }
}

async function applyAnimationFile(file: { name: string; text: string }, id: number) {
  const segment = animationSegments.value.find((item) => item.id === id)
  if (!segment) return
  segment.html = file.text
  segment.fileName = file.name
  syncAnimationSection()
}

async function readAnimationFile(event: Event, id: number) {
  try {
    const input = event.target as HTMLInputElement
    const selected = input.files?.[0]
    input.value = ''
    if (!selected) return
    if (!acceptWithinSectionLimit([selected]).length) return
    await applyAnimationFile({ name: selected.name, text: await selected.text() }, id)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'HTML 文件读取失败'
  }
}

async function dropAnimationFile(event: DragEvent, id: number) {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!acceptWithinSectionLimit([file]).length) return
  try {
    await applyAnimationFile({ name: file.name, text: await file.text() }, id)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'HTML 文件读取失败'
  }
}

function removeSectionFile(section: UploadSection, index: number) {
  formFiles[section].splice(index, 1)
  form.sections[section] = formFiles[section][0]?.text || originalSections[section]
}

/**
 * 调整文件顺序（上移 delta=-1 / 下移 delta=1）。
 *
 * 只影响列表顺序；真正的 order 在提交时按下标重算（见 filesPayload），
 * 这样"用户排的"和"存进库的"永远是同一个口径。
 */
function moveSectionFile(section: UploadSection, index: number, delta: number) {
  const list = formFiles[section]
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
}

/* ── 成果分类（论文 / 表格 / 代码 / 图片）──────────────────────── */

function resultDef(key: ResultCategory): ResultCategoryDef {
  return RESULT_CATEGORY_DEFS.find((cat) => cat.key === key) ?? RESULT_CATEGORY_DEFS[0]
}

function resultFilesOf(key: ResultCategory): ResultFile[] {
  return formFiles.result.filter((file) => file.category === key)
}

function newResultKey(): string {
  return `rf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addResultCategory(key: ResultCategory) {
  if (!enabledResultKeys.value.includes(key)) enabledResultKeys.value = [...enabledResultKeys.value, key]
}

function removeResultCategory(key: ResultCategory) {
  if (key === 'paper') return
  formFiles.result = formFiles.result.filter((file) => file.category !== key)
  enabledResultKeys.value = enabledResultKeys.value.filter((item) => item !== key)
}

function removeResultFile(key: string) {
  formFiles.result = formFiles.result.filter((file) => file.key !== key)
}

/**
 * 收下一个分类的文件：
 * - HTML / TXT / MD 直接读成文本（沿用原来的 JSON 通道）；
 * - PDF / Word / Excel / 图片走二进制暂存上传，拿到 token 等提交时归位。
 */
async function ingestResultFiles(files: File[], category: ResultCategory) {
  const def = resultDef(category)
  const limit = def.maxMB * 1024 * 1024
  const errors: string[] = []
  for (const file of files) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!def.exts.includes(ext)) {
      errors.push(`「${file.name}」不是${def.label}支持的格式（${def.hint}）`)
      continue
    }
    if (file.size > limit) {
      errors.push(`「${file.name}」${formatBytes(file.size)}，超过 ${def.label} ${def.maxMB}MB 上限`)
      continue
    }
    const isText = TEXT_EXTS.includes(ext)
    formFiles.result.push({
      key: newResultKey(),
      name: file.name,
      size: file.size,
      category,
      kind: isText ? 'text' : 'binary',
    })
    const entry = formFiles.result[formFiles.result.length - 1]
    if (isText) {
      try {
        entry.text = await file.text()
      } catch (e) {
        formFiles.result = formFiles.result.filter((item) => item.key !== entry.key)
        errors.push(`「${file.name}」读取失败`)
      }
      continue
    }
    entry.uploading = true
    try {
      const staged = await outsourcedCaseApi.uploadResultAsset(file, category)
      entry.token = staged.token
      entry.mime = staged.mime
      entry.size = staged.size || entry.size
    } catch (e) {
      formFiles.result = formFiles.result.filter((item) => item.key !== entry.key)
      errors.push(e instanceof Error ? e.message : `「${file.name}」上传失败`)
    } finally {
      entry.uploading = false
    }
  }
  formError.value = errors.join('；')
}

async function pickResultFiles(event: Event, category: ResultCategory) {
  const input = event.target as HTMLInputElement
  const selected = Array.from(input.files || [])
  input.value = ''
  await ingestResultFiles(selected, category)
}

async function dropResultFiles(event: DragEvent, category: ResultCategory) {
  await ingestResultFiles(Array.from(event.dataTransfer?.files || []), category)
}

/** 编辑态：把库里 resultFilesJson 还原成带分类的条目，并打开对应入口。 */
function restoreResultFiles(item?: OutsourcedCase) {
  formFiles.result = []
  const raw = item?.resultFilesJson
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
      parsed.forEach((file, index) => {
        const name = typeof file?.name === 'string' ? file.name : ''
        if (!name) return
        const rawCategory = typeof file.category === 'string' ? file.category : 'paper'
        const category = RESULT_CATEGORY_DEFS.some((def) => def.key === rawCategory)
          ? (rawCategory as ResultCategory)
          : 'paper'
        formFiles.result.push({
          key: `stored-${index}`,
          name,
          size: Number(file.size ?? 0),
          category,
          kind: file.kind === 'binary' ? 'binary' : 'text',
          text: typeof file.text === 'string' ? file.text : undefined,
          path: typeof file.path === 'string' ? file.path : undefined,
          url: typeof file.url === 'string' ? file.url : undefined,
          mime: typeof file.mime === 'string' ? file.mime : undefined,
        })
      })
    } catch {
      // 旧数据格式忽略
    }
  }
  if (!formFiles.result.length && item?.resultHtml) {
    formFiles.result.push({
      key: 'stored-0',
      name: item.resultFileName?.split('/').pop() || 'result.html',
      size: item.resultHtml.length,
      category: 'paper',
      kind: 'text',
      text: item.resultHtml,
    })
  }
  const existing = new Set(formFiles.result.map((file) => file.category))
  enabledResultKeys.value = [
    'paper',
    ...RESULT_CATEGORY_DEFS.map((def) => def.key).filter((key) => key !== 'paper' && existing.has(key)),
  ]
  stored.result = formFiles.result.length > 0
}

/** 提交用：文本带 text，新上传的二进制带 token，库里已有的带 path（后端按形态分流）。 */
function resultFilesPayload(): string {
  return JSON.stringify(
    formFiles.result.map((file) => {
      if (file.token) {
        return { name: file.name, category: file.category, kind: file.kind, token: file.token, size: file.size, mime: file.mime }
      }
      if (file.kind === 'text' && typeof file.text === 'string') {
        return { name: file.name, category: file.category, kind: 'text', text: file.text, size: file.size }
      }
      return { name: file.name, category: file.category, kind: file.kind, path: file.path, url: file.url, size: file.size, mime: file.mime }
    }),
  )
}

function formatBytes(size: number) {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function openNew() {
  if (!canOrAdmin(PERM.CASE_CREATE)) return
  resetForm()
  dialogOpen.value = true
}

function openEdit(item: OutsourcedCase) {
  if (!canOrAdmin(PERM.CASE_UPDATE)) return
  resetForm(item)
  dialogOpen.value = true
}

function closeDialog() {
  if (!saving.value) dialogOpen.value = false
}

function goHome() {
  void router.push('/')
}

function metaLine(item: OutsourcedCase) {
  const bits = [
    item.year,
    item.category,
    item.problemType,
    item.problemCode ? `题号 ${item.problemCode}` : '',
  ].filter(Boolean)
  return `${bits.length ? bits.join(' · ') : '元数据未填写'} · v${item.version}`
}

/** 文件引用集合是否非空：正文外置后 content 列可能是 NULL，真正内容在 *FilesJson 里 */
function hasFilesJson(json: string | null | undefined): boolean {
  if (!json) return false
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

/** 板块是否有内容：内联正文优先，其次看文件引用（含成果的文件集合） */
function sectionValue(item: OutsourcedCase, section: CaseSection) {
  const inlineOrFiles = (inline?: string | null, filesJson?: string | null) =>
    inline || (hasFilesJson(filesJson) ? 'files' : null)
  switch (section) {
    case 'guide':
      return inlineOrFiles(item.guideHtml, item.guideFilesJson)
    case 'animation':
      return inlineOrFiles(item.animationHtml, item.animationSegmentsJson)
    case 'code':
      return inlineOrFiles(item.codeText, item.codeFilesJson)
    case 'result':
      return inlineOrFiles(item.resultHtml, item.resultFilesJson)
    case 'replay':
      return item.replayHtml || item.replayFileName || null
  }
}

function statusText(status: string) {
  return status === 'PUBLISHED' ? '已发布' : status === 'BLANK' ? '空白' : '草稿'
}

/** 各板块当前「本次已选」的文件数（代码按分组汇总，附件单独算）。 */
function sectionCount(section: SectionKey): number {
  if (section === 'code') return codeGroups.value.reduce((sum, group) => sum + group.files.length, 0)
  if (section === 'attachments') return formFiles.attachments.length
  if (section === 'result') return formFiles.result.length
  if (section === 'animation') return animationSegments.value.filter((segment) => (segment.html || '').trim()).length
  return formFiles[section].length
}

/** 板块上传状态：本次新选文件→已准备；数据库已有内容→已上传；都没有→待上传 */
function sectionState(section: SectionKey): string {
  if (sectionCount(section)) return '已准备'
  return stored[section] ? '已上传' : '待上传'
}

function sectionReady(section: SectionKey): boolean {
  return sectionCount(section) > 0 || stored[section]
}

/** 新建案例的完整性闸门：五个板块都要有内容（对应后端 requireAllSections）；附件不是必填 */
function missingSections(): string[] {
  const missing: string[] = []
  if (!formFiles.guide.length && !stored.guide) missing.push('实训指导书')
  if (!animationSegments.value.some((segment) => (segment.html || '').trim())) missing.push('可视化演示')
  if (!sectionCount('code') && !stored.code) missing.push('代码')
  if (!formFiles.result.length && !stored.result) missing.push('成果')
  if (!formFiles.replay.length && !stored.replay) missing.push('复现')
  return missing
}

function slugPreview() {
  return (
    form.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '') || 'case'
  )
}

/** 标签不再手填：由 年份 + 赛别 + 题号 自动拼（与存量 '2026国赛C题' 同形） */
function composeTag(): string | null {
  const year = form.year.trim()
  const category = form.category.trim()
  const prefix = category.startsWith('美赛') ? '美赛' : category.startsWith('国赛') ? '国赛' : category
  const code = form.problemCode ? `${form.problemCode}题` : ''
  const tag = `${year}${prefix}${code}`.trim()
  return tag || null
}

function sortCases(list: OutsourcedCase[]) {
  const seq = (protoId: string) => {
    const matched = /^p(\d+)$/.exec(protoId)
    return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER
  }
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || seq(a.protoId) - seq(b.protoId))
}

async function togglePin(item: OutsourcedCase) {
  if (pinBusy.value) return
  // 原来这里静默 return，点了完全没反应也无提示；权限不足要说清楚
  if (!canOrAdmin(PERM.CASE_PIN)) {
    state.error.value = '当前账号没有 case:pin 权限，无法修改置顶状态'
    return
  }
  pinBusy.value = item.protoId
  state.error.value = ''
  try {
    const updated = await outsourcedCaseApi.pin(item.protoId, !item.pinned)
    state.cases.value = sortCases(
      state.cases.value.map((row) => (row.protoId === updated.protoId ? { ...row, pinned: updated.pinned } : row)),
    )
    flashFor(updated.pinned ? `「${item.title}」已置顶到首页轮播` : `「${item.title}」已取消置顶`)
  } catch (e) {
    // alert 在部分内嵌场景会被拦，同时写到页面顶部红条，避免再次「点了没反应」
    const message = e instanceof Error ? e.message : '置顶操作失败'
    state.error.value = `置顶失败：${message}`
    window.alert(message)
  } finally {
    pinBusy.value = ''
  }
}

async function submit() {
  // 新建与编辑是两个码：只有 case:update 的账号不能顺手造新案例
  const required = editing.value ? PERM.CASE_UPDATE : PERM.CASE_CREATE
  if (!canOrAdmin(required)) {
    formError.value = `当前账号没有 ${required} 权限，无法保存案例`
    return
  }
  formError.value = ''
  const problems: string[] = []
  if (!form.title.trim()) problems.push('案例名称不能为空')
  if (!form.summary.trim()) problems.push('简介不能为空（首页每张案例卡片都会显示这句简介）')
  else if (form.summary.trim().length > 500) problems.push('简介不能超过 500 字')
  if (!validateYear()) problems.push(yearError.value)
  if (!validateDict('category')) problems.push(dictError.category)
  if (!validateDict('problemType')) problems.push(dictError.problemType)
  if (!editing.value) {
    const missing = missingSections()
    if (missing.length) problems.push(`${missing.join('、')}还没有上传文件（五个板块都提交后才能创建案例）`)
  }
  if (formFiles.result.some((file) => file.uploading)) {
    problems.push('成果文件还在上传中，请等上传完成后再保存')
  }
  if (formFiles.result.some((file) => !file.token && !file.path && file.kind === 'binary')) {
    problems.push('有成果文件没有上传成功，请移除后重新选择')
  }
  if (formFiles.attachments.some((file) => file.uploading)) {
    problems.push('题目附件还在上传中，请等上传完成后再保存')
  }
  if (formFiles.attachments.some((file) => !file.token && !file.path && file.kind === 'binary')) {
    problems.push('有附件没有上传成功，请移除后重新选择')
  }
  if (problems.length) {
    formError.value = problems.join('；')
    return
  }

  saving.value = true
  try {
    syncAnimationSection()
    /*
     * 2026-10-26：不再自动重命名。
     * 以前每个文件都会被改成 <protoId>_<slug>_<板块>_<序号>_v<版本>.ext，
     * 于是每保存一次版本号 +1、文件名整批换掉，目录里同时躺着 v13/v15/v16/v18 好几代，
     * 谁也认不出哪个文件是什么。现在一律保留上传时的原名（重名即覆盖，等于「替换」语义）。
     * 只有在原名未知（老数据没有文件名）时才回落到 <板块>-<序号>。
     */
    const animationSegmentsJson = JSON.stringify(
      animationSegments.value.map((segment, index) => ({
        key: segment.key,
        label: segment.label,
        // 动画按段命名：global.html / problem1.html…，稳定、可读、覆盖式更新
        fileName: segment.html ? `${segment.key || `seg${index + 1}`}.html` : '',
        html: segment.html,
      })),
    )
    const filesPayload = (section: 'guide') =>
      JSON.stringify(
        formFiles[section].map((file, index) => ({
          ...file,
          order: index + 1,
        })),
      )
    const codePayload = JSON.stringify(
      flattenCodeFiles().map((file) => ({
        name: file.name,
        text: file.text,
        size: file.size,
        step: file.step,
        order: file.order,
        title: file.title,
        note: file.note,
      })),
    )

    await outsourcedCaseApi.upsert({
      protoId: editing.value ? form.protoId : 'auto',
      title: form.title.trim(),
      tag: composeTag(),
      year: form.year.trim(),
      category: form.category.trim(),
      problemType: form.problemType.trim(),
      problemCode: form.problemCode || null,
      summary: form.summary.trim(),
      // 封面单走到 /cover 通道；这里只在已有封面时把当前值带回，避免 upsert 抹掉
      coverImage: form.coverImage || null,
      pinned: form.pinned,
      sections: {
        animation: form.sections.animation || null,
        animationSegments: animationSegmentsJson,
        guideFiles: filesPayload('guide'),
        codeFiles: codePayload,
        resultFiles: resultFilesPayload(),
        attachmentFiles: attachmentFilesPayload(),
        guide: form.sections.guide || null,
        // 代码正文由 codeFiles 承载（分组 + 原名）；不再写重复的单个主文件
        code: null,
        // 成果正文改由 resultFiles 承载（分类 + 二进制），不再写单个 result 文件
        result: null,
        replay: form.sections.replay || null,
        // 复现只有一个 HTML，文件名单独带过去，避免后端按旧规则重命名
        replayFileName: formFiles.replay[0]?.name || editing.value?.replayFileName?.split('/').pop() || null,
      },
    })
    const created = !editing.value
    await reloadOutsourcedCases(true)
    dialogOpen.value = false
    flashFor(created ? '案例已创建，已同步到首页案例库' : '案例已更新')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function removeCase(item: OutsourcedCase) {
  if (!canOrAdmin(PERM.CASE_DELETE)) return
  const ok = window.confirm(
    `确认删除「${item.title}」？\n会同时删除数据库记录（含 entries 子表）与 public/cases/${item.protoId} 下的全部文件，不可恢复。`,
  )
  if (!ok) return
  try {
    await outsourcedCaseApi.remove(item.protoId)
    await reloadOutsourcedCases(true)
    if (state.cases.value.some((row) => row.protoId === item.protoId)) {
      throw new Error('后端返回成功，但该案例仍在列表中；请检查 agents-backend-tjdc 日志')
    }
    flashFor(`案例「${item.title}」已删除（数据库与本地文件）`)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '删除失败')
  }
}
</script>

<style scoped>
.case-admin {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(18, 165, 148, 0.12), transparent 34%),
    linear-gradient(180deg, #f7fbfb 0%, #eef5f4 100%);
  color: #15333a;
  /* 顶部留出固定导航的 66px，再留下原来的 42px 呼吸位。
     本页自带整屏渐变背景，所以外框保持满宽（不能加 max-width，否则两侧露白），
     靠内部区块的 1600px 定宽与 SiteNav 的 1680px 容器对齐 */
  padding: 108px 40px 42px;
  font-family: Inter, "Microsoft YaHei", sans-serif;
}
.case-admin-head {
  max-width: 1600px;
  margin: 0 auto 30px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-end;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: .14em;
  color: #0f9f91;
  font-weight: 800;
}
.case-admin h1 {
  margin: 8px 0;
  font-size: 34px;
  color: #102f36;
}
.case-admin-head p {
  margin: 0;
  color: #647b83;
}
.head-actions,
.card-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.btn {
  border: 1px solid #cddddd;
  border-radius: 10px;
  padding: 10px 16px;
  background: #ffffff;
  color: #25464d;
  cursor: pointer;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(18, 50, 56, .06);
}
.btn.primary {
  background: #12a594;
  border-color: #12a594;
  color: #ffffff;
}
.btn.primary:disabled {
  opacity: .62;
  cursor: not-allowed;
}
.btn.secondary:hover {
  border-color: #12a594;
  color: #0b887b;
}
.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.case-grid {
  max-width: 1600px;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.case-card {
  background: rgba(255, 255, 255, .92);
  border: 1px solid #d9e8e7;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 14px 32px rgba(28, 67, 72, .08);
}
.case-card.is-pinned {
  border-color: #9ed5ce;
  box-shadow: 0 14px 32px rgba(18, 165, 148, .14);
}
.case-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-flags {
  display: flex;
  gap: 6px;
  align-items: center;
}
.case-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #0f8f83;
  font-size: 12px;
  font-weight: 800;
}
.pin-flag {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 99px;
  background: #12a594;
  color: #fff;
  font-weight: 800;
}
.status {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 99px;
  background: #dcf8f1;
  color: #08796f;
  font-weight: 800;
}
.status.blank {
  background: #fff5d6;
  color: #9b6500;
}
.status.draft {
  background: #eee7ff;
  color: #6550ad;
}
.case-card h2 {
  font-size: 19px;
  margin: 18px 0 8px;
  color: #163940;
}
.meta {
  color: #70868d;
  font-size: 13px;
}
.section-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 18px 0;
}
.section-chips span {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 7px;
  background: #e1f7f2;
  color: #08796f;
  font-weight: 700;
}
.section-chips span.empty {
  background: #eef2f3;
  color: #809098;
}
.text-danger {
  border: 0;
  background: transparent;
  color: #d84f5b;
  cursor: pointer;
  font-weight: 800;
}
.empty {
  grid-column: 1 / -1;
  padding: 60px;
  text-align: center;
  color: #83969d;
  background: rgba(255, 255, 255, .78);
  border: 1px dashed #ccdcdb;
  border-radius: 16px;
}
.notice {
  max-width: 1600px;
  margin: 0 auto 18px;
  padding: 12px 15px;
  border-radius: 10px;
  border: 1px solid transparent;
}
.notice.error {
  background: #fff0f2;
  color: #b9303e;
  border-color: #ffd1d8;
}
.notice.warn {
  background: #fff8e5;
  color: #8b6518;
  border-color: #f7df9f;
}
.notice.ok {
  background: #e6f9f3;
  color: #0a7a6e;
  border-color: #b6e9dc;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 38, 43, .42);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
  backdrop-filter: blur(6px);
}
.case-form {
  width: min(980px, 96vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #d9e8e7;
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(17, 50, 56, .22);
}
.form-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 24px 14px;
  flex: none;
}
.form-head h2 {
  margin: 8px 0 0;
  color: #173940;
}
.close {
  border: 0;
  background: #f2f7f7;
  color: #547078;
  border-radius: 10px;
  width: 36px;
  height: 36px;
  font-size: 24px;
  cursor: pointer;
}
.form-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 24px 8px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 8px 0 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #34565e;
  font-size: 13px;
  font-weight: 800;
  min-width: 0;
}
.field-label {
  display: block;
}
.case-form input,
.case-form select,
.case-form textarea {
  background: #fbfefe;
  border: 1px solid #cfe0df;
  border-radius: 10px;
  color: #15333a;
  padding: 10px 12px;
  font: inherit;
  font-weight: 600;
  outline: none;
  width: 100%;
}
.case-form input:focus,
.case-form select:focus,
.case-form textarea:focus {
  border-color: #12a594;
  box-shadow: 0 0 0 3px rgba(18, 165, 148, .14);
}
.case-form input.invalid {
  border-color: #e08b94;
  background: #fff8f9;
}
.case-form input.invalid:focus {
  border-color: #d84f5b;
  box-shadow: 0 0 0 3px rgba(216, 79, 91, .12);
}
.static-field {
  padding: 10px 12px;
  border: 1px dashed #9ed5ce;
  border-radius: 10px;
  background: #f4fbfa;
  color: #08796f;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 800;
}
.static-field.muted {
  color: #0b887b;
}
.hint {
  color: #7f959b;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.5;
}
.err {
  color: #c0392f;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
}
.manual-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.manual-row input {
  flex: 1;
  min-width: 0;
}
.link-btn {
  flex: none;
  border: 0;
  background: transparent;
  color: #0b887b;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  padding: 6px 2px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pin-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 18px;
  border: 1px solid #dbe9e8;
  border-radius: 14px;
  background: #fbfefe;
}
.pin-row.on {
  border-color: #9ed5ce;
  background: #f3fbf9;
}
.switch {
  flex: none;
  width: 46px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid #cddddd;
  background: #eef2f3;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background .16s ease, border-color .16s ease;
}
.switch i {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(20, 50, 55, .22);
  transition: transform .16s ease;
}
.switch.on {
  background: #12a594;
  border-color: #12a594;
  justify-content: flex-end;
}
.pin-text b {
  display: block;
  color: #173940;
  font-size: 14px;
}
.pin-text small {
  display: block;
  margin-top: 3px;
  color: #789096;
  font-size: 12px;
  font-weight: 500;
}
.upload-section {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #dbe9e8;
  border-radius: 16px;
  background: #fbfefe;
}
.upload-section-head,
.segment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.upload-section-head strong {
  display: block;
  color: #173940;
  font-size: 15px;
}
.upload-section-head small {
  display: block;
  margin-top: 4px;
  color: #789096;
  font-size: 12px;
  font-weight: 500;
}
.upload-state {
  flex: none;
  border-radius: 999px;
  padding: 5px 10px;
  background: #eef2f3;
  color: #7d8e94;
  font-size: 12px;
  font-weight: 800;
}
.upload-state.ready {
  background: #ddf8f1;
  color: #08796f;
}
.upload-zone {
  position: relative;
  min-height: 96px;
  border: 1px dashed #9ed5ce;
  border-radius: 14px;
  background: linear-gradient(180deg, #f7fdfc, #edf8f6);
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 18px;
  text-align: center;
  cursor: pointer;
}
.upload-zone.compact {
  min-height: 78px;
  margin-bottom: 10px;
}
.upload-zone:hover {
  border-color: #12a594;
  box-shadow: 0 0 0 3px rgba(18, 165, 148, .1);
}
.upload-zone input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.upload-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #12a594;
  color: #fff;
  font-weight: 900;
}
.upload-main {
  color: #213f46;
  font-weight: 900;
}
.upload-sub {
  color: #789096;
  font-size: 12px;
}
.selected-file {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  padding: 9px 11px;
  border-radius: 10px;
  background: #f1f8f7;
  color: #49666d;
  font-size: 12px;
}
.selected-file b {
  color: #0f8f83;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
}
.selected-file em {
  color: #82949a;
  font-style: normal;
  white-space: nowrap;
}
.selected-file-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.selected-file button {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #d84f5b;
  cursor: pointer;
  font-weight: 800;
}
.selected-file button:disabled {
  color: #b9c6c9;
  cursor: progress;
}
.selected-file .uploading {
  color: #0f8f83;
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}
/* 代码运行顺序：序号 + 标题 + 说明 + 上下移 */
.code-order-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.code-order-hint {
  margin: 0;
  color: #82949a;
  font-size: 12px;
  line-height: 1.5;
}
.code-order-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #d9e8e7;
  border-radius: 10px;
  background: #f1f8f7;
}
.step-no {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #0f8f83;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  margin-top: 2px;
}
.code-order-main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
}
.code-order-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}
.code-order-row b {
  color: #0f8f83;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
}
.code-order-row em {
  color: #82949a;
  font-style: normal;
  white-space: nowrap;
}
.code-order-main input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 8px;
  border: 1px solid #d9e8e7;
  border-radius: 7px;
  background: #fff;
  color: #22484f;
  font-size: 12px;
}
.code-order-main input:focus {
  outline: none;
  border-color: #0f8f83;
}
.code-order-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.code-order-actions button {
  border: 1px solid #d9e8e7;
  background: #fff;
  color: #49666d;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}
.code-order-actions button:disabled {
  color: #c3d0d2;
  cursor: not-allowed;
}
.code-order-actions button:last-child {
  color: #d84f5b;
  border-color: transparent;
  background: transparent;
  font-weight: 700;
}
/* 成果分类：论文 / 表格 / 代码 / 图片 */
.result-category {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid #d9e8e7;
  border-radius: 14px;
  background: #ffffff;
}
.result-category-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.result-category-head b {
  color: #0f7d72;
  font-size: 13px;
}
.result-category-head small {
  color: #789096;
  font-size: 12px;
}
.result-category-head .grow {
  flex: 1;
}
.result-add-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.result-total {
  margin-left: auto;
  color: #789096;
  font-size: 12px;
}
.animation-segment {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #d9e8e7;
  border-radius: 14px;
  background: #ffffff;
}
.segment-index {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #e1f7f2;
  color: #08796f;
  font-weight: 900;
  flex: none;
}
.segment-head input {
  flex: 1;
}
.form-error {
  max-width: none;
  margin: 4px 0 12px;
}
.form-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid #e2eeed;
  background: #ffffff;
  box-shadow: 0 -8px 20px rgba(17, 50, 56, .06);
}
.form-tip {
  color: #8095a0;
  font-size: 12px;
  font-weight: 500;
}
.grow {
  flex: 1;
}
/* ── 简介字段 ───────────────────────────────────────────────── */
.field.span-2 {
  grid-column: 1 / -1;
}
.field .required {
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  color: #d84f5b;
  margin-left: 4px;
}
.case-form textarea {
  resize: vertical;
  min-height: 68px;
  line-height: 1.6;
}
/* ── 封面预览 ───────────────────────────────────────────────── */
.cover-section {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  margin-top: 6px;
  border: 1px solid #dbe9e8;
  border-radius: 16px;
  background: #fbfefe;
}
.cover-preview {
  flex: none;
  width: 240px;
  aspect-ratio: 3 / 2;
  border-radius: 12px;
  overflow: hidden;
  background: #eef5f4;
  border: 1px solid #d9e8e7;
  display: grid;
  place-items: center;
  position: relative;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-empty {
  color: #8ba0a5;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}
/* 「内置封面」角标：库里的 cover_image 还空着，现在显示的是随前端发布的静态图 */
.cover-badge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(9, 42, 48, 0.62);
  color: #eaf7f5;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
  pointer-events: none;
}
.hint.ok-hint {
  color: #0b7a6e;
}
.cover-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8px;
}
.cover-info strong {
  color: #173940;
  font-size: 15px;
}
.cover-info small {
  color: #789096;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
}
.cover-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cover-actions .btn.disabled {
  opacity: .6;
  cursor: progress;
}
.cover-info code,
.upload-section-head code {
  background: #eaf5f3;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11.5px;
  color: #0b7a6e;
}
/* ── 案例卡片：封面 + 简介 ──────────────────────────────────── */
.case-card-cover {
  margin: -20px -20px 14px;
  height: 132px;
  border-radius: 15px 15px 0 0;
  overflow: hidden;
  background: linear-gradient(135deg, #e7f4f2, #d7ebe8);
  position: relative;
}
.case-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.summary {
  margin: 6px 0 0;
  color: #55707a;
  font-size: 13px;
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.summary.missing {
  color: #b08a2e;
  font-style: italic;
}
/* ── 代码分组 ───────────────────────────────────────────────── */
.code-group-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.code-dir {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  color: #0f8f83;
  background: #eaf5f3;
  border-radius: 6px;
  padding: 4px 8px;
}
.code-move {
  flex: none;
  border: 1px solid #d9e8e7;
  background: #fff;
  color: #49666d;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}
.code-move:disabled {
  color: #c3d0d2;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  /* 窄屏收回左右内边距，40px 在手机上太占地方 */
  .case-admin {
    padding: 88px 18px 32px;
  }
  .case-admin-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .head-actions {
    flex-wrap: wrap;
  }
  .form-tip {
    display: none;
  }
}
</style>
