<!--
  市调演真 · 案例复现（完全对齐数模演易原型 v2 的工作台复现形态）。

  结构：wtop（返回 + 题号 + 标题 + 编号步骤条 + 环境徽章 + 状态章 + 我有问题/回到上一步 + 收起产物）
        wbody（左：AI 对话流 + 输入台 + 快捷指令；右：产物抽屉——可视化演示/问题分析/报告初稿）。
  案例模式按固定材料脚本逐步演示；真实任务模式沿用原研究会话接口，页面不伪造阶段结论或进度。

  双模式数据源：
   A. 赛题复现  /research/replay/:id        —— 内容来自 src/data/contestProblems.ts（市调静态演示库）。
   B. 真实任务  /research/replay?task=xx   —— 本机任务身份用于绑定当前真实研究会话；消息、中断和成果读取走现有服务接口。
        任务草稿不会自动当成服务端运行结果；本页复用截图中的对话与产物布局。
  可视化演示为按步骤生成的示意图形（内联 SVG，演示口径），可导出 HTML。
-->
<template>
  <main class="replay" v-if="src">
    <!-- ===== 顶栏 ===== -->
    <div class="wtop">
      <RouterLink class="icon-btn" :to="src.backTo" title="返回">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
      </RouterLink>
      <span v-if="!task" class="wtb">{{ src.tag }}</span>
      <div class="wt" :title="src.title">{{ src.title }}</div>
      <div class="steps" :style="{'--step-count':stepLabels.length}" role="tablist" aria-label="复现步骤">
        <template v-for="(label,index) in stepLabels" :key="label">
          <span v-if="index" class="step-line" aria-hidden="true"></span>
          <span class="step" :class="{done:!task && index<cur,now:activeStepIndexes.includes(index),clickable:!task && index<=maxStep}" role="tab" :aria-selected="activeStepIndexes.includes(index)" :title="task ? '后台阶段仅用于定位，阶段审核结果另行核对。G1涵盖赛事理解、选题分析和研究方向。' : label" @click="jumpStep(index)">
            <span class="n">{{ !task && index<cur?'✓':index+1 }}</span>{{ label }}
          </span>
        </template>
      </div>
      <span v-if="!task" class="env-badge" :class="{inactive:!envReady}"><span>{{envLabel}}</span></span>
      <span class="stag" :class="{done:finished}"><i aria-hidden="true"></i>{{ stagText }}</span>
      <div class="flow-tools">
        <button v-if="task" type="button" class="flow-tool" :disabled="recordBusy || !liveScopeMatches" @click="saveLocalRecord">{{recordBusy?'保存中…':'保存本次记录'}}</button>
        <button v-if="task" type="button" class="flow-tool" :disabled="!liveScopeMatches" @click="openLocalRecord">本机复现</button>
        <button type="button" class="flow-tool" title="暂停当前流程，先问一个问题" @click="askPause">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1.1-1.5 2.2" /><path d="M12 17h.01" /></svg>
          我有问题
        </button>
        <button type="button" class="flow-tool" title="回到上一步重新看" :disabled="!canBack" @click="backStep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4" /><path d="M5 10h8a6 6 0 0 1 6 6v2" /></svg>
          回到上一步
        </button>
      </div>
      <div class="grow"></div>
      <button type="button" class="flow-tool" @click="drawerOpen=!drawerOpen">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path v-if="drawerOpen" d="M18 6L6 18M6 6l12 12" /><path v-else d="M9 9h6v6H9z" /><path v-if="!drawerOpen" d="M3 3h18v18H3z" /></svg>
        {{ drawerOpen?'收起产物':'展开产物' }}
      </button>
    </div>

    <!-- ===== 主体：左对话 + 右产物 ===== -->
    <div class="wbody">
      <div class="chat">
        <div ref="streamEl" class="stream" @scroll="trackConversationScroll">
          <div class="stream-in">
            <p v-if="recordNotice" class="tip-line" role="status">{{recordNotice}}</p>
            <div v-for="m in displayMessages" :key="m.key" class="msg" :class="m.who">
              <div class="bubble">
                <div class="txt" :class="{'message-markdown':!!task}" v-html="m.html"></div>
                <div v-if="m.arts&&m.arts.length" class="arts">
                  <button v-for="(art,ai) in m.arts" :key="ai" type="button" class="acard" :class="{open:openKey===m.key+'-'+ai}" @click="viewArt(art,m.key+'-'+ai)">
                    <span v-if="art.auto" class="auto">自动弹出</span>
                    <span class="ai" :style="{background:artGrad(art.kind)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="art.kind==='analysis'" d="M9 18h6M10 22h4" /><path v-if="art.kind==='analysis'" d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /><path v-if="art.kind==='animation'" d="M3 3v17a1 1 0 0 0 1 1h17" /><rect v-if="art.kind==='animation'" x="7" y="12" width="3" height="6" /><rect v-if="art.kind==='animation'" x="12.5" y="8" width="3" height="10" /><rect v-if="art.kind==='animation'" x="18" y="4.5" width="3" height="13.5" /><path v-if="art.kind==='paper'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path v-if="art.kind==='paper'" d="M14 2v6h6" /></svg></span>
                    <span class="at"><b>{{ art.title }}</b><span>{{ art.sub }}</span></span>
                    <span class="arrow">查看<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>
                  </button>
                </div>
              </div>
            </div>
              <div v-if="task && liveScopeMatches && (liveError||liveFormError||liveSession.error||liveSession.notice||latestGateTimedOut)" class="msg ai">
              <div class="bubble"><div class="txt">
                <p v-if="liveFiles.some(file=>isQuestionnairePath(file.path))"><button type="button" class="chip" @click="openAgentQuestionnaire">查看当前会话问卷 →</button></p>
                <p v-if="liveError||liveFormError||liveSession.error" class="tip-line">{{liveError||liveFormError||liveSession.error}}</p>
                <p v-if="liveSession.notice">{{liveSession.notice}}</p>
                <div v-if="liveSession.reportedProgress" class="reported-progress">
                  <strong>会话最近报告的进度 · {{liveSession.reportedProgress.phase}}</strong>
                  <p>进行中 {{liveSession.reportedProgress.currentWork}}</p>
                  <p>下一步 {{liveSession.reportedProgress.nextStep}}</p>
                  <p>记录状态 {{liveSession.reportedProgress.state}}</p>
                  <small v-if="liveSession.lastStatusCheckAt">最近核对 {{new Date(liveSession.lastStatusCheckAt).toLocaleTimeString('zh-CN')}}</small>
                </div>
                <p v-if="liveSession.status==='working'">{{backgroundChecks>=120?'自动核对已达到本页次数上限。请手动核对会话；仍无变化时需检查后台任务日志。':'后台进展每 5 秒自动核对，出现审核表单后会显示在这里。核对不会提交审核或发送继续指令。'}}</p>
                <p v-if="latestGateTimedOut" class="tip-line">服务端报告本次审核已超时关闭，请先核对会话中的审核状态。</p>
                <button v-if="latestGateTimedOut && !liveSession.halted" type="button" class="conversation-action primary" :disabled="liveSession.busy" @click="sendLive('请核对当前研究中已超时关闭的 G1 审核，在原会话重新提供审核入口并保留已有产物。本消息只请求恢复审核，研究阶段等待人工决策。',false,true)">请求恢复审核</button>
                <button v-if="liveSession.halted" type="button" class="flow-tool" :disabled="liveSession.busy" @click="liveSession.recheckBlocked()">核对已保存的审核结果</button>
                <button v-else-if="liveSession.identity" type="button" class="flow-tool" :disabled="liveSession.busy" @click="liveSession.recover()">恢复／核对会话</button>
              </div></div>
            </div>
            <div v-if="task && liveScopeMatches && liveForms.length" class="msg ai">
              <div class="bubble form-panel"><div class="txt">
                <h4>待填写或确认的服务端表单</h4>
                <p>请逐项核对服务端表单；提交由原研究会话接口处理，不会自动代答或批准。</p>
                <p v-if="liveFormError" class="tip-line" role="alert">{{liveFormError}}</p>
                <section v-for="form in liveForms" :key="form.interruptId" class="live-form">
                  <h4>{{form.title||form.toolName}}</h4><p v-if="form.message">{{form.message}}</p>
                  <div v-for="field in form.fields" :key="field.key" class="live-field">
                    <label :for="liveInputId(form.interruptId,field.key)">{{field.label}}<strong v-if="field.required"> · 必填</strong></label>
                    <textarea v-if="field.kind==='textarea'" :id="liveInputId(form.interruptId,field.key)" :disabled="liveSession.busy" :value="String(liveValue(form.interruptId,field.key)??'')" :placeholder="field.placeholder" :minlength="field.minLength" :maxlength="field.maxLength" @input="setLiveField(form.interruptId,field,$event)" />
                    <select v-else-if="field.kind==='select'" :id="liveInputId(form.interruptId,field.key)" :disabled="liveSession.busy" :value="String(liveValue(form.interruptId,field.key)??'')" @change="setLiveField(form.interruptId,field,$event)"><option value="">请选择</option><option v-for="option in field.options" :key="option" :value="option">{{option}}</option></select>
                    <div v-else-if="field.kind==='radio-group'||field.kind==='checkbox-group'" class="live-choices">
                      <label v-for="option in field.options" :key="option"><input :type="field.kind==='radio-group'?'radio':'checkbox'" :name="liveInputId(form.interruptId,field.key)" :disabled="liveSession.busy" :checked="field.kind==='checkbox-group'?isLiveChecked(form.interruptId,field.key,option):liveValue(form.interruptId,field.key)===option" @change="field.kind==='checkbox-group'?toggleLiveChoice(form.interruptId,field.key,option):setLiveChoice(form.interruptId,field.key,option)" />{{option}}</label>
                    </div>
                    <template v-else-if="field.kind==='other-text'">
                      <input :id="liveInputId(form.interruptId,field.key)" :list="liveInputId(form.interruptId,field.key)+'-options'" :disabled="liveSession.busy" :value="String(liveValue(form.interruptId,field.key)??'')" :placeholder="field.placeholder||'选择或填写其他内容'" @input="setLiveField(form.interruptId,field,$event)" />
                      <datalist :id="liveInputId(form.interruptId,field.key)+'-options'"><option v-for="option in field.options" :key="option" :value="option" /></datalist>
                    </template>
                    <input v-else :id="liveInputId(form.interruptId,field.key)" :type="field.kind==='number'?'number':'text'" :disabled="liveSession.busy" :value="String(liveValue(form.interruptId,field.key)??'')" :placeholder="field.placeholder" :min="field.min" :max="field.max" :step="field.step" :minlength="field.minLength" :maxlength="field.maxLength" @input="setLiveField(form.interruptId,field,$event)" />
                  </div>
                </section>
                <button type="button" class="dl" :aria-busy="formSubmitting" :disabled="liveSession.busy||liveSession.stopping||liveSession.status!=='interrupt'||!!liveFormError" @click="submitLiveForms"><span v-if="formSubmitting" class="submit-spinner" aria-hidden="true" />{{formSubmitting?(liveSession.formSubmission?.replyAt?'正在接收回复…':liveSession.formSubmission?.runStartedAt?'服务端已响应，处理中…':'正在发送，请稍候…'):'提交全部表单并继续'}}</button>
              </div></div>
            </div>
            <div v-if="task && liveScopeMatches && submissionFeedback" class="msg ai">
              <div class="bubble submission-feedback" :class="{'is-active':submissionFeedback.active,'is-warning':submissionFeedback.warning}">
                <div role="status" aria-live="polite" aria-atomic="true" class="submission-heading">
                  <span class="submission-indicator" aria-hidden="true">{{submissionFeedback.warning?'!':submissionFeedback.active?'':'✓'}}</span>
                  <strong>{{submissionFeedback.title}}</strong>
                </div>
                <ol class="submission-steps" aria-label="本次表单提交进度">
                  <li v-for="(label,index) in ['发送表单','服务端响应','智能体回复']" :key="label" :class="{'is-done':index<submissionFeedback.step,'is-current':index===submissionFeedback.step}">
                    <span aria-hidden="true">{{index<submissionFeedback.step?'✓':index+1}}</span>{{label}}
                  </li>
                </ol>
                <div v-if="submissionFeedback.active" class="submission-track" aria-hidden="true"><span /></div>
                <p class="submission-detail">{{submissionFeedback.detail}}</p>
                <div class="submission-meta">
                  <span v-if="submissionFeedback.elapsed!==null">{{submissionFeedback.active?'已等待':'本次耗时'}} {{submissionFeedback.elapsed}} 秒</span>
                  <span v-if="liveSession.formSubmission?.checkedAt">最近核对 {{new Date(liveSession.formSubmission.checkedAt).toLocaleTimeString('zh-CN')}}</span>
                  <button v-if="submissionFeedback.warning" type="button" class="flow-tool" :disabled="liveSession.formSubmission?.checking || (liveSession.busy && !formSubmitting)" @click="recheckSubmission">{{liveSession.formSubmission?.checking?'正在核对…':'重新核对'}}</button>
                </div>
              </div>
            </div>
            <section v-if="chips.length" class="next-action-card" aria-label="需要你操作">
              <div class="next-action-heading"><span aria-hidden="true">→</span><strong>需要你操作</strong></div>
              <p>{{liveSession.nextStage ? '当前等待确认是否进入 '+liveSession.nextStage+'。请核对已有回复中的风险和待确认事项后选择。' : task && liveSession.serverPhase==='G3' ? g3Action?.description || '请先核对当前等待的具体事项。' : '请选择下一步，点击后会发送到当前对话。'}}</p>
              <div class="conversation-actions">
                <button v-for="chip in chips" :key="chip" type="button" class="conversation-action primary" :disabled="task ? liveSession.busy || materialBusy : thinkingOn" @click="quickSay(chip)">{{chip}}</button>
              </div>
            </section>
            <div v-if="task ? liveScopeMatches && liveSession.busy && !submissionFeedback : thinkingOn" class="msg ai"><div class="bubble"><span class="thinking"><i></i><i></i><i></i>{{ task ? (liveSession.status==='checking' ? '正在检查模型连接' : liveSession.status==='running' ? '等待智能体响应' : '正在读取或核对会话') : 'AI 正在思考' }}</span></div></div>
          </div>
        </div>
        <div v-if="!followLatest" class="latest-wrap"><button type="button" class="latest-button" @click="scrollBottom(true)">↓ 回到最新</button></div>
        <div class="composer-bar">
          <div class="cw">
            <div class="composer">
              <label class="sr-only" for="replay-input">对话输入</label>
              <textarea id="replay-input" ref="composerInput" title="Enter 发送，Shift+Enter 换行" v-model="draft" rows="1" :placeholder="inputPlaceholder" @keydown.enter.exact="sendOnEnter"></textarea>
              <div class="cbar">
                <button type="button" class="btn-ghost upload-action" aria-label="上传文件" :title="materialBusy ? '材料处理中…' : '上传文件'" :disabled="!!task && (!liveScopeMatches || !liveSession.identity || liveSession.busy || materialBusy)" @click="pickFile">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
                  <span class="sr-only">上传文件</span>
                </button>
                <button v-if="task && liveSession.identity" type="button" class="btn-ghost" :disabled="materialBusy || liveSession.busy" @click="openMaterialManager">附件{{materials.length?'（'+materials.length+'）':''}}</button>
                <span v-if="materialBusy" class="hint" role="status">材料处理中…</span>
                <div class="spacer"></div>
                <button type="button" class="btn-send" @click="send()">
                  发送
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div v-if="task" class="material-status">
                <input ref="materialInput" type="file" hidden :accept="liveSession.serverPhase==='G3' ? '.csv,.tsv,.md,.txt,.json' : undefined" @change="chooseMaterial" />
                <p v-if="materialError" role="alert">{{materialError}} <button type="button" class="material-retry" :disabled="materialBusy" @click="openMaterialManager">核对附件</button></p>
                <p v-if="selectedMaterial">已选择 {{selectedMaterial.name}} <button type="button" class="chip" :disabled="materialBusy" @click="uploadMaterial">重试上传</button></p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <aside class="drawer" :class="{on:drawerOpen}" aria-label="产物预览">
        <div class="dh">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#12A594" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>
          <h3>{{ drawerTitle }}<span class="sub">{{ drawerSub }}</span></h3>
          <button type="button" class="icon-btn" title="收起产物" @click="drawerOpen=false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="db">
          <template v-if="task">
            <section class="card session-files" aria-label="当前研究文件">
              <div class="file-toolbar">
                <div class="file-tabs" role="tablist" aria-label="文件分类">
                  <button id="artifact-tab" type="button" role="tab" :aria-selected="fileTab==='artifacts'" aria-controls="artifact-panel" :class="{active:fileTab==='artifacts'}" @click="fileTab='artifacts'">智能体产物 <span>{{artifactReadState==='loading'?'…':artifactReadState==='error'?'!':liveFiles.length || (artifactReadState==='loaded' ? 0 : '—')}}</span></button>
                  <button id="materials-tab" type="button" role="tab" :aria-selected="fileTab==='materials'" aria-controls="materials-panel" :class="{active:fileTab==='materials'}" @click="fileTab='materials'">已上传材料 <span>{{materialBusy?'…':materialError?'!':materials.length || (materialsLoaded ? 0 : '—')}}</span></button>
                </div>
                <button type="button" class="file-refresh" :disabled="!liveScopeMatches || !liveSession.identity || (fileTab==='artifacts' ? liveSession.busy : materialBusy)" @click="fileTab==='artifacts' ? refreshFileArtifacts() : reloadMaterials()">刷新</button>
              </div>
              <div class="card-b file-panel-body">
                <p v-if="!liveScopeMatches">正在连接当前任务会话…</p>
                <div v-else-if="fileTab==='artifacts'" id="artifact-panel" role="tabpanel" aria-labelledby="artifact-tab" :aria-busy="artifactReadState==='loading'">
                  <p v-if="artifactReadState==='loading'" class="file-status" role="status">正在读取产物…</p>
                  <p v-else-if="artifactReadState==='error'" class="uploaded-material-error" role="alert">{{artifactReadError}}</p>
                  <ul v-if="liveScopeMatches&&liveFiles.length" class="live-files artifact-grid"><li v-for="file in liveFiles" :key="file.path" class="artifact-file" :class="'artifact-'+artifactType(file.name).kind" :title="file.name+' · '+file.path">
                <div class="artifact-file-title"><span class="artifact-type-mark" aria-hidden="true">{{artifactType(file.name).glyph}}</span><strong :title="file.name">{{file.name}}</strong></div>
                <div class="artifact-file-meta"><span class="artifact-type-label">{{artifactType(file.name).label}}</span><small class="artifact-file-size">{{file.size??'未知'}} 字节</small></div>
                <button type="button" class="dl ghost" :disabled="liveSession.busy" @click="openArtifactPreview(file.path)">预览</button>
              </li></ul>
                  <p v-if="!liveFiles.length && artifactReadState==='idle'" class="file-status">点击右上角刷新，读取本会话产物。</p>
                  <p v-else-if="!liveFiles.length && artifactReadState==='loaded'" class="file-status">本次读取未找到可预览文件。</p>
                </div>
                <div v-else id="materials-panel" role="tabpanel" aria-labelledby="materials-tab" :aria-busy="materialBusy">
                  <p v-if="materialError" class="uploaded-material-error" role="alert">{{materialError}}</p>
                  <p v-else-if="materialBusy" class="file-status" role="status">正在读取材料…</p>
                  <ul v-if="materials.length" class="live-files upload-grid"><li v-for="item in materials" :key="item.ref" class="uploaded-material" :title="item.fileName">
                  <div class="uploaded-material-title"><span class="artifact-type-mark" aria-hidden="true">{{artifactType(item.fileName).glyph}}</span><strong :title="item.fileName">{{item.fileName}}</strong></div>
                  <small>{{item.size}} 字节</small>
                  <button type="button" class="dl ghost delete-attachment" :disabled="materialBusy || liveSession.busy" @click="removeMaterial(item,true)">删除</button>
                </li></ul>
                  <p v-if="!materials.length && !materialBusy && !materialError" class="file-status">{{materialsLoaded?'当前会话没有已上传材料。':'点击右上角刷新，读取已上传材料。'}}</p>
                </div>
              </div>
            </section>
          </template>
          <div v-else class="anim-empty">产物会随流程逐步生成：走到「全局分析」后，第一份分析产物与演示一会出现在这里；之后每走一步多一份。未走到的步骤不会提前出现。</div>
        </div>
      </aside>
    </div>
    <dialog ref="recordDialog" class="preview-dialog" aria-labelledby="record-title">
      <header class="preview-dialog-head"><h3 id="record-title">本机记录复现 · {{savedRecord?.title}}</h3><button type="button" class="icon-btn" aria-label="关闭复现" @click="recordDialog?.close()">×</button></header>
      <div v-if="savedRecord" class="preview-dialog-body">
        <p>保存于 {{new Date(savedRecord.savedAt).toLocaleString('zh-CN')}} · 阶段 {{savedRecord.phase || '未确认'}} · 本机历史记录</p>
        <p v-if="savedRecord.gaps.length" class="tip-line">保存缺口：{{savedRecord.gaps.join('；')}}</p>
        <div v-for="message in savedRecord.messages.slice(0,recordStep)" :key="message.id" class="msg" :class="message.role==='user'?'me':'ai'"><div class="bubble"><div class="txt message-markdown" v-html="renderResearchMessage(message.text,message.role)"></div></div></div>
        <div class="conversation-actions"><button type="button" class="conversation-action" :disabled="recordStep<=1" @click="recordStep--">上一步</button><span>{{recordStep}} / {{savedRecord.messages.length}}</span><button type="button" class="conversation-action primary" :disabled="recordStep>=savedRecord.messages.length" @click="recordStep++">下一步</button><button type="button" class="conversation-action" @click="recordStep=1">从头复现</button></div>
        <details v-for="file in savedRecord.files" :key="file.path"><summary>{{file.path}}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">{{file.content}}</pre></details>
      </div>
    </dialog>
    <dialog ref="materialDialog" class="preview-dialog material-dialog" aria-labelledby="material-dialog-title" @click="($event.target===materialDialog) && materialDialog?.close()">
      <header class="preview-dialog-head"><h3 id="material-dialog-title">会话附件</h3><button type="button" class="icon-btn" aria-label="关闭附件管理" autofocus @click="materialDialog?.close()">×</button></header>
      <div class="preview-dialog-body">
        <p>删除后，智能体将无法继续读取该附件。重新上传后请发送消息说明使用哪份文件。</p>
        <p v-if="materialError" role="alert">{{materialError}}</p>
        <ul class="live-files"><li v-for="item in materials" :key="item.ref"><strong>{{item.fileName}}</strong><small>{{item.size}} 字节 · {{item.fileId}}</small><button type="button" class="dl ghost" :disabled="materialBusy || liveSession.busy" @click="removeMaterial(item)">删除附件</button></li></ul>
        <p v-if="materialBusy" role="status">正在读取附件…</p>
        <p v-else-if="!materials.length && !materialError">{{materialsLoaded?'当前会话没有附件。':'点击刷新读取附件。'}}</p>
      </div>
      <footer class="material-dialog-actions">
        <button type="button" class="dl ghost" :disabled="materialBusy" @click="reloadMaterials">刷新列表</button>
        <button type="button" class="dl" :disabled="materialBusy || liveSession.busy" @click="materialInput?.click()">上传文件</button>
      </footer>
    </dialog>
    <dialog ref="previewDialog" class="preview-dialog" aria-labelledby="preview-dialog-title" @click="closeOnBackdrop" @close="closePreviewState">
      <header class="preview-dialog-head"><h3 id="preview-dialog-title">{{openArt?.title || previewPath.split('/').at(-1) || '产物预览'}}</h3><button type="button" class="icon-btn" aria-label="关闭预览" autofocus @click="previewDialog?.close()">×</button></header>
      <div class="preview-dialog-body">
          <template v-if="openArt">
            <!-- 可视化演示 -->
            <template v-if="openArt.kind==='animation'">
              <div class="stage" v-html="animSvg(openArt.index)"></div>
              <div class="card">
                <div class="card-h"><h3>演示列表（按流程生成）</h3><span class="tag-c">已生成 {{ animBank.length }} / {{ totalDemos }}</span></div>
                <div class="card-b tight">
                  <button v-for="q in animBank" :key="q.k" type="button" class="acard mini" :class="{open:openArt.index===q.k}" @click="switchAnim(q.k)">
                    <span class="ai num" :style="{background:'linear-gradient(120deg,#12A594,#1E9FC4)'}">{{ q.k+1 }}</span>
                    <span class="at"><b>{{ q.title }}</b><span>{{ q.sub }} · 点击回看</span></span>
                    <span class="arrow">播放</span>
                  </button>
                </div>
              </div>
              <div class="card">
                <div class="card-h"><h3>演示说明</h3></div>
                <div class="card-b">
                  <p class="side-note">{{ src.intro }}图形按步骤由本机绘制；来源报告汇总值保留原有口径，未读取或重算个人答卷。</p>
                  <div class="legend">
                    <template v-if="src.study">
                      <div><i style="background:#2EC4B0"></i>材料中记录的研究设计与时间安排</div>
                      <div><i style="background:#F5A623"></i>来源文档报告值；本页未重新计算</div>
                      <div><i style="background:#7FE0A8"></i>主题、题库版本与模型口径待核验</div>
                    </template>
                    <template v-else>
                      <div><i style="background:#2EC4B0"></i>计划 / 设计侧结果（抽样、量表、发放节奏）</div>
                      <div><i style="background:#F5A623"></i>实际 / 回收侧结果（回收率、有效率、偏差）</div>
                      <div><i style="background:#7FE0A8"></i>关键识别点（口径分界、分层节点）</div>
                    </template>
                  </div>
                  <div class="exp-row"><button type="button" class="dl" @click="exportAnim">导出 HTML（答辩可用）</button></div>
                </div>
              </div>
            </template>
            <!-- 问题分析 -->
            <div v-else-if="openArt.kind==='analysis'" class="card">
              <div class="card-h"><h3>{{ openArt.title }}</h3></div>
              <div class="card-b" v-html="analysisHtml(openArt.index)"></div>
            </div>
            <!-- 报告初稿 -->
            <div v-else class="card">
              <div class="card-h"><h3>报告初稿 <span class="tag-c">v1</span></h3></div>
              <div class="card-b" v-html="paperHtml()"></div>
              <div class="card-b col">
                <button type="button" class="dl" @click="downloadReport">下载报告初稿（Markdown）</button>
                <RouterLink v-if="src.workspaceLink" class="dl ghost" :to="src.workspaceLink">进入七阶段工作台编辑本任务 →</RouterLink>
              </div>
            </div>
          </template>
        <template v-else-if="previewPath && liveScopeMatches">
          <p v-if="liveSession.busy" role="status">正在读取文件…</p>
          <p v-else-if="liveSession.preview?.path!==previewPath" role="alert">{{liveSession.error || '文件读取失败，请关闭后重试。'}}</p>
              <AgentQuestionnairePreview v-if="liveScopeMatches && liveSession.preview?.path===previewPath && liveSession.preview?.content && !liveSession.preview.truncated && isQuestionnairePath(liveSession.preview.path)" :content="liveSession.preview.content" :project-id="liveSession.identity?.projectId || ''" :task-id="task?.localTaskId" :thread-id="liveSession.identity?.threadId || ''" :path="liveSession.preview.path" />
              <pre v-else-if="liveScopeMatches&&liveSession.preview?.path===previewPath">{{liveSession.preview.content??liveSession.preview.reason??'该文件无法直接预览。'}}</pre>
        </template>
      </div>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import {fetchArtifactContent} from '@/api/artifact'
