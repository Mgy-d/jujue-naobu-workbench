/** Presentation-only provider failure recognition; never changes run or review state. */
export function researchResponseTimeout(text:string):{seconds:number;start:number;end:number;raw:string}|null{
 const lines=text.split('\n');let fenced=false,offset=0
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!
  if(/^\s*(```|~~~)/.test(line)){fenced=!fenced;offset+=line.length+1;continue}
  const match=!fenced&&/^\s*(?:\*\*)?Request exceeded (\d+)s limit(?:\*\*)?\s*$/i.exec(line.replace(/\\$/,''))
  if(match){
   let start=offset;const previous=lines[i-1]||''
   if(/^\s*\[req_[^\]]+\]/.test(previous))start-=previous.length+1
   let end=offset+line.length
   for(let j=i+1;j<lines.length;j++){
    const next=lines[j]!.trim()
    if(next&&!/^(?:[-*] |\*\*(?:Billing|Recommended tools)|(?:Billing|Recommended tools|How to fix):|Your prompt took too long|These responses are optimized|If you are using a non-standard client)/i.test(next))break
    end+=lines[j]!.length+1
   }
   return {seconds:Number(match[1]),start,end,raw:text.slice(start,end)}
  }
  offset+=line.length+1
 }
 return null
}
export function latestResponseTimedOut(messages:{role:string;text:string;local?:boolean}[]):boolean{
 for(let i=messages.length-1;i>=0;i--){const m=messages[i]!;if(m.local)continue;if(m.role==='user')return false;if(m.role==='assistant'&&m.text.trim())return !!researchResponseTimeout(m.text)}
 return false
}
/** Drop native DSML call envelopes outside code examples, including partial streaming calls. */
export function stripResearchToolMarkup(text:string):string{
 const stack:string[]=[];const output:string[]=[];let fence=''
 for(const line of text.split('\n')){
  const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line)
  if(!stack.length&&marker){if(!fence)fence=marker[1]!;else if(marker[1]![0]===fence[0]&&marker[1]!.length>=fence.length)fence='';output.push(line);continue}
  if(fence){output.push(line);continue}
  let result='',cursor=0
  const tags=/\\?<\s*(\/?)｜DSML｜\s*(calls|invoke|parameter)\b[^>]*>/g
  for(const m of line.matchAll(tags)){
   if(!stack.length)result+=line.slice(cursor,m.index)
   if(m[1]){const index=stack.lastIndexOf(m[2]!);if(index>=0)stack.splice(index)}else stack.push(m[2]!)
   cursor=m.index!+m[0].length
  }
  if(!stack.length)result+=line.slice(cursor)
  // Incomplete streamed envelope must not expose its JSON payload.
  const partial=result.indexOf('<｜DSML｜');if(partial>=0){result=result.slice(0,partial);stack.push('invoke')}
  if(result.trim())output.push(result);else if(!stack.length&&(output.at(-1)||'').trim())output.push('')
 }
 return output.join('\n').trim()
}
