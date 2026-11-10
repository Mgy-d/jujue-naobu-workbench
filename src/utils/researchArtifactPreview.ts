import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({html:false, breaks:false, linkify:false})
/** File contents are evidence: render directly, without the chat-specific filtering. */
export function renderArtifactMarkdown(content:string):string {return markdown.render(content.replace(/^\uFEFF/,''))}
export const CSV_PREVIEW_ROWS=200
export const CSV_PREVIEW_COLUMNS=50
export function parseArtifactCsv(content:string,delimiter= ',') {
  const source=content.replace(/^\uFEFF/,'')
  const visible:string[][]=[]
  let row:string[]=[],cell='',quoted=false,closed=false,started=false,total=0,width=0
  const field=()=>{row.push(cell);cell='';closed=false;started=false}
  const record=()=>{
    if(!row.length && !cell && !started)return
    field();total++
    if(total===1)width=row.length
    else if(row.length!==width)throw Error('第 '+total+' 行的列数与表头不一致，请查看原文核对。')
    if(total<=CSV_PREVIEW_ROWS+1)visible.push(row.slice(0,CSV_PREVIEW_COLUMNS))
    row=[]
  }
  for(let i=0;i<source.length;i++){
    const c=source[i]!
    if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
    if(c===delimiter){field();continue}
    if(c==='\r'||c==='\n'){record();if(c==='\r'&&source[i+1]==='\n')i++;continue}
    if(closed)throw Error('引号结束后出现无法识别的内容，请查看原文核对。')
    if(c==='"'){if(started)throw Error('字段中的引号格式不完整，请查看原文核对。');quoted=true;started=true;continue}
    cell+=c;started=true
  }
  if(quoted)throw Error('CSV 引号未闭合，无法完整展示表格。')
  record()
  return {headers:visible[0]??[],rows:visible.slice(1),totalRows:Math.max(0,total-1),totalColumns:width}
}

const labels:Record<string,string>={title:'标题',description:'说明',summary:'摘要',status:'状态',version:'版本',questions:'题目',variables:'变量',variable:'变量',name:'名称',label:'名称',text:'内容',type:'类型',code:'编码',options:'选项',required:'必填',method:'方法',methods:'方法',results:'结果',findings:'发现',conclusion:'结论',conclusions:'结论',limitations:'局限',warnings:'提醒',errors:'问题',items:'条目',source:'来源',sources:'来源',createdAt:'生成时间',updatedAt:'更新时间',sampleSize:'样本量',rowCount:'数据行数',count:'数量',value:'值',mean:'均值',median:'中位数',min:'最小值',max:'最大值',std:'标准差',missing:'缺失',analysisPlan:'分析计划',plan:'计划',notes:'备注',checks:'检查项',passed:'是否通过',reason:'原因',recommendations:'建议',sections:'章节',data:'数据',schemaVersion:'格式版本'}
export interface ArtifactJsonNode {kind:'value'|'object'|'array'|'limit';text?:string;entries?:{label:string;node:ArtifactJsonNode}[];total?:number}
export function buildArtifactJson(value:unknown):ArtifactJsonNode {
  let budget=500
  function visit(input:unknown,depth:number):ArtifactJsonNode {
    if(--budget<0 || depth>8)return {kind:'limit',text:'此部分较长，请切换“查看原文”阅读。'}
    if(input===null)return {kind:'value',text:'空值'}
    if(typeof input!=='object')return {kind:'value',text:input===true?'是':input===false?'否':String(input)}
    const array=Array.isArray(input),entries=array?input.map((v,i)=>[String(i+1),v] as const):Object.entries(input as Record<string,unknown>)
    return {kind:array?'array':'object',total:entries.length,entries:entries.slice(0,50).map(([key,v])=>({label:array?'第 '+key+' 项':Object.prototype.hasOwnProperty.call(labels,key)?labels[key]!:key,node:visit(v,depth+1)}))}
  }
  return visit(value,0)
}
