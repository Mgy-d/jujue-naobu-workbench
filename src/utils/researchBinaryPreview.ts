export const BINARY_PREVIEW_MAX_BYTES=32*1024*1024
export function checkBinaryPreview(bytes:Uint8Array,kind:'pdf'|'pptx'){
 if(!bytes.length)throw Error('文件内容为空，无法预览。')
 if(bytes.length>BINARY_PREVIEW_MAX_BYTES)throw Error('文件超过32MB，请下载后查看。')
 if(kind==='pdf'){
  if(!new TextDecoder('ascii').decode(bytes.subarray(0,1024)).includes('%PDF-'))throw Error('读取到的内容不是有效的 PDF 文件，请下载核对。')
 }else if(bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==3||bytes[3]!==4)throw Error('读取到的内容不是有效的 PPTX 文件，请下载核对。')
}

/** PDF points are 72/in; CSS pixels are 96/in, matching the upstream viewer. */
export function pdfPreviewMetrics(pdfWidth:number,pdfHeight:number,zoom:number,deviceRatio:number){
 const scale=zoom*96/72,width=pdfWidth*scale,height=pdfHeight*scale
 // Supersample small CJK glyphs on ordinary screens; bound the bitmap to 16M pixels.
 const ratio=Math.min(Math.max(2,deviceRatio||1),3,Math.sqrt(16_777_216/(width*height)))
 return {scale,width,height,ratio}
}
