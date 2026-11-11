export interface DisplayArtifact {name:string;path:string}

/** Presentation only: never rewrites the path sent to the file API. */
export function artifactPresentation(file:DisplayArtifact){
  const ext=file.name.split('.').pop()?.toLowerCase()??''
  const stem=file.name.replace(/\.[^.]+$/,'')
  const format=({docx:'Word',doc:'Word',pdf:'PDF',pptx:'PPT',ppt:'PPT',md:'文档',txt:'文档',json:'数据',csv:'表格',tsv:'表格',xlsx:'Excel',xls:'Excel',png:'图片',jpg:'图片',jpeg:'图片',webp:'图片',svg:'图片'} as Record<string,string>)[ext]??'文件'
  let title=stem,subject=''
  const report=stem.match(/^(.*?)[-—_·\s]*(报告正文|研究报告|报告初稿|答辩PPT|答辩演示)$/i)
  if(report){title=/答辩/.test(report[2])?'答辩演示':report[2];subject=report[1].replace(/[-—_·\s]+$/,'')}
  if(stem==='问卷结构')title='调查问卷'
  const label=title==='调查问卷'?'问卷':format
  return {title,subject,format:label}
}

/** Identify report deliveries without treating checks, inputs or scripts as report prose. */
export function isReportDeliverable(file:DisplayArtifact){
 const path=file.path.replace(/\\/g,'/'),ext=file.name.split('.').pop()?.toLowerCase()||''
 if(/(?:^|\/)(?:_proof|_input|uploads|分析代码)(?:\/|$)/i.test(path))return false
 if(/^(?:合规检查|审核报告|核验|校验|检查清单|提交前清单|README|模板|AI使用|AI整理)/i.test(file.name))return false
 if(!['doc','docx','pdf','ppt','pptx','md','html'].includes(ext))return false
 const reportName=/报告正文|研究报告|报告初稿|答辩|(?:^|[-_\s])(?:report|presentation|slides)(?:[-_.\s]|$)/i.test(file.name)
 const delivery=/(?:^|\/)(?:交付|报告|reports?|deliverables?|delivery)(?:\/|$)/i.test(path)
 return reportName||(delivery&&['doc','docx','pdf','ppt','pptx'].includes(ext))||['ppt','pptx'].includes(ext)
}
export function prioritizeArtifacts<T extends DisplayArtifact>(files:T[]):T[]{
 const rank=(file:T)=>{if(!isReportDeliverable(file))return 10;const ext=file.name.split('.').pop()?.toLowerCase();return ext==='docx'||ext==='doc'?0:ext==='pdf'?1:ext==='pptx'||ext==='ppt'?2:3}
 return [...files].sort((a,b)=>rank(a)-rank(b))
}
export interface ArtifactCard<T extends DisplayArtifact> {key:string;files:T[]}
/** Group same-directory image formats; preserve different paths and versions as separate cards. */
export function groupArtifactCards<T extends DisplayArtifact>(files:T[]):ArtifactCard<T>[]{
 const cards=new Map<string,ArtifactCard<T>>(),seen=new Set<string>()
 for(const file of files){
  if(seen.has(file.path))continue;seen.add(file.path)
  const path=file.path.replace(/\\/g,'/'),image=/\.(png|svg|webp|jpe?g|gif|bmp|avif)$/i.test(file.name)
  const key=image?'image:'+path.replace(/\.[^/.]+$/,''):'file:'+path
  const card=cards.get(key);if(card)card.files.push(file);else cards.set(key,{key,files:[file]})
 }
 return [...cards.values()]
}
export function selectedArtifactVariant<T extends DisplayArtifact>(card:ArtifactCard<T>,path?:string):T{
 const selected=card.files.find(file=>file.path===path);if(selected)return selected
 return card.files.find(file=>/\.png$/i.test(file.name))||card.files[0]!
}
export function isPrimaryResearchArtifact(file:DisplayArtifact){
  if(isReportDeliverable(file))return true
  if(/(?:^|[/\\])(?:_proof|_state|_input|uploads|分析代码)(?:[/\\]|$)/i.test(file.path))return false
  if(/manifest|日志|留痕|核验|校验|交接|登记|AI使用|AI整理|指纹|原始|模板|数据字典|清洗后|统计结果|图表清单|图表规格/i.test(file.name))return false
  const ext=file.name.split('.').pop()?.toLowerCase()??''
  if(['png','jpg','jpeg','webp','svg'].includes(ext))return true
  if(['pdf','doc','docx','ppt','pptx'].includes(ext))return /报告|答辩|问卷|方案/.test(file.name)
  if(ext==='json')return /^(?:问卷结构|答辩题库)\.json$/i.test(file.name)
  return /^(?:调查方案|研究方案|统计报告|分析报告|研究报告|报告初稿|报告正文|答辩题库|问卷.*(?:预览|定稿|正式))\.(?:md|txt|html)$/i.test(file.name)
}

/** Keep ambiguous duplicates. Directory and time are provenance, not proof of adoption. */
export function artifactSourceLabel(file:DisplayArtifact,files:DisplayArtifact[]){
  const same=(other:DisplayArtifact)=>/\.(png|svg|webp|jpe?g|gif|bmp|avif)$/i.test(file.name)?other.name.replace(/\.[^.]+$/,'')===file.name.replace(/\.[^.]+$/,''):other.name===file.name
  if(files.filter(same).length<2)return ''
  const parts=file.path.replace(/\\/g,'/').split('/').slice(0,-1)
  const project=parts.findIndex(part=>/^sz-/.test(part))
  const relative=parts.slice(project>=0?project+1:0).join(' / ')
  const peers=files.filter(same)
  const labels=peers.map(other=>{
    const dirs=other.path.replace(/\\/g,'/').split('/').slice(0,-1)
    const index=dirs.findIndex(part=>/^sz-/.test(part))
    return dirs.slice(index>=0?index+1:0).join(' / ')
  })
  const label=relative||'研究目录'
  return '来源：'+label+(labels.filter(item=>item===relative).length>1?'（第 '+(peers.findIndex(other=>other.path===file.path)+1)+' 份）':'')
}
