import type {ResearchReplayRecord} from './researchReplayRecord'
const database='shidiaoyanzhen-replay-v2'
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(database,1);request.onupgradeneeded=()=>{request.result.createObjectStore('records',{keyPath:'key'});request.result.createObjectStore('files',{keyPath:'key'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
const key=(owner:string,task:string,id:string)=>JSON.stringify([owner,task,id])
export async function saveReplayLocal(record:ResearchReplayRecord,files:{path:string;bytes:ArrayBuffer}[]){
 const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['records','files'],'readwrite');tx.objectStore('records').add({key:key(record.ownerId,record.taskId,record.id),record:JSON.parse(JSON.stringify(record))});for(const file of files)tx.objectStore('files').put({key:key(record.ownerId,record.id,file.path),bytes:file.bytes});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('本机存储未完成'))})}finally{db.close()}
}
export async function listReplayLocal(owner:string,task:string):Promise<ResearchReplayRecord[]>{
 const db=await open();try{return await new Promise((resolve,reject)=>{const req=db.transaction('records').objectStore('records').getAll();req.onsuccess=()=>resolve(req.result.map(row=>row.record as ResearchReplayRecord).filter(r=>r.ownerId===owner&&r.taskId===task).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));req.onerror=()=>reject(req.error)})}finally{db.close()}
}
export async function readReplayLocalFile(owner:string,id:string,path:string):Promise<ArrayBuffer|null>{
 const db=await open();try{return await new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(key(owner,id,path));req.onsuccess=()=>resolve(req.result?.bytes||null);req.onerror=()=>reject(req.error)})}finally{db.close()}
}
