import type {SurveyQuestion} from '@/components/research/questionnaire-contract'

export interface AgentQuestionnaire {
  title:string
  version:string
  questionIds:string[]
  questions:SurveyQuestion[]
  notes:string[]
  unsupported:{id:string;text:string;type:string}[]
  canFill:boolean
}
export function readAgentQuestionnaire(content:string,projectId:string):AgentQuestionnaire {
  const raw=JSON.parse(content.replace(/^\uFEFF/,''))
  if(raw.schema!=='sz-questionnaire/v1')throw Error('问卷文件格式暂不支持，请查看原文。')
  if(!projectId || raw.projectId!==projectId)throw Error('问卷项目 ID 与当前研究不一致，已阻止展示。')
  if(!Array.isArray(raw.questions) || !raw.questions.length)throw Error('问卷没有可展示的题目。')
  const result:AgentQuestionnaire={title:typeof raw.title==='string'?raw.title:'调查问卷',version:typeof raw.version==='string'?raw.version:'版本未提供',questionIds:[],questions:[],notes:[],unsupported:[],canFill:true}
  const ids=new Set<string>()
  for(const item of raw.questions){
    if(!item || typeof item.id!=='string' || !item.id.trim() || ids.has(item.id) || typeof item.text!=='string' || typeof item.required!=='boolean')throw Error('问卷题号、题干或必填字段有误，请查看原文。')
    ids.add(item.id)
    result.questionIds.push(item.id)
    const q:SurveyQuestion={id:item.id,text:item.text,type:'text',required:item.required,options:[],scale:null,measureId:typeof item.variable==='string'?item.variable:'',codingNote:'',screening:false}
    if(item.questionType==='single' || item.questionType==='multi'){
      if(!Array.isArray(item.options) || item.options.length<2)throw Error(item.id+' 缺少有效选项。')
      const codes=new Set<string>()
      q.options=item.options.map((option:unknown)=>{
        const o=option as {code?:unknown;label?:unknown}
        if(!o || typeof o.code!=='string' || !o.code || codes.has(o.code) || typeof o.label!=='string')throw Error(item.id+' 的选项编码或文字有误。')
        codes.add(o.code)
        return {id:o.code,label:o.label,code:o.code,exclusive:false,openEnded:false}
      })
      q.type=item.questionType
    }else if(item.questionType==='scale'){
      const scale=item.scale
      if(!scale || !Number.isInteger(scale.min) || !Number.isInteger(scale.max) || scale.max<scale.min || scale.max-scale.min>19 || !Array.isArray(scale.labels) || scale.labels.length!==scale.max-scale.min+1 || scale.labels.some((label:unknown)=>typeof label!=='string'))throw Error(item.id+' 的量表范围或标签有误。')
      // Explicit choices preserve non-one-based scales and every anchor label.
      q.type='single'
      q.options=scale.labels.map((label:string,index:number)=>({id:String(scale.min+index),code:String(scale.min+index),label:String(scale.min+index)+' '+label,exclusive:false,openEnded:false}))
    }else if(item.questionType==='open' || item.questionType==='number'){
      q.type=item.questionType==='number' || ['int','float'].includes(item.dataField?.type)?'number':'text'
    }else{
      result.unsupported.push({id:item.id,text:item.text,type:String(item.questionType)})
      result.canFill=false
      continue
    }
    if(item.sourceNote)q.codingNote=String(item.sourceNote)
    if(Array.isArray(item.skipLogic) && item.skipLogic.length){result.notes.push(item.id+' 包含跳转规则，当前预览暂不执行跳转。');result.canFill=false}
    result.questions.push(q)
  }
  if(raw.synthetic===true)result.notes.unshift('来源文件标注为合成样例。')
  return result
}
