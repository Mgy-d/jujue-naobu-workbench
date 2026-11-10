export interface ResultChart {heading:string;rows:{label:string;value:number;display:string}[]}
export interface ResultSlide {heading:string;body:string;excerpt:boolean;chart:ResultChart|null}
function chartFromTable(body:string):ResultChart|null{
 const lines=body.split('\n').map(s=>s.trim())
 for(let i=0;i<lines.length-2;i++){
  const cells=(line:string)=>line.replace(/^\||\|$/g,'').split('|').map(s=>s.trim())
  const header=cells(lines[i]!),divider=cells(lines[i+1]!)
  if(header.length!==2 || divider.length!==2 || !divider.every(c=>/^:?-{3,}:?$/.test(c)) || /编号|代码|题号|\bid\b/i.test(header[1]!))continue
  const rows:ResultChart['rows']=[];let unit:string|undefined,valid=true
  for(let j=i+2;j<lines.length && lines[j]!.startsWith('|');j++){
   const parts=cells(lines[j]!),value=parts[1]?.match(/^(-?\d+(?:\.\d+)?)\s*(%|％)?$/)
   if(parts.length!==2 || !parts[0] || /^\d+$/.test(parts[0]) || !value || Number(value[1])<0){valid=false;break}
   const suffix=value[2]?'%':'';if(unit!==undefined&&unit!==suffix){valid=false;break}unit=suffix
   rows.push({label:parts[0],value:Number(value[1]),display:parts[1]!})
  }
  if(valid && rows.length>=2 && rows.length<=20)return {heading:header.join(' · '),rows}
 }
 return null
}
export function resultSlides(content:string,fileName:string):ResultSlide[]{
 const base=fileName.replace(/\.[^.]+$/,'')
 if(/\.json$/i.test(fileName)){
  const parsed=JSON.parse(content)
  if(parsed===null || typeof parsed!=='object')return [{heading:base,body:content,excerpt:false,chart:null}]
  return Object.entries(parsed).map(([key,value])=>({heading:key,body:JSON.stringify(value,null,2),excerpt:false,chart:null}))
 }
 const sections:{heading:string;lines:string[]}[]=[];let section={heading:base,lines:[] as string[]},fenced=false
 for(const line of content.split('\n')){
  if(/^\s*```/.test(line))fenced=!fenced
  const heading=!fenced?line.match(/^#{1,6}\s+(.+?)\s*#*$/):null
  if(heading){if(section.lines.join('\n').trim())sections.push(section);section={heading:heading[1]!,lines:[]}}
  else section.lines.push(line)
 }
 if(section.lines.join('\n').trim())sections.push(section)
 return sections.map(s=>{const full=s.lines.join('\n').trim();return {heading:s.heading,body:full.slice(0,8000),excerpt:full.length>8000,chart:chartFromTable(full)}})
}
