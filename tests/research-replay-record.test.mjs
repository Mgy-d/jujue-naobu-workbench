import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const output=await build({entryPoints:['src/utils/researchReplayRecord.ts'],bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}})
const {recoverReplayFormHistory,mergeReplayForms,replayQuestionnaireIdentity,replayRounds,replaySteps,mergeReplayMessages,recoverReplayForms,validateReplayRecord,replayJournalKey}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'))
const form={id:'reply:choice',form:{interruptId:'reply:choice',toolName:'ui_gate',title:'G2 问卷确认',message:'',fields:[]},answers:{decision:'通过'},afterMessageId:'explanation',answerMessageId:'answer',phase:'G2',submitted:true}
const record={version:2,id:'version1',ownerId:'owner',taskId:'task',threadId:'thread',agentId:'agent',title:'合成流程',savedAt:'2026-11-10T00:00:00Z',messages:[{id:'explanation',role:'assistant',text:'请确认问卷'},{id:'answer',role:'user',text:'通过'},{id:'response',role:'assistant',text:'已收到选择'}],forms:[form],files:[],gaps:[]}
test('saved form appears before its issued answer and replay does not mutate historical data',()=>{
 const before=JSON.stringify(record),steps=replaySteps(record)
 assert.deepEqual(steps.map(s=>s.id),['message:explanation','form:reply:choice','message:answer','message:response'])
 assert.equal(steps[1].form.answers.decision,'通过');assert.equal(JSON.stringify(record),before)
})
test('snapshot extension keeps earlier messages and stable anchors across remote IDs',()=>{
 const before=[{id:'a',remoteId:'server-a',role:'assistant',text:'earlier'},{id:'b',role:'user',text:'later'}]
 const merged=mergeReplayMessages(before,[{id:'server-a',role:'assistant',text:'earlier updated'},{id:'c',role:'assistant',text:'new'}])
 assert.deepEqual(merged.map(m=>m.id),['a','b','c']);assert.equal(merged[0].text,'earlier updated')
})
test('old transcript restores original form schema without guessing missing answers or treating timeout as approval',()=>{
 const source=[{id:'reply',role:'assistant',content:[{type:'text',text:'请确认'},{type:'tool_call',id:'choice',name:'ui_form_advanced',input:JSON.stringify({title:'G2 问卷确认',pages:[{title:'选择',items:[{key:'choice',label:'是否通过',kind:'radio-group',options:['通过','不通过'],required:true}]}]})}]},{id:'result',role:'assistant',content:[{type:'tool_result',id:'choice',state:'success',output:'HITL_TIMEOUT'}]}]
 const forms=recoverReplayForms(source)
 assert.equal(forms.length,1);assert.equal(forms[0].phase,'G2');assert.deepEqual(forms[0].answers,{});assert.equal(forms[0].submitted,false);assert.equal(forms[0].form.fields[0].options[0],'通过')
})
test('record and journal identities separate owners, tasks and sessions',()=>{
 assert.equal(validateReplayRecord(record,'owner','task'),record)
 assert.throws(()=>validateReplayRecord(record,'other','task'));assert.throws(()=>validateReplayRecord(record,'owner','other'))
 assert.notEqual(replayJournalKey('a','b:c','d','e'),replayJournalKey('a:b','c','d','e'))
 assert.notEqual(replayJournalKey('a','b','d','e'),replayJournalKey('a','b','d','other'))
})


test('historical answers recover only from one schema-valid structured result',()=>{
 const call={id:'reply',content:[{type:'tool_call',id:'choice',name:'ui_form_advanced',input:JSON.stringify({title:'确认',pages:[{title:'选择',items:[{key:'choice',label:'是否通过',kind:'radio-group',options:['通过','不通过'],required:true}]}]})}]}
 const result={id:'result',content:[{type:'tool_result',id:'choice',state:'success',output:JSON.stringify({choice:'通过'})}]}
 assert.deepEqual(recoverReplayForms([call,result])[0].answers,{choice:'通过'})
 assert.equal(recoverReplayForms([call,result,result])[0].submitted,false)
 assert.equal(recoverReplayForms([call,{id:'result',content:[{...result.content[0],output:'通过'}]}])[0].submitted,false)
})


test('500 assistant fragments advance as one user operation without losing any source messages',()=>{
 const messages=[{id:'user',role:'user',text:'合成研究题目'},...Array.from({length:500},(_,i)=>({id:'reply-'+i,role:'assistant',text:'合成回复片段 '+i}))]
 const source={...record,messages,forms:[]},before=JSON.stringify(source),rounds=replayRounds(source)
 assert.equal(rounds.length,1);assert.equal(rounds[0].messages.length,501);assert.equal(JSON.stringify(source),before)
})
test('forms remain separate pauses between grouped user operations',()=>{
 const source={...record,messages:[record.messages[0],{id:'detail',role:'assistant',text:'连续说明'},...record.messages.slice(1)]}
 const rounds=replayRounds(source)
 assert.equal(rounds.length,3);assert.equal(rounds[0].messages.length,2);assert.equal(rounds[1].form.id,form.id);assert.deepEqual(rounds[2].messages.map(m=>m.id),['answer','response'])
})
test('phase transitions and new user inputs remain reachable; hidden fragments consume no steps',()=>{
 const ledger=phase=>'[进度] 阶段='+phase+' 完成=已保存 进行中=无 剩余=人工确认 下步=等待确认 状态=等待人工'
 const source={...record,forms:[],messages:[{id:'a',role:'user',text:'题目'},{id:'b',role:'assistant',text:ledger('G1')},{id:'c',role:'assistant',text:'同阶段说明'},{id:'d',role:'assistant',text:ledger('G2')},{id:'e',role:'user',text:'补充要求'},{id:'hidden',role:'assistant',text:'hidden'}]}
 const rounds=replayRounds(source,message=>message.text!=='hidden')
 assert.deepEqual(rounds.map(r=>r.phase),['G1','G2','G2']);assert.deepEqual(rounds.map(r=>r.messages.length),[3,1,1])
})


