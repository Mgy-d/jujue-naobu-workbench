import {readableResearchText} from './researchDisplayText'
import type {ResearchForm,ResearchField} from '@/api/szRun'
/** Exact semantic adapter only: submitted fields/options are never rewritten. */
export function researchFormPresentation(form:ResearchForm){
 const decision=form.fields.find(f=>f.kind==='radio-group'&&/冻结的.*合规检查.*匿名口径不一致/.test(f.label))
 const known=!!decision&&/团队署名与成员信息\s*待团队填写/.test(decision.label)&&/合规检查件与匿名口径的处理方式/.test(form.title)&&decision.options.length===3
  &&/^保持现状：视为 \d{1,2}:\d{2} 前时点的审核留痕，不改动$/.test(decision.options[0]||'')
  &&decision.options[1]==='走 G4 修订：更新为已确定匿名，重跑校验与闸门'
  &&decision.options[2]==='先看现状，暂不决定'
 const presentation={
  known,title:known?'确认报告的匿名说明':form.title||'请确认以下事项',
  description:known?'之前保存的检查记录仍写着“团队署名与成员信息待填写”，与你已经确认的匿名要求不一致。请选择处理方式。':form.message==='运行等待确认，请完成以下表单后继续'?'':form.message,
  label:(field:ResearchField)=>known&&field===decision?'你希望怎么处理？':known&&field.kind==='textarea'&&/^补充说明（可选，/.test(field.label)?'补充要求（选填）':field.label,
  placeholder:(field:ResearchField)=>known&&field.kind==='textarea'&&/^补充说明（可选，/.test(field.label)?'例如：说明参考文献还有哪些需要补充。':field.placeholder,
  option:(field:ResearchField,value:string)=>{
   if(!known||field!==decision)return {title:value,description:''}
   const index=decision.options.indexOf(value)
   return [
    {title:'保留原检查记录',description:'将它作为当时的历史记录保留，本次不修改。'},
    {title:'按已确认的匿名要求修订',description:'更新相关记录，重新检查，并再次提交你审核。'},
    {title:'暂不决定，先查看相关内容',description:'本次不作修改。此选项本身不会打开文件。'},
   ][index]||{title:value,description:''}
  },
 }
 return {...presentation,title:readableResearchText(presentation.title),description:readableResearchText(presentation.description||''),label:(field:ResearchField)=>readableResearchText(presentation.label(field)),placeholder:(field:ResearchField)=>readableResearchText(presentation.placeholder(field)||''),option:(field:ResearchField,value:string)=>{const option=presentation.option(field,value);return {title:readableResearchText(option.title),description:readableResearchText(option.description)}}}
}
