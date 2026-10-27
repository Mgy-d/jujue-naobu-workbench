<!--
  第三阶段 · 研究方案 编辑组件（F 交付）

  契约来源：docs/mvp-scope-and-status.md 第 3 节「3 研究方案」验收标准
  —— 抽样/招募/测量/证据/分析计划对应；预检问卷和统计可执行，用户采用固定版本。

  - props：context / draft / upstream{competition,topic} / readOnly / issues
  - emits：update-draft（完整 draft 覆盖语义）、save-request（正式候选保存请求）
  - 本组件不 fetch、不读写 localStorage、不触碰全局 store；落盘由外壳完成。
  - 每次编辑以「当前 props.context」+「整份 draft」回传，外壳负责 revision 递增与陈旧事件拒绝。

  设计取舍见 docs/f-proposal-3-research-plan.md：
  不提供大段「方案正文」，把方案拆成互相对应、可预检的结构化字段。
  视觉沿用宿主 tokens.scss 的青绿体系，与前两阶段同密度、同间距。
-->
<template>
  <section class="rpe" :class="{ 'rpe--readonly': isReadOnly }">
    <header class="rpe-head">
      <div class="rpe-head__text">
        <h3 class="rpe-title">研究方案</h3>
        <p class="rpe-sub">
          把抽样、招募、测量、证据、分析这五块对齐：每个研究问题都要有变量和分析，每个变量都要说清数据从哪来、在第几页。
          本机标记后内容再改，需要重新标记；正式版本与阶段确认仍待服务器接入。
        </p>
      </div>
      <div class="rpe-head__status">
        <span v-if="isReadOnly" class="pill pill--lock">只读</span>
        <span v-else-if="issues.length" class="pill pill--warn" :title="issues.join('；')">
          待补充 {{ issues.length }} 项
        </span>
        <span v-else class="pill pill--ok">本机完整</span>
      </div>
    </header>

    <!-- 0. 上游：本方案基于哪个采用方向（只读） -->
    <section class="rpe-up">
      <div class="rpe-up__bar">
        <h4 class="rpe-h4">本方案基于</h4>
        <span class="rpe-up__src">第二阶段 · 本机拟选方向（未正式采用，只读）</span>
      </div>

      <p v-if="!upstream.topic" class="rpe-up__warn">
        外壳未传入第二阶段结果，无法确认本方案基于哪个方向。可以先写方案，但正式检查会提示缺项。
      </p>
      <p v-else-if="!upstream.topic.selectedDirectionId" class="rpe-up__warn">
        第二阶段尚未在本机拟选方向，本方案还没有依据。建议先回去选定一个方向。
      </p>
      <template v-else>
        <div class="rpe-up__row">
          <p class="rpe-up__name">{{ selectedDirectionTitle }}</p>
          <p v-if="selectedDirectionQuestion" class="rpe-up__q">{{ selectedDirectionQuestion }}</p>
        </div>
        <p v-if="directionDrifted" class="rpe-up__warn">
          本方案记录的方向已不是当前本机拟选方向。
          <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="alignDirection">
            对齐到当前方向
          </button>
        </p>
        <p v-else-if="!draft.directionId" class="rpe-up__warn">
          尚未记录本方案基于哪个方向。
          <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="alignDirection">
            记为当前方向
          </button>
        </p>
      </template>

      <p v-if="sourceOptions.length" class="rpe-note">
        第一阶段有 {{ sourceOptions.length }} 条来源，可用于「已有资料」类变量的溯源。
      </p>
    </section>

    <!-- 1. 研究问题 -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">
          研究问题
          <span class="rpe-h4__count">共 {{ draft.researchQuestions.length }} 个</span>
        </h4>
        <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="addQuestion">
          新增问题
        </button>
      </div>

      <p v-if="!draft.researchQuestions.length" class="empty-hint">
        尚未记录研究问题。方案要回答的就是这里的问题，先把它们写出来，后面才有变量和分析可挂。
      </p>

      <ul v-else class="rpe-list">
        <li v-for="(question, index) in draft.researchQuestions" :key="question.id" class="rpe-item">
          <div class="rpe-item__head">
            <span class="rpe-item__no">Q{{ index + 1 }}</span>
            <span class="rpe-item__meta">
              {{ question.measureIds.length }} 个变量 · {{ analysesOfQuestion(question.id).length }} 条分析
            </span>
            <button
              type="button"
              class="rpe-remove"
              :disabled="isReadOnly"
              :aria-label="`删除问题 Q${index + 1}`"
              @click="removeQuestion(question.id)"
            >
              删除
            </button>
          </div>

          <label class="rpe-field">
            <span class="rpe-label">问题正文</span>
            <textarea
              class="rpe-input rpe-textarea"
              rows="2"
              :value="question.text"
              :readonly="isReadOnly"
              placeholder="一句话、能用数据回答的问题，例如：本校本科生在什么时段最缺自习座位，缺口有多大？"
              @input="onQuestionTextInput(question.id, $event)"
            />
          </label>

          <div class="rpe-field">
            <span class="rpe-label">这个问题用哪些变量回答</span>
            <div class="rpe-chips">
              <span v-if="!draft.measures.length" class="rpe-note">还没有变量，先在下方「测量与变量」里新增。</span>
              <label
                v-for="measure in draft.measures"
                :key="measure.id"
                class="rpe-chip"
                :class="{ 'rpe-chip--on': question.measureIds.includes(measure.id) }"
              >
                <input
                  type="checkbox"
                  :checked="question.measureIds.includes(measure.id)"
                  :disabled="isReadOnly"
                  @change="toggleQuestionMeasure(question.id, measure.id)"
                />
                <span>{{ measure.name.trim() || '未命名变量' }}</span>
              </label>
            </div>
          </div>

          <p v-if="questionIssue(question)" class="rpe-inline-warn">{{ questionIssue(question) }}</p>
        </li>
      </ul>
    </section>

    <!-- 2. 抽样 -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">抽样</h4>
        <span class="rpe-block__hint">抽样框回答「从哪份名单取人」，不是「怎么找到人」</span>
      </div>

      <div class="rpe-grid2">
        <label class="rpe-field">
          <span class="rpe-label">分析单位</span>
          <input
            class="rpe-input"
            type="text"
            :value="draft.sampling.unit"
            :readonly="isReadOnly"
            placeholder="例如：一位在校本科生"
            @input="onSamplingInput('unit', $event)"
          />
        </label>

        <label class="rpe-field">
          <span class="rpe-label">抽样方法</span>
          <select
            class="rpe-input rpe-select"
            :value="draft.sampling.method"
            :disabled="isReadOnly"
            @change="onSamplingMethodChange($event)"
          >
            <option v-for="option in samplingOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span class="rpe-note">{{ samplingHint }}</span>
        </label>
      </div>

      <label class="rpe-field">
        <span class="rpe-label">抽样框</span>
        <textarea
          class="rpe-input rpe-textarea"
          rows="2"
          :value="draft.sampling.frame"
          :readonly="isReadOnly"
          placeholder="例如：学工系统导出的在册本科生名单（脱敏后共 12,400 人）"
          @input="onSamplingInput('frame', $event)"
        />
      </label>

      <div class="rpe-grid2">
        <label class="rpe-field">
          <span class="rpe-label">预期有效样本量</span>
          <input
            class="rpe-input"
            type="number"
            min="1"
            step="1"
            :value="draft.sampling.targetSize === null ? '' : String(draft.sampling.targetSize)"
            :readonly="isReadOnly"
            placeholder="尚未估计"
            @input="onTargetSizeInput($event)"
          />
          <span class="rpe-note">预期值，不是实际回收数；实际数以正式调查结果为准。</span>
        </label>

        <label class="rpe-field">
          <span class="rpe-label">覆盖范围之外</span>
          <input
            class="rpe-input"
            type="text"
            :value="draft.sampling.coverageNote"
            :readonly="isReadOnly"
            placeholder="例如：只覆盖在校住宿生，走读生不在名单内"
            @input="onSamplingInput('coverageNote', $event)"
          />
        </label>
      </div>

      <label class="rpe-field">
        <span class="rpe-label">结论能推广到谁、不能推广到谁</span>
        <textarea
          class="rpe-input rpe-textarea"
          rows="2"
          :value="draft.sampling.inferenceScope"
          :readonly="isReadOnly"
          placeholder="例如：可外推到本校在册本科生；不能代表全国大学生，也不能代表已毕业人群"
          @input="onSamplingInput('inferenceScope', $event)"
        />
        <span v-if="samplingIsNonProbability" class="rpe-note rpe-note--warn">
          当前是非概率抽样，结论不能外推到总体，请在这里写清边界。
        </span>
      </label>
    </section>

    <!-- 3. 招募 -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">
          招募
          <span class="rpe-h4__count">{{ draft.recruitment.channels.length }} 个渠道</span>
        </h4>
        <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="addChannel">
          新增渠道
        </button>
      </div>

      <p v-if="!draft.recruitment.channels.length" class="empty-hint">
        尚未记录招募渠道。写清实际用哪些渠道接触受访者，以及渠道本身会带来什么偏差。
      </p>

      <ul v-else class="rpe-channels">
        <li v-for="(channel, index) in draft.recruitment.channels" :key="`ch-${index}`" class="rpe-channel">
          <input
            class="rpe-input"
            type="text"
            :value="channel"
            :readonly="isReadOnly"
            :placeholder="channelPlaceholder(index)"
            @input="onChannelInput(index, $event)"
          />
          <button
            type="button"
            class="rpe-remove"
            :disabled="isReadOnly"
            :aria-label="`删除渠道 ${index + 1}`"
            @click="removeChannel(index)"
          >
            删除
          </button>
        </li>
      </ul>

      <div class="rpe-grid2">
        <label class="rpe-field">
          <span class="rpe-label">筛选条件</span>
          <input
            class="rpe-input"
            type="text"
            :value="draft.recruitment.screening"
            :readonly="isReadOnly"
            placeholder="例如：本校在读本科生，本学期有图书馆自习经历"
            @input="onRecruitmentInput('screening', $event)"
          />
        </label>

        <label class="rpe-field">
          <span class="rpe-label">激励方式</span>
          <input
            class="rpe-input"
            type="text"
            :value="draft.recruitment.incentive"
            :readonly="isReadOnly"
            placeholder="例如：无 / 抽奖小礼品 / 课程加分"
            @input="onRecruitmentInput('incentive', $event)"
          />
        </label>
      </div>

      <div class="rpe-grid2">
        <label class="rpe-field">
          <span class="rpe-label">招募开始</span>
          <input
            class="rpe-input"
            type="date"
            :value="draft.recruitment.windowStart"
            :readonly="isReadOnly"
            @input="onRecruitmentInput('windowStart', $event)"
          />
        </label>

        <label class="rpe-field">
          <span class="rpe-label">招募结束</span>
          <input
            class="rpe-input"
            type="date"
            :value="draft.recruitment.windowEnd"
            :readonly="isReadOnly"
            @input="onRecruitmentInput('windowEnd', $event)"
          />
        </label>
      </div>

      <label class="rpe-field">
        <span class="rpe-label">渠道带来的自选择偏差</span>
        <textarea
          class="rpe-input rpe-textarea"
          rows="2"
          :value="draft.recruitment.biasNote"
          :readonly="isReadOnly"
          placeholder="例如：只在班级群发，会偏向高频使用手机的活跃学生"
          @input="onRecruitmentInput('biasNote', $event)"
        />
      </label>
    </section>

    <!-- 4. 测量与变量（含证据来源） -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">
          测量与变量
          <span class="rpe-h4__count">共 {{ draft.measures.length }} 个</span>
        </h4>
        <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="addMeasure">
          新增变量
        </button>
      </div>

      <p v-if="!draft.measures.length" class="empty-hint">
        尚未记录变量。每个变量要说清测量尺度（决定能算什么统计）、数据从哪来、以及在第几页可以核对。
      </p>

      <ul v-else class="rpe-list">
        <li v-for="(measure, index) in draft.measures" :key="measure.id" class="rpe-item">
          <div class="rpe-item__head">
            <span class="rpe-item__no">M{{ index + 1 }}</span>
            <span class="rpe-item__meta">{{ levelLabel(measure.level) }} · {{ instrumentLabel(measure.instrument) }}</span>
            <button
              type="button"
              class="rpe-remove"
              :disabled="isReadOnly"
              :aria-label="`删除变量 M${index + 1}`"
              @click="removeMeasure(measure.id)"
            >
              删除
            </button>
          </div>

          <div class="rpe-grid2">
            <label class="rpe-field">
              <span class="rpe-label">变量名</span>
              <input
                class="rpe-input"
                type="text"
                :value="measure.name"
                :readonly="isReadOnly"
                placeholder="例如：每周自习小时数"
                @input="onMeasureInput(measure.id, 'name', $event)"
              />
            </label>

            <label class="rpe-field">
              <span class="rpe-label">测量什么构念</span>
              <input
                class="rpe-input"
                type="text"
                :value="measure.construct"
                :readonly="isReadOnly"
                placeholder="例如：自习投入强度"
                @input="onMeasureInput(measure.id, 'construct', $event)"
              />
            </label>
          </div>

          <div class="rpe-grid2">
            <label class="rpe-field">
              <span class="rpe-label">测量尺度</span>
              <select
                class="rpe-input rpe-select"
                :value="measure.level"
                :disabled="isReadOnly"
                @change="onMeasureLevelChange(measure.id, $event)"
              >
                <option v-for="option in levelOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="rpe-note">{{ levelHint(measure.level) }}</span>
            </label>

            <label class="rpe-field">
              <span class="rpe-label">数据来源</span>
              <select
                class="rpe-input rpe-select"
                :value="measure.instrument"
                :disabled="isReadOnly"
                @change="onMeasureInstrumentChange(measure.id, $event)"
              >
                <option v-for="option in instrumentOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="rpe-note">{{ instrumentHint(measure.instrument) }}</span>
            </label>
          </div>

          <template v-if="measure.instrument === 'existing'">
            <div class="rpe-field">
              <span class="rpe-label">引用的第一阶段来源</span>
              <div class="rpe-chips">
                <span v-if="!sourceOptions.length" class="rpe-note">
                  第一阶段还没有记录来源，已有资料类变量无法溯源。
                </span>
                <label
                  v-for="source in sourceOptions"
                  :key="source.sourceId"
                  class="rpe-chip"
                  :class="{ 'rpe-chip--on': measure.sourceIds.includes(source.sourceId) }"
                >
                  <input
                    type="checkbox"
                    :checked="measure.sourceIds.includes(source.sourceId)"
                    :disabled="isReadOnly"
                    @change="toggleMeasureSource(measure.id, source.sourceId)"
                  />
                  <span>{{ sourceLabel(source) }}</span>
                </label>
                <label v-for="(sourceId, missingIndex) in missingSourceIds(measure)" :key="'missing-'+sourceId" class="rpe-chip rpe-chip--on">
                  <input type="checkbox" :checked="true" :disabled="isReadOnly" :aria-label="'移除失效来源关联 '+(missingIndex+1)" @change="toggleMeasureSource(measure.id,sourceId)" />
                  <span>来源已删除（取消勾选以移除关联）</span>
                </label>
              </div>
            </div>

            <label class="rpe-field">
              <span class="rpe-label">定位（页／表／字段）</span>
              <input
                class="rpe-input"
                type="text"
                :value="measure.locator"
                :readonly="isReadOnly"
                placeholder="例如：2025 年图书馆年报 第 12 页 表 3「分时段入馆人次」"
                @input="onMeasureInput(measure.id, 'locator', $event)"
              />
            </label>
          </template>

          <label class="rpe-field">
            <span class="rpe-label">{{ hintLabel(measure.instrument) }}</span>
            <textarea
              class="rpe-input rpe-textarea"
              rows="2"
              :value="measure.questionHint"
              :readonly="isReadOnly"
              :placeholder="hintPlaceholder(measure.instrument)"
              @input="onMeasureInput(measure.id, 'questionHint', $event)"
            />
            <span v-if="measure.instrument === 'questionnaire'" class="rpe-note">
              阶段 4 据此建题；已绑定题目：{{ measure.questionIds.length }} 道（本阶段只读，由阶段 4 回填）。
            </span>
          </label>

          <p v-if="measureIssue(measure)" class="rpe-inline-warn">{{ measureIssue(measure) }}</p>
        </li>
      </ul>
    </section>

    <!-- 5. 分析计划 -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">
          分析计划
          <span class="rpe-h4__count">共 {{ draft.analyses.length }} 条</span>
        </h4>
        <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="addAnalysis">
          新增分析
        </button>
      </div>

      <p v-if="!draft.researchQuestions.length" class="empty-hint">
        还没有研究问题，分析没有可对应的对象。先在上面写研究问题。
      </p>
      <p v-else-if="!draft.analyses.length" class="empty-hint">
        尚未记录分析计划。每个研究问题至少要有一条分析，否则问题无法落地。
      </p>

      <ul v-else class="rpe-list">
        <li
          v-for="(analysis, index) in draft.analyses"
          :key="analysis.id"
          class="rpe-item"
          :class="{ 'rpe-item--blocked': precheckOf(analysis).status === 'blocked' }"
        >
          <div class="rpe-item__head">
            <span class="rpe-item__no">A{{ index + 1 }}</span>
            <span class="rpe-item__meta">{{ analysisLabel(analysis.method) }}</span>
            <span class="rpe-badge" :class="precheckClass(analysis)">{{ precheckText(analysis) }}</span>
            <button
              type="button"
              class="rpe-remove"
              :disabled="isReadOnly"
              :aria-label="`删除分析 A${index + 1}`"
              @click="removeAnalysis(analysis.id)"
            >
              删除
            </button>
          </div>

          <div class="rpe-grid2">
            <label class="rpe-field">
              <span class="rpe-label">对应研究问题</span>
              <select
                class="rpe-input rpe-select"
                :value="analysis.questionId"
                :disabled="isReadOnly"
                @change="onAnalysisQuestionChange(analysis.id, $event)"
              >
                <option value="">（未选择）</option>
                <option v-for="(question, qIndex) in draft.researchQuestions" :key="question.id" :value="question.id">
                  Q{{ qIndex + 1 }} {{ question.text.trim().slice(0, 24) || '未填写' }}
                </option>
              </select>
            </label>

            <label class="rpe-field">
              <span class="rpe-label">分析方法</span>
              <select
                class="rpe-input rpe-select"
                :value="analysis.method"
                :disabled="isReadOnly"
                @change="onAnalysisMethodChange(analysis.id, $event)"
              >
                <option v-for="option in analysisOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="rpe-note">要求：{{ analysisNeed(analysis.method) }}</span>
            </label>
          </div>

          <div class="rpe-field">
            <span class="rpe-label">用哪些变量</span>
            <div class="rpe-chips">
              <span v-if="!measuresOfQuestion(analysis.questionId).length" class="rpe-note">
                该问题还没有挂变量，先在上方「研究问题」里勾选。
              </span>
              <label
                v-for="measure in measuresOfQuestion(analysis.questionId)"
                :key="measure.id"
                class="rpe-chip"
                :class="{ 'rpe-chip--on': analysis.measureIds.includes(measure.id) }"
              >
                <input
                  type="checkbox"
                  :checked="analysis.measureIds.includes(measure.id)"
                  :disabled="isReadOnly"
                  @change="toggleAnalysisMeasure(analysis.id, measure.id)"
                />
                <span>{{ measure.name.trim() || '未命名变量' }}（{{ levelLabel(measure.level) }}）</span>
              </label>
            </div>
          </div>

          <label class="rpe-field">
            <span class="rpe-label">预期产出</span>
            <input
              class="rpe-input"
              type="text"
              :value="analysis.expectedOutput"
              :readonly="isReadOnly"
              placeholder="例如：一张分时段的自习座位缺口表 + 一张折线图"
              @input="onAnalysisOutputInput(analysis.id, $event)"
            />
          </label>

          <div v-if="precheckOf(analysis).messages.length" class="rpe-precheck">
            <p v-for="(message, mIndex) in precheckOf(analysis).messages" :key="`m-${mIndex}`" class="rpe-precheck__line">
              {{ message }}
            </p>
          </div>

          <label v-if="precheckOf(analysis).status === 'blocked'" class="rpe-field">
            <span class="rpe-label">补救说明（不可执行时必填）</span>
            <textarea
              class="rpe-input rpe-textarea"
              rows="2"
              :value="analysis.fallbackNote"
              :readonly="isReadOnly"
              placeholder="例如：改为对两个分类变量做交叉表，或先补采每周自习小时数这个数值变量"
              @input="onAnalysisFallbackInput(analysis.id, $event)"
            />
          </label>
        </li>
      </ul>
    </section>

    <!-- 6. 本机预检 -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">本机预检</h4>
        <span class="rpe-block__hint">这里只判断「缺什么、可不可执行」，不判断方案好不好</span>
      </div>

      <div class="rpe-check">
        <div class="rpe-check__group">
          <p class="rpe-check__title">
            对应关系
            <span class="rpe-check__count" :class="{ 'rpe-check__count--bad': check.correspondence.length }">
              {{ check.correspondence.length }}
            </span>
          </p>
          <p v-if="!check.correspondence.length" class="rpe-check__ok">五块对应关系已齐备。</p>
          <ul v-else class="rpe-check__list">
            <li v-for="(item, index) in check.correspondence" :key="`c-${index}`">{{ item }}</li>
          </ul>
        </div>

        <div class="rpe-check__group">
          <p class="rpe-check__title">
            统计可执行
            <span class="rpe-check__count" :class="{ 'rpe-check__count--bad': check.statistics.length }">
              {{ check.statistics.length }}
            </span>
          </p>
          <p v-if="!check.statistics.length" class="rpe-check__ok">没有发现不可执行的分析。</p>
          <ul v-else class="rpe-check__list">
            <li v-for="(item, index) in check.statistics" :key="`s-${index}`">{{ item }}</li>
          </ul>
        </div>

        <div class="rpe-check__group">
          <p class="rpe-check__title">
            问卷可测
            <span class="rpe-check__count" :class="{ 'rpe-check__count--bad': check.questionnaire.length }">
              {{ check.questionnaire.length }}
            </span>
          </p>
          <p v-if="!check.questionnaire.length" class="rpe-check__ok">问卷类变量都能在阶段 4 建题。</p>
          <ul v-else class="rpe-check__list">
            <li v-for="(item, index) in check.questionnaire" :key="`q-${index}`">{{ item }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 7. 采用（固定版本） -->
    <section class="rpe-block">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">本机方案标记</h4>
        <span class="rpe-badge" :class="adoptBadgeClass">{{ adoptText }}</span>
      </div>

      <p class="rpe-note">
        本机标记会记录当前内容的指纹，用于发现后续修改；它不是服务器固定版本，也不代表正式采用或阶段确认。
      </p>

      <div class="rpe-adopt">
        <button
          v-if="adoptState !== 'adopted'"
          type="button"
          class="btn rpe-btn-sm"
          :disabled="isReadOnly"
          @click="adoptCurrent"
        >
          {{ adoptState === 'drifted' ? '重新标记（内容已变更）' : '本机标记当前方案' }}
        </button>
        <span v-if="draft.adoption.signature" class="rpe-adopt__sig">
          {{ adoptState === 'adopted' ? '当前内容已在本机标记' : '上次本机标记的指纹' }} {{ draft.adoption.signature }}
        </span>
      </div>

      <label class="rpe-field">
        <span class="rpe-label">本机标记理由</span>
        <textarea
          class="rpe-input rpe-textarea"
          rows="2"
          :value="draft.adoption.note"
          :readonly="isReadOnly"
          placeholder="例如：这套抽样与测量能在学期内完成，且每个问题都有对应分析"
          @input="onAdoptionNoteInput"
        />
      </label>

      <label class="rpe-field">
        <span class="rpe-label">其他说明</span>
        <textarea
          class="rpe-input rpe-textarea"
          rows="3"
          :value="draft.otherNote"
          :readonly="isReadOnly"
          placeholder="无法归入以上字段的补充，例如伦理审查、数据保存方式、分工"
          @input="onOtherNoteInput"
        />
      </label>
    </section>

    <!-- 8. 未知项 -->
    <section class="rpe-block rpe-block--last">
      <div class="rpe-block__bar">
        <h4 class="rpe-h4">
          未知项
          <span class="rpe-h4__count">{{ draft.unknowns.length }} 条</span>
        </h4>
        <button type="button" class="btn rpe-btn-sm" :disabled="isReadOnly" @click="addUnknown">
          新增未知项
        </button>
      </div>

      <p v-if="!draft.unknowns.length" class="empty-hint">
        没有记录未知项。如果确实都清楚了，可以留空；有没答复的事就写在这里，并标明是否影响当前决定。
      </p>

      <ul v-else class="rpe-unknowns">
        <li v-for="(item, index) in draft.unknowns" :key="item.id" class="rpe-unknown">
          <span class="rpe-unknown__no">U{{ index + 1 }}</span>
          <input
            class="rpe-input rpe-unknown__input"
            type="text"
            :value="item.text"
            :readonly="isReadOnly"
            placeholder="例如：图书馆预约系统数据能否导出，尚未答复"
            @input="onUnknownTextInput(item.id, $event)"
          />
          <label class="rpe-switch">
            <input
              type="checkbox"
              :checked="item.blocksDecision"
              :disabled="isReadOnly"
              @change="toggleUnknownBlocks(item.id)"
            />
            <span>影响当前决定</span>
          </label>
          <button
            type="button"
            class="rpe-remove"
            :disabled="isReadOnly"
            :aria-label="`删除未知项 U${index + 1}`"
            @click="removeUnknown(item.id)"
          >
            删除
          </button>
        </li>
      </ul>
    </section>

    <footer v-if="!isReadOnly" class="rpe-footer">
      <button type="button" class="btn" @click="requestCandidate">提交为正式候选</button>
      <span class="rpe-footer__note">
        正式保存要求后端接口；本机保存请用外壳的保存按钮。当前不会假装保存成功。
      </span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import type { ContestSource } from '../../types/research-contracts'
import {
  ANALYSIS_OPTIONS,
  INSTRUMENT_OPTIONS,
  MEASURE_LEVEL_OPTIONS,
  SAMPLING_OPTIONS,
  adoptionState as resolveAdoptionState,
  analysisLabel,
  checkPlanDraft,
  instrumentLabel,
  levelLabel,
  planSignature,
  precheckAnalysis,
  precheckStatusLabel,
  type AnalysisMethod,
  type AnalysisPrecheck,
  type MeasureInstrument,
  type MeasureLevel,
  type PlanAnalysis,
  type PlanActionRequest,
  type PlanDraftUpdate,
  type PlanMeasure,
  type PlanQuestion,
  type ResearchPlanDraft,
  type ResearchPlanEditorProps,
  type SamplingMethod,
} from './plan-contract'

const props = defineProps<ResearchPlanEditorProps>()

const emit = defineEmits<{
  'update-draft': [value: PlanDraftUpdate]
  'save-request': [value: PlanActionRequest]
}>()

const isReadOnly = computed(() => props.readOnly === true)
const samplingOptions = SAMPLING_OPTIONS
const levelOptions = MEASURE_LEVEL_OPTIONS
const instrumentOptions = INSTRUMENT_OPTIONS
const analysisOptions = ANALYSIS_OPTIONS

// ── 写出口（与第一、二阶段同一套合并提交）──────────────────────────────────
/**
 * 外壳以 `localTaskId + revision` 判定事件是否陈旧，revision 要等回传才更新。
 * 同一轮连发两次第二次仍带旧 revision，会被当作陈旧事件丢弃，所以合并成一次 emit。
 */
let pendingDraft: ResearchPlanDraft | null = null
let flushScheduled = false

function commit(patch: Partial<ResearchPlanDraft>) {
  if (isReadOnly.value) return
  pendingDraft = { ...(pendingDraft ?? props.draft), ...patch }
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(flushDraft)
}

function flushDraft() {
  flushScheduled = false
  const draft = pendingDraft
  pendingDraft = null
  if (!draft) return
  emit('update-draft', { context: { ...props.context }, draft })
}

/** 合并提交期间 pendingDraft 才是权威值；读 props.draft 会把同轮的前一次改动覆盖回去。 */
function currentDraft(): ResearchPlanDraft {
  return pendingDraft ?? props.draft
}

function textOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// ── 上游 ────────────────────────────────────────────────────────────────
const sourceOptions = computed<ContestSource[]>(() => props.upstream.competition?.sources ?? [])

const selectedDirection = computed(() => {
  const topic = props.upstream.topic
  if (!topic?.selectedDirectionId) return null
  return topic.directions.find((item) => item.id === topic.selectedDirectionId) ?? null
})

const selectedDirectionTitle = computed(() => {
  if (!props.upstream.topic?.selectedDirectionId) return ''
  return selectedDirection.value?.title.trim() || '未命名方向'
})

const selectedDirectionQuestion = computed(() => selectedDirection.value?.question.trim() ?? '')

const directionDrifted = computed(() => {
  const current = props.upstream.topic?.selectedDirectionId
  return Boolean(current) && Boolean(props.draft.directionId) && props.draft.directionId !== current
})

function alignDirection() {
  const target = props.upstream.topic?.selectedDirectionId
  if (!target) return
  commit({ directionId: target })
}

function sourceLabel(source: ContestSource): string {
  const text = source.title.trim() || '未命名来源'
  return text.length > 16 ? `${text.slice(0, 16)}…` : text
}

// ── 研究问题 ────────────────────────────────────────────────────────────
function addQuestion() {
  const next: PlanQuestion = { id: uid('q'), text: '', measureIds: [] }
  commit({ researchQuestions: [...currentDraft().researchQuestions, next] })
}

function removeQuestion(id: string) {
  const draft = currentDraft()
  commit({
    researchQuestions: draft.researchQuestions.filter((item) => item.id !== id),
    // 问题被删，挂在它下面的分析一并移除，避免留下悬空 questionId
    analyses: draft.analyses.filter((item) => item.questionId !== id),
  })
}

function onQuestionTextInput(id: string, event: Event) {
  const text = textOf(event)
  commit({
    researchQuestions: currentDraft().researchQuestions.map((item) => (item.id === id ? { ...item, text } : item)),
  })
}

function toggleQuestionMeasure(questionId: string, measureId: string) {
  const draft = currentDraft()
  const target = draft.researchQuestions.find((item) => item.id === questionId)
  if (!target) return
  const measureIds = target.measureIds.includes(measureId)
    ? target.measureIds.filter((value) => value !== measureId)
    : [...target.measureIds, measureId]
  commit({
    researchQuestions: draft.researchQuestions.map((item) => (item.id === questionId ? { ...item, measureIds } : item)),
    // 从问题里摘掉变量时，同步从该问题的分析里摘掉，保持子集关系
    analyses: draft.analyses.map((item) =>
      item.questionId === questionId && !measureIds.includes(item.id)
        ? { ...item, measureIds: item.measureIds.filter((value) => value !== measureId) }
        : item,
    ),
  })
}

function analysesOfQuestion(questionId: string): PlanAnalysis[] {
  return props.draft.analyses.filter((item) => item.questionId === questionId)
}

function questionIssue(question: PlanQuestion): string {
  if (!question.text.trim()) return '问题正文为空。'
  if (!question.measureIds.length) return '这个问题还没有挂变量，无法设计测量。'
  if (!analysesOfQuestion(question.id).length) return '这个问题还没有分析计划，问题会落不了地。'
  return ''
}

// ── 抽样 ────────────────────────────────────────────────────────────────
function patchSampling(patch: Partial<ResearchPlanDraft['sampling']>) {
  commit({ sampling: { ...currentDraft().sampling, ...patch } })
}

function onSamplingInput(key: 'unit' | 'frame' | 'coverageNote' | 'inferenceScope', event: Event) {
  patchSampling({ [key]: textOf(event) } as Partial<ResearchPlanDraft['sampling']>)
}

function onSamplingMethodChange(event: Event) {
  const value = textOf(event) as SamplingMethod
  const allowed = SAMPLING_OPTIONS.some((option) => option.value === value)
  patchSampling({ method: allowed ? value : 'unknown' })
}

function onTargetSizeInput(event: Event) {
  const raw = textOf(event).trim()
  if (!raw) {
    patchSampling({ targetSize: null })
    return
  }
  const parsed = Number(raw)
  patchSampling({ targetSize: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null })
}

const samplingHint = computed(() => SAMPLING_OPTIONS.find((item) => item.value === props.draft.sampling.method)?.hint ?? '')

const samplingIsNonProbability = computed(() => {
  const option = SAMPLING_OPTIONS.find((item) => item.value === props.draft.sampling.method)
  return Boolean(option) && !option!.probability && props.draft.sampling.method !== 'unknown'
})

// ── 招募 ────────────────────────────────────────────────────────────────
function patchRecruitment(patch: Partial<ResearchPlanDraft['recruitment']>) {
  commit({ recruitment: { ...currentDraft().recruitment, ...patch } })
}

function onRecruitmentInput(key: 'screening' | 'incentive' | 'windowStart' | 'windowEnd' | 'biasNote', event: Event) {
  patchRecruitment({ [key]: textOf(event) } as Partial<ResearchPlanDraft['recruitment']>)
}

function addChannel() {
  commit({ recruitment: { ...currentDraft().recruitment, channels: [...currentDraft().recruitment.channels, ''] } })
}

function removeChannel(index: number) {
  const channels = currentDraft().recruitment.channels.filter((_, i) => i !== index)
  commit({ recruitment: { ...currentDraft().recruitment, channels } })
}

function onChannelInput(index: number, event: Event) {
  const value = textOf(event)
  const channels = currentDraft().recruitment.channels.map((item, i) => (i === index ? value : item))
  commit({ recruitment: { ...currentDraft().recruitment, channels } })
}

function channelPlaceholder(index: number): string {
  const samples = ['例如：班级群 / 年级群', '例如：图书馆门口线下拦截', '例如：学生会公众号推送', '例如：任课老师课堂通知']
  return samples[index] ?? '例如：其他渠道'
}

// ── 变量 ────────────────────────────────────────────────────────────────
function addMeasure() {
  const next: PlanMeasure = {
    id: uid('m'),
    name: '',
    construct: '',
    level: 'nominal',
    instrument: 'questionnaire',
    sourceIds: [],
    locator: '',
    questionHint: '',
    questionIds: [],
  }
  commit({ measures: [...currentDraft().measures, next] })
}

function removeMeasure(id: string) {
  const draft = currentDraft()
  commit({
    measures: draft.measures.filter((item) => item.id !== id),
    researchQuestions: draft.researchQuestions.map((item) => ({
      ...item,
      measureIds: item.measureIds.filter((value) => value !== id),
    })),
    analyses: draft.analyses.map((item) => ({
      ...item,
      measureIds: item.measureIds.filter((value) => value !== id),
    })),
  })
}

function onMeasureInput(id: string, key: 'name' | 'construct' | 'locator' | 'questionHint', event: Event) {
  const value = textOf(event)
  commit({
    measures: currentDraft().measures.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
  })
}

function onMeasureLevelChange(id: string, event: Event) {
  const value = textOf(event) as MeasureLevel
  const allowed = MEASURE_LEVEL_OPTIONS.some((option) => option.value === value)
  commit({
    measures: currentDraft().measures.map((item) =>
      item.id === id ? { ...item, level: allowed ? value : 'nominal' } : item,
    ),
  })
}

function onMeasureInstrumentChange(id: string, event: Event) {
  const value = textOf(event) as MeasureInstrument
  const allowed = INSTRUMENT_OPTIONS.some((option) => option.value === value)
  commit({
    measures: currentDraft().measures.map((item) =>
      item.id === id ? { ...item, instrument: allowed ? value : 'questionnaire' } : item,
    ),
  })
}

function missingSourceIds(measure: PlanMeasure) { const known = new Set(sourceOptions.value.map(source => source.sourceId)); return measure.sourceIds.filter(id => !known.has(id)) }

function toggleMeasureSource(measureId: string, sourceId: string) {
  const target = currentDraft().measures.find((item) => item.id === measureId)
  if (!target) return
  const sourceIds = target.sourceIds.includes(sourceId)
    ? target.sourceIds.filter((value) => value !== sourceId)
    : [...target.sourceIds, sourceId]
  commit({
    measures: currentDraft().measures.map((item) => (item.id === measureId ? { ...item, sourceIds } : item)),
  })
}

function measureIssue(measure: PlanMeasure): string {
  if (!measure.name.trim()) return '变量名为空。'
  if (!measure.construct.trim()) return '未说明这个变量测的是什么构念。'
  if (measure.instrument === 'existing' && !measure.sourceIds.length) return '取自已有资料，但没有指明来源。'
  if (measure.instrument === 'existing' && !measure.locator.trim()) return '取自已有资料，但没有写明定位（页／表／字段）。'
  if (measure.instrument === 'questionnaire' && !measure.questionHint.trim())
    return '走问卷采集，但没写拟测题目，阶段 4 无法据此建题。'
  return ''
}

function levelHint(value: MeasureLevel): string {
  return MEASURE_LEVEL_OPTIONS.find((item) => item.value === value)?.hint ?? ''
}

function instrumentHint(value: MeasureInstrument): string {
  return INSTRUMENT_OPTIONS.find((item) => item.value === value)?.hint ?? ''
}

/** 「取值口径」与「拟测题目」不是一回事，按数据来源换标签，避免已有资料被要求写题目。 */
function hintLabel(instrument: MeasureInstrument): string {
  if (instrument === 'existing') return '取值口径说明'
  if (instrument === 'interview') return '访谈提纲要点'
  if (instrument === 'observation') return '观察记录口径'
  return '拟测题目描述'
}

function hintPlaceholder(instrument: MeasureInstrument): string {
  if (instrument === 'existing') return '例如：按「分时段入馆人次」原值录入，单位为次／小时，缺失记为空'
  if (instrument === 'interview') return '例如：请受访者回忆上周哪几个时段找不到座位，追问具体星期与钟点'
  if (instrument === 'observation') return '例如：每天 8:00–22:00 每两小时记录一次空座数与在座人数'
  return '例如：请估计你上周在图书馆自习的总小时数（填空，整数）'
}

// ── 分析 ────────────────────────────────────────────────────────────────
function addAnalysis() {
  const first = currentDraft().researchQuestions[0]
  const next: PlanAnalysis = {
    id: uid('a'),
    questionId: first?.id ?? '',
    method: 'undecided',
    measureIds: [...(first?.measureIds ?? [])],
    expectedOutput: '',
    fallbackNote: '',
  }
  commit({ analyses: [...currentDraft().analyses, next] })
}

function removeAnalysis(id: string) {
  commit({ analyses: currentDraft().analyses.filter((item) => item.id !== id) })
}

function onAnalysisQuestionChange(id: string, event: Event) {
  const questionId = textOf(event)
  const draft = currentDraft()
  const question = draft.researchQuestions.find((item) => item.id === questionId)
  commit({
    analyses: draft.analyses.map((item) => {
      if (item.id !== id) return item
      // 换问题时只保留属于新问题的变量，维持「分析变量 ⊆ 问题变量」
      const allowed = question?.measureIds ?? []
      return { ...item, questionId, measureIds: item.measureIds.filter((value) => allowed.includes(value)) }
    }),
  })
}

function onAnalysisMethodChange(id: string, event: Event) {
  const value = textOf(event) as AnalysisMethod
  const allowed = ANALYSIS_OPTIONS.some((option) => option.value === value)
  commit({
    analyses: currentDraft().analyses.map((item) =>
      item.id === id ? { ...item, method: allowed ? value : 'undecided' } : item,
    ),
  })
}

function toggleAnalysisMeasure(analysisId: string, measureId: string) {
  const draft = currentDraft()
  const target = draft.analyses.find((item) => item.id === analysisId)
  if (!target) return
  const measureIds = target.measureIds.includes(measureId)
    ? target.measureIds.filter((value) => value !== measureId)
    : [...target.measureIds, measureId]
  commit({
    analyses: draft.analyses.map((item) => (item.id === analysisId ? { ...item, measureIds } : item)),
  })
}

function onAnalysisOutputInput(id: string, event: Event) {
  const expectedOutput = textOf(event)
  commit({
    analyses: currentDraft().analyses.map((item) => (item.id === id ? { ...item, expectedOutput } : item)),
  })
}

function onAnalysisFallbackInput(id: string, event: Event) {
  const fallbackNote = textOf(event)
  commit({
    analyses: currentDraft().analyses.map((item) => (item.id === id ? { ...item, fallbackNote } : item)),
  })
}

function measuresOfQuestion(questionId: string): PlanMeasure[] {
  const question = props.draft.researchQuestions.find((item) => item.id === questionId)
  if (!question) return []
  return props.draft.measures.filter((item) => question.measureIds.includes(item.id))
}

function precheckOf(analysis: PlanAnalysis): AnalysisPrecheck {
  return precheckAnalysis(analysis, props.draft.measures, props.draft.sampling.targetSize)
}

function precheckClass(analysis: PlanAnalysis): string {
  const status = precheckOf(analysis).status
  if (status === 'ok') return 'rpe-badge--ok'
  if (status === 'risky') return 'rpe-badge--warn'
  return 'rpe-badge--bad'
}

function precheckText(analysis: PlanAnalysis): string {
  return precheckStatusLabel(precheckOf(analysis).status)
}

function analysisNeed(method: AnalysisMethod): string {
  return ANALYSIS_OPTIONS.find((option) => option.value === method)?.need ?? '—'
}

// ── 预检 ────────────────────────────────────────────────────────────────
const check = computed(() => checkPlanDraft(props.draft, props.upstream))

// ── 采用 ────────────────────────────────────────────────────────────────
const adoptState = computed(() => resolveAdoptionState(props.draft))

const adoptText = computed(() => {
  if (adoptState.value === 'adopted') return '本机已标记'
  if (adoptState.value === 'drifted') return '内容已变更，需重新标记'
  return '尚未在本机标记'
})

const adoptBadgeClass = computed(() => {
  if (adoptState.value === 'adopted') return 'rpe-badge--ok'
  if (adoptState.value === 'drifted') return 'rpe-badge--warn'
  return 'rpe-badge--idle'
})

function adoptCurrent() {
  const draft = currentDraft()
  commit({ adoption: { ...draft.adoption, signature: planSignature(draft) } })
}

function onAdoptionNoteInput(event: Event) {
  const note = textOf(event)
  commit({ adoption: { ...currentDraft().adoption, note } })
}

function onOtherNoteInput(event: Event) {
  commit({ otherNote: textOf(event) })
}

// ── 未知项 ──────────────────────────────────────────────────────────────
function addUnknown() {
  commit({ unknowns: [...currentDraft().unknowns, { id: uid('unknown'), text: '', blocksDecision: false }] })
}

function removeUnknown(id: string) {
  commit({ unknowns: currentDraft().unknowns.filter((item) => item.id !== id) })
}

function onUnknownTextInput(id: string, event: Event) {
  const text = textOf(event)
  commit({ unknowns: currentDraft().unknowns.map((item) => (item.id === id ? { ...item, text } : item)) })
}

function toggleUnknownBlocks(id: string) {
  const target = currentDraft().unknowns.find((item) => item.id === id)
  if (!target) return
  commit({
    unknowns: currentDraft().unknowns.map((item) =>
      item.id === id ? { ...item, blocksDecision: !target.blocksDecision } : item,
    ),
  })
}

// ── 正式候选保存 ────────────────────────────────────────────────────────
/**
 * 先落盘本轮未提交的编辑，再等一次渲染把最新 revision 带回 props，然后才发保存请求。
 * 直接用旧 context 发 save-request 会被宿主判为陈旧请求而拒绝。
 */
async function requestCandidate() {
  if (isReadOnly.value) return
  flushDraft()
  await nextTick()
  emit('save-request', { context: { ...props.context } })
}
</script>

<style scoped>
.rpe {
  margin: 22px 0 6px;
  padding: 20px 22px 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  font-size: 13px;
  color: var(--c-ink);
}

.rpe--readonly {
  background: #fbfdfd;
}

/* 头部 */
.rpe-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--c-line);
}

