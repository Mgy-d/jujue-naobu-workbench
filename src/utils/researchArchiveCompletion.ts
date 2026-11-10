export interface ArchiveFileRef {path:string;id:string;fileName:string;contentHash:string;size:number}
export interface ArchiveCompletion {version:1;taskId:string;threadId:string;baseSavedAt:string;capturedAt:string;files:{path:string;content:string}[];fileRefs:ArchiveFileRef[];gaps:string[]}
/** Enumerate every listed path; no first-30 truncation or substitution by basename. */
export async function completeResearchArchive(input:{taskId:string;threadId:string;baseSavedAt:string;paths:{path:string;name:string}[];priorFiles?:{path:string;content:string}[];valid:()=>boolean;read:(path:string)=>Promise<{bytes:ArrayBuffer;ref:ArchiveFileRef}>}):Promise<ArchiveCompletion>{
 const result:ArchiveCompletion={version:1,taskId:input.taskId,threadId:input.threadId,baseSavedAt:input.baseSavedAt,capturedAt:new Date().toISOString(),files:[],fileRefs:[],gaps:[]}
 let textBytes=0;const encoder=new TextEncoder()
 const paths=new Map(input.paths.map(file=>[file.path,file]))
 for(const prior of input.priorFiles||[])if(!paths.has(prior.path))paths.set(prior.path,{path:prior.path,name:prior.path.split('/').at(-1)||prior.path})
 for(const file of paths.values()){
  if(!input.valid())throw Error('任务或账号已变化，已停止补全。')
  try{
   const {bytes,ref}=await input.read(file.path)
   if(!input.valid())throw Error('任务或账号已变化，已停止补全。')
   result.fileRefs.push(ref)
   if(/\.(md|markdown|txt|csv|tsv|json|py|html|css|js)$/i.test(file.path)){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),size=encoder.encode(text).byteLength
    if(textBytes+size<=3_000_000){result.files.push({path:file.path,content:text});textBytes+=size}
   }
  }catch(error){
   if(!input.valid())throw error
   const prior=input.priorFiles?.find(item=>item.path===file.path)
   if(prior && textBytes+encoder.encode(prior.content).byteLength<=3_000_000){result.files.push({...prior});textBytes+=encoder.encode(prior.content).byteLength}
   result.gaps.push(file.path+'：'+(error instanceof Error?error.message:'读取失败'))
  }
 }
 if(!paths.size)result.gaps.push('未取得文件清单，不能确认成果完整性。')
 return result
}