test('intake form stays near its original reply across local and remote message identifiers',()=>{
 const intake={...form,id:'intake',afterMessageId:'remote-intro',answerMessageId:'missing-answer',submitted:false}
 const source={...record,messages:[{id:'topic',role:'user',text:'题目'},{id:'local-intro',remoteId:'remote-intro',role:'assistant',text:'请填写六要素'},{id:'later',role:'assistant',text:'后续研究'}],forms:[intake]}
 assert.deepEqual(replaySteps(source).map(step=>step.id),['message:topic','message:local-intro','form:intake','message:later'])
})
test('legacy JSON Schema intake preserves undergraduate choice and all six original answers',()=>{
 const properties={group:{type:'string',title:'参赛组别',enum:['本科组','专科组']},source:{type:'string',title:'选题来源'},topic:{type:'string',title:'研究主题'},object:{type:'string',title:'研究对象'},region:{type:'string',title:'调查地域'},time:{type:'string',title:'调查时间'}}
 const answers={group:'本科组',source:'自主选题',topic:'合成题目',object:'本校学生',region:'广州',time:'2026年秋季'}
 const messages=[{id:'user',role:'user',content:[{type:'text',text:'合成题目'}]},{id:'tool-text',role:'tool',content:[{type:'text',text:'内部工具输出'}]},{id:'intake-reply',role:'assistant',content:[{type:'tool_call',id:'intake-call',name:'ui_form',input:JSON.stringify({title:'研究资料收集',schema:{type:'object',properties,required:Object.keys(properties)}})}]},{id:'intake-result',role:'assistant',content:[{type:'tool_result',id:'intake-call',state:'success',output:JSON.stringify(answers)}]}]
 const before=JSON.stringify(messages),history=recoverReplayFormHistory(messages)
 assert.equal(history.gaps.length,0);assert.equal(history.forms.length,1);assert.equal(history.forms[0].form.fields.length,6);assert.deepEqual(history.forms[0].answers,answers);assert.equal(history.forms[0].afterMessageId,'user');assert.equal(JSON.stringify(messages),before)
})
test('unsupported historical forms are counted as gaps instead of silently omitted',()=>{
 const history=recoverReplayFormHistory([{id:'reply',content:[{type:'tool_call',id:'unsupported',name:'ui_form_advanced',input:JSON.stringify({title:'历史补充表单',pages:[{items:[{key:'x',kind:'unknown-picker',label:'无法识别的字段'}]}]})}]}])
 assert.equal(history.forms.length,0);assert.equal(history.gaps.length,1);assert.match(history.gaps[0],/历史补充表单/)
})
test('saving another snapshot retains earlier forms and never replaces submitted answers with an incomplete recovery',()=>{
 const original=JSON.stringify(form),incomplete={...form,answers:{},submitted:false}
 const merged=mergeReplayForms([form],[incomplete],[{...form,id:'another'}])
 assert.equal(merged.length,2);assert.equal(merged[0].answers.decision,'通过');assert.equal(JSON.stringify(form),original)
})
test('saved questionnaire identity uses original project or archived path, never arbitrary JSON ownership',()=>{
 const path='artifacts/sz-original/问卷/问卷结构.json',file={name:'问卷结构.json',path,phase:'G2'}
 assert.equal(replayQuestionnaireIdentity(record,file).projectId,'sz-original')
 assert.equal(replayQuestionnaireIdentity({...record,projectId:'sz-original'},file).error,'')
 assert.match(replayQuestionnaireIdentity({...record,projectId:'sz-other'},file).error,/不一致/)
 assert.match(replayQuestionnaireIdentity(record,{...file,path:'问卷结构.json'}).error,/未保存/)
})


test('confirmed historical form answers echo as a user message only when no original answer message was saved',()=>{
 const field={key:'decision',kind:'radio-group',label:'是否通过',options:['通过','不通过'],required:true},saved={...form,form:{...form.form,fields:[field]},answerMessageId:undefined}
 const source={...record,messages:[record.messages[0]],forms:[saved]},before=JSON.stringify(source),steps=replaySteps(source)
 assert.equal(steps.length,3);assert.equal(steps[2].message.role,'user');assert.match(steps[2].message.text,/是否通过：通过/);assert.equal(JSON.stringify(source),before)
 assert.equal(replaySteps({...source,forms:[{...saved,submitted:false}]}).length,2)
})