.rpe-head__text {
  min-width: 0;
}

.rpe-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ink);
  letter-spacing: 0.01em;
}

.rpe-sub {
  margin: 0;
  max-width: 62em;
  font-size: 12px;
  line-height: 1.75;
  color: var(--c-muted);
}

.rpe-head__status {
  flex: none;
  padding-top: 2px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.pill--ok {
  background: var(--c-primary-soft);
  color: var(--c-primary-ink);
}

.pill--warn {
  background: var(--c-warn-soft);
  color: var(--c-warn-ink);
  border: 1px solid var(--c-warn-line);
}

.pill--lock {
  background: #eef1f4;
  color: var(--c-muted);
  border: 1px solid var(--c-line-strong);
}

/* 上游信息条 */
.rpe-up {
  margin: 14px 0 4px;
  padding: 12px 14px;
  background: #f7fbfa;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rpe-up__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.rpe-up__src {
  font-size: 11px;
  color: var(--c-muted);
}

.rpe-up__row {
  display: grid;
  gap: 4px;
}

.rpe-up__name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.rpe-up__q {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--c-ink-2);
}

.rpe-up__warn {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-warn-ink);
}

/* 区块 */
.rpe-block {
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--c-line);
}

.rpe-block--last {
  border-bottom: 0;
  padding-bottom: 4px;
}