import {computed,nextTick,onBeforeUnmount,onMounted,reactive,ref,watch} from 'vue'
import {researchG3Action} from '@/utils/researchProgress'
import {useRoute,useRouter} from 'vue-router'
import {getContestProblem} from '@/data/contestProblems'
import {uploadAttachment,listAttachments,deleteAttachment,precheckFile} from '@/api/attachment'
import AgentQuestionnairePreview from './research/AgentQuestionnairePreview.vue'
import {renderResearchMessage} from '@/utils/researchMessageRender'
import {getResearchDemoCase,type ResearchDemoCase} from '@/data/researchDemoCases'
import {AUTH_CHANGE_EVENT} from '@/api/http'
import {configuredResearchAgent} from '@/config/researchAgent'
import {currentResearchOwner,useResearchRuns} from '@/stores/researchRuns'
import {normalizeResearchInterrupt,researchChoiceAnswer,type ResearchField,type ResearchForm} from '@/api/szRun'
import {useUserStore} from '@/stores/user'
import {useResearchStore} from '@/stores/research'
import {kindToMode,stagesFor,workflowLabel} from '@/utils/researchDrafts'
import type {WorkflowKind,LocalResearchTask} from '@/types/research-contracts'
import type {ArtifactNode,AttachmentItem} from '@/types/sandbox'

const NUMS=['一','二','三','四','五','六','七','八','九','十']
const cn=(n:number)=>NUMS[n-1]??String(n)
const route=useRoute(),router=useRouter(),researchStore=useResearchStore()
const userStore=useUserStore(),liveSession=useResearchRuns().session
const liveOwner=ref(''),liveError=ref(''),liveFormError=ref(''),liveForms=ref<ResearchForm[]>([]),liveAnswers=reactive<Record<string,Record<string,unknown>>>({})
let liveGeneration=0
const autoStartedTasks=new Set<string>()

