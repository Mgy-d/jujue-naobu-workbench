import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const output=await build({entryPoints:['src/utils/researchFormPresentation.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {researchFormPresentation}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'))
function fixture(){return {title:'市调演真 · 合规检查件与匿名口径的处理方式',message:'运行等待确认，请完成以下表单后继续',fields:[{key:'decision',kind:'radio-group',label:'冻结的 报告/合规检查.md 仍写「团队署名与成员信息 待团队填写」，与已确定的匿名口径不一致，如何处理？',required:true,options:['保持现状：视为 16:07 前时点的审核留痕，不改动','走 G4 修订：更新为已确定匿名，重跑校验与闸门','先看现状，暂不决定']},{key:'notes',kind:'textarea',label:'补充说明（可选，例如是否同时把 S12 参考文献需求一并提出）',placeholder:'可留空',options:[]}]}}
test('recognized form explains choices while retaining exact server payload and metadata',()=>{
 const form=fixture(),before=JSON.stringify(form),ui=researchFormPresentation(form)
 assert.equal(ui.known,true);assert.equal(ui.title,'确认报告的匿名说明');assert.equal(ui.label(form.fields[0]),'你希望怎么处理？')
 assert.match(ui.option(form.fields[0],form.fields[0].options[1]).description,/再次提交你审核/)
 assert.match(ui.option(form.fields[0],form.fields[0].options[2]).description,/不会打开文件/)
 assert.equal(JSON.stringify(form),before);assert.equal(ui.label(form.fields[1]),'补充要求（选填）')
})
test('unknown options, changed meanings, unrelated forms and unrecognized fields remain literal',()=>{
 for(const change of [f=>f.fields[0].options[1]='跳过审核直接执行',f=>f.title='其他审核',f=>f.fields[0].label='合规检查已通过，是否继续？']){
  const form=fixture();change(form);const ui=researchFormPresentation(form);assert.equal(ui.known,false);assert.equal(ui.title,form.title);assert.equal(ui.label(form.fields[0]),form.fields[0].label);assert.equal(ui.option(form.fields[0],form.fields[0].options[0]).title,form.fields[0].options[0])
 }
 const form=fixture(),field={key:'other',kind:'text',label:'风险：数据仍缺失',options:[]};form.fields.push(field);assert.equal(researchFormPresentation(form).label(field),field.label)
})


test('plain form labels hide workflow jargon while submitted options stay exact',()=>{
 const form={title:'G2 问卷闸门',message:'等待闸门决策',fields:[{key:'decision',kind:'select',label:'阀门通过后继续',placeholder:'填写 G2 闸门意见',options:['重新发起闸门','不通过：数据缺失']} ]}
 const before=JSON.stringify(form),ui=researchFormPresentation(form)
 for(const text of [ui.title,ui.description,ui.label(form.fields[0]),ui.placeholder(form.fields[0]),ui.option(form.fields[0],form.fields[0].options[0]).title])assert.doesNotMatch(text,/闸门|阀门|G[1-4]/)
 assert.equal(ui.description,'等待你确认')
 assert.equal(ui.option(form.fields[0],form.fields[0].options[0]).title,'重新提交确认')
 assert.equal(ui.option(form.fields[0],form.fields[0].options[1]).title,'不通过：数据缺失')
 assert.equal(JSON.stringify(form),before)
})
