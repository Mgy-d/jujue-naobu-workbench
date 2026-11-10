export interface CitationMaterial {ref:string;fileName:string}
export function materialCitationKey(owner:string,agent:string,task:string,thread:string){return 'shidiaoyanzhen.material-citations.v1:'+ [owner,agent,task,thread].map(encodeURIComponent).join(':')}
export function referencedMaterialRefs(materials:CitationMaterial[],messages:{role:string;text:string}[]):string[]{
 const words=new Set(messages.filter(m=>m.role==='user').flatMap(m=>m.text.split(/\s+/)))
 return materials.filter(m=>words.has(m.ref)||words.has(m.ref.replace(/^@/,''))).map(m=>m.ref)
}
export function pendingMaterialCitations<T extends CitationMaterial>(materials:T[],messages:{role:string;text:string}[],attempted:string[],explicit:string[]=[]):T[]{
 const known=new Set([...attempted,...referencedMaterialRefs(materials,messages)]),forced=new Set(explicit)
 return materials.filter(m=>forced.has(m.ref)||!known.has(m.ref))
}
