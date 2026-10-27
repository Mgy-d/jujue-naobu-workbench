<!--
  第四阶段 · 问卷设计与预测试 编辑组件（F 交付）

  契约来源：docs/mvp-scope-and-status.md 第 3 节「4 问卷设计与预测试」验收标准
  —— 编辑/核对/真实试填反馈/修订；正式问卷固定版本；无真实反馈不标预测试通过。

  - props：context / draft / upstream{plan} / readOnly / issues
  - emits：update-draft（完整 draft 覆盖语义）、save-request（正式候选保存请求）
  - 本组件不 fetch、不读写 localStorage、不触碰全局 store；落盘由外壳完成。
  - 不生成任何试填数据：轮次、人数、完成率都必须由用户录入真实发生过的值。

  设计取舍见 docs/f-proposal-4-questionnaire.md：
  预测试状态由证据推导（pretestState），不存 passed 布尔值；
  每轮记录「当轮试填的问卷指纹」，改过题就退回需重测。
-->
<template>
  <section class="rqe" :class="{ 'rqe--readonly': isReadOnly }">
    <header class="rqe-head">
      <div class="rqe-head__text">
        <h3 class="rqe-title">问卷设计与预测试</h3>
        <p class="rqe-sub">
          先按阶段 3 的问卷变量建题，再逐题核对措辞与选项，然后用真实受访者试填并记录发现。
          试填数据由你录入；本机只检查资料和内容是否对应，不核验试填真实性，也不生成服务器正式版本。
        </p>
      </div>
      <div class="rqe-head__status">
        <span v-if="isReadOnly" class="pill pill--lock">只读</span>
        <template v-else>
          <span class="pill" :class="pretestPillClass">{{ pretestLabel }}</span>
          <span v-if="issues.length" class="pill pill--warn" :title="issues.join('；')">待补充 {{ issues.length }} 项</span>
          <span v-else class="pill pill--ok">本机完整</span>
        </template>
      </div>
    </header>

    <!-- 0. 上游：阶段 3 的问卷类变量 -->
    <section class="rqe-up">
      <div class="rqe-up__bar">
        <h4 class="rqe-h4">本问卷要覆盖的变量</h4>
        <span class="rqe-up__src">第三阶段 · 本机问卷变量参考（未正式确认，只读）</span>
      </div>

      <p v-if="!upstream.plan" class="rqe-up__warn">
        当前是「已有问卷」快捷入口：外壳没有传入第三阶段方案，因此不检查变量对应。录入资料检查和本机内容标记照常使用，正式确认仍待接口。
      </p>
      <p v-else-if="!measures.length" class="rqe-up__warn">
        第三阶段没有标记为「问卷新采」的变量。若本问卷确实要采集数据，建议先回去补变量，否则阶段 6 无法核对字段。
      </p>
      <ul v-else class="rqe-up__list">
        <li v-for="measure in measures" :key="measure.id" class="rqe-up__item">
          <span class="rqe-up__name">{{ measure.name.trim() || '未命名变量' }}</span>
          <span class="rqe-up__level">{{ levelName(measure.level) }}</span>
          <span class="rqe-up__cover" :class="{ 'rqe-up__cover--done': countOfMeasure(measure.id) }">
            {{ countOfMeasure(measure.id) ? `已建 ${countOfMeasure(measure.id)} 题` : '未建题' }}
          </span>
          <span v-if="measure.questionHint.trim()" class="rqe-up__hint">拟测：{{ measure.questionHint }}</span>
        </li>
      </ul>
    </section>

    <!-- 1. 卷首信息 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">卷首信息</h4>
        <span class="rqe-block__hint">开场说明决定受访者愿不愿意继续答</span>
      </div>

      <label class="rqe-field">
        <span class="rqe-label">问卷标题</span>
        <input
          class="rqe-input"
          type="text"
          :value="draft.meta.title"
          :readonly="isReadOnly"
          aria-label="问卷标题"
          placeholder="例如：本校图书馆自习座位供需情况调查"
          @input="onMetaInput('title', $event)"
        />
      </label>

      <label class="rqe-field">
        <span class="rqe-label">开场说明</span>
        <textarea
          class="rqe-input rqe-textarea"
          rows="3"
          :value="draft.meta.intro"
          :readonly="isReadOnly"
          aria-label="开场说明"
          placeholder="例如：本问卷用于课程调研，匿名填写，约需 3 分钟，可随时退出，数据仅用于汇总分析。"
          @input="onMetaInput('intro', $event)"
        />
      </label>

      <div class="rqe-grid2">
        <label class="rqe-field">
          <span class="rqe-label">预估填答时长（分钟）</span>
          <input
            class="rqe-input"
            type="number"
            min="1"
            step="1"
            :value="draft.meta.estimatedMinutes === null ? '' : String(draft.meta.estimatedMinutes)"
            :readonly="isReadOnly"
            aria-label="预估填答时长"
            placeholder="尚未估计"
            @input="onEstimatedMinutesInput($event)"
          />
        </label>

        <div class="rqe-field">
          <span class="rqe-label">知情同意</span>
          <label class="rqe-switch">
            <input type="checkbox" :checked="draft.meta.consent" :disabled="isReadOnly" @change="toggleConsent" />
            <span>已在卷首声明数据用途、匿名与自愿退出</span>
          </label>
          <span class="rqe-note">平台内匿名调查必须先声明，未勾选会计入缺项。</span>
        </div>
      </div>

      <div class="rqe-grid2">
        <label class="rqe-field">
          <span class="rqe-label">匿名与数据保存说明</span>
          <input
            class="rqe-input"
            type="text"
            :value="draft.meta.anonymityNote"
            :readonly="isReadOnly"
            aria-label="匿名与数据保存说明"
            placeholder="例如：不采集姓名与学号，结果仅以汇总形式呈现"
            @input="onMetaInput('anonymityNote', $event)"
          />
        </label>

        <label class="rqe-field">
          <span class="rqe-label">结束语</span>
          <input
            class="rqe-input"
            type="text"
            :value="draft.meta.closeNote"
            :readonly="isReadOnly"
            aria-label="结束语"
            placeholder="例如：感谢填写，结果将于课程汇报中公布"
            @input="onMetaInput('closeNote', $event)"
          />
        </label>
      </div>
    </section>

    <!-- 2. 题目 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">
          题目
          <span class="rqe-h4__count">共 {{ draft.questions.length }} 题</span>
        </h4>
        <div class="rqe-add">
          <button
            v-for="option in questionTypeOptions"
            :key="option.value"
            type="button"
            class="btn rqe-btn-sm"
            :disabled="isReadOnly"
            :title="option.hint"
            @click="addQuestion(option.value)"
          >
            + {{ option.label }}
          </button>
        </div>
      </div>

      <p v-if="!draft.questions.length" class="empty-hint">
        还没有题目。先按上方变量建题：一个变量至少对应一道题，否则阶段 3 的分析拿不到数据。
      </p>

      <ul v-else class="rqe-list">
        <li v-for="(question, index) in draft.questions" :key="question.id" class="rqe-item">
          <div class="rqe-item__head">
            <span class="rqe-item__no">Q{{ index + 1 }}</span>
            <select
              class="rqe-input rqe-select rqe-select--mini"
              :value="question.type"
              :disabled="isReadOnly"
              :aria-label="`第 ${index + 1} 题题型`"
              @change="onQuestionTypeChange(question.id, $event)"
            >
              <option v-for="option in questionTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <label class="rqe-switch">
              <input type="checkbox" :checked="question.required" :disabled="isReadOnly" @change="toggleRequired(question.id)" />
              <span>必填</span>
            </label>
            <label class="rqe-switch">
              <input type="checkbox" :checked="question.screening" :disabled="isReadOnly" @change="toggleScreening(question.id)" />
              <span>筛选题</span>
            </label>
            <button
              type="button"
              class="rqe-remove"
              :disabled="isReadOnly"
              :aria-label="`删除第 ${index + 1} 题`"
              @click="removeQuestion(question.id)"
            >
              删除
            </button>
          </div>

          <label class="rqe-field">
            <span class="rqe-label">题干</span>
            <textarea
              class="rqe-input rqe-textarea"
              rows="2"
              :value="question.text"
              :readonly="isReadOnly"
              :aria-label="`第 ${index + 1} 题题干`"
              placeholder="写成能被回答的一句话，例如：你上周在图书馆找不到座位的次数大约是？"
              @input="onQuestionTextInput(question.id, $event)"
            />
          </label>

          <!-- 选项 -->
          <div v-if="question.type === 'single' || question.type === 'multi'" class="rqe-field">
            <span class="rqe-label">选项</span>
            <ul class="rqe-options">
              <li v-for="(option, optionIndex) in question.options" :key="option.id" class="rqe-option">
                <span class="rqe-option__no">{{ index + 1 }}.{{ optionIndex + 1 }}</span>
                <input
                  class="rqe-input"
                  type="text"
                  :value="option.label"
                  :readonly="isReadOnly"
                  :placeholder="optionPlaceholder(optionIndex)"
                  :aria-label="`第 ${index + 1} 题选项 ${optionIndex + 1}`"
                  @input="onOptionInput(question.id, option.id, 'label', $event)"
                />
                <input
                  class="rqe-input rqe-input--code"
                  type="text"
                  :value="option.code"
                  :readonly="isReadOnly"
                  placeholder="编码"
                  :aria-label="`第 ${index + 1} 题选项 ${optionIndex + 1} 编码`"
                  @input="onOptionInput(question.id, option.id, 'code', $event)"
                />
                <label class="rqe-switch" :title="'排他项：如「以上都不」'">
                  <input
                    type="checkbox"
                    :checked="option.exclusive"
                    :disabled="isReadOnly"
                    @change="toggleOptionFlag(question.id, option.id, 'exclusive')"
                  />
                  <span>排他</span>
                </label>
                <label class="rqe-switch" :title="'选此项时需填写文字'">
                  <input
                    type="checkbox"
                    :checked="option.openEnded"
                    :disabled="isReadOnly"
                    @change="toggleOptionFlag(question.id, option.id, 'openEnded')"
                  />
                  <span>需填写</span>
                </label>
                <button
                  type="button"
                  class="rqe-remove"
                  :disabled="isReadOnly"
                  :aria-label="`删除第 ${index + 1} 题选项 ${optionIndex + 1}`"
                  @click="removeOption(question.id, option.id)"
                >
                  删除
                </button>
              </li>
            </ul>
            <button type="button" class="btn rqe-btn-sm" :disabled="isReadOnly" @click="addOption(question.id)">
              + 新增选项
            </button>
          </div>

          <!-- 量表 -->
          <div v-if="question.type === 'scale' && question.scale" class="rqe-grid3">
            <label class="rqe-field">
              <span class="rqe-label">点数</span>
              <input
                class="rqe-input"
                type="number"
                min="2"
                step="1"
                :value="String(question.scale.points)"
                :readonly="isReadOnly"
                @input="onScalePointsInput(question.id, $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">起点标签</span>
              <input
                class="rqe-input"
                type="text"
                :value="question.scale.minLabel"
                :readonly="isReadOnly"
                placeholder="非常不同意"
                @input="onScaleLabelInput(question.id, 'minLabel', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">终点标签</span>
              <input
                class="rqe-input"
                type="text"
                :value="question.scale.maxLabel"
                :readonly="isReadOnly"
                placeholder="非常同意"
                @input="onScaleLabelInput(question.id, 'maxLabel', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">中点标签</span>
              <input
                class="rqe-input"
                type="text"
                :value="question.scale.midLabel"
                :readonly="isReadOnly"
                placeholder="一般（偶数点可留空）"
                @input="onScaleLabelInput(question.id, 'midLabel', $event)"
              />
            </label>
            <div class="rqe-field">
              <span class="rqe-label">出口选项</span>
              <label class="rqe-switch">
                <input
                  type="checkbox"
                  :checked="question.scale.hasDontKnow"
                  :disabled="isReadOnly"
                  @change="toggleScaleDontKnow(question.id)"
                />
                <span>提供「不知道／不适用」</span>
              </label>
            </div>
          </div>

          <div class="rqe-grid2">
            <label class="rqe-field">
              <span class="rqe-label">对应变量</span>
              <select
                class="rqe-input rqe-select"
                :value="question.measureId"
                :disabled="isReadOnly || !upstream.plan"
                :aria-label="`第 ${index + 1} 题对应变量`"
                @change="onMeasureChange(question.id, $event)"
              >
                <option value="">未挂变量</option>
                <option v-if="question.measureId && !measures.some(item=>item.id===question.measureId)" :value="question.measureId">原关联变量已删除或更改采集方式，请重新选择</option>
                <option v-for="measure in measures" :key="measure.id" :value="measure.id">
                  {{ measure.name.trim() || '未命名变量' }}（{{ levelName(measure.level) }}）
                </option>
              </select>
              <span v-if="measureHintOf(question.measureId)" class="rqe-note">{{ measureHintOf(question.measureId) }}</span>
              <span v-else-if="!upstream.plan" class="rqe-note">已有问卷快捷入口不挂变量。</span>
            </label>

            <label class="rqe-field">
              <span class="rqe-label">{{ codingLabel(question.type) }}</span>
              <input
                class="rqe-input"
                type="text"
                :value="question.codingNote"
                :readonly="isReadOnly"
                :aria-label="`第 ${index + 1} 题填答口径`"
                :placeholder="codingPlaceholder(question.type)"
                @input="onCodingNoteInput(question.id, $event)"
              />
            </label>
          </div>

          <p v-for="hint in hintsOf(question, index)" :key="hint.text" class="rqe-hint" :class="`rqe-hint--${hint.level}`">
            {{ hint.text }}
          </p>
          <p v-if="firstBlocker(question, index)" class="rqe-inline-warn">{{ firstBlocker(question, index) }}</p>
        </li>
      </ul>
    </section>

    <!-- 3. 全卷提示 -->
    <section v-if="check.hints.length" class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">
          全卷提示
          <span class="rqe-h4__count">{{ check.hints.length }} 条</span>
        </h4>
        <span class="rqe-block__hint">只提示，不算缺项</span>
      </div>
      <ul class="rqe-hintlist">
        <li v-for="hint in check.hints" :key="hint">{{ hint }}</li>
      </ul>
    </section>

    <!-- 4. 预测试 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">
          预测试
          <span class="rqe-h4__count">{{ draft.pretestRounds.length }} 轮试填</span>
        </h4>
        <button type="button" class="btn rqe-btn-sm" :disabled="isReadOnly" @click="addRound">+ 记录一轮试填</button>
      </div>

      <div class="rqe-state" :class="`rqe-state--${pretest.state}`">
        <div class="rqe-state__head">
          <span class="rqe-badge" :class="pretestPillClass">{{ pretestLabel }}</span>
          <span class="rqe-state__sig">当前内容指纹 <code>{{ currentSignature }}</code></span>
        </div>
        <ul class="rqe-state__reasons">
          <li v-for="reason in pretest.reasons" :key="reason">{{ reason }}</li>
        </ul>
        <p v-if="pretest.state === 'draft'" class="rqe-note">
          还没有试填记录。这里不会替你生成任何数据：日期、人数、完成率都必须来自真实发生的试填。
        </p>
      </div>

      <p v-if="!draft.pretestRounds.length" class="empty-hint">
        还没有试填轮次。找 5 位以上符合条件的人真实填一遍，把人数、完成率、发现的问题记下来。
      </p>

      <ul v-else class="rqe-list">
        <li v-for="(round, roundIndex) in draft.pretestRounds" :key="round.id" class="rqe-item">
          <div class="rqe-item__head">
            <span class="rqe-item__no">第 {{ roundIndex + 1 }} 轮</span>
            <span class="rqe-item__meta">
              {{ round.respondentCount === null ? '人数未填' : `${round.respondentCount} 人` }}
              · {{ round.findings.length }} 条发现
            </span>
            <span class="rqe-badge" :class="roundVersionClass(round)">
              {{ roundVersionText(round) }}
            </span>
            <button
              type="button"
              class="rqe-remove"
              :disabled="isReadOnly"
              :aria-label="`删除第 ${roundIndex + 1} 轮试填`"
              @click="removeRound(round.id)"
            >
              删除
            </button>
          </div>

          <div class="rqe-grid3">
            <label class="rqe-field">
              <span class="rqe-label">试填日期</span>
              <input
                class="rqe-input"
                type="date"
                :value="round.date"
                :readonly="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮试填日期`"
                @input="onRoundInput(round.id, 'date', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">参与人数</span>
              <input
                class="rqe-input"
                type="number"
                min="1"
                step="1"
                :value="round.respondentCount === null ? '' : String(round.respondentCount)"
                :readonly="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮参与人数`"
                placeholder="实际完成人数"
                @input="onRoundNumberInput(round.id, 'respondentCount', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">招募渠道</span>
              <input
                class="rqe-input"
                type="text"
                :value="round.channel"
                :readonly="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮招募渠道`"
                placeholder="例如：班级群"
                @input="onRoundInput(round.id, 'channel', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">完成率（%）</span>
              <input
                class="rqe-input"
                type="number"
                min="0"
                max="100"
                step="1"
                :value="round.completionRate === null ? '' : String(round.completionRate)"
                :readonly="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮完成率`"
                placeholder="未统计"
                @input="onRoundNumberInput(round.id, 'completionRate', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">中位填答时长（分钟）</span>
              <input
                class="rqe-input"
                type="number"
                min="0"
                step="0.5"
                :value="round.medianMinutes === null ? '' : String(round.medianMinutes)"
                :readonly="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮中位时长`"
                placeholder="未统计"
                @input="onRoundNumberInput(round.id, 'medianMinutes', $event)"
              />
            </label>
            <label class="rqe-field">
              <span class="rqe-label">本轮结论</span>
              <select
                class="rqe-input rqe-select"
                :value="round.verdict"
                :disabled="isReadOnly"
                :aria-label="`第 ${roundIndex + 1} 轮结论`"
                @change="onRoundVerdictChange(round.id, $event)"
              >
                <option v-for="option in verdictOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="rqe-note">{{ verdictHint(round.verdict) }}</span>
            </label>
          </div>

          <label class="rqe-field">
            <span class="rqe-label">本轮之后的修改</span>
            <textarea
              class="rqe-input rqe-textarea"
              rows="2"
              :value="round.revisionNote"
              :readonly="isReadOnly"
              :aria-label="`第 ${roundIndex + 1} 轮之后的修改`"
              placeholder="结论选「已修改」时必填：具体改了哪几题、怎么改的"
              @input="onRoundInput(round.id, 'revisionNote', $event)"
            />
          </label>

          <div class="rqe-findings">
            <div class="rqe-findings__bar">
              <span class="rqe-label">试填发现</span>
              <button type="button" class="btn rqe-btn-sm" :disabled="isReadOnly" @click="addFinding(round.id)">
                + 记录发现
              </button>
            </div>
            <p v-if="!round.findings.length" class="rqe-note">
              没有记录发现不代表没有问题，只代表没写。每条发现都要写清「怎么改的」才算闭环。
            </p>
            <ul v-else class="rqe-findinglist">
              <li v-for="finding in round.findings" :key="finding.id" class="rqe-finding">
                <div class="rqe-finding__row">
                  <select
                    class="rqe-input rqe-select"
                    :value="finding.questionId"
                    :disabled="isReadOnly"
                    :aria-label="`试填发现对应题目`"
                    @change="onFindingQuestionChange(round.id, finding.id, $event)"
                  >
                    <option value="">全卷</option>
                    <option v-if="finding.questionId && !draft.questions.some(item=>item.id===finding.questionId)" :value="finding.questionId">原关联题目已删除，请重新选择</option>
                    <option v-for="(item, itemIndex) in draft.questions" :key="item.id" :value="item.id">
                      第 {{ itemIndex + 1 }} 题 · {{ questionShort(item) }}
                    </option>
                  </select>
                  <select
                    class="rqe-input rqe-select"
                    :value="finding.kind"
                    :disabled="isReadOnly"
                    :aria-label="`试填发现类型`"
                    @change="onFindingKindChange(round.id, finding.id, $event)"
                  >
                    <option v-for="option in kindOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="rqe-remove"
                    :disabled="isReadOnly"
                    :aria-label="`删除试填发现`"
                    @click="removeFinding(round.id, finding.id)"
                  >
                    删除
                  </button>
                </div>
                <input
                  class="rqe-input"
                  type="text"
                  :value="finding.text"
                  :readonly="isReadOnly"
                  aria-label="试填发现现象"
                  placeholder="实际现象，例如：3 人问「经常」是多少次"
                  @input="onFindingInput(round.id, finding.id, 'text', $event)"
                />
                <input
                  class="rqe-input"
                  type="text"
                  :value="finding.action"
                  :readonly="isReadOnly"
                  aria-label="试填发现处理方式"
                  placeholder="怎么改的，例如：改为「每周几次」并给出 0/1–2/3–5/5 次以上"
                  @input="onFindingInput(round.id, finding.id, 'action', $event)"
                />
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </section>

    <!-- 5. 固定版本 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">本机标记当前问卷</h4>
        <span class="rqe-block__hint">仅保存本机指纹；正式调查需服务器固定版本及发布服务</span>
      </div>

      <div class="rqe-fix">
        <span class="rqe-badge" :class="fixBadgeClass">{{ fixText }}</span>
        <span v-if="draft.adoption.signature" class="rqe-fix__sig">
          指纹 <code>{{ draft.adoption.signature }}</code>
          <template v-if="draft.adoption.roundId"> · {{ roundNumberOf(draft.adoption.roundId) ? `依据第 ${roundNumberOf(draft.adoption.roundId)} 轮试填` : '依据轮次已删除' }}</template>
        </span>
        <button
          v-if="fixState !== 'fixed'"
          type="button"
          class="btn primary rqe-btn-sm"
          :disabled="isReadOnly || pretest.state !== 'passed'"
          @click="fixCurrent"
        >
          本机标记当前问卷
        </button>
      </div>

      <p v-if="pretest.state !== 'passed'" class="rqe-note rqe-note--warn">
        试填录入资料未通过本机检查，暂不能标记。原因：{{ pretest.reasons[0] }}
      </p>

      <div class="rqe-grid2">
        <label class="rqe-field">
          <span class="rqe-label">固定理由</span>
          <input
            class="rqe-input"
            type="text"
            :value="draft.adoption.note"
            :readonly="isReadOnly"
            aria-label="固定理由"
            placeholder="例如：第 2 轮试填 8 人，完成率 100%，改动已复核"
            @input="onAdoptionNoteInput($event)"
          />
        </label>
        <div class="rqe-field">
          <span class="rqe-label">依据的试填轮次</span>
          <span class="rqe-note">
            {{ draft.adoption.roundId ? (roundNumberOf(draft.adoption.roundId) ? `第 ${roundNumberOf(draft.adoption.roundId)} 轮` : '依据轮次已删除') : '本机标记时记录当前满足检查的轮次' }}
          </span>
        </div>
      </div>
    </section>

    <!-- 6. 其他说明与未知项 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">其他说明</h4>
      </div>
      <label class="rqe-field">
        <span class="rqe-label">补充说明</span>
        <textarea
          class="rqe-input rqe-textarea"
          rows="2"
          :value="draft.otherNote"
          :readonly="isReadOnly"
          aria-label="其他说明"
          placeholder="例如：问卷与访谈提纲的题目共用一套编号"
          @input="onOtherNoteInput($event)"
        />
        <span class="rqe-note">计入内容指纹：改这里也会让预测试「已通过」退回需重测。</span>
      </label>
    </section>

    <section class="rqe-block rqe-block--last">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">
          未知项
          <span class="rqe-h4__count">{{ draft.unknowns.length }} 条</span>
        </h4>
        <button type="button" class="btn rqe-btn-sm" :disabled="isReadOnly" @click="addUnknown">+ 新增未知项</button>
      </div>
      <p v-if="!draft.unknowns.length" class="rqe-note">
        尚未记录未知项；这不代表没有未知项。例如「是否能拿到完整抽样框」就属于会阻碍决定的一条。
      </p>
      <ul v-else class="rqe-unknowns">
        <li v-for="(unknown, index) in draft.unknowns" :key="unknown.id" class="rqe-unknown">
          <span class="rqe-unknown__no">{{ index + 1 }}</span>
          <input
            class="rqe-input rqe-unknown__input"
            type="text"
            :value="unknown.text"
            :readonly="isReadOnly"
            :aria-label="`未知项 ${index + 1}`"
            placeholder="例如：是否能拿到含年级字段的完整名单"
            @input="onUnknownTextInput(unknown.id, $event)"
          />
          <label class="rqe-switch">
            <input
              type="checkbox"
              :checked="unknown.blocksDecision"
              :disabled="isReadOnly"
              @change="toggleUnknownBlocks(unknown.id)"
            />
            <span>影响当前决定</span>
          </label>
          <button
            type="button"
            class="rqe-remove"
            :disabled="isReadOnly"
            :aria-label="`删除未知项 ${index + 1}`"
            @click="removeUnknown(unknown.id)"
          >
            删除
          </button>
        </li>
      </ul>
    </section>

    <!-- 完整性汇总 -->
    <section class="rqe-block">
      <div class="rqe-block__bar">
        <h4 class="rqe-h4">本机完整性</h4>
        <span class="rqe-block__hint">这是本机提示，不是正式阶段确认</span>
      </div>
      <div class="rqe-check">
        <div class="rqe-check__group">
          <p class="rqe-check__title">
            题目与卷首
            <span class="rqe-check__count" :class="{ 'rqe-check__count--bad': check.questions.length }">
              {{ check.questions.length }}
            </span>
          </p>
          <ul v-if="check.questions.length" class="rqe-check__list">
            <li v-for="item in check.questions" :key="item">{{ item }}</li>
          </ul>
          <p v-else class="rqe-check__ok">未发现必填缺项。</p>
        </div>
        <div class="rqe-check__group">
          <p class="rqe-check__title">
            与阶段 3 对应
            <span class="rqe-check__count" :class="{ 'rqe-check__count--bad': check.mapping.length }">
              {{ check.mapping.length }}
            </span>
          </p>
          <p v-if="!upstream.plan" class="rqe-check__ok">独立模式，不做变量对应检查。</p>
          <ul v-else-if="check.mapping.length" class="rqe-check__list">
            <li v-for="item in check.mapping" :key="item">{{ item }}</li>
          </ul>
          <p v-else class="rqe-check__ok">问卷变量都有对应题目。</p>
        </div>
        <div class="rqe-check__group">
          <p class="rqe-check__title">
            预测试证据
            <span class="rqe-check__count" :class="{ 'rqe-check__count--bad': check.pretest.length }">
              {{ check.pretest.length }}
            </span>
          </p>
          <ul v-if="check.pretest.length" class="rqe-check__list">
            <li v-for="item in check.pretest" :key="item">{{ item }}</li>
          </ul>
          <p v-else class="rqe-check__ok">试填录入资料与当前内容一致；尚未核验真实性。</p>
        </div>
      </div>
    </section>

    <footer class="rqe-footer">
      <button type="button" class="btn primary" :disabled="isReadOnly" @click="requestCandidate">
        提交为正式候选
      </button>
      <span class="rqe-footer__note">
        只发出保存请求，不表示服务端已保存。正式问卷保存、确认与发布服务尚未接入。
      </span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import {
  FINDING_KIND_OPTIONS,
  PRETEST_VERDICT_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  checkQuestionnaire,
  emptyPretestRound,
  emptyQuestionOption,
  emptyScaleSpec,
  emptySurveyQuestion,
  levelName,
  pretestState as resolvePretestState,
  pretestStateLabel,
  questionBlockers,
  questionHints,
  questionnaireAdoptionState,
  questionnaireMeasures,
  questionnaireSignature,
  type FindingKind,
  type PretestRound,
  type PretestVerdict,
  type QuestionType,
  type QuestionnaireActionRequest,
  type QuestionnaireDraft,
  type QuestionnaireDraftUpdate,
  type ResearchQuestionnaireEditorProps,
  type ScaleSpec,
  type SurveyQuestion,
} from './questionnaire-contract'

