import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const core = readFileSync(new URL('../src/legacy/prototype/core.ts', import.meta.url), 'utf8')
function loadRecovery() {
  const start = core.indexOf('function restoreWorkbenchPanels(')
  assert.notEqual(start, -1, 'workbench restoration must rehydrate dynamic panels')
  const end = core.indexOf('\n}', start) + 2
  return runInNewContext(core.slice(start, end) + '; restoreWorkbenchPanels', {bindReportCard(){},bindArtifactCard(){}})
}

test('restoring a task remounts dynamic report/artifact panels without re-exporting', () => {
  const report = {innerHTML:'old 502 export error'}
  const artifact = {innerHTML:'old 502 artifact error'}
  const host = {querySelectorAll(selector){return selector === '.rep-card' ? [report] : [artifact]}}
  const mounted = []
  const recover = loadRecovery()
  recover(host, {
    reportMount(box,id){box.innerHTML='current report controls'; mounted.push(['report',id])},
    artifactMount(box,id){box.innerHTML='current artifact controls'; mounted.push(['artifact',id])},
    artifactRefresh(){mounted.push(['read'])},
    reportRefresh(){throw new Error('restoration must not overwrite exported files')},
  }, 'case-1')
  assert.equal(report.innerHTML, 'current report controls')
  assert.equal(artifact.innerHTML, 'current artifact controls')
  assert.deepEqual(mounted, [['report','case-1'],['artifact','case-1'],['read']])
})

test('restored controls receive working click bindings exactly once', () => {
  const listeners=[]
  const report={innerHTML:'old',addEventListener(type,fn){listeners.push([type,fn])}}
  const host={querySelectorAll(s){return s==='.rep-card'?[report]:[]}}
  let binds=0
  const recover=loadRecovery()
  // Binding functions belong to the existing DOM bridge; exercise the recovery call boundary.
  const context={bindReportCard(){binds++},bindArtifactCard(){},}
  const start=core.indexOf('function restoreWorkbenchPanels(')
  const end=core.indexOf('\n}',start)+2
  const withBindings=runInNewContext(core.slice(start,end)+';restoreWorkbenchPanels',context)
  withBindings(host,{reportMount(){}},'case-1')
  withBindings(host,{reportMount(){}},'case-1')
  assert.equal(binds,1)
})

test('idle workbench also paints a pending form restored from the backend', () => {
  const start=core.indexOf('function railSync(')
  const end=core.indexOf('\n\n',start)
  const host={},hooks={gate:()=>({interruptId:'new-form'})},painted=[]
  const sync=runInNewContext(core.slice(start,end)+';railSync',{
    state:{view:'work'},railBind(){},railArtSync(){},
    getAnalysisHooks:()=>hooks,workHostEl:()=>host,
    syncGate:(h,a)=>painted.push([h,a]),
  })
  sync()
  assert.deepEqual(painted,[[host,hooks]])
})

function loadGateSubmit() {
  const start=core.indexOf('function submitGateCard(')
  assert.notEqual(start,-1,'gate submission must validate the live gate and await its result')
  const end=core.indexOf('\n}',start)+2
  const frozen=[]
  const fn=runInNewContext(core.slice(start,end)+';submitGateCard',{
    gateFreeze:(card,note)=>{frozen.push(note);card.note.textContent=note},
    gateFail:(card,note)=>{card.className='gate-card failed';card.note.textContent=note;card.submitButton.disabled=true},
  })
  return {fn,frozen}
}

function gateCard(id='gate-1') {
  return {
    note:{textContent:''},
    submitButton:{disabled:false},
    getAttribute(name){return name==='data-gate'?id:null},
    querySelector(selector){
      if(selector==='.gate-note')return this.note
      if(selector==='button[data-act="submit"]')return this.submitButton
      return null
    },
    setAttribute(){},
  }
}

test('stale restored gate never claims submission or calls the current gate handler',async()=>{
  const {fn,frozen}=loadGateSubmit()
  const card=gateCard('old-gate')
  let calls=0
  const ok=await fn(card,()=>null,()=>{calls++},{answer:'yes'})
  assert.equal(ok,false)
  assert.equal(calls,0)
  assert.equal(frozen.length,0)
  assert.match(card.note.textContent,/失效/)
})

test('resume rejection remains visible as a failed gate, not a successful submission',async()=>{
  const {fn,frozen}=loadGateSubmit()
  const card=gateCard()
  const ok=await fn(card,()=>({interruptId:'gate-1'}),async()=>({ok:false,message:'缺少运行编号'}),{answer:'yes'})
  assert.equal(ok,false)
  assert.equal(card.note.textContent,'缺少运行编号')
  assert.equal(card.className,'gate-card failed')
  assert.equal(card.submitButton.disabled,true)
  assert.equal(frozen.length,0)
})

test('gate freezes as submitted only after the resume handler confirms success',async()=>{
  const {fn,frozen}=loadGateSubmit()
  const card=gateCard()
  let finish
  const pending=new Promise(resolve=>{finish=resolve})
  const attempt=fn(card,()=>({interruptId:'gate-1'}),()=>pending,{answer:'yes'})
  assert.equal(card.note.textContent,'正在提交…')
  assert.equal(card.submitButton.disabled,true)
  assert.equal(frozen.length,0)
  finish({ok:true,message:'确认已接收并续跑成功'})
  assert.equal(await attempt,true)
  assert.deepEqual(frozen,['确认已接收并续跑成功'])
})