/* ---------- 归一化数据源：赛题 / 本机任务 ---------- */
/* 统一七阶段骨架：全局分析 + 六个阶段步骤 + 报告与答辩（赛题/任务两种模式共用同一节奏）。 */
const STAGE_LABELS=['赛事理解','选题分析','研究方向','问卷与测试','正式调查','数据分析'] as const
const PAPER_LABEL='报告与答辩'
const cut=(s:string,n:number)=>s.length>n?s.slice(0,n)+'…':s
interface ReplayRow{label:string;question:string;method:string;finding:string}
interface ReplaySource{
  tag:string;title:string;summary:string;intro:string;note:string;
  rows:ReplayRow[];info:string[];callout?:string;
  items:{dimension:string;sample:string;scale:string}[];
  attach:string;toc:string[];backTo:string;workspaceLink?:string;
  evidenceRows?:ResearchDemoCase['evidenceRows'];sourceNote?:string;study?:ResearchDemoCase;
}
const task=computed<LocalResearchTask|undefined>(()=>{
  const id=route.query.task
  return id?researchStore.registry.tasks[String(id)]:undefined
})
const caseStudy=computed(()=>task.value?null:getResearchDemoCase(route.params.id as string|undefined))
const problem=computed(()=>task.value||caseStudy.value?undefined:getContestProblem(route.params.id as string|undefined))
const src=computed<ReplaySource|undefined>(()=>{
  if(caseStudy.value){const c=caseStudy.value;return {tag:c.tag,title:c.title,summary:c.summary,intro:c.intro,note:c.note,rows:c.rows,info:c.info,callout:c.callout,items:c.items,evidenceRows:c.evidenceRows,attach:c.attach,toc:[...STAGE_LABELS,PAPER_LABEL],backTo:'/',sourceNote:c.sourceNote,study:c}}
  if(problem.value){
    const p=problem.value
    const R=p.results.rows
    const q0=p.questionnaire.items[0]
    const rows:ReplayRow[]=[
      {label:'赛事理解',question:'通读题目背景与要求，明确研究对象与任务边界',method:'拆出已知信息、需要回答的问题与限制条件，形成任务清单。',finding:'关键口径：'+(p.guide[0]?.bullets?.[0]??'先界定对象与总体，再定抽样方式')},
      {label:'选题分析',question:'把背景拆解成可研究的问题，论证选题价值与创新点',method:'从题目要求出发拆解研究问题清单，明确每个问题的回答口径。',finding:'共拆解出 '+R.length+' 个研究问题，首个：'+cut(R[0]?.question??'',40)},
      {label:'研究方向',question:'确定调查方式、抽样设计与分析方法',method:'比较可行的调查方式与抽样方案，选定与问题匹配的分析路线。',finding:'拟采用：'+cut(R[0]?.method??'',44)},
      {label:'问卷与测试',question:'设计量表与题项，完成小样本预测试',method:'按研究问题设计量表维度与题项，小样本预测试检验信度与题项质量。',finding:q0?'量表示例：'+q0.dimension+'（'+q0.scale+'）':'量表设计待接入真实题项。'},
      {label:'正式调查',question:'组织问卷发放与数据回收',method:'确定发布渠道、调查对象、开始条件与停止规则，组织数据回收。',finding:'演示口径：按计划渠道发放，回收后逐份核查有效性并记录回收率。'},
      {label:'数据分析',question:'清洗数据并完成统计分析，输出关键发现',method:'数据清洗 → 描述统计 → 交叉与相关分析，逐一回答研究问题。',finding:R[R.length-1]?.finding??'分析结论待真实数据接入后补充。'},
    ]
    return{
      tag:'市调赛题（演示）',title:p.title,summary:p.summary,intro:p.results.intro,note:p.results.note,
      rows,
      info:p.guide[0]?.bullets??[],callout:p.guide[0]?.callout,
      items:p.questionnaire.items.map(it=>({dimension:it.dimension,sample:it.sample,scale:it.scale})),
      attach:'附件：实训指导书（'+p.wordCount+'）、问卷量表（'+p.questionnaire.items.length+' 个维度）、示例回收数据（演示口径）',
      toc:[...STAGE_LABELS,PAPER_LABEL],
      backTo:'/contest/problem/'+p.id,
    }
  }
  const t=task.value
  if(!t)return undefined
  const kind:WorkflowKind=t.workflowKind,label=workflowLabel(kind)
  const stages=stagesFor(kind)
  const rows:ReplayRow[]=[
    {label:'赛事理解',question:'通读任务背景与要求，明确研究对象与任务边界',method:'拆出已知信息、需要回答的问题与限制条件，形成任务清单。',finding:''},
    {label:'选题分析',question:'把背景拆解成可研究的问题，论证选题价值与创新点',method:'从背景出发拆解研究问题清单，明确每个问题的回答口径。',finding:''},
    {label:'研究方向',question:'确定调查方式、抽样设计与分析方法',method:'比较可行的调查方式与抽样方案，选定与问题匹配的分析路线。',finding:''},
    {label:'问卷与测试',question:'设计量表与题项，完成小样本预测试',method:'按研究问题设计量表维度与题项，小样本预测试检验信度与题项质量。',finding:''},
    {label:'正式调查',question:'组织问卷发放与数据回收',method:'确定发布渠道、调查对象、开始条件与停止规则，组织数据回收。',finding:''},
    {label:'数据分析',question:'清洗数据并完成统计分析，输出关键发现',method:'数据清洗 → 描述统计 → 交叉与相关分析，逐一回答研究问题。',finding:''},
  ]
  for(let i=0;i<rows.length;i++){
    const phase=kind==='full-study'?i:0
    rows[i]!.finding=t.viewedPhase>=phase
      ?'该阶段对应工作台「'+(stages[Math.min(phase,stages.length-1)]?.title??'—')+'」，已浏览过；草稿内容随任务保存，可随时去工作台查看或继续完善。'
      :'尚未开始；进入工作台该阶段可填写内容并本机保存。'
  }
  const bg=(t.competition?.background??'').trim()
  const reqs=(t.competition?.requirements??[]).map(r=>String(r?.text??'')).filter(s=>s.trim())
  const body=(t.report?.body??'').trim()
  return{
    tag:'本机任务 · '+label,
    title:t.title||label+'任务',
    summary:bg?bg.slice(0,220):'研究主题：'+(t.title||label)+'。背景尚未填写，可在工作台「'+(stages[0]?.title??'赛事理解')+'」阶段补充。',
  intro:'本任务为「'+label+'」类型。发送内容后通过当前账户的市调智能体会话处理；本机草稿不代表服务端运行结果，阶段进度仍需根据会话证据和人工确认核对。',
    note:body?body.slice(0,180):'报告正文尚未撰写；可在工作台「报告与答辩」阶段完成正文与答辩准备后本机保存。',
    rows,
    info:reqs.length?reqs:['先界定研究对象与总体，再选择抽样方式','量表题与行为题分开设计，便于后续统计','先定口径再动手：每一步先明确"用什么数据回答什么问题"'],
    items:[],
    attach:'附件：任务背景'+(bg?'（'+bg.length+' 字）':'（待补充）')+' · 各阶段草稿随本机任务保存',
    toc:[...STAGE_LABELS,PAPER_LABEL],
    backTo:'/mine',
    workspaceLink:'/research/work?mode='+kindToMode(kind)+'&task='+encodeURIComponent(t.localTaskId),
  }
})
watch(src,v=>{if(!v)void router.replace('/')},{immediate:true})

/* ---------- 状态 ---------- */
interface Art{kind:'analysis'|'animation'|'paper';title:string;sub:string;index:number;auto?:boolean}
interface Msg{key:string|number;who:'me'|'ai';html:string;arts?:Art[]}

const messages=ref<Msg[]>([])
const cur=ref(0)          /* 当前等待推进到的步骤下标（0=全局分析） */
const maxStep=ref(0)      /* 已经走到过的最大步骤 */
const envReadyLocal=ref(false)
const liveScopeMatches=computed(()=>!!task.value&&!!liveOwner.value&&liveSession.scope?.ownerId===liveOwner.value&&liveSession.scope?.taskId===task.value.localTaskId)
const envReady=computed(()=>task.value?liveScopeMatches.value:envReadyLocal.value)
const thinkingOn=ref(false)
const drawerOpen=ref(true)
const draft=ref('')
const openKey=ref('')
const openArt=ref<Art|null>(null)
const animBank=ref<{k:number;title:string;sub:string}[]>([])
const streamEl=ref<HTMLElement|null>(null)
const composerInput=ref<HTMLTextAreaElement|null>(null)
const followLatest=ref(true)
function resizeComposer(){
  const input=composerInput.value
  if(!input)return
  input.style.height='auto'
  input.style.height=Math.min(input.scrollHeight,144)+'px'
}
function sendOnEnter(event:KeyboardEvent){
  if(event.isComposing)return
  event.preventDefault()
  send()
}
function trackConversationScroll(){
  const stream=streamEl.value
  if(stream)followLatest.value=stream.scrollHeight-stream.clientHeight-stream.scrollTop<64
}
watch(draft,()=>{void nextTick(resizeComposer)})
onMounted(()=>{void nextTick(resizeComposer)})
let seq=0

const stepLabels=computed(()=>['全局分析',...src.value!.rows.map(r=>r.label),src.value!.toc[src.value!.toc.length-1]??PAPER_LABEL])
const activeStepIndexes=computed(()=>{
  if(!task.value)return [cur.value]
  if(!liveScopeMatches.value)return []
  const phaseSteps:Record<string,number[]>={G1:[1,2,3],G2:[4],G3:[6],G4:[7]}
  return phaseSteps[liveSession.serverPhase] ?? []
})
const totalSteps=computed(()=>stepLabels.value.length)
const totalDemos=computed(()=>totalSteps.value-1)   /* 报告不生成演示 */
const finished=computed(()=>!task.value&&cur.value>=totalSteps.value-1&&messages.value.length>1)
const canBack=computed(()=>!task.value&&cur.value>0)
const g3Action=computed(()=>researchG3Action(liveSession.reportedProgress))
const stagText=computed(()=>{
  if(task.value){
    if(!liveOwner.value)return '待登录'
    if(!liveScopeMatches.value)return '连接中'
    if(liveSession.status==='checking')return '检查中'
    if(liveSession.status==='running')return '生成中'
    if(liveSession.status==='interrupt')return '待填写或确认'
    if(liveSession.status==='uncertain')return '待核对'
    if(liveSession.status==='working')return '后台待核对'
    if(liveSession.status==='awaiting')return liveSession.nextStage ? '待确认进入 '+liveSession.nextStage : liveSession.serverPhase==='G3' ? g3Action.value?.badge || '待确认下一步' : '待输入'
    if(liveSession.status==='finished')return '本轮结束'
    return '待输入'
  }
  if(finished.value)return '全部完成'
  if(cur.value===0)return messages.value.length?'等待：确认全局分析':'等待你的指令'
  const next=stepLabels.value[cur.value+1]
  return next?'等待：进入'+next:'等待：确认报告初稿'
})
const latestGateTimedOut=computed(()=>liveScopeMatches.value && /HITL_TIMEOUT|等待用户审核超时/.test(liveSession.messages.at(-1)?.text || ''))
const chips=computed<string[]>(()=>{
  if(task.value){
    if(!liveScopeMatches.value)return []
    if(liveSession.halted||latestGateTimedOut.value||liveSession.busy||liveForms.value.length||['uncertain','working','running','interrupt'].includes(liveSession.status))return []
    if(liveSession.status==='awaiting' && liveSession.nextStage)return ['确认进入 '+liveSession.nextStage,'先说明需要修订的内容']
    if(liveSession.status==='awaiting' && liveSession.serverPhase==='G3')return [g3Action.value?.label || '查看当前需要确认的事项']
    return ['请结合题目梳理研究问题和方法','继续下一步']
  }
  if(finished.value)return ['重新复现一遍','回看全局分析']
  if(cur.value===0)return ['确认理解，进入下一步','再讲一遍全局分析','这个任务的研究方法是什么？']
  if(cur.value>=totalSteps.value-1)return ['确认报告初稿，完成复现','下载报告初稿','回看全局分析']
  return ['进入下一步','把这一步的方法再展开讲讲','跳过这一步，直接进入下一问']
})
const inputPlaceholder=computed(()=>task.value?'输入问题或补充说明…':'输入问题，或选择下方快捷指令…')
const envLabel=computed(()=>task.value?(liveScopeMatches.value?'真实会话已绑定':liveOwner.value?'正在绑定任务':'等待登录'):envReadyLocal.value?'演示环境就绪':'未创建环境')
const drawerTitle=computed(()=>!openArt.value?'产物预览':openArt.value.kind==='animation'?'可视化演示':openArt.value.kind==='analysis'?'问题分析':'报告初稿')
const drawerSub=computed(()=>!openArt.value?'随流程逐步生成':openArt.value.kind==='animation'?'点击左侧卡片回看 · 可手动收起':'由本步骤讲解内容整理')

/* ---------- 消息 ---------- */
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
const displayMessages=computed<Msg[]>(()=>{
  if(!liveScopeMatches.value||!liveSession.messages.length)return messages.value
  return liveSession.messages.flatMap(message=>{
    if(/^\s*\[平台留痕\]\s*等待用户审核超时[，,]/.test(message.text))return []
    const html=renderResearchMessage(message.text,message.role)
    if(!html)return []
    return [{key:message.id,who:message.role==='user'?'me' as const:'ai' as const,html}]
  })
})
const previewDialog=ref<HTMLDialogElement|null>(null)
const previewPath=ref('')
function closePreviewState(){previewPath.value='';openArt.value=null}
function closeOnBackdrop(event:MouseEvent){if(event.target===previewDialog.value)previewDialog.value?.close()}
async function openArtifactPreview(path:string){
  if(!liveScopeMatches.value || liveSession.busy)return
  openArt.value=null
  previewPath.value=path
  previewDialog.value?.showModal()
  await liveSession.previewArtifact(path)
}
watch(()=>openArt.value,art=>{if(art){previewPath.value='';void nextTick(()=>{if(!previewDialog.value?.open)previewDialog.value?.showModal()})}})
watch(()=>[task.value?.localTaskId,liveOwner.value,liveSession.identity?.threadId],()=>{previewDialog.value?.close();closePreviewState()})
onBeforeUnmount(()=>previewDialog.value?.close())
function isQuestionnairePath(path:string){return /(?:^|[/\\])问卷结构\.json$/i.test(path)}
function artifactType(name:string){
  const ext=name.toLowerCase().split('.').pop()??''
  if(isQuestionnairePath(name))return {kind:'questionnaire',label:'问卷',glyph:'问'}
  if(['xlsx','xls','csv','tsv'].includes(ext))return {kind:'spreadsheet',label:'表格',glyph:'表'}
  if(ext==='json')return {kind:'data',label:'数据',glyph:'数'}
  if(['md','txt','doc','docx','pdf'].includes(ext))return {kind:'document',label:'文档',glyph:'文'}
  if(['png','jpg','jpeg','webp','gif','svg'].includes(ext))return {kind:'image',label:'图片',glyph:'图'}
  return {kind:'other',label:'文件',glyph:'件'}
}
function openAgentQuestionnaire(){
  drawerOpen.value=true
  openArt.value=null
  const files=liveFiles.value.filter(file=>isQuestionnairePath(file.path))
  if(files.length===1 && !liveSession.busy)void openArtifactPreview(files[0]!.path)
}
const liveFiles=computed(()=>{
  if(!liveScopeMatches.value)return []
  const flatten=(nodes:ArtifactNode[]):ArtifactNode[]=>nodes.flatMap(node=>node.type==='file'?[node]:node.children?flatten(node.children):[])
  return flatten(liveSession.artifacts)
})