const props = defineProps<ResearchQuestionnaireEditorProps>()

const emit = defineEmits<{
  'update-draft': [value: QuestionnaireDraftUpdate]
  'save-request': [value: QuestionnaireActionRequest]
}>()

const isReadOnly = computed(() => props.readOnly === true)
const questionTypeOptions = QUESTION_TYPE_OPTIONS
const verdictOptions = PRETEST_VERDICT_OPTIONS
const kindOptions = FINDING_KIND_OPTIONS

// ── 写出口（与前三阶段同一套合并提交）──────────────────────────────────────
/**
 * 外壳以 `localTaskId + revision` 判定事件是否陈旧，revision 要等回传才更新。
 * 同一轮连发两次，第二次仍带旧 revision 会被丢弃，所以合并成一次 emit。
 */
let pendingDraft: QuestionnaireDraft | null = null
let flushScheduled = false

function commit(patch: Partial<QuestionnaireDraft>) {
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
function currentDraft(): QuestionnaireDraft {
  return pendingDraft ?? props.draft
}

function patchQuestion(id: string, updater: (question: SurveyQuestion) => SurveyQuestion) {
  commit({ questions: currentDraft().questions.map((item) => (item.id === id ? updater(item) : item)) })
}

function textOf(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function numberOrNull(event: Event): number | null {
  const raw = textOf(event).trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

// ── 上游 ────────────────────────────────────────────────────────────────
const upstream = computed(() => props.upstream)
const measures = computed(() => questionnaireMeasures(props.upstream.plan))

function countOfMeasure(measureId: string): number {
  return props.draft.questions.filter((item) => item.measureId === measureId).length
}

function measureHintOf(measureId: string): string {
  if (!measureId) return ''
  const measure = measures.value.find((item) => item.id === measureId)
  if (!measure) return ''
  const hint = measure.questionHint.trim()
  return hint ? `阶段 3 拟测：${hint}` : ''
}

// ── 卷首 ────────────────────────────────────────────────────────────────
function onMetaInput(key: 'title' | 'intro' | 'anonymityNote' | 'closeNote', event: Event) {
  commit({ meta: { ...currentDraft().meta, [key]: textOf(event) } })
}

function onEstimatedMinutesInput(event: Event) {
  const parsed = numberOrNull(event)
  commit({ meta: { ...currentDraft().meta, estimatedMinutes: parsed === null ? null : Math.max(1, Math.round(parsed)) } })
}

function toggleConsent() {
  commit({ meta: { ...currentDraft().meta, consent: !currentDraft().meta.consent } })
}

// ── 题目 ────────────────────────────────────────────────────────────────
function addQuestion(type: QuestionType) {
  commit({ questions: [...currentDraft().questions, emptySurveyQuestion(type)] })
}

function removeQuestion(id: string) {
  const draft = currentDraft()
  commit({
    questions: draft.questions.filter((item) => item.id !== id),
    // 题目被删，指向它的试填发现退化为「全卷」，避免留下悬空 questionId
    pretestRounds: draft.pretestRounds.map((round) => ({
      ...round,
      findings: round.findings.map((finding) => (finding.questionId === id ? { ...finding, questionId: '' } : finding)),
    })),
  })
}

function onQuestionTextInput(id: string, event: Event) {
  const text = textOf(event)
  patchQuestion(id, (question) => ({ ...question, text }))
}

function onQuestionTypeChange(id: string, event: Event) {
  const value = textOf(event) as QuestionType
  const allowed = QUESTION_TYPE_OPTIONS.some((option) => option.value === value)
  const type: QuestionType = allowed ? value : 'single'
  patchQuestion(id, (question) => {
    if (question.type === type) return question
    const isChoice = type === 'single' || type === 'multi'
    return {
      ...question,
      type,
      // 换题型时保留能保留的部分：选择类互转不丢选项，量表参数换回来还在
      options: isChoice ? (question.options.length ? question.options : [emptyQuestionOption(), emptyQuestionOption()]) : [],
      scale: type === 'scale' ? (question.scale ?? emptyScaleSpec()) : null,
    }
  })
}

function toggleRequired(id: string) {
  patchQuestion(id, (question) => ({ ...question, required: !question.required }))
}

function toggleScreening(id: string) {
  patchQuestion(id, (question) => ({ ...question, screening: !question.screening }))
}

function onMeasureChange(id: string, event: Event) {
  const measureId = textOf(event)
  patchQuestion(id, (question) => ({ ...question, measureId }))
}

function onCodingNoteInput(id: string, event: Event) {
  const codingNote = textOf(event)
  patchQuestion(id, (question) => ({ ...question, codingNote }))
}

function addOption(questionId: string) {
  patchQuestion(questionId, (question) => ({ ...question, options: [...question.options, emptyQuestionOption()] }))
}

function removeOption(questionId: string, optionId: string) {
  patchQuestion(questionId, (question) => ({
    ...question,
    options: question.options.filter((option) => option.id !== optionId),
  }))
}

function onOptionInput(questionId: string, optionId: string, key: 'label' | 'code', event: Event) {
  const value = textOf(event)
  patchQuestion(questionId, (question) => ({
    ...question,
    options: question.options.map((option) => (option.id === optionId ? { ...option, [key]: value } : option)),
  }))
}

function toggleOptionFlag(questionId: string, optionId: string, key: 'exclusive' | 'openEnded') {
  patchQuestion(questionId, (question) => ({
    ...question,
    options: question.options.map((option) =>
      option.id === optionId ? { ...option, [key]: !option[key] } : option,
    ),
  }))
}

function onScalePointsInput(id: string, event: Event) {
  const parsed = numberOrNull(event)
  patchQuestion(id, (question) => {
    if (!question.scale) return question
    const points = parsed === null ? question.scale.points : Math.max(2, Math.round(parsed))
    return { ...question, scale: { ...question.scale, points } }
  })
}

function onScaleLabelInput(id: string, key: keyof Pick<ScaleSpec, 'minLabel' | 'maxLabel' | 'midLabel'>, event: Event) {
  const value = textOf(event)
  patchQuestion(id, (question) => {
    if (!question.scale) return question
    return { ...question, scale: { ...question.scale, [key]: value } }
  })
}

function toggleScaleDontKnow(id: string) {
  patchQuestion(id, (question) => {
    if (!question.scale) return question
    return { ...question, scale: { ...question.scale, hasDontKnow: !question.scale.hasDontKnow } }
  })
}

function optionPlaceholder(index: number): string {
  const samples = ['例如：每周 0 次', '例如：每周 1–2 次', '例如：每周 3–5 次', '例如：每周 5 次以上']
  return samples[index] ?? '其他选项'
}

function codingLabel(type: QuestionType): string {
  if (type === 'multi') return '填答口径（最多可选几项、是否互斥）'
  if (type === 'number') return '填答口径（单位与取值范围）'
  if (type === 'text') return '填答口径（字数上限、是否编码）'
  if (type === 'scale') return '填答口径（分数如何记）'
  return '填答口径（是否含「其他」需填写）'
}

function codingPlaceholder(type: QuestionType): string {
  if (type === 'multi') return '例如：最多选 3 项，「以上都不」与其他项互斥'
  if (type === 'number') return '例如：单位为次，0–30 的整数，缺失记为空'
  if (type === 'text') return '例如：不超过 100 字，按开放编码整理'
  if (type === 'scale') return '例如：1–5 计 1–5 分，「不知道」记为缺失'
  return '例如：选「其他」时填写具体说明，编码另记'
}

function hintsOf(question: SurveyQuestion, index: number) {
  return questionHints(question, index)
}

function firstBlocker(question: SurveyQuestion, index: number): string {
  return questionBlockers(question, index)[0] ?? ''
}

function questionShort(question: SurveyQuestion): string {
  const text = question.text.trim()
  if (!text) return '未填题干'
  return text.length > 12 ? `${text.slice(0, 12)}…` : text
}

// ── 试填轮次 ────────────────────────────────────────────────────────────
function addRound() {
  const draft = currentDraft()
  // 新增轮次默认声明「当前这一版被试填过」；用户改了题之后指纹就与轮次不一致，需要重测
  commit({ pretestRounds: [...draft.pretestRounds, emptyPretestRound(questionnaireSignature(draft))] })
}

function removeRound(id: string) {
  commit({ pretestRounds: currentDraft().pretestRounds.filter((item) => item.id !== id) })
}

function patchRound(id: string, updater: (round: PretestRound) => PretestRound) {
  commit({ pretestRounds: currentDraft().pretestRounds.map((item) => (item.id === id ? updater(item) : item)) })
}

function onRoundInput(id: string, key: 'date' | 'channel' | 'revisionNote', event: Event) {
  const value = textOf(event)
  patchRound(id, (round) => ({ ...round, [key]: value }))
}

function onRoundNumberInput(
  id: string,
  key: 'respondentCount' | 'completionRate' | 'medianMinutes',
  event: Event,
) {
  const parsed = numberOrNull(event)
  patchRound(id, (round) => ({ ...round, [key]: parsed }))
}

function onRoundVerdictChange(id: string, event: Event) {
  const value = textOf(event) as PretestVerdict
  const allowed = PRETEST_VERDICT_OPTIONS.some((option) => option.value === value)
  patchRound(id, (round) => ({ ...round, verdict: allowed ? value : 'no-change' }))
}

function verdictHint(value: PretestVerdict): string {
  return PRETEST_VERDICT_OPTIONS.find((option) => option.value === value)?.hint ?? ''
}

const currentSignature = computed(() => questionnaireSignature(props.draft))

function roundVersionText(round: PretestRound): string {
  if (round.signature === currentSignature.value) return '与当前版本一致'
  return '试填的不是这一版'
}

function roundVersionClass(round: PretestRound): string {
  return round.signature === currentSignature.value ? 'rqe-badge--ok' : 'rqe-badge--bad'
}

function roundNumberOf(roundId: string): number {
  const index = props.draft.pretestRounds.findIndex((item) => item.id === roundId)
  return index >= 0 ? index + 1 : 0
}

// ── 试填发现 ────────────────────────────────────────────────────────────
function addFinding(roundId: string) {
  const finding = {
    id: `f-${crypto.randomUUID()}`,
    questionId: '',
    kind: 'wording' as FindingKind,
    text: '',
    action: '',
  }
  patchRound(roundId, (round) => ({ ...round, findings: [...round.findings, finding] }))
}

function removeFinding(roundId: string, findingId: string) {
  patchRound(roundId, (round) => ({ ...round, findings: round.findings.filter((item) => item.id !== findingId) }))
}

function patchFinding(roundId: string, findingId: string, patch: Partial<PretestRound['findings'][number]>) {
  patchRound(roundId, (round) => ({
    ...round,
    findings: round.findings.map((item) => (item.id === findingId ? { ...item, ...patch } : item)),
  }))
}

function onFindingInput(roundId: string, findingId: string, key: 'text' | 'action', event: Event) {
  const value = textOf(event)
  patchFinding(roundId, findingId, key === 'text' ? { text: value } : { action: value })
}

function onFindingQuestionChange(roundId: string, findingId: string, event: Event) {
  patchFinding(roundId, findingId, { questionId: textOf(event) })
}

function onFindingKindChange(roundId: string, findingId: string, event: Event) {
  const value = textOf(event) as FindingKind
  const allowed = FINDING_KIND_OPTIONS.some((option) => option.value === value)
  patchFinding(roundId, findingId, { kind: allowed ? value : 'other' })
}

// ── 状态与预检 ──────────────────────────────────────────────────────────
const pretest = computed(() => resolvePretestState(props.draft))
const check = computed(() => checkQuestionnaire(props.draft, props.upstream))

const pretestLabel = computed(() => pretestStateLabel(pretest.value.state))

const pretestPillClass = computed(() => {
  if (pretest.value.state === 'passed') return 'rqe-badge--ok'
  if (pretest.value.state === 'draft') return 'rqe-badge--idle'
  return 'rqe-badge--warn'
})

// ── 固定版本 ────────────────────────────────────────────────────────────
const fixState = computed(() => questionnaireAdoptionState(props.draft))

const fixText = computed(() => {
  if (fixState.value === 'fixed') return '本机已标记（非正式版本）'
  if (fixState.value === 'drifted') return '本机标记后内容改过或依据失效，需重新标记'
  return '尚未固定'
})

const fixBadgeClass = computed(() => {
  if (fixState.value === 'fixed') return 'rqe-badge--ok'
  if (fixState.value === 'drifted') return 'rqe-badge--warn'
  return 'rqe-badge--idle'
})

function fixCurrent() {
  if (pretest.value.state !== 'passed' || !pretest.value.roundId) return
  const draft = currentDraft()
  commit({
    adoption: {
      ...draft.adoption,
      signature: questionnaireSignature(draft),
      roundId: pretest.value.roundId,
    },
  })
}

function onAdoptionNoteInput(event: Event) {
  commit({ adoption: { ...currentDraft().adoption, note: textOf(event) } })
}

function onOtherNoteInput(event: Event) {
  commit({ otherNote: textOf(event) })
}

// ── 未知项 ──────────────────────────────────────────────────────────────
function addUnknown() {
  commit({ unknowns: [...currentDraft().unknowns, { id: `u-${crypto.randomUUID()}`, text: '', blocksDecision: false }] })
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
.rqe {
  margin: 22px 0 6px;
  padding: 20px 22px 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  font-size: 13px;
  color: var(--c-ink);
}

.rqe--readonly {
  background: #fbfdfd;
}

/* 头部 */
.rqe-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--c-line);
}

.rqe-head__text {
  min-width: 0;
}

.rqe-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ink);
  letter-spacing: 0.01em;
}

