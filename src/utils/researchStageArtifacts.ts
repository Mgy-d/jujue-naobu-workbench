import type {ArtifactNode} from '../types/sandbox'
/** Display grouping only. Preserve backend paths; never interpret a filename as approval. */
export function stageArtifacts(files:ArtifactNode[],projectId:string,phase:number):ArtifactNode[]{
 if(!projectId)return [];
 return files.filter(f=>{
  const parts=f.path.replace(/\\/g,'/').split('/');
  const index=parts.indexOf(projectId);if(index<0)return false;
  const relative=parts.slice(index+1).join('/');
  if(phase<=2)return relative===['研究简报.md','研究问题.md','调查方案.md'][phase];
  if(phase===3)return relative.startsWith('问卷/');
  if(phase===5)return /^(数据|统计|分析)\//.test(relative);
  if(phase===6)return /^(报告|PPT|答辩)\//.test(relative);
  return false;
 });
}