function push(who:Msg['who'],html:string,arts?:Art[]){messages.value.push({key:++seq,who,html,arts});scrollBottom()}
function scrollBottom(force=false){
  if(force)followLatest.value=true
  if(!followLatest.value)return
  void nextTick(()=>{
    if(followLatest.value && streamEl.value)streamEl.value.scrollTop=streamEl.value.scrollHeight
  })
}
watch(displayMessages,()=>scrollBottom(),{deep:true})
function think(cb:()=>void){thinkingOn.value=true;scrollBottom();setTimeout(()=>{thinkingOn.value=false;cb()},760)}
function artGrad(kind:Art['kind']){return kind==='analysis'?'linear-gradient(120deg,#12A594,#17A2C4)':kind==='animation'?'linear-gradient(120deg,#17A2C4,#2EC4B0)':'linear-gradient(120deg,#0B6E68,#2EC4B0)'}
function liveInputId(id:string,key:string){return 'replay-live-'+encodeURIComponent(id)+'-'+encodeURIComponent(key)}
function liveValue(id:string,key:string){return liveAnswers[id]?.[key]}
function setLiveField(id:string,field:ResearchField,event:Event){
  const target=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,text=target.value
  liveAnswerSet(id)[field.key]=field.kind==='number'&&text!==''?Number(text):text
}
function liveAnswerSet(id:string){return liveAnswers[id]??(liveAnswers[id]={})}
function isLiveChecked(id:string,key:string,option:string){const value=liveValue(id,key);return Array.isArray(value)&&value.includes(option)}
function liveStatusIs(...statuses:string[]){return statuses.includes(liveSession.status)}
function setLiveChoice(id:string,key:string,option:string){liveAnswerSet(id)[key]=option}
function toggleLiveChoice(id:string,key:string,option:string){
  const value=liveValue(id,key),next=Array.isArray(value)?[...value]:[],index=next.indexOf(option)
  if(index>=0)next.splice(index,1);else next.push(option)
  liveAnswerSet(id)[key]=next
}
async function syncLiveIdentity(){
  const currentTask=task.value
  const currentOwner=currentResearchOwner()
  if(currentTask && currentOwner && liveOwner.value===currentOwner && liveSession.scope?.ownerId===currentOwner && liveSession.scope?.taskId===currentTask.localTaskId)return
  const generation=++liveGeneration
  if(!currentTask){liveOwner.value='';return}
  const owner=currentResearchOwner();liveOwner.value=owner;liveError.value=''
  if(!owner){liveSession.dispose();liveError.value='请先登录，再连接市调智能体；当前题目仍保存在本机草稿中。';return}
  try{
    const agent=configuredResearchAgent()
    await liveSession.select({ownerId:owner,agentId:agent.id,taskId:currentTask.localTaskId})
    if(generation!==liveGeneration)return
    if(route.query.autoStart==='1'&&!autoStartedTasks.has(currentTask.localTaskId)){
      autoStartedTasks.add(currentTask.localTaskId)
      const query={...route.query};delete query.autoStart
      void router.replace({path:route.path,query})
      const background=(currentTask.competition?.background??'').trim()
      if(!background){liveError.value='当前任务没有研究主题，未启动智能体。';return}
      draft.value=background
      await sendLive(background,true)
    }
  }catch(error){if(generation===liveGeneration)liveError.value=error instanceof Error?error.message:'无法建立当前研究会话。'}
}
async function sendLive(text:string,initial=false,recoverExpiredGate=false){
  const currentTask=task.value,message=text.trim()
  if(!currentTask||!message)return
  if(!liveOwner.value){liveError.value='请先登录，再发送真实研究问题。';return}
  let generation=liveGeneration
  try{
    if(!liveScopeMatches.value){await syncLiveIdentity();generation=liveGeneration}
    if(generation!==liveGeneration||task.value?.localTaskId!==currentTask.localTaskId)return
    if(!liveOwner.value||!liveScopeMatches.value)return
    if(materialBusy.value){liveError.value='材料仍在上传或读取，请完成后发送。';return}
    if(liveSession.busy)return
    if(liveStatusIs('interrupt')){
      const choice=researchChoiceAnswer(liveForms.value,message)
      if(!choice){
        liveError.value='当前正在等待表单回答。请直接输入选项原文，或填写上方表单后提交。'
        return
      }
      liveAnswerSet(choice.interruptId)[choice.key]=choice.value
      liveError.value=''
      await submitLiveForms()
      if(generation===liveGeneration && !liveSession.error && !liveStatusIs('interrupt','uncertain') && draft.value.trim()===message)draft.value=''
      return
    }
    if(liveStatusIs('working','running')){liveError.value=liveSession.error||'当前运行状态尚未核对，请先恢复会话。';return}
    liveError.value=''
    if(liveSession.busy||liveSession.stopping)return

    if(liveStatusIs('working','running')){liveError.value=liveSession.error||'当前运行状态尚未核对，请先恢复会话。';return}
    const materialRefs=materials.value.length ? '\n\n本会话已上传材料引用（需读取核对）：\n'+materials.value.map(item=>item.fileName+' '+item.ref).join('\n') : ''
    const prompt=(initial?message:'研究主题：'+(currentTask.competition?.background??currentTask.title)+'\n\n我的问题或补充说明：\n'+message)+materialRefs
    const before=liveSession.messages.length
    await liveSession.start(prompt, {requireModelProbe:false,allowIdleMessage:!initial,recoverExpiredGate})
    if(generation!==liveGeneration||task.value?.localTaskId!==currentTask.localTaskId)return
    if(liveSession.messages.length>before&&draft.value.trim()===message)draft.value=''
    if(['finished','interrupt','awaiting'].includes(liveSession.status)&&liveSession.identity?.runId)await liveSession.refreshArtifacts()
  }catch(error){
    if(generation===liveGeneration)liveError.value=error instanceof Error?error.message:'发送失败，请核对当前会话状态。'
  }
}
interface LocalRecord {version:1;title:string;savedAt:string;phase:string;messages:{id:string;role:'user'|'assistant';text:string}[];files:{path:string;content:string}[];gaps:string[]}
const recordBusy=ref(false),recordNotice=ref(''),savedRecord=ref<LocalRecord|null>(null),recordStep=ref(1),recordDialog=ref<HTMLDialogElement|null>(null)
function localRecordKey(){return 'shidiaoyanzhen.record.v1:'+liveOwner.value+':'+liveSession.scope?.agentId+':'+task.value?.localTaskId}
async function saveLocalRecord(){
  if(recordBusy.value || !liveScopeMatches.value || !liveSession.identity || !liveSession.scope)return
  const generation=liveGeneration,key=localRecordKey(),identity={...liveSession.identity},agentId=liveSession.scope.agentId
  if(localStorage.getItem(key)){recordNotice.value='本任务的第一份记录已保存，点击“本机复现”查看。';return}
  recordBusy.value=true;recordNotice.value='正在保存当前对话与可读取产物…'
  try{
    const record:LocalRecord={version:1,title:task.value?.title || '研究记录',savedAt:new Date().toISOString(),phase:liveSession.serverPhase,messages:liveSession.messages.map(m=>({id:m.id,role:m.role,text:m.text})),files:[],gaps:[]}
    if(!record.messages.length)throw Error('尚未读取到对话，请先核对会话。')
    if(!liveSession.busy)await liveSession.refreshArtifacts()
    if(generation!==liveGeneration || key!==localRecordKey())return
    const files=[...liveFiles.value]
    if(!files.length)record.gaps.push(liveSession.error || '未读取到产物文件，仅保存当前对话和阶段')
    if(files.length>30)record.gaps.push('超过30份的文件未纳入本次记录')
    for(const file of files.slice(0,30)){
      try{
        if((file.size || 0)>300000)throw Error('文件超过本机快照大小上限')
        const content=await fetchArtifactContent(agentId,identity.threadId,file.path,AbortSignal.timeout(10000))
        if(generation!==liveGeneration || key!==localRecordKey())return
        if(content.content===null || content.truncated || content.binary)throw Error(content.reason || '文件无法完整保存为文本')
        record.files.push({path:file.path,content:content.content})
      }catch(error){record.gaps.push(file.name+'：'+(error instanceof Error?error.message:'读取失败'))}
    }
    const json=JSON.stringify(record)
    if(new Blob([json]).size>3000000)throw Error('记录超过3MB，请减少材料后保存。')
    if(generation!==liveGeneration || key!==localRecordKey())return
    localStorage.setItem(key,json)
    recordNotice.value='已保存第一份本机记录。'+(record.gaps.length?'部分文件未保存，复现时会显示缺口。':'可点击“本机复现”从头查看。')
  }catch(error){if(generation===liveGeneration)recordNotice.value='保存失败：'+(error instanceof Error?error.message:'浏览器存储不可用')}
  finally{recordBusy.value=false}
}
function openLocalRecord(){
  try{
    const raw=localStorage.getItem(localRecordKey())
    if(!raw)throw Error('请先保存本次记录。')
    const record=JSON.parse(raw) as LocalRecord
    if(record.version!==1 || !Array.isArray(record.messages) || !Array.isArray(record.files) || !Array.isArray(record.gaps))throw Error('本机记录格式不完整。')
    savedRecord.value=record;recordStep.value=Math.min(1,record.messages.length);recordDialog.value?.showModal()
  }catch(error){recordNotice.value=error instanceof Error?error.message:'无法读取本机记录。'}
}
watch(()=>[task.value?.localTaskId,liveOwner.value],()=>{recordDialog.value?.close();savedRecord.value=null;recordNotice.value=''})
const materialInput=ref<HTMLInputElement|null>(null)
const selectedMaterial=ref<File|null>(null)
const fileTab=ref<'artifacts'|'materials'>('artifacts')
const artifactReadState=ref<'idle'|'loading'|'loaded'|'error'>('idle')
const artifactReadError=ref('')
const materialsLoaded=ref(false)
async function refreshFileArtifacts(){
  if(!liveScopeMatches.value || !liveSession.identity || liveSession.busy)return
  const generation=liveGeneration
  const threadId=liveSession.identity.threadId
  artifactReadState.value='loading'
  artifactReadError.value=''
  await liveSession.refreshArtifacts()
  if(generation!==liveGeneration || threadId!==liveSession.identity?.threadId)return
  artifactReadError.value=liveSession.error || ''
  artifactReadState.value=artifactReadError.value?'error':'loaded'
}
const materials=ref<AttachmentItem[]>([])
const materialError=ref(''),materialBusy=ref(false)
let materialOperation=0
let materialController:AbortController|undefined
function materialContext(){
  if(!task.value || !liveScopeMatches.value || !liveSession.identity || !liveSession.scope)return null
  return {taskId:task.value.localTaskId,ownerId:liveOwner.value,agentId:liveSession.scope.agentId,threadId:liveSession.identity.threadId}
}
function sameMaterialContext(context:NonNullable<ReturnType<typeof materialContext>>,operation:number){
  const current=materialContext()
  return operation===materialOperation && current?.taskId===context.taskId
    && current.ownerId===context.ownerId && current.agentId===context.agentId
    && current.threadId===context.threadId && current.ownerId===currentResearchOwner()
}
const materialDialog=ref<HTMLDialogElement|null>(null)
function openMaterialManager(){materialDialog.value?.showModal();void reloadMaterials()}
async function removeMaterial(item:AttachmentItem,confirmDelete=false){
  const context=materialContext()
  if(!context || materialBusy.value || liveSession.busy || !materials.value.some(file=>file.ref===item.ref && file.fileId===item.fileId))return
  if(confirmDelete && !window.confirm('确定删除「'+item.fileName+'」吗？删除后智能体将无法继续读取该附件。'))return
  if(!sameMaterialContext(context,materialOperation))return
  const operation=++materialOperation
  materialController=new AbortController();materialBusy.value=true;materialError.value=''
  try{
    await deleteAttachment(context.agentId,context.threadId,item.fileId,materialController.signal)
    if(!sameMaterialContext(context,operation))return
    materials.value=materials.value.filter(file=>file.ref!==item.ref)
    if(materialInput.value)materialInput.value.value=''
  }catch(error){
    if(sameMaterialContext(context,operation))materialError.value=(error instanceof Error?error.message:'删除失败。')+' 请刷新附件列表核对实际结果。'
  }finally{if(sameMaterialContext(context,operation))materialBusy.value=false}
}
async function reloadMaterials(){
  const context=materialContext()
  if(!context || materialBusy.value)return
  const operation=++materialOperation
  materialController=new AbortController();materialBusy.value=true;materialError.value=''
  try{
    const items=await listAttachments(context.agentId,context.threadId,materialController.signal)
    if(sameMaterialContext(context,operation)){
      materials.value=items.filter(item=>item.ref)
      materialsLoaded.value=true
    }
  }catch(error){
    if(sameMaterialContext(context,operation))materialError.value=error instanceof Error?error.message:'材料列表读取失败。'
  }finally{if(sameMaterialContext(context,operation))materialBusy.value=false}
}
async function chooseMaterial(event:Event){
  selectedMaterial.value=(event.target as HTMLInputElement).files?.[0] || null
  if(selectedMaterial.value)await uploadMaterial()
}
async function uploadMaterial(){
  const context=materialContext(),file=selectedMaterial.value
  if(!context || !file || materialBusy.value || liveSession.busy)return
  materialError.value=''
  const check=precheckFile(file)
  if(!check.ok){materialError.value=check.message || '文件未通过检查。';return}
  if(!file.size){materialError.value='文件为空，请检查文件内容后重新选择。';return}
  if(liveSession.serverPhase==='G3' && !/\.(csv|tsv|md|txt|json)$/i.test(file.name)){
    materialError.value='G3 请提供 CSV/TSV 数据，或 MD/TXT/JSON 分析计划。';return
  }
  const operation=++materialOperation
  materialController=new AbortController();materialBusy.value=true
  try{
    const item=await uploadAttachment(context.agentId,context.threadId,file,materialController.signal)
    if(!sameMaterialContext(context,operation))return
    if(!item.ref)throw Error('上传返回缺少服务器材料引用，尚不能确认上传结果。')
    materials.value=[...materials.value.filter(existing=>existing.ref!==item.ref),item]
    selectedMaterial.value=null
    if(materialInput.value)materialInput.value.value=''
  }catch(error){
    if(sameMaterialContext(context,operation))materialError.value=(error instanceof Error?error.message:'上传失败。')+' 请先读取已上传材料核对结果，再决定是否重试。'
  }finally{if(sameMaterialContext(context,operation))materialBusy.value=false}
}
watch(()=>[task.value?.localTaskId,liveOwner.value,liveSession.identity?.threadId],()=>{
  materialDialog.value?.close()
  materialOperation++;materialController?.abort();materialBusy.value=false
  fileTab.value='artifacts';artifactReadState.value='idle';artifactReadError.value='';materialsLoaded.value=false
  materials.value=[];selectedMaterial.value=null;materialError.value=''
  if(materialInput.value)materialInput.value.value=''
  void reloadMaterials()
},{immediate:true})
onBeforeUnmount(()=>{materialDialog.value?.close();materialOperation++;materialController?.abort()})
const feedbackClock=ref(Date.now())
let feedbackTimer:ReturnType<typeof setInterval>|undefined
const formSubmitting=computed(()=>liveSession.formSubmission ? liveSession.formSubmission.settledAt===null : liveSession.busy && liveSession.status==='running' && liveForms.value.length>0)
const submissionFeedback=computed(()=>{
  const submission=liveSession.formSubmission
  if(!submission){
    if(!formSubmitting.value)return null
    return {active:true,warning:false,step:0,title:'等待服务端回应',detail:'本次请求正在等待返回，接收结果尚待确认。',elapsed:null}
  }
  const active=formSubmitting.value || liveSession.status==='working'
  const now=active?Math.max(feedbackClock.value,submission.startedAt):(submission.settledAt || submission.startedAt)
  const elapsed=Math.max(0,Math.floor((now-submission.startedAt)/1000))
  const quiet=active && now-submission.lastEventAt>=45000
  const failed=!!liveSession.error || liveSession.status==='uncertain' || liveSession.halted
  const warning=failed || quiet || submission.checkFailed
  const step=submission.replyAt? (active?2:3):submission.runStartedAt?1:0
  let title='正在核对并发送表单'
  let detail='请稍候，正在核对本次填写内容与当前待答表单。'
  if(submission.issued){title='正在发送，等待服务端响应';detail='请求已发出，收到服务端事件后会更新下方步骤。'}
  if(submission.runStartedAt){title='服务端已响应，智能体处理中';detail='已收到开始运行事件，回复会同步显示在对话中。'}
  if(submission.replyAt){title='正在接收智能体回复';detail='已收到回复内容，请查看上方对话。'}
  if(!active && !failed){
    title=liveSession.status==='interrupt'?'已收到后续表单，请继续确认':'本轮处理已结束'
    detail=liveSession.status==='interrupt'?'请查看下方新表单，核对后继续。':'请查看对话中的回复和下一步要求。'
  }
  if(quiet){
    title='暂未收到新回复'
    detail=submission.checkMessage || '本次请求仍在等待回应，暂时无法确认新的处理进展。'
  }
  if(submission.checkFailed && !failed){title='状态核对暂时失败';detail=submission.checkMessage}
  if(failed){title=submission.issued?'提交结果需要核对':'本次未能提交';detail=liveSession.error || '请核对当前会话状态，填写内容已保留。'}
  return {active:active && !failed,warning,step,title,detail,elapsed}
})
async function recheckSubmission(){
  if(formSubmitting.value)await liveSession.checkFormSubmission()
  else await liveSession.recover({readOnly:true})
}
onMounted(()=>{feedbackTimer=setInterval(()=>{feedbackClock.value=Date.now()},1000)})
onBeforeUnmount(()=>{clearInterval(feedbackTimer)})
async function submitLiveForms(){
  if(liveSession.busy || liveSession.stopping)return
  const generation=liveGeneration
  const request=liveSession.submit(liveAnswers)
  await nextTick()
  if(generation===liveGeneration)scrollBottom(true)
  await request
  if(generation===liveGeneration)scrollBottom(true)
}
const backgroundChecks=ref(0)
let backgroundTimer:ReturnType<typeof setInterval>|undefined
watch(()=>[task.value?.localTaskId,liveSession.identity?.threadId,liveSession.identity?.runId],()=>{backgroundChecks.value=0})
async function checkBackground(){
  if(document.visibilityState==='visible' && liveScopeMatches.value && formSubmitting.value && backgroundChecks.value<120){
    backgroundChecks.value++
    await liveSession.checkFormSubmission()
    return
  }
  if(document.visibilityState!=='visible'||!liveScopeMatches.value||liveSession.status!=='working'||liveSession.busy||liveSession.halted||backgroundChecks.value>=120)return
  backgroundChecks.value++
  const generation=liveGeneration
  await liveSession.recover({readOnly:true})
  if(generation!==liveGeneration||!liveScopeMatches.value)return
  scrollBottom()
}
function visibilityChanged(){if(document.visibilityState==='visible')void checkBackground()}
function authChanged(){void syncLiveIdentity()}
watch(()=>liveSession.interrupts,items=>{try{liveForms.value=items.map(normalizeResearchInterrupt);liveFormError.value='';for(const form of liveForms.value){if(!liveAnswers[form.interruptId])liveAnswers[form.interruptId]={};for(const field of form.fields)if(liveAnswers[form.interruptId]![field.key]===undefined&&field.initialValue!==undefined)liveAnswers[form.interruptId]![field.key]=field.initialValue}}catch(error){liveFormError.value=error instanceof Error?error.message:'无法解析服务端表单。';liveForms.value=[]}},{immediate:true,deep:true})
watch(()=>[task.value?.localTaskId,userStore.token],()=>{void syncLiveIdentity()},{immediate:true})
onMounted(()=>{window.addEventListener('storage',authChanged);window.addEventListener(AUTH_CHANGE_EVENT,authChanged);document.addEventListener('visibilitychange',visibilityChanged);backgroundTimer=setInterval(()=>{void checkBackground()},5000)})
onBeforeUnmount(()=>{liveGeneration++;clearInterval(backgroundTimer);document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('storage',authChanged);window.removeEventListener(AUTH_CHANGE_EVENT,authChanged)})