.rqe-sub {
  margin: 0;
  max-width: 62em;
  font-size: 12px;
  line-height: 1.75;
  color: var(--c-muted);
}

.rqe-head__status {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
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
.rqe-up {
  margin: 14px 0 4px;
  padding: 12px 14px;
  background: #f7fbfa;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rqe-up__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.rqe-up__src {
  font-size: 11px;
  color: var(--c-muted);
}

.rqe-up__warn {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-warn-ink);
}

.rqe-up__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.rqe-up__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}

.rqe-up__name {
  font-weight: 600;
  color: var(--c-ink);
}

.rqe-up__level {
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
  color: var(--c-muted);
  background: #eef4f3;
  border-radius: 999px;
}

.rqe-up__cover {
  font-size: 11px;
  color: var(--c-warn-ink);
}

.rqe-up__cover--done {
  color: var(--c-primary-ink);
}

.rqe-up__hint {
  flex-basis: 100%;
  font-size: 11px;
  line-height: 1.65;
  color: var(--c-muted);
}

/* 区块 */
.rqe-block {
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--c-line);
}

.rqe-block--last {
  border-bottom: 0;
  padding-bottom: 4px;
}

.rqe-block__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.rqe-h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.rqe-h4__count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--c-muted);
}

.rqe-block__hint {
  font-size: 11px;
  color: var(--c-muted);
}

