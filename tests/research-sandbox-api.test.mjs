import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }))
const result = await build({entryPoints:[fileURLToPath(new URL('../src/api/researchSandbox.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'})
const { sandboxClient } = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))

test('network failure gives actionable feedback for requests and downloads', async t => {
  t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch')})
  for(const request of [()=>sandboxClient('synthetic').workspaces(),()=>sandboxClient('synthetic').download('r',{artifactId:'a',versionId:'v'})])
    await assert.rejects(request, e=>e.name==='SandboxConnectionError' && /启动/.test(e.message) && /分析服务/.test(e.message))
})
test('a timed out submission is not retried or falsely declared unstarted', async t => {
  let calls=0
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw new DOMException('timeout','TimeoutError')})
  await assert.rejects(()=>sandboxClient('synthetic').start('w',{},'same-key'),e=>e.name==='SandboxConnectionError' && /无法确认/.test(e.message) && /核对/.test(e.message))
  assert.equal(calls,1)
})
test('invalid token is distinguished from an unavailable server',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({code:'invalid_token',message:'not valid'}),{status:401}))
  await assert.rejects(()=>sandboxClient('synthetic').workspaces(),e=>e.name==='SandboxAuthenticationError' && /令牌/.test(e.message))
})
test('a non JSON gateway failure explains service startup',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('<html>Bad Gateway</html>',{status:502}))
  await assert.rejects(()=>sandboxClient('synthetic').workspaces(),e=>e.name==='SandboxConnectionError' && /启动/.test(e.message) && /分析服务/.test(e.message))
})
test('a 200 HTML fallback does not count as a connected API',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('<html>frontend fallback</html>',{status:200}))
  await assert.rejects(()=>sandboxClient('synthetic').workspaces(),e=>e.name==='SandboxConnectionError' && /响应/.test(e.message))
})
test('engine refusal remains explicit rather than a network failure',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({code:'execution_unavailable'}),{status:503}))
  await assert.rejects(()=>sandboxClient('synthetic').start('w',{},'k'),e=>e.name==='Error' && /本次任务未启动/.test(e.message))
})