/* ---------- 步骤内容（赛题数据 / 本机任务归一化后共用） ---------- */
function globalHtml():string{
  const s=src.value!
  return '<div class="lead-line">我会带你完整走一遍这道题：先<strong>全局分析</strong>，再按<strong>赛事理解 → 选题分析 → 研究方向 → 问卷与测试 → 正式调查 → 数据分析 → 报告与答辩</strong>七个阶段逐步讲解。你说一句（发送或点快捷指令），我才走一步。</div>'
    +'<h4>1. 题目背景</h4><p>'+esc(s.summary)+'</p>'
    +'<h4>2. 七阶段流程一览</h4><ul>'+s.rows.map(r=>'<li><b>'+esc(r.label)+'</b>：'+esc(r.question)+'</li>').join('')+'<li><b>'+esc(PAPER_LABEL)+'</b>：整理结论成稿，准备答辩材料</li></ul>'
    +'<h4>3. 动手前的关键判断</h4><ul>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>'
    +(s.callout?'<p>'+esc(s.callout)+'</p>':'')
    +'<p class="next">下一步：确认理解没问题，我就进入<b>'+esc(stepLabels.value[1]??'下一步')+'</b>，把目标、方法与预期产出逐步展开。</p>'
}
function comprehensionWalk():string{
  const s=src.value!
  const subs=s.info.length?s.info:['把赛题总目标拆成 3–4 个可测量、可回答的子问题']
  return '<h4>赛事理解 · 把命题翻译成可研究的调研任务</h4>'
    +'<h4>1. 还原真问题</h4><p>赛题给的是现实场景：'+esc(cut(s.summary,72))+'。先区分<b>表象问题</b>与<b>根问题</b>——前者是现象，后者才是调研该回答的；写出"谁遇到什么问题、为什么现在要研究它"。</p>'
    +'<h4>2. 拆解核心研究问题</h4><ul>'+subs.map(b=>'<li>'+esc(b)+' —— 需标注"用什么数据、什么方法回答"</li>').join('')+'</ul>'
    +'<h4>3. 关键概念操作性定义</h4><p>把核心概念写成可测量或可判定的规则，交代变量、对象、时间范围与边界，避免问卷和分析使用不同口径。'+(s.items[0]?'示例：「'+esc(s.items[0].dimension)+'」可按当前材料中的题库主题继续核对：「'+esc(s.items[0].sample)+'」':'')+'</p>'
    +'<h4>4. 已知信息与数据资源盘点</h4><p>当前可用材料：'+esc(s.attach)+'。逐份说明覆盖范围和不能支持的结论，详见右侧材料清单。</p>'
    +'<h4>5. 约束条件与边界</h4><p>明确研究对象与总体、时间/预算、伦理合规（未成年人、敏感数据）与可获取样本边界。</p>'
    +'<h4>6. 评审要点对齐</h4><p>站在评委视角：问题界定清晰度、方法严谨性、结论可核查性、数据真实性、报告完整度——写成贯穿全程的 checklist。</p>'
    +'<p class="next">右侧抽屉已生成《概念定义表》《信息清单》两份可勾选产物。确认理解后，进入<b>'+esc(s.rows[1].label)+'</b>。</p>'
}
function comprehensionProduct():string{
  const s=src.value!
  const definitions=s.items.length?s.items.slice(0,4):[]
  const evidence=s.evidenceRows??[
    {source:'赛题材料',scope:'当前可见的背景与指导书',supports:'题目要求与研究问题梳理',limitation:'需以实际提供材料和来源核验。'},
    {source:'问卷材料',scope:'已核验的问卷题项',supports:'变量与测量设计',limitation:'题项版本和编码需人工确认。'},
    {source:'分析材料',scope:'来源报告汇总',supports:'报告中明确记录的统计结果',limitation:'不得替代原始数据复算。'},
  ]
  return '<h4>赛事理解 · 产物（来源与口径）</h4>'
    +'<h4>1. 研究主题</h4><p>'+esc(cut(s.summary,180))+'</p>'
    +'<h4>2. 已有材料清单</h4><ul>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>'
    +'<h4>3. 问卷主题摘要</h4>'
      +(definitions.length?'<table class="dtable"><thead><tr><th>主题</th><th>说明</th><th>题项状态</th></tr></thead><tbody>'
        +definitions.map(it=>'<tr><td>'+esc(it.dimension)+'</td><td>'+esc(it.sample)+'</td><td>'+esc(it.scale)+'</td></tr>').join('')
        +'</tbody></table>':'<p>当前没有可核验的问卷题项。</p>')
    +'<h4>4. 来源证据与限制</h4>'
      +'<table class="dtable"><thead><tr><th>来源</th><th>范围</th><th>可支持的判断</th><th>限制／待核验</th></tr></thead><tbody>'
      +evidence.map(row=>'<tr><td>'+esc(row.source)+'</td><td>'+esc(row.scope)+'</td><td>'+esc(row.supports)+'</td><td>'+esc(row.limitation)+'</td></tr>').join('')
      +'</tbody></table>'
    +(s.callout?'<p class="dnote">'+esc(s.callout)+'</p>':'')
    +(s.sourceNote?'<p class="dnote">'+esc(s.sourceNote)+'</p>':'')
}

function questionHtml(k:number):string{
  if(k===1)return comprehensionWalk()
  const s=src.value!
  const row=s.rows[k-1]
  const last=k>=s.rows.length
  return '<h4>'+esc(row.label)+' · 解题分析</h4>'
    +'<h4>1. 本步目标</h4><p>'+esc(row.question)+'</p>'
    +'<h4>2. 方法路线</h4><p>'+esc(row.method)+'</p>'
    +'<h4>3. 当前进展（示例口径）</h4><p>'+esc(row.finding)+'</p>'
    +'<p class="next">'+(last?'下一步：进入<b>报告初稿</b>，我会给出报告目录与结论要点。':'下一步：进入<b>'+esc(s.rows[k].label)+'</b>，我会继续展开目标、方法与预期产出。')+'</p>'
}
function paperHtml():string{
  const s=src.value!
  return '<h4>报告初稿 · 收束成稿</h4>'
    +'<h4>1. 报告目录</h4><ol class="toc-mini">'+s.toc.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ol>'
    +'<h4>2. 结论要点</h4><p>'+esc(s.note)+'</p>'
    +'<p class="next">'+(s.workspaceLink?'复现到此完成。要正式撰写与保存，可点右侧「进入七阶段工作台编辑本任务」。':'复现到此完成。要正式撰写报告，可回到七阶段工作台的「报告与答辩」阶段继续完善并本机保存。')+'</p>'
}
function analysisHtml(k:number):string{
  const s=src.value!
  if(k===0){
    return '<h4>研究步骤清单</h4><ul>'+s.rows.map(r=>'<li><b>'+esc(r.label)+'</b>：'+esc(r.question.replace(/^推进「[^」]*」阶段：/,''))+'<br /><small>方法：'+esc(r.method)+'</small></li>').join('')+'</ul>'
      +'<h4>信息清单（能回答什么 / 缺什么）</h4><ul>'+s.info.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>'
      +(s.callout?'<p class="dnote">'+esc(s.callout)+'</p>':'')
  }
  if(k===1)return comprehensionProduct()
  if(k>=1&&k<=s.rows.length){
    const row=s.rows[k-1]
    return '<h4>本步目标</h4><p>'+esc(row.question)+'</p><h4>方法与当前进展</h4><p>'+esc(row.method)+'</p><p class="dfind">'+esc(row.finding)+'</p>'
      +(s.items.length?'<h4>涉及量表（示例）</h4><table class="dtable"><thead><tr><th>维度</th><th>示例题项</th><th>量表</th></tr></thead><tbody>'
        +s.items.slice(0,4).map(it=>'<tr><td>'+esc(it.dimension)+'</td><td>'+esc(it.sample)+'</td><td>'+esc(it.scale)+'</td></tr>').join('')
        +'</tbody></table>':'')
  }
  return paperHtml()
}

/* ---------- 推进流程 ---------- */
function stepArts(k:number):Art[]{
  const s=src.value!
  const label=k===0?'全局分析':k>=totalSteps.value-1?PAPER_LABEL:s.rows[k-1]?.label??PAPER_LABEL
  const arts:Art[]=[{kind:'analysis',title:label+' · 分析产物',sub:k===0?'研究步骤清单 + 信息清单 + 关键口径':k===1?'六板块拆解 + 概念定义表 + 信息清单':'目标 + 方法路线 + 当前进展',index:k}]
  if(k<totalSteps.value-1)arts.push({kind:'animation',title:'演示'+cn(k+1)+' · '+label+'演示',sub:(ANIM_SUBS[Math.min(k,ANIM_SUBS.length-1)]??'示意图')+' · 自动生成',index:k,auto:true})
  else arts.push({kind:'paper',title:'报告初稿 · v1',sub:'目录 + 结论要点 · 自动生成',index:k})
  return arts
}
function pushStep(k:number){
  cur.value=k;maxStep.value=Math.max(maxStep.value,k);envReadyLocal.value=true
  const html=k===0?globalHtml():k>=totalSteps.value-1?paperHtml():questionHtml(k)
  const arts=stepArts(k)
  push('ai',html,arts)
  const auto=arts.find(a=>a.auto)
  if(auto)setTimeout(()=>{openArt.value=auto;openKey.value=seq+'-auto';registerAnim(auto);drawerOpen.value=true},700)
}
function quickSayToastLike(text:string){
  if(task.value&&liveScopeMatches.value){liveError.value=text;return}
  push('ai','<p>'+esc(text)+'</p>')
}
function advance(){if(!finished.value)pushStep(cur.value+1)}
function registerAnim(a:Art){
  if(a.kind!=='animation')return
  if(!animBank.value.some(q=>q.k===a.index))animBank.value.push({k:a.index,title:a.title,sub:a.sub})
  animBank.value.sort((x,y)=>x.k-y.k)
}
function viewArt(art:Art,key:string){
  openArt.value=art;openKey.value=key;drawerOpen.value=true;registerAnim(art)
}
function switchAnim(k:number){const hit=animBank.value.find(q=>q.k===k);if(!hit)return;openArt.value={kind:'animation',title:hit.title,sub:hit.sub,index:k};openKey.value='anim-'+k}
function jumpStep(i:number){
  if(task.value){liveError.value='真实任务进度以当前会话和人工确认记录为准，不能通过回看按钮代替阶段确认。';return}
  if(i>maxStep.value){quickSayToastLike('这一步还没走到，先按顺序往下推进');return}
  push('me','回到「'+esc(stepLabels.value[i])+'」，我想再看一遍')
  think(()=>pushStep(i))
}
function backStep(){if(canBack.value)jumpStep(cur.value-1)}
function askPause(){
  if(task.value){liveError.value='当前是真实市调智能体会话；可以在下方继续输入具体问题。';return}
  push('ai','<h4>暂停一下，听你问</h4><p>复现按固定剧本推进：左边是每一步的分析讲解，右边是对应的分析产物与演示。你可以直接在下方输入具体问题；本页演示仅在本机回显。</p>')
}
function pickFile(){
  if(task.value){materialInput.value?.click();return}
  push('me','上传了一份补充材料（演示）：<span class="kv">补充材料.xlsx · 已接收</span>')
  think(()=>push('ai','<p>已接收（演示回显，不会真实解析）。流程继续按剧本推进；正式环境中这里会接入本机沙箱做字段解析与质量检查。</p>'))
}
function reset(){
  followLatest.value=true
  messages.value=[];cur.value=0;maxStep.value=0;envReadyLocal.value=false;thinkingOn.value=false;animBank.value=[];openArt.value=null;openKey.value='';draft.value='';liveError.value='';liveFormError.value=''
  const s=src.value
  if(!s)return
  if(task.value){
    const background=(task.value.competition?.background??'').trim()
    if(route.query.autoStart==='1'&&background)draft.value=background
    if(!background)liveError.value='当前任务没有研究主题；请先补充题目后再发送。'
    if(!liveScopeMatches.value||!liveSession.messages.length)push('ai','<p>真实研究任务已载入；发送后将调用已配置的市调智能体。页面不会用固定演示脚本生成该任务的分析或阶段结论。</p>')
    return
  }
  const lead=problem.value?'（已载入赛题与实训指导书）':caseStudy.value?'（已载入提供的赛题材料；本机完整演示）':'（已载入本机研究任务）'
  push('me',lead+'<br><b>'+esc(s.tag)+'</b>：'+esc(s.title)+'。<br>'+esc(s.attach))
  think(()=>pushStep(0))
}
function sendMaterials(){
  if(!materials.value.length)return
  void sendLive(draft.value.trim() || '请读取本会话已上传的材料，核对文件是否可读、字段及当前阶段的材料缺口，并反馈读取结果。标有合成测试的文件按软件演练材料登记。统计执行等待我确认。')
}
function send(){
  const text=draft.value.trim()
  if(text || (task.value && materials.value.length))scrollBottom(true)
  if(task.value && !text && materials.value.length){sendMaterials();return}
  if(!text){quickSayToastLike(task.value?'请先输入要发送给市调智能体的问题。':'和 AI 说一句话，它才会继续下一步');return}
  if(task.value){void sendLive(text);return}
  draft.value=''
  push('me',esc(text))
  respond(text)
}
function quickSay(chip:string){
  scrollBottom(true)
  if(task.value){
    if(chip==='确认进入 G4' && liveSession.nextStage==='G4'){
      void sendLive('确认进入 G4，仅启动当前会话允许的报告骨架与图表清单整理，沿用已有统计结果，暂不重新执行统计。保留所有待补材料、待确认分析计划和结论边界；报告正文与讲稿由团队完成。')
      return
    }
    const action=g3Action.value
    void sendLive(action && chip===action.label ? action.message : chip)
    return
  }
  if(/重新复现|重新|再来/.test(chip)){reset();return}
  if(/下载报告/.test(chip)){downloadReport();return}
  push('me',esc(chip))
  respond(chip)
}
function respond(text:string){
  think(()=>{
    if(finished.value){
      if(/回看/.test(text)){jumpStep(0);return}
      if(/报告|下载/.test(text)){downloadReport();return}
      push('ai','<p>复现已完成。点「重新复现一遍」可从头再来'+(src.value?.workspaceLink?'，或进入工作台继续编辑本任务。':'，或回到赛题页查看实训指导书。')+'</p>')
      return
    }
    if(/再讲|再看看|再展开|什么口径|口径|方法/.test(text)&&!/跳过|下一步/.test(text)){
      const k=Math.min(cur.value,totalSteps.value-1)
      push('ai',k===0?globalHtml():k>=totalSteps.value-1?paperHtml():questionHtml(k),stepArts(k))
      return
    }
    advance()
  })
}

