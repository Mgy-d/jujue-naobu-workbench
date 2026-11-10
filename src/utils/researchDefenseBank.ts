export interface DefenseQuestion {
  id:string;category:string;question:string;riskLevel:string;evidenceHint:string;owner:string;answer:string
}
export interface DefenseBank {version:string;groups:{category:string;questions:DefenseQuestion[]}[];total:number}
export function readDefenseBank(path:string,value:unknown):DefenseBank|null {
  if(!value || typeof value!=='object' || Array.isArray(value))return null
  const record=value as Record<string,unknown>
  const knownSchema=record.schema==='sz-defense-bank/v1'
  const knownFile=path.split(/[\\/]/).at(-1)==='答辩题库.json'
  if(!knownSchema && !knownFile)return null
  if(record.schema!==undefined && !knownSchema)return null
  if(!Array.isArray(record.questions) || record.questions.length>500)throw Error('答辩题库的问题列表不完整或超过预览范围，请查看原文。')
  const string=(v:unknown)=>typeof v==='string'?v:''
  const groups:DefenseBank['groups']=[]
  for(const [index,raw] of record.questions.entries()){
    if(!raw || typeof raw!=='object' || Array.isArray(raw) || typeof raw.question!=='string' || !raw.question.trim())throw Error('第 '+(index+1)+' 题缺少可读取的问题内容，请查看原文。')
    const item=raw as Record<string,unknown>,category=string(item.category)||'未分类'
    const question:DefenseQuestion={id:string(item.id),category,question:string(item.question),riskLevel:string(item.riskLevel),evidenceHint:string(item.evidenceHint),owner:string(item.owner),answer:string(item.referenceAnswer)||string(item.answer)}
    let group=groups.find(group=>group.category===category)
    if(!group){group={category,questions:[]};groups.push(group)}
    group.questions.push(question)
  }
  return {version:string(record.version),total:record.questions.length,groups}
}
