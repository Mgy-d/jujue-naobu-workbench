import type {SurveyQuestion,QuestionnaireDraft} from '../components/research/questionnaire-contract'
import type {SandboxReference} from '../types/research-contracts'
import type {SandboxRun} from '../api/researchSandbox'
export interface PreviewAnswer {value?:string|string[];other?:Record<string,string>}
export function answerIssue(q:SurveyQuestion,a?:PreviewAnswer|null):string{
 const v=a?.value,empty=v===undefined||v===''||Array.isArray(v)&&!v.length;
 if(empty)return q.required?'请填写此必填题':'';
 if(q.type==='single'||q.type==='multi'){
  if(q.type==='single'&&typeof v!=='string'||q.type==='multi'&&!Array.isArray(v))return '答题格式不正确';
  const selected=Array.isArray(v)?v:[v];if(new Set(selected).size!==selected.length||selected.some(id=>!q.options.some(o=>o.id===id)))return '请选择有效选项';
  if(selected.length>1&&q.options.some(o=>o.exclusive&&selected.includes(o.id)))return '排他选项不能和其他选项同时选择';
  if(q.options.some(o=>selected.includes(o.id)&&o.openEnded&&!a?.other?.[o.id]?.trim()))return '请补充其他选项的说明';
 }else if(q.type==='number'){if(typeof v!=='string'||!v.trim()||!Number.isFinite(Number(v)))return '请输入有限数值'}
 else if(q.type==='scale'){if(v==='dontknow'&&q.scale?.hasDontKnow)return '';const n=Number(v);if(!q.scale||!Number.isInteger(n)||n<1||n>q.scale.points)return '请选择量表范围内的值'}
 else if(q.type==='text'){if(typeof v!=='string'||!v.trim())return '请填写文字'}else return '此题型暂不支持试填';
 return ''
}
export function g2DraftInput(draft:QuestionnaireDraft):string{
 if(!draft.questions.length)throw Error('请先填写团队题项');
 if(draft.questions.some(q=>!['single','multi','scale','number','text'].includes(q.type)))throw Error('存在不支持的题型，请核对后再准备 G2 输入');
 return JSON.stringify(draft,null,2)
}
export function resultIssue(ref:SandboxReference,run:SandboxRun):string{
 if(run.workspaceId!==ref.workspaceId||run.runId!==ref.runId)return '结果身份与当前任务的分析引用不匹配';
 if(run.executionStatus!=='succeeded')return '运行尚未成功，不能作为已完成分析';
 if(run.outputStatus!=='available'||!Array.isArray(run.artifacts)||!run.artifacts.length)return '结果尚未保存或没有固定产物';
 if(!run.inputFingerprint||run.artifacts.some(a=>!a.artifactId||!a.versionId||!a.name||!/^[a-f0-9]{64}$/i.test(a.sha256)))return '固定产物身份或校验值不完整';return ''
}
