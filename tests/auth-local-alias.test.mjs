import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }))

async function subject(env) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/api/auth.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
    define: { 'import.meta.env': JSON.stringify(env) },
  })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64') + '#' + Math.random())
}

async function loginRequest(env, username) {
  const m = await subject(env)
  const old = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch }
  const stored = new Map()
  let request
  try {
    globalThis.window = { location: { origin: 'http://synthetic.test' }, setTimeout, clearTimeout }
    globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
    globalThis.fetch = async (_url, options) => {
      request = JSON.parse(options.body)
      return new Response(JSON.stringify({ accessToken: 'synthetic-token', refreshToken: 'synthetic-refresh', userId: 'synthetic-id', username: 'server-identity', role: 'end_user' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const result = await m.authApi.login(username, 'synthetic-password')
    assert.equal(result.username, 'server-identity')
    assert.equal(JSON.parse(stored.get('user_info')).username, 'server-identity')
    assert.equal(request.password, 'synthetic-password')
    return request.username
  } finally { Object.assign(globalThis, old) }
}

test('local admin alias forwards the original password and retains the real server identity', async () => {
  assert.equal(await loginRequest({ DEV: true, VITE_LOCAL_LOGIN_ALIAS_TARGET: 'synthetic_test' }, 'admin'), 'synthetic_test')
})

test('production, unconfigured aliases and other usernames retain their original login account', async () => {
  assert.equal(await loginRequest({ DEV: false, VITE_LOCAL_LOGIN_ALIAS_TARGET: 'synthetic_test' }, 'admin'), 'admin')
  assert.equal(await loginRequest({ DEV: true }, 'admin'), 'admin')
  assert.equal(await loginRequest({ DEV: true, VITE_LOCAL_LOGIN_ALIAS_TARGET: 'synthetic_test' }, 'other_user'), 'other_user')
})
