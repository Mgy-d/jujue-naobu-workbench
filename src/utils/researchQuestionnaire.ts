import type {QuestionnaireDraft,QuestionnaireUpstream} from '../components/research/questionnaire-contract'
import {normalizeQuestionnaireDraft as normalizeEditor,checkQuestionnaire} from '../components/research/questionnaire-contract'
export {emptyQuestionnaireDraft,questionnaireSignature,pretestState as questionnairePretestState} from '../components/research/questionnaire-contract'
const unique=(rows:{id:string}[])=>rows.every(row=>row.id.trim())&&new Set(rows.map(row=>row.id)).size===rows.length
const finite=(n:unknown)=>n===null||typeof n==='number'&&Number.isFinite(n)
export function normalizeQuestionnaireDraft(value:any):QuestionnaireDraft|null{
 const clean=normalizeEditor(value);if(!clean)return null
 if(!unique(clean.questions)||!unique(clean.pretestRounds)||!unique(clean.unknowns))return null
 if(!finite(clean.meta.estimatedMinutes)||value.adoption.versionId!==undefined&&typeof value.adoption.versionId!=='string')return null
 for(const q of value.questions){if(!unique(q.options))return null;if(q.scale&&(!Number.isFinite(q.scale.points)||!['minLabel','maxLabel','midLabel'].every(k=>typeof q.scale[k]==='string')||typeof q.scale.hasDontKnow!=='boolean'))return null}
 for(const r of clean.pretestRounds)if(!unique(r.findings)||![r.respondentCount,r.completionRate,r.medianMinutes].every(finite))return null
 return clean
}
export function checkQuestionnaireDraft(draft:QuestionnaireDraft,upstream:QuestionnaireUpstream={plan:null}):string[]{
 const issues=[...checkQuestionnaire(draft,upstream).all],ids=new Set(draft.questions.map(q=>q.id))
 for(const round of draft.pretestRounds)for(const finding of round.findings)if(finding.questionId&&!ids.has(finding.questionId))issues.push('试填发现引用的题目已不存在，请重新关联。')
 return issues
}