.rqe-btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

.rqe-add {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 字段 */
.rqe-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  /* 有提示文字的一侧不能把整行拉高，否则同排另一侧的输入框会被拉伸 */
  align-content: start;
}

/* 字段里的按钮不要被 grid 拉满整行 */
.rqe-field > .btn {
  justify-self: start;
}

.rqe-label {
  font-size: 12px;
  color: var(--c-ink-2);
}

.rqe-input {
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

.rqe-input::placeholder {
  color: #9db3b8;
}

.rqe-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(18, 165, 148, 0.14);
}

.rqe-input:read-only,
.rqe-input:disabled {
  background: #f7fafa;
  color: var(--c-ink-2);
  cursor: default;
}

.rqe-textarea {
  resize: vertical;
  min-height: 52px;
}

.rqe-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--c-muted) 50%),
    linear-gradient(135deg, var(--c-muted) 50%, transparent 50%);
  background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 28px;
}

.rqe-select--mini {
  width: auto;
  padding: 3px 26px 3px 8px;
  font-size: 11px;
}

.rqe-input--code {
  max-width: 84px;
}

.rqe-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}

.rqe-grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.rqe-note {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

.rqe-note--warn {
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
.rqe-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.rqe-item {
  padding: 12px 14px;
  background: #fdfefe;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rqe-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.rqe-item__no {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
  padding: 1px 6px;
  border-radius: 4px;
}

.rqe-item__meta {
  font-size: 11px;
  color: var(--c-muted);
}

.rqe-item__head .rqe-remove {
  margin-left: auto;
}

.rqe-remove {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--c-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.rqe-remove:hover:not(:disabled) {
  color: var(--c-error);
  background: var(--c-error-soft);
  border-color: #f2c7c1;
}

.rqe-remove:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 选项 */
.rqe-options {
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.rqe-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 84px auto auto auto;
  align-items: center;
  gap: 8px;
}

.rqe-option__no {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-muted);
}

.rqe-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--c-ink-2);
  white-space: nowrap;
  cursor: pointer;
}

