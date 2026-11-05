import {rawFetch,getAccessToken,authSnapshot,sameAuth} from './http'

export interface CollectionSurvey {
  id:string;code:string;title:string;version:string;status:string;responseCount:number
  projectId:string;batchKind:'synthetic'|'real';batchName:string;schemaHash:string;createdAt:string;sourceThreadId:string;sourceTaskId:string
}
export interface CollectionResponse {id:string;submittedAt:string;answers:Record<string,unknown>;flags:string[]}
export interface CollectionSnapshot {id:string;surveyId:string;rowCount:number;schemaHash:string;contentHash:string;confirmed:boolean;createdAt:string}
export interface CollectionQuestionStat {
  qid:string;variable:string;type:string;text:string;answered:number;missing:number
  counts:{code:string;label:string;count:number;percent:number}[]
}
export interface CollectionStats {
  surveyId:string;code:string;title:string;version:string;status:string
  total:number;pretest:number;today:number;unusedInvites:number
  byDay:{day:string;count:number}[];questions:CollectionQuestionStat[]
}
export class CollectionError extends Error {constructor(message:string,public status:number){super(message)}}
const prefix='/collection-api'
async function request<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal,publicAccess=false,text=false,bytes=false):Promise<T>{
  const auth=authSnapshot()
  if(!publicAccess && !getAccessToken())throw Error('请先登录研究者账号。')
  const response=await rawFetch(prefix+path,{method,body,signal,skipAuth:publicAccess,timeoutMs:20000})
  if(!publicAccess && !sameAuth(auth))throw Error('账号已变化，请重新读取数据。')
  if(!response.ok){
    const error=await response.json().catch(()=>null)
    throw new CollectionError(response.status===401?'问卷收集服务未接受当前登录，请重新登录或核对服务端认证/验签方式与平台地址配置。':error?.message || '问卷服务请求失败（'+response.status+'）',response.status)
  }
  return (bytes?await response.arrayBuffer():text?await response.text():await response.json()) as T
}
export const collectionApi={
  list:(signal?:AbortSignal)=>request<CollectionSurvey[]>('/surveys','GET',undefined,signal),
  publish:(body:unknown,signal?:AbortSignal)=>request<CollectionSurvey>('/surveys','POST',body,signal),
  definition:(id:string,signal?:AbortSignal)=>request<unknown>('/surveys/'+encodeURIComponent(id)+'/definition','GET',undefined,signal),
  stats:(id:string,signal?:AbortSignal)=>request<CollectionStats>('/surveys/'+encodeURIComponent(id)+'/stats','GET',undefined,signal),
  close:(id:string)=>request<CollectionSurvey>('/surveys/'+encodeURIComponent(id)+'/close','POST'),
  responses:(id:string,page=1,signal?:AbortSignal,from='',until='')=>request<{items:CollectionResponse[];total:number;totalPages:number}>('/surveys/'+encodeURIComponent(id)+'/responses?page='+page+'&size=20'+(from?'&from='+encodeURIComponent(from):'')+(until?'&until='+encodeURIComponent(until):''),'GET',undefined,signal),
  publicSurvey:(code:string,signal?:AbortSignal)=>request<{code:string;title:string;version:string;notice:string;questions:unknown[]}>('/public/surveys/'+encodeURIComponent(code),'GET',undefined,signal,true),
  receipt:(code:string,deviceId:string,submissionId:string,signal?:AbortSignal)=>request<{ok:boolean;responseId:string|null}>('/public/surveys/'+encodeURIComponent(code)+'/responses/receipt','POST',{deviceId,submissionId},signal,true),
  submit:(code:string,body:unknown,signal?:AbortSignal)=>request<{ok:boolean;responseId:string}>('/public/surveys/'+encodeURIComponent(code)+'/responses','POST',body,signal,true),
  previewSnapshot:(id:string)=>request<CollectionSnapshot>('/surveys/'+encodeURIComponent(id)+'/snapshot-previews','POST'),
  confirmSnapshot:(id:string)=>request<CollectionSnapshot>('/survey-snapshots/'+encodeURIComponent(id)+'/confirm','POST'),
  snapshots:(id:string,signal?:AbortSignal)=>request<CollectionSnapshot[]>('/surveys/'+encodeURIComponent(id)+'/snapshots','GET',undefined,signal),
  snapshotBytes:(id:string)=>request<ArrayBuffer>('/survey-snapshots/'+encodeURIComponent(id)+'/raw.csv','GET',undefined,undefined,false,false,true),
  snapshotCsv:(id:string)=>request<string>('/survey-snapshots/'+encodeURIComponent(id)+'/raw.csv','GET',undefined,undefined,false,true),
  exportCsv:(id:string)=>request<string>('/surveys/'+encodeURIComponent(id)+'/export/raw.csv','GET',undefined,undefined,false,true),
}
