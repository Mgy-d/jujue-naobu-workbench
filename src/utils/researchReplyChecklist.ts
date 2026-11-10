import MarkdownIt from 'markdown-it'
const markdown=new MarkdownIt({html:false})
export interface ReplyChecklist {items:string[];remainder:string;original:string}
/** Extract only an explicit checklist in this reply, never infer work from older messages. */
export function researchReplyChecklist(text:string):ReplyChecklist|null{
 const tokens=markdown.parse(text,{}),lines=text.split('\n')
 let found:ReplyChecklist|null=null
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i]!
  if(!['paragraph_open','heading_open'].includes(token.type)||token.level!==0||!token.map)continue
  const inline=tokens[i+1];if(inline?.type!=='inline')continue
  const label=inline.content.replace(/[*_`]/g,'').trim()
  if(!/^(?:仍需(?:你们?|团队)?完成|仍需(?:你们?|团队)?补(?:充|的)|剩下.{0,16}(?:提供|完成)|接下来需要(?:你|团队)?提供|需要你指定后|团队待办)/.test(label))continue
  let listIndex=i+1
  while(listIndex<tokens.length&&['inline','paragraph_close','heading_close'].includes(tokens[listIndex]!.type))listIndex++
  const list=tokens[listIndex]
  if(!list||!['ordered_list_open','bullet_list_open'].includes(list.type)||list.level!==0||!list.map)continue
  const items:string[]=[]
  let end=list.map[1]
  for(let j=listIndex+1;j<tokens.length;j++){
   const item=tokens[j]!
   if((item.type==='ordered_list_close'||item.type==='bullet_list_close')&&item.level===0)break
   if(item.type==='list_item_open'&&item.level===1&&item.map){
    const raw=lines.slice(item.map[0],item.map[1]).join('\n').replace(/^\s*(?:\d+[.)]|[-+*])\s+/,'').trim()
    if(raw&&!items.includes(raw))items.push(raw)
   }
  }
  if(items.length)found={items,remainder:[...lines.slice(0,token.map[0]),...lines.slice(end)].join('\n').trim(),original:text}
 }
 return found
}

/** Known checklist wording only; unfamiliar risks and instructions remain verbatim. */
export function presentReplyChecklistItem(source:string):{title:string;description:string}|null{
 const plain=source.replace(/[*`]/g,'').trim()
 if(/风险|失败|警告|禁止|不得|未通过|重跑统计|待人工确认/.test(plain))return null
 const references=/^(?:S12\s*)?参考文献\s*(\d+\s*[—–~-]\s*\d+)\s*条真实引用/.exec(plain)
 if(references)return {title:'参考文献',description:'提供 '+references[1]+' 条真实引用。'}
 if(/^FIG1[—–~-]FIG4\s*(?:正式)?插图/.test(plain))return {title:'正式插图',description:'补充四张图，或说明需要协助处理哪张。'}
 const defense=/^答辩题库\s*(\d+)\s*条答案/.exec(plain)
 if(defense)return {title:'答辩答案',description:'由团队补充 '+defense[1]+' 条回答要点。'}
 if(/^E01\s*[\/／]\s*E02\s*外部工具结果/.test(plain))return {title:'外部分析结果',description:'提供对应分析结果和所用工具信息。'}
 return null
}
