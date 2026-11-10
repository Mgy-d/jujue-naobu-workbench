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

export function isPrimaryResearchArtifact(file:DisplayArtifact){
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
  if(files.filter(other=>other.name===file.name).length<2)return ''
  const parts=file.path.replace(/\\/g,'/').split('/').slice(0,-1)
  const project=parts.findIndex(part=>/^sz-/.test(part))
  const relative=parts.slice(project>=0?project+1:0).join(' / ')
  const peers=files.filter(other=>other.name===file.name)
  const labels=peers.map(other=>{
    const dirs=other.path.replace(/\\/g,'/').split('/').slice(0,-1)
    const index=dirs.findIndex(part=>/^sz-/.test(part))
    return dirs.slice(index>=0?index+1:0).join(' / ')
  })
  const label=relative||'研究目录'
  return '来源：'+label+(labels.filter(item=>item===relative).length>1?'（第 '+(peers.findIndex(other=>other.path===file.path)+1)+' 份）':'')
}