.rpe-block__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.rpe-h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.rpe-h4__count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--c-muted);
}

.rpe-block__hint {
  font-size: 11px;
  color: var(--c-muted);
}

.rpe-btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

/* 字段 */
.rpe-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  /* 有提示文字的一侧不能把整行拉高，否则同排另一侧的输入框会被拉伸 */
  align-content: start;
}

.rpe-label {
  font-size: 12px;
  color: var(--c-ink-2);
}

.rpe-input {
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--c-ink);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.rpe-input::placeholder {
  color: #9db3b8;
}

.rpe-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}

.rpe-input:read-only,
.rpe-input:disabled {
  background: #f7fafa;
  color: var(--c-ink-2);
  cursor: default;
}

.rpe-textarea {
  resize: vertical;
  min-height: 52px;
}

.rpe-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--c-muted) 50%),
    linear-gradient(135deg, var(--c-muted) 50%, transparent 50%);
  background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 28px;
}

.rpe-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}

.rpe-note {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

.rpe-note--warn {
  color: var(--c-warn-ink);
}

.empty-hint {
  margin: 0 0 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.75;
  color: var(--c-muted);
  background: #f7f9fa;
  border: 1px dashed var(--c-line-strong);
  border-radius: var(--radius-sm);
}

/* 条目 */
.rpe-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.rpe-item {
  padding: 12px 14px;
  background: #fdfefe;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rpe-item--blocked {
  border-color: var(--c-warn-line);
  background: #fffdfa;
}

.rpe-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.rpe-item__no {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  padding: 1px 6px;
  border-radius: 4px;
}

.rpe-item__meta {
  font-size: 11px;
  color: var(--c-muted);
}

.rpe-item__head .rpe-remove {
  margin-left: auto;
}

.rpe-remove {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--c-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.rpe-remove:hover:not(:disabled) {
  color: var(--c-error);
  background: var(--c-error-soft);
  border-color: #f2c7c1;
}

.rpe-remove:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 勾选 chip */
.rpe-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rpe-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  font-size: 11px;
  color: var(--c-ink-2);
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rpe-chip input {
  margin: 0;
  accent-color: var(--c-primary);
}

.rpe-chip--on {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  border-color: #a9ded3;
}

.rpe-inline-warn {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-warn-ink);
}

/* 分析预检 */
.rpe-precheck {
  margin: 4px 0 10px;
  padding: 8px 10px;
  background: #f8fafb;
  border-left: 2px solid var(--c-line-strong);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.rpe-precheck__line {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-ink-2);
}

.rpe-precheck__line + .rpe-precheck__line {
  margin-top: 3px;
}

/* 状态徽标 */
.rpe-badge {
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.rpe-badge--ok {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
}

.rpe-badge--warn {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border: 1px solid var(--c-warn-line);
}

.rpe-badge--bad {
  color: var(--c-error);
  background: var(--c-error-soft);
  border: 1px solid #f2c7c1;
}

.rpe-badge--idle {
  color: var(--c-muted);
  background: #eef1f4;
  border: 1px solid var(--c-line-strong);
}

/* 预检汇总 */
.rpe-check {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.rpe-check__group {
  padding: 10px 12px;
  background: #f8fbfa;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rpe-check__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-ink);
}

.rpe-check__count {
  min-width: 20px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 999px;
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
}

.rpe-check__count--bad {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
}

.rpe-check__ok {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

.rpe-check__list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
}

.rpe-check__list li {
  font-size: 11px;
  line-height: 1.65;
  color: var(--c-ink-2);
}

/* 采用 */
.rpe-adopt {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 10px 0 14px;
}

.rpe-adopt__sig {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-muted);
}

/* 招募渠道 */
.rpe-channels {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.rpe-channel {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 未知项 */
.rpe-unknowns {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.rpe-unknown {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.rpe-unknown__no {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-muted);
}

.rpe-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--c-ink-2);
  white-space: nowrap;
  cursor: pointer;
}

.rpe-switch input {
  margin: 0;
  accent-color: var(--c-primary);
}

/* 底部 */
.rpe-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--c-line);
}

.rpe-footer__note {
  font-size: 11px;
  color: var(--c-muted);
}

@media (max-width: 900px) {
  .rpe-check {
    grid-template-columns: 1fr;
  }

  .rpe-grid2 {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .rpe-unknown {
    grid-template-columns: auto minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  /* 编号纵向跨两行居中；输入框占满右侧；开关与删除落在第二行并左对齐输入框 */
  .rpe-unknown__no {
    grid-row: 1 / span 2;
    align-self: center;
  }

  .rpe-unknown__input {
    grid-column: 2 / span 2;
  }

  .rpe-unknown .rpe-switch {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .rpe-unknown .rpe-remove {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
  }

  .rpe-block__bar {
    flex-wrap: wrap;
  }
}
</style>