.rqe-switch input {
  margin: 0;
  accent-color: var(--c-primary);
}

/* 提示 */
.rqe-hint {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-ink-2);
}

.rqe-hint--warn {
  color: var(--c-warn-ink);
}

.rqe-inline-warn {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-warn-ink);
}

.rqe-hintlist {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}

.rqe-hintlist li {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-ink-2);
}

/* 状态徽标 */
.rqe-badge {
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.rqe-badge--ok {
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
}

.rqe-badge--warn {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
  border: 1px solid var(--c-warn-line);
}

.rqe-badge--bad {
  color: var(--c-error);
  background: var(--c-error-soft);
  border: 1px solid #f2c7c1;
}

.rqe-badge--idle {
  color: var(--c-muted);
  background: #eef1f4;
  border: 1px solid var(--c-line-strong);
}

/* 预测试状态 */
.rqe-state {
  padding: 12px 14px;
  margin-bottom: 12px;
  background: #f8fbfa;
  border: 1px solid var(--c-line);
  border-left-width: 3px;
  border-radius: var(--radius-sm);
}

.rqe-state--passed {
  border-left-color: var(--c-primary);
}

.rqe-state--collecting,
.rqe-state--needs-revision {
  border-left-color: var(--c-warn);
}

.rqe-state--draft {
  border-left-color: var(--c-line-strong);
}

.rqe-state__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.rqe-state__sig {
  font-size: 11px;
  color: var(--c-muted);
}

.rqe-state__sig code,
.rqe-fix__sig code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-ink-2);
}