/* ---------- 可视化演示（内联 SVG 示意，每阶段专属图形） ---------- */
const ANIM_SUBS=['调研流程图','信息盘点矩阵','研究问题拆解树','抽样漏斗','量表结构与信度','回收进度曲线','分组对比图']
function svgHead(title:string,sub:string,h:number):string{
  return '<rect x="0" y="0" width="880" height="'+h+'" rx="14" fill="#fff"/>'
    +'<text x="30" y="38" font-size="15" font-weight="800" fill="#0B6E68">'+esc(title)+'</text>'
    +'<text x="30" y="60" font-size="11" fill="#7C99A1">'+esc(sub)+'</text>'
}
function svgFoot(h:number):string{
  const label=src.value?.study?.sourceNote??'演示口径 · 示例数据，仅用于讲解流程与统计口径'
  return '<text x="30" y="'+(h-12)+'" font-size="10" fill="#9AB4BB">'+esc(label)+'</text>'
}
function researchCaseSvg(k:number,c:ResearchDemoCase):string{
  const title=['全局流程','材料盘点','问题拆解','研究方法','问卷主题','调查安排','报告统计结果'][k]??'材料说明'
  if(k===0){
    const labels=[...STAGE_LABELS,PAPER_LABEL],w=108,g=13,x0=31
    const boxes=labels.map((label,i)=>{const x=x0+i*(w+g);return '<rect x="'+x+'" y="93" width="'+w+'" height="56" rx="11" fill="url(#g1)"/><text x="'+(x+w/2)+'" y="126" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">'+esc(label)+'</text>'+(i<labels.length-1?'<path d="M'+(x+w+2)+' 121 l10 0" stroke="#7FE0A8" stroke-width="2"/>':'')}).join('')
    return '<svg viewBox="0 0 880 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="大学生兼职调查完整流程"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E8F84"/><stop offset="1" stop-color="#17A2C4"/></linearGradient></defs><rect width="880" height="230" rx="14" fill="#0B6E68"/><text x="30" y="42" font-size="15" font-weight="800" fill="#fff">'+esc(cut(c.title,62))+'</text><text x="30" y="67" font-size="11" fill="#d6eeeb">材料复现 · 本机固定演示 · 不连接智能体</text>'+boxes+'</svg>'
  }
  let cards:{heading:string;lines:string[]}[]=[]
  if(k===1)cards=[{heading:'计划书',lines:['研究背景与目标','预测试与调查安排']},{heading:'兼职问卷题库',lines:['题项主题摘要','版本存在重复项']},{heading:'PCA 分析文档',lines:['12 个原始变量','来源报告统计汇总']}]
  else if(k===2)cards=[{heading:'现状描述',lines:c.researchQuestions.slice(0,2)},{heading:'满意度口径',lines:c.researchQuestions.slice(2,3)},{heading:'证据转化建议',lines:c.researchQuestions.slice(3)}]
  else if(k===3)cards=[{heading:'调查设计',lines:['文献研究','访谈','问卷调查']},{heading:'描述与分类',lines:['描述统计','文本分析／词云','K-means 聚类']},{heading:'关系与降维',lines:['非参数检验','多重响应分析','主成分／相关分析']}]
  else if(k===4)cards=[{heading:'题库主题',lines:c.questionnaireThemes.slice(0,3)},{heading:'题库主题',lines:c.questionnaireThemes.slice(3)},{heading:'核对事项',lines:['题号／选项重复','正式题项及编码待核验']}]
  else if(k===5)cards=[{heading:'预测试',lines:['78 份（计划书记载）','2022-01-08 至 01-15']},{heading:'正式调查',lines:['最终采纳 600 份','2022-01-19 至 01-31']},{heading:'后续安排',lines:['数据审核：02-01 至 02-05','统计与报告：02-09 至 03-10']}]
  else {
    const m=c.metrics
    cards=[{heading:'量表与适配度',lines:['信度：'+m.reliability,'效度：'+m.validity,'KMO：'+m.kmo]},{heading:'主成分分析',lines:['原始变量：'+m.originalVariables,'主成分：'+m.pcaComponents,'累积方差：'+m.pcaCumulativeVariance]},{heading:'因子与来源系数（待核验）',lines:m.factors.map((factor,index)=>factor+'：'+(m.modelCoefficients[index]??'未列示'))}]
  }
  const body=cards.map((card,i)=>{
    const x=28+i*282,lineGap=card.lines.length>4?20:28,lines=card.lines.map((line,j)=>'<text x="'+(x+15)+'" y="'+(119+j*lineGap)+'" font-size="11" fill="#3D6570">'+esc(cut(line,35))+'</text>').join('')
    return '<rect x="'+x+'" y="78" width="258" height="145" rx="12" fill="#fff" stroke="#DCEDEE"/><rect x="'+x+'" y="78" width="258" height="31" rx="12" fill="url(#g1)"/><text x="'+(x+129)+'" y="99" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">'+esc(card.heading)+'</text>'+lines
  }).join('')
  const subtitle=k===6?'来源系数的模型定义待回查，不解释为方差贡献或因果效应':'按提供材料整理；来源汇总未重新计算'
  return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(title)+'"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E8F84"/><stop offset="1" stop-color="#17A2C4"/></linearGradient></defs>'+svgHead(title,subtitle,260)+body+svgFoot(260)+'</svg>'
}

