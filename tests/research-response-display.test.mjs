import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function moduleOf(path){const r=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':'./src'}});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))}
const {researchResponseTimeout,latestResponseTimedOut,stripResearchToolMarkup}=await moduleOf('src/utils/researchResponseDisplay.ts')
const {renderResearchMessage}=await moduleOf('src/utils/researchMessageRender.ts')
const {conversationReceiptState}=await moduleOf('src/utils/researchConversationUi.ts')
const report='[req_test] [deepseek-test]\n**Request exceeded 570s limit**\n\n- Your prompt took too long to process.\nHow to fix:\n- **Send "continue"** to resume.\n**Billing:**\n- This request still counts as a request.\n**Recommended tools:**\n- These responses are optimized for clients.'
test('DSML calls and incomplete tool payloads never become chat text, normal text survives',()=>{
 const text='待团队确认。\n<｜DSML｜ calls>\n<｜DSML｜ invoke name="ui_form_advanced">\n<｜DSML｜ parameter name="pages">[{"secret":"payload"}]</｜DSML｜ parameter>\n</｜DSML｜ invoke>\n</｜DSML｜ calls>\n下一步请核对风险。'
 const shown=stripResearchToolMarkup(text);assert.equal(shown,'待团队确认。\n\n下一步请核对风险。')
 assert.equal(renderResearchMessage('<｜DSML｜ invoke name="tool">\n{"incomplete":true}','assistant'),'')
 assert.ok(!renderResearchMessage(text,'assistant').includes('DSML'));assert.match(shown,/风险/)
 assert.equal(stripResearchToolMarkup('<｜DSML｜ invoke'),'')
})
test('code examples and user quotations are not treated as active tool or provider output',()=>{
 const sample='```text\n<｜DSML｜ invoke name="example">\nRequest exceeded 570s limit\n```'
 assert.match(stripResearchToolMarkup(sample),/DSML/);assert.equal(researchResponseTimeout(sample),null)
 assert.match(renderResearchMessage(report,'user'),/Request exceeded/)
})
test('provider timeout becomes a Chinese failure, preserves diagnostics collapsed and later warnings',()=>{
 const html=renderResearchMessage('已修改说明，但校验仍有两条警告。\n\n'+report+'\n\n后续提示：统计尚未执行，请人工确认。','assistant')
 assert.match(html,/已修改说明/);assert.match(html,/本次处理超时，结果待核对/);assert.match(html,/570/);assert.match(html,/<details><summary>错误详情/)
 const visible=html.split('<details>')[0];assert.ok(!visible.includes('Billing'));assert.ok(!visible.includes('Send "continue"'));assert.match(html,/统计尚未执行/)
 assert.equal(researchResponseTimeout(report).seconds,570)
})
test('only latest response timeout overrides stale progress; a subsequent user turn or reply clears it',()=>{
 const messages=[{role:'user',text:'确认修订'},{role:'assistant',text:report}]
 assert.equal(latestResponseTimedOut(messages),true)
 assert.equal(latestResponseTimedOut([...messages,{role:'user',text:'本机尚未确认发送',local:true}]),true)
 assert.equal(latestResponseTimedOut([...messages,{role:'user',text:'请核对结果'}]),false)
 assert.equal(latestResponseTimedOut([...messages,{role:'assistant',text:'本轮已核对，仍需人工审核'}]),false)
 const result=conversationReceiptState({status:'awaiting',responseTimedOut:true});assert.equal(result.canCompose,false);assert.equal(result.tone,'attention');assert.match(result.title,/超时/)
})