.rqe-state__reasons {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 3px;
}

.rqe-state__reasons li {
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-ink-2);
}

/* 试填发现 */
.rqe-findings {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed var(--c-line);
}

.rqe-findings__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.rqe-findinglist {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.rqe-finding {
  display: grid;
  gap: 6px;
}

.rqe-finding__row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 110px auto;
  align-items: center;
  gap: 8px;
}

/* 固定版本 */
.rqe-fix {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 4px 0 12px;
}

.rqe-fix__sig {
  font-size: 11px;
  color: var(--c-muted);
}

/* 完整性汇总 */
.rqe-check {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.rqe-check__group {
  padding: 10px 12px;
  background: #f8fbfa;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-sm);
}

.rqe-check__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-ink);
}

.rqe-check__count {
  min-width: 20px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 999px;
  color: var(--c-primary-ink);
  background: var(--c-primary-soft);
}

.rqe-check__count--bad {
  color: var(--c-warn-ink);
  background: var(--c-warn-soft);
}

.rqe-check__ok {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-muted);
}

.rqe-check__list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
}

.rqe-check__list li {
  font-size: 11px;
  line-height: 1.65;
  color: var(--c-ink-2);
}

/* 未知项 */
.rqe-unknowns {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.rqe-unknown {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.rqe-unknown__no {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-muted);
}

/* 底部 */
.rqe-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--c-line);
}

