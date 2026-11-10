import DOMPurify from 'dompurify'
export const WORD_MAX_BYTES=20*1024*1024
/** Render semantic content, never embedded active HTML, external media or document scripts. */
export async function renderResearchWord(bytes:ArrayBuffer):Promise<string>{
  if(bytes.byteLength>WORD_MAX_BYTES)throw Error('Word 文件超过20MB，请下载后打开。')
  const mammoth=(await import('mammoth')).default
  const result=await mammoth.convertToHtml({arrayBuffer:bytes},{externalFileAccess:false,convertImage:mammoth.images.imgElement(async()=>({src:''}))})
  return DOMPurify.sanitize(result.value,{ALLOWED_TAGS:['h1','h2','h3','h4','h5','h6','p','strong','em','u','s','ul','ol','li','table','thead','tbody','tr','td','th','br','sup','sub','blockquote'],ALLOWED_ATTR:['colspan','rowspan']})
}
