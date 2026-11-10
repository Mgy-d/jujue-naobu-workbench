export interface ResearchHandoff {
 taskId:string;threadId:string;projectId:string;agentId:string;surveyId:string;snapshotId:string;version:string;batchName:string;batchKind:string;contentHash:string;rowCount:number;operationId:string;
 state:'preparing'|'uploading'|'attachments-ready'|'dispatching'|'sent'|'reply-observed';csvRef?:string;manifestRef?:string;updatedAt:string;error?:string
}
/** A persisted user turn proves receipt, a following assistant turn only proves a reply, not approval. */
export function handoffProof(messages:{role:string;text:string}[],snapshotId:string){
 const marker='已人工确认采用数据快照 '+snapshotId+'。'
 const index=messages.findIndex(m=>m.role==='user'&&m.text.includes(marker))
 return {sent:index>=0,replyObserved:index>=0&&messages.slice(index+1).some(m=>m.role==='assistant'&&m.text.trim())}
}
export function handoffStatus(record?:ResearchHandoff){
 if(!record)return '尚未登记交付'
 return ({preparing:'已登记，等待上传',uploading:'上传结果待核对', 'attachments-ready':'附件已上传，消息尚未发送',dispatching:'消息结果待核对',sent:'原会话已收到消息', 'reply-observed':'已读取原会话后续回复（不代表审核通过）'})[record.state]+(record.error?'；'+record.error:'')
}