.rqe-footer__note {
  font-size: 11px;
  color: var(--c-muted);
}

@media (max-width: 900px) {
  .rqe-check,
  .rqe-grid2,
  .rqe-grid3 {
    grid-template-columns: 1fr;
  }

  .rqe-grid2,
  .rqe-grid3 {
    gap: 6px;
  }

  .rqe-option {
    grid-template-columns: auto minmax(0, 1fr) 72px;
    row-gap: 6px;
  }

  .rqe-option .rqe-switch {
    grid-row: 2;
  }

  .rqe-option .rqe-remove {
    grid-row: 2;
    justify-self: end;
  }

  .rqe-finding__row {
    grid-template-columns: minmax(0, 1fr) 110px;
  }

  .rqe-finding__row .rqe-remove {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .rqe-unknown {
    grid-template-columns: auto minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  /* 编号纵向跨两行居中；输入框占满右侧；开关与删除落在第二行并左对齐输入框 */
  .rqe-unknown__no {
    grid-row: 1 / span 2;
    align-self: center;
  }

  .rqe-unknown__input {
    grid-column: 2 / span 2;
  }

  .rqe-unknown .rqe-switch {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .rqe-unknown .rqe-remove {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
  }

  .rqe-block__bar {
    flex-wrap: wrap;
  }
}
</style>