function animSvg(k:number):string{
  if(src.value?.study)return researchCaseSvg(k,src.value.study)
  const s=src.value!
  /* k=0 全局分析：七阶段流程图（深底） */
  if(k===0){
    const labels=[...STAGE_LABELS]
    const w=124,g=18,x0=Math.max(24,(880-(labels.length*w+(labels.length-1)*g))/2)
    const boxes=labels.map((n,i)=>{
      const x=x0+i*(w+g)
      return '<rect x="'+x+'" y="86" width="'+w+'" height="58" rx="12" fill="url(#g1)"/><text x="'+(x+w/2)+'" y="112" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">'+esc(n)+'</text><text x="'+(x+w/2)+'" y="130" text-anchor="middle" font-size="10.5" fill="rgba(255,255,255,.78)">阶段 '+(i+1)+'</text>'
      +(i<labels.length-1?'<path d="M'+(x+w+2)+' 115 l12 0" stroke="#7FE0A8" stroke-width="2.4" stroke-linecap="round"/><path d="M'+(x+w+9)+' 109 l9 6 -9 6" fill="none" stroke="#7FE0A8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>':'')
    }).join('')
    return '<svg viewBox="0 0 880 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="调研流程演示">'
      +'<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E8F84"/><stop offset="1" stop-color="#17A2C4"/></linearGradient></defs>'
      +'<rect x="0" y="0" width="880" height="230" rx="14" fill="#0B6E68"/>'
      +'<text x="30" y="42" font-size="16" font-weight="800" fill="#fff">演示一 · 全局分析演示：'+esc(s.title.slice(0,22))+(s.title.length>22?'…':'')+'</text>'
      +'<text x="30" y="64" font-size="11" fill="rgba(255,255,255,.72)">'+esc(s.tag)+' · 七阶段调研全流程 · 演示口径</text>'
      +boxes+'</svg>'
  }
  const row=s.rows[Math.min(k-1,s.rows.length-1)]
  const head=svgHead('演示'+cn(k+1)+' · '+row.label+'演示（示例口径）',cut(row.method,46),260)
  /* k=1 赛事理解：信息盘点矩阵 */
  if(k===1){
    const qs=(s.info.length?s.info.slice(0,3):[]).map(b=>cut(b,16))
    const pool=['复购现状如何','流失原因是什么','分层差异在哪','渠道贡献多大','行动建议是什么']
    while(qs.length<3)qs.push(pool[qs.length]!)
    const cols:[string,string[]][]=[
      ['已知信息',['背景与任务要求','订单/问卷/深访材料','往届评分关注点']],
      ['待回答问题',qs],
      ['约束边界',['时间与预算','样本可及范围','伦理与隐私']],
    ]
    const body=cols.map((c,ci)=>{
      const x=36+ci*274
      const chips=c[1].map((t,j)=>'<rect x="'+(x+14)+'" y="'+(124+j*32)+'" width="212" height="26" rx="8" fill="#F0FAF8" stroke="#DCEDEE"/><text x="'+(x+26)+'" y="'+(141+j*32)+'" font-size="11" fill="#3D6570">'+esc(t)+'</text>').join('')
      return '<rect x="'+x+'" y="78" width="240" height="140" rx="12" fill="#fff" stroke="#DCEDEE"/><rect x="'+x+'" y="78" width="240" height="30" rx="12" fill="url(#g1)"/><text x="'+(x+120)+'" y="98" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">'+esc(c[0])+'</text>'+chips
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="信息盘点矩阵">'+head+body+svgFoot(260)+'</svg>'
  }
  /* k=2 选题分析：研究问题拆解树 */
  if(k===2){
    const qs=(s.info.length?s.info:['复购现状如何','流失原因是什么','分层差异在哪','如何提升复购']).slice(0,4).map(b=>cut(b,20))
    const nodes=qs.map((q,i)=>{
      const y=52+i*50
      return '<path d="M186 138 C 262 138 272 '+(y+22)+' 348 '+(y+22)+'" fill="none" stroke="#BFE5DE" stroke-width="2"/>'
        +'<rect x="348" y="'+y+'" width="496" height="44" rx="10" fill="#F0FAF8" stroke="#DCEDEE"/><circle cx="372" cy="'+(y+22)+'" r="9" fill="#2EC4B0"/>'
        +'<text x="392" y="'+(y+27)+'" font-size="12.5" fill="#0B2E36">问题'+cn(i+1)+'：'+esc(q)+'</text>'
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="研究问题拆解树">'+head
      +'<rect x="30" y="108" width="156" height="60" rx="12" fill="url(#g1)"/><text x="108" y="134" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">选题总目标</text><text x="108" y="152" text-anchor="middle" font-size="10.5" fill="rgba(255,255,255,.78)">拆解为可回答问题</text>'
      +nodes+svgFoot(260)+'</svg>'
  }
  /* k=3 研究方向：抽样漏斗 */
  if(k===3){
    const layers:[string,number,string][]=[
      ['目标总体 · 研究范围内全部对象',560,'#DFF4F0'],
      ['抽样框 · 可触达名单',440,'#B9E7E0'],
      ['计划样本 · n = 500',320,'#63CDBC'],
      ['预计有效 · n ≥ 450',200,'#0E8F84'],
    ]
    const cx=300
    const body=layers.map((l,i)=>{
      const w=l[1],x=cx-w/2,y=74+i*44
      return (i>0?'<path d="M'+cx+' '+(y-8)+' l0 6" stroke="#7C99A1" stroke-width="2" stroke-linecap="round"/><path d="M'+(cx-4)+' '+(y-5)+' l4 5 4 -5" fill="none" stroke="#7C99A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>':'')
        +'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="34" rx="10" fill="'+l[2]+'"/>'
        +'<text x="'+cx+'" y="'+(y+22)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+(i>=2?'#fff':'#0B6E68')+'">'+esc(l[0])+'</text>'
    }).join('')
    const notes=['抽样方式：分层随机（示例）','配额：城市 × 活跃度','失效剔除：跳答 / 时长过短'].map((t,i)=>'<circle cx="622" cy="'+(104+i*30)+'" r="4" fill="#F5A623"/><text x="636" y="'+(108+i*30)+'" font-size="11.5" fill="#3D6570">'+esc(t)+'</text>').join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="抽样漏斗">'+head+body+notes+svgFoot(260)+'</svg>'
  }
  /* k=4 问卷与测试：量表结构 + 信度仪表 */
  if(k===4){
    const items=s.items.length?s.items.slice(0,4):[
      {dimension:'满意度',sample:'对履约时效的满意度',scale:'5 级李克特'},
      {dimension:'信任',sample:'对平台售后的信任',scale:'5 级李克特'},
      {dimension:'复购意愿',sample:'90 天内复购可能性',scale:'行为意向'},
      {dimension:'人群画像',sample:'使用频率与场景',scale:'单选/多选'},
    ]
    const rows=items.map((it,i)=>{
      const y=80+i*40
      return '<rect x="36" y="'+y+'" width="380" height="32" rx="9" fill="#F0FAF8" stroke="#DCEDEE"/>'
        +'<text x="52" y="'+(y+21)+'" font-size="12" font-weight="700" fill="#0B6E68">'+esc(it.dimension)+'</text>'
        +'<text x="150" y="'+(y+21)+'" font-size="11" fill="#3D6570">'+esc(cut(it.sample,15))+'</text>'
        +'<text x="402" y="'+(y+21)+'" text-anchor="end" font-size="10.5" fill="#7C99A1">'+esc(it.scale)+'</text>'
    }).join('')
    const gauge='<path d="M585 150 A70 70 0 0 1 725 150" fill="none" stroke="#E5F2F0" stroke-width="16" stroke-linecap="round"/>'
      +'<path d="M585 150 A70 70 0 0 1 725 150" fill="none" stroke="#F5A623" stroke-width="16" stroke-linecap="round" stroke-dasharray="189 240"/>'
      +'<text x="655" y="138" text-anchor="middle" font-size="20" font-weight="800" fill="#0B6E68">α = 0.86</text>'
      +'<text x="655" y="158" text-anchor="middle" font-size="10.5" fill="#7C99A1">预测试 Cronbach α（示例）</text>'
      +'<text x="655" y="176" text-anchor="middle" font-size="10" fill="#9AB4BB">≥0.7 可接受 · ≥0.8 良好</text>'
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="量表结构与信度">'+head+rows+gauge+svgFoot(260)+'</svg>'
  }
  /* k=5 正式调查：回收进度曲线（计划 vs 实际） */
  if(k===5){
    const N=9,x0=70,dx=74
    const plan=(i:number)=>Math.round(30+i*(470/N))
    const actual=(i:number)=>Math.round(plan(i)*(0.7+((i*37)%23)/60))
    const Y=(v:number)=>Math.round(212-v*0.26)
    const grid=[0,250,500].map(v=>'<line x1="60" y1="'+Y(v)+'" x2="846" y2="'+Y(v)+'" stroke="#E5F2F0" stroke-width="1.5"/><text x="52" y="'+(Y(v)+4)+'" text-anchor="end" font-size="10" fill="#9AB4BB">'+v+'</text>').join('')
    const pts=(f:(i:number)=>number)=>Array.from({length:N+1},(_,i)=>(x0+i*dx)+' '+Y(f(i))).join(' L')
    const line=(p:string,color:string,dash:string)=>'<path d="M'+p+'" fill="none" stroke="'+color+'" stroke-width="2.6" stroke-linecap="round" '+(dash?'stroke-dasharray="6 5"':'')+'/>'
    const dots=Array.from({length:N+1},(_,i)=>'<circle cx="'+(x0+i*dx)+'" cy="'+Y(actual(i))+'" r="3.6" fill="#F5A623"/>').join('')
    const legend='<rect x="620" y="26" width="12" height="12" rx="3" fill="#7C99A1"/><text x="638" y="36" font-size="11" fill="#3D6570">计划累计</text><rect x="716" y="26" width="12" height="12" rx="3" fill="#F5A623"/><text x="734" y="36" font-size="11" fill="#3D6570">实际累计</text>'
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="回收进度曲线">'+head+grid
      +line(pts(plan),'#7C99A1','1')+line(pts(actual),'#F5A623','')+dots+legend
      +'<text x="30" y="236" font-size="10.5" fill="#7C99A1">横轴：调查日（第 1–10 天，示例） · 纵轴：累计回收份数</text>'+svgFoot(260)+'</svg>'
  }
  /* k=6 数据分析：老/新用户分组对比 */
  if(k===6){
    const dims=['复购频次','满意度','信任度','推荐意愿']
    const oldV=[72,64,58,49],yngV=[54,61,70,63]
    const legend='<rect x="560" y="26" width="12" height="12" rx="3" fill="#2EC4B0"/><text x="578" y="36" font-size="11" fill="#3D6570">老用户</text><rect x="646" y="26" width="12" height="12" rx="3" fill="#F5A623"/><text x="664" y="36" font-size="11" fill="#3D6570">新用户</text>'
    const bars=dims.map((d,gi)=>{
      const x=96+gi*186
      const bar=(v:number,bx:number,color:string)=>{const h=Math.round(v*1.3);return '<rect x="'+bx+'" y="'+(200-h)+'" width="44" height="'+h+'" rx="7" fill="'+color+'"/><text x="'+(bx+22)+'" y="'+(194-h)+'" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0B2E36">'+v+'</text>'}
      return bar(oldV[gi]!,x,'#2EC4B0')+bar(yngV[gi]!,x+52,'#F5A623')
        +'<text x="'+(x+48)+'" y="222" text-anchor="middle" font-size="11.5" fill="#3D6570">'+esc(d)+'</text>'
    }).join('')
    return '<svg viewBox="0 0 880 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="分组对比图">'+head
      +'<line x1="60" y1="200" x2="846" y2="200" stroke="#DCEDEE" stroke-width="1.5"/>'+bars+legend
      +'<text x="850" y="60" text-anchor="end" font-size="10.5" fill="#F5A623">识别点：新用户「信任度」更高</text>'+svgFoot(260)+'</svg>'
  }
  return head+svgFoot(260)+'</svg>'
}
function exportAnim(){
  const art=openArt.value
  if(!art||art.kind!=='animation')return
  const s=src.value!
  const svg=animSvg(art.index)
  const doc='<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>'+s.title+' · '+art.title+'</title>'
    +'<style>body{font-family:system-ui,sans-serif;margin:32px auto;max-width:920px;color:#0B2E36}h1{font-size:20px;color:#0B6E68}p{color:#3D6570;font-size:13px}svg{width:100%;height:auto;border:1px solid #DCEDEE;border-radius:14px}</style></head><body>'
    +'<h1>'+s.title+' — '+art.title+'</h1><p>'+s.tag+' · 市调演真案例复现 · 演示口径（不代表真实调查结论）</p>'+svg+'</body></html>'
  const blob=new Blob([doc],{type:'text/html;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=s.title+'·'+art.title+'.html'
  a.click()
  URL.revokeObjectURL(url)
}
function downloadReport(){
  const s=src.value
  if(!s)return
  const lines:string[]=['# 《'+s.title+'》报告初稿（v1 · 演示）','',s.intro,'','## 目录','']
  for(const c of s.toc)lines.push('- '+c)
  lines.push('','## 结论要点','',s.note,'','> 本初稿为案例复现演示产物，正式报告请在七阶段工作台「报告与答辩」阶段整理并保存。')
  const blob=new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=s.title+'·报告初稿.md'
  a.click()
  URL.revokeObjectURL(url)
}

reset()
watch(()=>[route.params.id,route.query.task],()=>{if(route.name==='research-replay')reset()})
</script>

<style scoped>
.replay{
  --ink:#0B2E36;--ink2:#3D6570;--ink3:#7C99A1;--ink4:#9AB0B6;
  --teal-700:#0B6E68;--blue-800:#0E8F84;--blue-700:#0E8F84;--blue-600:#12A594;--blue-500:#12A594;--blue-400:#3DB3AC;
  --blue-300:#6EC6C0;--blue-200:#BFE3E0;--blue-100:#DFF4F1;--blue-50:#EFFAF8;
  --line:#E0EBE8;--line-2:#EAF5F5;--bg:#F3FAFA;--amber:#F5A623;
  --grad:linear-gradient(120deg,#12A594 0%,#1E9FC4 100%);
  --sh-1:0 2px 8px rgba(11,110,104,.06);--sh-2:0 6px 20px rgba(11,110,104,.1);
  height:100dvh;min-height:560px;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.7
}
.icon-btn{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink2);cursor:pointer;flex-shrink:0}
.icon-btn:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
/* ===== 顶栏 ===== */
.wtop{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 24px;background:#fff;border-bottom:1px solid var(--line);flex-shrink:0;overflow:visible}
.wtop::-webkit-scrollbar{display:none}
.wtb{padding:3px 9px;border-radius:6px;background:var(--blue-100);color:var(--blue-700);font-size:11.5px;font-weight:700;flex-shrink:0;white-space:nowrap}
.wt{font-size:15px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;min-width:100px;flex-shrink:1}
.steps{display:grid;grid-template-columns:repeat(var(--step-count,8),minmax(0,1fr));align-items:stretch;gap:6px;order:2;flex:0 0 100%;min-width:0;box-sizing:border-box;margin:0;padding:10px 0 0;border-top:1px solid var(--line);overflow:visible}
.steps::-webkit-scrollbar{display:none}
.step-line{display:none;width:10px;height:2px;border-radius:2px;background:var(--line);flex-shrink:0}
.step{display:flex;align-items:center;gap:7px;flex-shrink:0;font-size:12px;color:var(--ink3);white-space:normal;min-width:0;padding:6px 8px;border:1px solid transparent;border-radius:10px;transition:background .15s,border-color .15s,color .15s}
.step.clickable{cursor:pointer}
.step.clickable:hover{background:var(--blue-50);color:var(--blue-700)}
.step .n{width:22px;height:22px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink3);background:#fff;flex-shrink:0}
.step.done{color:var(--blue-700)}
.step.done .n{background:var(--blue-600);border-color:var(--blue-600);color:#fff}
.step.now{color:var(--blue-800);font-weight:700;background:var(--blue-50);border-color:var(--blue-200)}
.step.now .n{background:var(--blue-600);border-color:var(--blue-600);color:#fff;box-shadow:0 2px 5px rgba(11,110,104,.18)}
.stag{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;padding:5px 10px;border-radius:999px;font-size:11.8px;font-weight:700;color:#8A5A00;background:#FFF6DC;border:1px solid #F4DFA8;white-space:nowrap}
.stag i{width:6px;height:6px;border-radius:50%;background:var(--amber);box-shadow:0 0 0 3px rgba(245,166,35,.18)}
.stag.done{color:#1E7A4F;background:#E7F6EE;border-color:#BFE6CF}
.stag.done i{background:#2FA36B;box-shadow:0 0 0 3px rgba(47,163,107,.16)}
.env-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:11.8px;font-weight:600;color:#1E7A4F;background:#E7F6EE;border:1px solid #BFE6CF;flex-shrink:0}
.env-badge::before{content:"";width:7px;height:7px;border-radius:50%;background:#2BA471;box-shadow:0 0 0 3px rgba(47,163,107,.18)}
.env-badge.inactive{color:var(--ink3);background:#F1F5F6;border-color:var(--line)}
.env-badge.inactive::before{background:var(--ink4);box-shadow:none}
.flow-tools{display:flex;align-items:center;gap:7px;flex-shrink:0}
.flow-tool{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink2);font-size:12px;font-weight:700;cursor:pointer;transition:.16s;flex-shrink:0}
.flow-tool:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
.flow-tool:disabled{opacity:.45;cursor:not-allowed}
.flow-tool svg{width:14px;height:14px;flex:0 0 auto}
.grow{flex:1}
/* ===== 主体 ===== */
.wbody{display:flex;gap:0;flex:1;min-height:0}
.chat{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg)}
.stream{flex:1;min-height:0;overflow-y:auto;padding:20px 26px 12px;scroll-behavior:auto}
.stream-in{max-width:860px;margin:0 auto}
.msg{display:flex;margin-bottom:16px}
.msg.me{flex-direction:row-reverse}
.bubble{max-width:94%;min-width:0}
.msg.me .bubble{margin-left:auto;max-width:80%}
.bubble .txt{background:#fff;border:1px solid #91B9B1;border-radius:14px;padding:11px 16px;font-size:14px;line-height:1.8;color:var(--ink2);box-shadow:0 2px 6px rgba(11,110,104,.08)}
.msg.me .bubble .txt{background:#1A7A6A;border-color:#1A7A6A;color:#fff}
.msg.me .bubble .txt *{color:#fff}
.bubble .txt h4{font-size:14.5px;font-weight:800;color:var(--ink);margin:0 0 8px}
.bubble .txt h4:not(:first-child){margin-top:16px}
.msg.me .bubble .txt h4{color:#fff}
.bubble .txt p{margin:0 0 8px}
.bubble .txt :deep(:last-child){margin-bottom:0}
.bubble .txt ul{margin:0 0 8px 0;list-style:none;padding:0}
.bubble .txt ol{margin:0 0 8px;padding-left:20px}
.bubble .txt li{padding-left:16px;position:relative;margin-bottom:5px}
.bubble .txt ul>li:before{content:"";position:absolute;left:3px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--blue-400)}
.msg.me .bubble .txt ul>li:before{background:rgba(255,255,255,.8)}
.bubble .txt .kv{color:var(--blue-700);font-weight:700}
.bubble .txt small{color:var(--ink3)}
.lead-line{margin:0 0 12px}
.next{margin-top:12px;padding:9px 13px;border-radius:9px;font-size:13px;line-height:1.72;color:var(--blue-800);background:var(--blue-50);border-left:3px solid var(--blue-500)}
.next b{color:var(--blue-700)}
.tip-line{margin:0;padding:9px 12px;border-radius:9px;font-size:12.4px;line-height:1.7;color:#8A5A00;background:#FFF6DC;border-left:3px solid var(--amber)}
.thinking{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink3);padding:6px 0}
.thinking i{width:6px;height:6px;border-radius:50%;background:var(--blue-400);animation:bl 1s infinite}
.thinking i:nth-child(2){animation-delay:.15s}
.thinking i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,100%{opacity:.25}50%{opacity:1}}
/* 产物卡 */
.arts{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.acard{display:flex;align-items:center;gap:13px;width:100%;background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px 16px;cursor:pointer;transition:.18s;text-align:left;box-shadow:var(--sh-1);position:relative;overflow:hidden}
.acard:hover{border-color:var(--blue-300);transform:translateY(-2px);box-shadow:var(--sh-2)}
.acard.open{border-color:var(--blue-600);box-shadow:0 0 0 3px rgba(11,110,104,.12)}
.acard .ai{width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
.acard .at{flex:1;min-width:0}
.acard .at b{display:block;font-size:14px;font-weight:700;color:var(--ink)}
.acard .at span{display:block;font-size:12px;color:var(--ink3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acard .arrow{color:var(--blue-600);flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700}
.acard .auto{position:absolute;top:0;right:0;padding:2px 8px;border-radius:0 0 0 8px;background:var(--amber);color:#fff;font-size:10.5px;font-weight:700}
.acard.mini{padding:10px 13px;border-radius:11px;margin-bottom:8px}
.acard.mini .ai{width:30px;height:30px;font-size:12.5px}
/* 输入台 */
.composer-bar{background:var(--bg);padding:8px 26px 12px;flex-shrink:0}
.composer-bar .cw{max-width:860px;margin:0 auto}
.composer{background:#fff;border:1px solid #91B9B1;border-radius:18px;box-shadow:0 4px 16px rgba(11,110,104,.08);transition:border-color .2s,box-shadow .2s;overflow:hidden}
.composer:focus-within{border-color:var(--blue-400);box-shadow:0 8px 28px rgba(11,110,104,.14)}
.composer textarea{display:block;box-sizing:border-box;width:100%;padding:12px 16px 6px;min-height:44px;max-height:144px;overflow-y:auto;resize:none;border:none;outline:none;background:none;font:inherit;font-size:14px;line-height:1.7;color:var(--ink)}
.composer textarea::placeholder{color:var(--ink4)}
.composer textarea:focus-visible{outline:none}
.cbar{display:flex;align-items:center;gap:8px;padding:5px 10px 9px;background:#fff}
.cbar .spacer{flex:1}
.hint{font-size:12px;color:var(--ink4)}
.btn-ghost{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-weight:600;font-size:13.5px;transition:.18s;cursor:pointer}
.btn-ghost:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
.btn-send{display:inline-flex;align-items:center;gap:7px;padding:7px 15px;border-radius:10px;border:none;background:var(--grad);color:#fff;font-weight:700;font-size:14px;box-shadow:0 3px 10px rgba(11,110,104,.28);transition:.18s;cursor:pointer}
.btn-send:hover{filter:brightness(1.06);transform:translateY(-1px)}
.chip{padding:6px 13px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:12.5px;color:var(--ink2);transition:.18s;cursor:pointer}
.chip:hover{border-color:var(--blue-300);color:var(--blue-700);background:var(--blue-50)}
/* ===== 产物抽屉 ===== */
.drawer{width:0;flex-shrink:0;border-left:3px solid #7FB7AD;background:#fff;overflow:hidden;transition:width .26s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}
.drawer.on{width:480px;box-shadow:-12px 0 28px rgba(11,46,54,.14)}
.dh{padding:14px 18px;border-bottom:1px solid #CFE3DF;display:flex;align-items:center;gap:10px;flex-shrink:0;position:relative;background:linear-gradient(135deg,#fff 0%,#F2FAF8 100%)}
.dh h3{font-size:15px;font-weight:800;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
.dh .sub{font-size:11.5px;color:var(--ink3);display:block;font-weight:500;margin-top:1px}
.db{flex:1;overflow-y:auto;padding:18px;background:linear-gradient(180deg,#EDF7F5 0%,#F5FAF9 100%);min-width:480px}
.stage{margin-bottom:16px;border-radius:14px;overflow:hidden;box-shadow:var(--sh-2)}
.stage :deep(svg){width:100%;height:auto;display:block}
.card{background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:var(--sh-1);margin-bottom:16px;overflow:hidden}
.card:last-child{margin-bottom:0}
.card-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-2)}
.card-h h3{margin:0;font-size:14px;font-weight:800;color:var(--ink);flex:1}
.tag-c{padding:2px 8px;border-radius:99px;background:var(--blue-100);color:var(--blue-700);font-size:11px;font-weight:700}
.card-b{padding:14px 16px;font-size:12.8px;color:var(--ink2);line-height:1.75}
.card-b.tight{padding:12px}
.card-b.col{display:grid;gap:8px}
.card-b h4{margin:12px 0 7px;font-size:13.2px;color:var(--teal-700);border-left:3px solid var(--blue-500);padding-left:8px}
.card-b h4:first-child{margin-top:0}
.card-b p{margin:0 0 9px}
.card-b ul{margin:0 0 9px;padding-left:18px}
.card-b li{margin-bottom:6px}
.card-b li b{color:var(--blue-700)}
.card-b li small{color:var(--ink3)}
.card-b ol{margin:0 0 9px;padding-left:20px}
.dnote{padding:9px 12px;border:1px solid #ECD9A8;border-radius:9px;background:#FDF6E4;color:#6B5316;font-size:12px}
.dfind{padding:9px 12px;border-left:3px solid var(--blue-500);border-radius:0 9px 9px 0;background:var(--blue-50)}
.dtable{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.dtable th,.dtable td{padding:7px 9px;border-bottom:1px solid var(--line-2);text-align:left}
.dtable th{background:var(--blue-50);color:var(--teal-700)}
.side-note{font-size:12.3px;color:var(--ink2)}
.legend{display:grid;gap:6px;margin-top:10px;font-size:12px;color:var(--ink2)}
.legend div{display:flex;align-items:center;gap:8px}
.legend i{width:12px;height:12px;border-radius:3px;flex-shrink:0}
.exp-row{margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2)}
.dl{width:100%;padding:9px 12px;border:1px solid var(--blue-200);border-radius:9px;background:var(--blue-50);color:var(--blue-700);font-size:12.8px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;display:block}
.dl:hover{background:var(--blue-100)}
.dl.ghost{background:#fff;border-style:dashed}
.live-form{margin:14px 0;padding:16px;border:1.5px solid #8FBDB6;border-radius:12px;background:#fff;box-shadow:0 3px 10px rgba(11,110,104,.06)}
.live-form>h4{margin:-16px -16px 14px;padding:12px 16px;background:#EAF6F3;border-bottom:1px solid #A7CEC6;border-radius:11px 11px 0 0}
.live-field{display:grid;gap:5px;margin:10px 0}
.live-field>label{font-weight:700;color:var(--ink2)}
.live-field>label strong{font-size:11px;color:#A76B0A}
.live-field input:not([type=checkbox]):not([type=radio]),.live-field textarea,.live-field select{box-sizing:border-box;width:100%;min-height:38px;padding:8px 10px;border:1.5px solid #94B9B3;border-radius:8px;background:#fff;color:var(--ink);font:inherit}
.live-field textarea{min-height:82px;resize:vertical}
.live-choices{display:flex;flex-wrap:wrap;gap:8px}
.live-choices label{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:pointer}
.live-choices input{margin:0;accent-color:var(--blue-700)}
.live-form .dl{max-width:300px;margin-top:12px}
.form-panel{border-radius:16px;overflow:hidden;border:1.5px solid #6DAFA3;box-shadow:0 4px 16px rgba(11,110,104,.10)}
.live-field input:focus-visible,.live-field textarea:focus-visible,.live-field select:focus-visible{outline:3px solid rgba(14,156,143,.16);outline-offset:1px;border-color:#078B7B}
.live-choices label{border-color:#A0C2BB;transition:background .16s,border-color .16s,box-shadow .16s}
.live-choices label:has(input:checked){border-color:#078B7B;background:#DBF2EB;color:#075F56;box-shadow:inset 0 0 0 1px #078B7B}
.live-choices label:focus-within{outline:2px solid #078B7B;outline-offset:2px}
.form-panel .dl{background:#0B8E80;border-color:#08796E;color:#fff;transition:transform .15s,box-shadow .15s,background .15s}
.form-panel .dl:not(:disabled):hover{background:#08796E;box-shadow:0 4px 12px rgba(11,110,104,.2)}
.form-panel .dl:not(:disabled):active{transform:scale(.985)}
.form-panel .dl:disabled{cursor:wait;opacity:.65}
.submit-spinner{display:inline-block;width:13px;height:13px;margin-right:8px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;vertical-align:-2px;animation:form-spin .8s linear infinite}
.submission-feedback{border-radius:14px;box-sizing:border-box;width:100%;padding:16px 18px;border:1.5px solid #74B5A8;background:#F3FBF8;box-shadow:0 4px 14px rgba(11,110,104,.08)}
.submission-heading{display:flex;align-items:center;gap:9px;color:#08685E}
.submission-indicator{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;border-radius:50%;background:#0B8E80;color:#fff;font-size:13px}
.is-active .submission-indicator{animation:form-pulse 1.7s ease-in-out infinite}
.is-active .submission-indicator:empty::after{content:'';width:6px;height:6px;background:#fff;border-radius:50%}
.submission-steps{display:flex;flex-wrap:wrap;gap:10px 18px;padding:0;margin:16px 0 12px;list-style:none;color:#677E7A;font-size:12px}
.submission-steps li{display:flex;align-items:center;gap:6px}
.submission-steps li>span{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid #B6CEC8;border-radius:50%;background:#fff}
.submission-steps .is-done,.submission-steps .is-current{color:#08796E;font-weight:700}
.submission-steps .is-done>span{background:#0B8E80;border-color:#0B8E80;color:#fff}
.submission-steps .is-current>span{border:2px solid #0B8E80;box-shadow:0 0 0 3px #D8EEE7}
.submission-track{height:4px;overflow:hidden;border-radius:4px;background:#D7EDE7}
.submission-track span{display:block;width:35%;height:100%;border-radius:4px;background:linear-gradient(90deg,transparent,#10A493,transparent);animation:form-flow 2s ease-in-out infinite}
.submission-detail{margin:10px 0 8px;font-size:13px;line-height:1.7;overflow-wrap:anywhere}
.submission-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;font-size:12px;color:#597B74;font-variant-numeric:tabular-nums}
.submission-meta .flow-tool{margin-left:auto}
.submission-feedback.is-warning{border-color:#D4AE60;background:#FFFAEE}
.is-warning .submission-heading{color:#8C621A}.is-warning .submission-indicator{background:#B48429;animation:none}
@keyframes form-spin{to{transform:rotate(360deg)}}
@keyframes form-pulse{50%{box-shadow:0 0 0 5px rgba(11,142,128,.12)}}
@keyframes form-flow{from{transform:translateX(-100%)}to{transform:translateX(390%)}}
@media(prefers-reduced-motion:reduce){.submit-spinner,.is-active .submission-indicator,.submission-track span{animation:none}.live-choices label,.form-panel .dl{transition:none}.form-panel .dl:not(:disabled):active{transform:none}}

.live-files{display:grid;gap:8px;margin:12px 0;padding:0;list-style:none}
.live-files li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff}
.live-files small{grid-column:1/-1;overflow-wrap:anywhere;color:var(--ink3)}
.live-files .dl{grid-column:2;grid-row:1}
.dh::after{content:"";position:absolute;left:18px;right:18px;bottom:-1px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--blue-600),rgba(18,165,148,0));pointer-events:none}
.drawer .card{border:2px solid #AFCFC8;box-shadow:0 7px 20px rgba(11,110,104,.1)}
.drawer .card-h{position:relative;background:linear-gradient(90deg,#EAF8F5 0%,#F7FCFB 100%);border-bottom-color:#D8EAE6}
.drawer .card-h::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(180deg,#12A594,#1E9FC4)}
.drawer .live-files{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0;align-items:stretch}
.drawer .artifact-file{display:flex;position:relative;flex-direction:column;align-items:stretch;gap:8px;min-width:0;min-height:132px;padding:10px 10px 10px 12px;border:1.5px solid #AFCFC8;border-radius:11px;background:linear-gradient(135deg,#fff 0%,#FBFEFD 100%);box-shadow:0 2px 8px rgba(11,46,54,.055);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;overflow:hidden}
.drawer .artifact-file::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:#9AB0B6}
.drawer .artifact-file.artifact-questionnaire::before{background:#12A594}
.drawer .artifact-file.artifact-spreadsheet::before{background:#46A982}
.drawer .artifact-file.artifact-data::before{background:#399FC3}
.drawer .artifact-file.artifact-document::before{background:#829BA3}
.drawer .artifact-file.artifact-image::before{background:#9A83C5}
.drawer .artifact-file:hover{transform:translateY(-1px);border-color:#83C7BE;box-shadow:0 7px 16px rgba(11,110,104,.1)}
.drawer .artifact-file:focus-within{border-color:#57B7AC;box-shadow:0 0 0 3px rgba(18,165,148,.12)}
.drawer .artifact-file-title{grid-column:1;display:flex;align-items:flex-start;gap:8px;min-width:0}
.drawer .artifact-file-title strong{display:-webkit-box;min-width:0;padding-top:2px;color:var(--ink);font-size:12.7px;line-height:1.45;overflow:hidden;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.drawer .artifact-type-mark{display:grid;place-items:center;width:30px;height:30px;flex:0 0 auto;border-radius:9px;background:#E7F5F2;color:#0B8279;font-size:11.5px;font-weight:800;box-shadow:inset 0 0 0 1px rgba(11,110,104,.08)}
.drawer .artifact-spreadsheet .artifact-type-mark{background:#EAF6EE;color:#32845D}
.drawer .artifact-data .artifact-type-mark{background:#EAF5FA;color:#267FA1}
.drawer .artifact-document .artifact-type-mark{background:#F0F4F5;color:#5D7881}
.drawer .artifact-image .artifact-type-mark{background:#F2EFF9;color:#7259A5}
.drawer .artifact-file-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.drawer .artifact-type-label{display:inline-flex;flex:0 0 auto;align-items:center;padding:2px 8px;border-radius:999px;background:#E8F6F3;color:#0B8279;font-size:10.5px;font-weight:700;line-height:1.5}
.drawer .artifact-spreadsheet .artifact-type-label{background:#EAF6EE;color:#32845D}
.drawer .artifact-data .artifact-type-label{background:#EAF5FA;color:#267FA1}
.drawer .artifact-document .artifact-type-label{background:#F0F4F5;color:#5D7881}
.drawer .artifact-image .artifact-type-label{background:#F2EFF9;color:#7259A5}
.drawer .artifact-file-meta small{min-width:0;color:var(--ink3);font-size:10.5px;line-height:1.45;white-space:nowrap}
.drawer .artifact-file .dl.ghost{width:100%;margin:auto 0 0;padding:7px 10px;border-style:solid;background:#EFFAF8;box-shadow:0 1px 3px rgba(11,110,104,.06)}
.drawer .artifact-file .dl.ghost:hover{border-color:#6EC6C0;background:#DFF4F1;color:#0B6E68}
.drawer .upload-grid{margin:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.drawer .uploaded-material{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:8px 6px;align-items:center;min-width:0;padding:10px;border:1.5px solid #AFCFC8;border-radius:10px;background:#fff;box-shadow:0 2px 7px rgba(11,46,54,.05)}
.drawer .uploaded-material:hover{border-color:#83C7BE;box-shadow:0 5px 12px rgba(11,110,104,.09)}
.drawer .uploaded-material-title{grid-column:1/-1;display:flex;align-items:flex-start;gap:8px;min-width:0}
.drawer .uploaded-material-title strong{display:-webkit-box;min-width:0;color:var(--ink);font-size:12px;line-height:1.45;overflow:hidden;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.drawer .uploaded-material small{grid-column:1;min-width:0;color:var(--ink3);font-size:10px;white-space:nowrap}
.drawer .uploaded-material .delete-attachment{grid-column:2;grid-row:2;width:auto;margin:0;padding:5px 8px;border-style:solid;border-color:#E8C8C2;border-radius:8px;background:#FFF8F6;color:#984C43;font-size:11px}
.drawer .uploaded-material .delete-attachment:hover{border-color:#D8998E;background:#FDEFEA;color:#87382F}
.uploaded-material-error{color:#984C43}
.uploaded-material-loading,.uploaded-material-empty{color:var(--ink3);font-size:12px}
@media(max-width:420px){.drawer .live-files{grid-template-columns:1fr}}
.drawer .dl,.drawer .icon-btn{transition:transform .16s ease,border-color .16s ease,color .16s ease,background-color .16s ease,box-shadow .16s ease}
.drawer .dl:not(:disabled):hover{transform:translateY(-1px);border-color:#72BEB2;box-shadow:0 5px 12px rgba(11,110,104,.14)}
.drawer .dl:not(:disabled):active{transform:translateY(0) scale(.98);box-shadow:0 1px 3px rgba(11,110,104,.12)}
.drawer .icon-btn:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(11,110,104,.12)}
.drawer .icon-btn:active{transform:translateY(0) scale(.96)}
.drawer .dl:focus-visible,.drawer .icon-btn:focus-visible{outline:2px solid #0B6E68;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.drawer .dl,.drawer .icon-btn,.drawer .artifact-file{transition:none}.drawer .dl:not(:disabled):hover,.drawer .dl:not(:disabled):active,.drawer .icon-btn:hover,.drawer .icon-btn:active,.drawer .artifact-file:hover{transform:none}}
.anim-empty{padding:26px 20px;border:1px dashed var(--blue-200);border-radius:12px;background:#fff;font-size:12.8px;color:var(--ink3);line-height:1.8}

.message-markdown{overflow-wrap:anywhere;line-height:1.85}
.message-markdown :deep(ul>li::before){content:none}
.message-markdown :deep(blockquote p){margin:0}
.message-markdown :deep(th){font-weight:700;color:var(--ink)}
.message-markdown :deep(p){margin:0 0 10px}
.message-markdown :deep(p:last-child){margin-bottom:0}
.message-markdown :deep(h1),.message-markdown :deep(h2),.message-markdown :deep(h3),.message-markdown :deep(h4){margin:16px 0 8px;font-size:15px;line-height:1.6;color:var(--ink)}
.message-markdown :deep(:first-child){margin-top:0}
.message-markdown :deep(ul),.message-markdown :deep(ol){margin:8px 0;padding-left:24px;list-style:revert}
.message-markdown :deep(li){margin:4px 0;padding-left:0}
.message-markdown :deep(blockquote){margin:10px 0;padding-left:12px;border-left:3px solid var(--blue-200);color:var(--ink3)}
.message-markdown :deep(table){display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:10px 0;font-size:13px}
.message-markdown :deep(th),.message-markdown :deep(td){padding:7px 10px;border:1px solid var(--line);text-align:left;min-width:70px}
.message-markdown :deep(th){background:var(--blue-50)}
.message-markdown :deep(pre){max-width:100%;overflow:auto;box-sizing:border-box;margin:10px 0;padding:12px;border-radius:8px;background:var(--bg);white-space:pre}
.message-markdown :deep(code){font-family:Consolas,monospace;font-size:.92em;background:var(--bg);padding:1px 4px;border-radius:4px}
.message-markdown :deep(pre code){padding:0;background:transparent}
.message-markdown :deep(a){color:var(--blue-700);text-decoration:underline}

.preview-dialog{box-sizing:border-box;width:min(1000px,calc(100vw - 40px));max-height:calc(100dvh - 48px);padding:0;border:1px solid var(--line);border-radius:18px;background:var(--bg,#f3fafa);color:var(--ink2);box-shadow:0 20px 70px rgba(11,46,54,.22)}
.preview-dialog::backdrop{background:rgba(11,46,54,.38)}
.preview-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 22px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:2}
.preview-dialog-head h3{margin:0;font-size:17px;color:var(--ink);overflow-wrap:anywhere}
.preview-dialog-body{padding:22px;min-width:0}.preview-dialog-body pre{white-space:pre-wrap;overflow-wrap:anywhere}
@media(max-width:600px){.preview-dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 24px)}.preview-dialog-head,.preview-dialog-body{padding:14px}}
.material-status p{margin:0;padding:6px 12px;font-size:12px;line-height:1.5;border-top:1px solid var(--line-2);overflow-wrap:anywhere}
.material-status [role=alert]{background:#FFF7F2}
.material-retry{padding:0 4px;border:0;background:transparent;color:var(--blue-700);font:inherit;text-decoration:underline;cursor:pointer}
.cbar .btn-ghost{padding:6px 10px;font-size:12px;border-color:transparent;background:var(--blue-50)}
.cbar .upload-action{width:32px;height:32px;padding:0;justify-content:center;background:transparent}
.cbar .upload-action svg{width:18px;height:18px}
.cbar .btn-ghost:disabled,.material-retry:disabled{opacity:.5;cursor:not-allowed}
.latest-wrap{position:relative;flex-shrink:0;height:0;z-index:2}
.latest-button{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:7px 14px;border:1px solid #91B9B1;border-radius:999px;background:#fff;color:var(--blue-700);box-shadow:0 3px 12px rgba(11,110,104,.12);font:inherit;font-size:12px;cursor:pointer}
.material-status [role=alert]{color:#9b392a}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:960px){
  .drawer{position:fixed;top:0;right:0;bottom:0;z-index:40;box-shadow:-8px 0 24px rgba(11,46,54,.14)}
  .drawer.on{width:min(480px,94vw)}
  .db{min-width:0}
  .wt{max-width:160px}
}
button:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid #0B6E68;outline-offset:2px}

.file-toolbar{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #CFE3DF;background:#F0F9F7}
.file-tabs{display:flex;gap:4px;flex:1;min-width:0}
.file-tabs button{display:inline-flex;align-items:center;gap:6px;padding:8px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink3);font:inherit;font-size:12px;white-space:nowrap;cursor:pointer}
.file-tabs button.active{background:#fff;border-color:#AFCFC8;color:var(--blue-800);font-weight:700;box-shadow:0 2px 5px rgba(11,110,104,.06)}
.file-tabs button span{min-width:18px;padding:1px 4px;border-radius:8px;background:#E1F3EF;color:var(--blue-700);font-size:10px;text-align:center}
.file-refresh{flex-shrink:0;padding:6px 8px;border:1px solid #AFCFC8;border-radius:8px;background:#fff;color:var(--blue-700);font:inherit;font-size:12px;cursor:pointer}
.file-refresh:disabled{opacity:.5;cursor:not-allowed}
.file-status{color:var(--ink3);font-size:12px;line-height:1.7}
.file-panel-body{min-height:96px}
.preview-dialog.material-dialog{width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 48px)}
.material-dialog .preview-dialog-head{padding:12px 16px}
.material-dialog .preview-dialog-body{padding:14px 16px;max-height:calc(100dvh - 220px);overflow-y:auto}
.material-dialog .preview-dialog-body>p{margin:0 0 12px;font-size:12px;line-height:1.7;color:var(--ink3)}
.material-dialog .preview-dialog-body>[role=alert]{color:#984C43}
.material-dialog .live-files{margin:0 0 12px}
.material-dialog .live-files li{overflow-wrap:anywhere}
.material-dialog-actions{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid var(--line);background:#fff}
.material-dialog-actions .dl{width:auto;padding:8px 14px}

.next-action-card{margin:4px 0 16px;padding:16px 18px;border:2px solid #219C8C;border-left-width:5px;border-radius:14px;background:linear-gradient(110deg,#E6F5EF,#F4FAF8);box-shadow:0 4px 14px rgba(11,110,104,.1)}
.next-action-heading{display:flex;align-items:center;gap:9px;color:#075F56;font-size:15px}
.next-action-heading>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#0B8E80;color:#fff;font-weight:700}
.next-action-card>p{margin:6px 0 10px;color:#456F66;font-size:12px}
.next-action-card .conversation-action{min-height:40px;font-size:13px;box-shadow:0 3px 8px rgba(11,110,104,.12)}
.next-action-card .conversation-action:focus-visible{outline:3px solid #64B9A8;outline-offset:3px}
@media(max-width:1100px){.steps{grid-template-columns:repeat(4,minmax(0,1fr))}.flow-tools{flex-wrap:wrap;flex-shrink:1}}
@media(max-width:600px){.steps{grid-template-columns:repeat(2,minmax(0,1fr))}.wtop{padding:10px 12px}.wt{max-width:180px}.next-action-card{padding:12px}}
.conversation-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.conversation-action{padding:9px 14px;border:1px solid #A4CFC5;border-radius:10px;background:#fff;color:var(--blue-700);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .15s}
.conversation-action:hover:not(:disabled){background:#EAF7F2;border-color:#54AF9E;box-shadow:0 3px 8px rgba(11,110,104,.1)}
.conversation-action.primary{background:linear-gradient(120deg,#087C74,#139EAA);border-color:transparent;color:#fff;margin-right:8px;margin-bottom:6px}
.conversation-action.primary:hover:not(:disabled){background:linear-gradient(120deg,#087C74,#139EAA);color:#fff;border-color:#087C74;filter:none}
.conversation-action:disabled{opacity:.5;cursor:not-allowed}
</style>
