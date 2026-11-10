import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
async function subject(path){const r=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,alias:{'@':'./src'}});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'))}
const {renderResearchMessage}=await subject('src/utils/researchMessageRender.ts'),{researchReplyChecklist}=await subject('src/utils/researchReplyChecklist.ts')
test('previous reasoning stays hidden and care warning content remains visible including escaped tags',()=>{
 const html=renderResearchMessage('已完成读取。\n<previous_reasoning>内部推理\n尝试另一个脚本。</previous_reasoning>\n<care>发现4个无法溯源数值，需人工核对。</care>','assistant')
 assert.ok(!html.includes('内部推理'));assert.ok(!html.includes('previous_reasoning'));assert.ok(!html.includes('&lt;care'));assert.match(html,/4个无法溯源/)
 assert.equal(renderResearchMessage('<previous_reasoning>尚未闭合','assistant'),'')
 assert.match(renderResearchMessage('```text\n<previous_reasoning>示例</previous_reasoning>\n```','assistant'),/previous_reasoning/)
})
test('empty ordered lists are removed without touching meaningful numbered answers',()=>{
 assert.ok(!renderResearchMessage('1.\n2.\n3.\n4.','assistant').includes('<ol>'))
 assert.match(renderResearchMessage('1. 仍需人工审核\n2. 统计未执行','assistant'),/<ol>/)
})
test('platform retry logs are historical notices with raw instructions collapsed',()=>{
 const html=renderResearchMessage('[异步任务完成通知] 收到以下来自后台子智能体的完成事件，请据此继续推进流程：\n\n[run-failure-retry] 模型请求失败，第 1/5 次自动恢复；不要重复重跑。','user')
 assert.equal(html,'')
})
test('only explicit final checklist is extracted, including all text and boundaries',()=>{
 const source='报告已交付，但仍需人工定稿。\n\n**剩下四项只能由你们提供，AI 不得代做**：\n\n1. **S12 参考文献**：8—15条真实引用\n2. FIG1—FIG4 正式插图\n3. 答辩题目答案\n4. 外部工具结果（统计待人工确认）\n\n没有材料时不修改冻结产物。'
 const result=researchReplyChecklist(source);assert.equal(result.items.length,4);assert.match(result.items[3],/待人工确认/);assert.equal(result.original,source);assert.match(result.remainder,/不修改冻结产物/);assert.ok(!result.remainder.includes('8—15条'))
 assert.equal(researchReplyChecklist('早先可能需要参考文献，当前等待审核。'),null)
 assert.equal(researchReplyChecklist('```md\n仍需你们完成\n1. 示例\n```'),null)
})


test('known checklist items use readable labels while unusual approval constraints stay literal',async()=>{
 const {presentReplyChecklistItem}=await subject('src/utils/researchReplyChecklist.ts')
 assert.deepEqual(presentReplyChecklistItem('**S12 参考文献** 8—15 条真实引用 → 我只做格式统一与引用核对，不编造出处'),{title:'参考文献',description:'提供 8—15 条真实引用。'})
 assert.equal(presentReplyChecklistItem('**FIG1—FIG4 插图** → 跑 render_figures.py').title,'正式插图')
 assert.equal(presentReplyChecklistItem('E01/E02 外部工具结果 → 我只登记回填').title,'外部分析结果')
 assert.equal(presentReplyChecklistItem('E01/E02 外部工具结果，风险尚未通过审核，禁止继续'),null)
})
