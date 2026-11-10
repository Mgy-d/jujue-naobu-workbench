import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}))
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})
const credentials=(side,user='A')=>({accessToken:side+'-'+user,refreshToken:side+'-refresh-'+user,userId:side+'-id-'+user,username:user,role:'end_user',permissions:side==='biz'?['case:view']:[],oauthAccessToken:side==='biz'?'oauth-'+user:undefined})
async function fixture(run){
 const result=await build({stdin:{contents:`export * from './src/api/http'; export * from './src/api/auth'; export {useUserStore,USER_KEY} from './src/stores/user'; export {createPinia,setActivePinia} from 'pinia'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':JSON.stringify({VITE_DUAL_TOKEN:'1'})}})
 const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64')+'#'+Math.random())
 const old={window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch},saved=new Map()
 globalThis.window={location:{origin:'http://synthetic.test'},setTimeout,clearTimeout}
 globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)}
 try{await run(m,saved)}finally{Object.assign(globalThis,old)}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))
test('one login obtains separate credentials; research keeps agent identity; OAuth only reaches business APIs',()=>fixture(async(m,saved)=>{
 const calls=[]
 globalThis.fetch=async(url,options)=>{const path=new URL(url).pathname;calls.push({path,headers:options.headers});return path.endsWith('/login')?json(credentials(path.startsWith('/business-auth')?'biz':'agent')):json([])}
 const result=await m.authApi.login('A','synthetic-password')
 assert.equal(calls.filter(c=>c.path.endsWith('/login')).length,2)
 assert.equal(result.userId,'agent-id-A');assert.deepEqual(result.permissions,['case:view']);assert.equal(saved.get('user_id'),'agent-id-A')
 await m.http.get('/api/tjdc/cases');await m.http.get('/api/agents/example');await m.http.get('/collection-api/research/documents/task')
 const business=calls.find(c=>c.path==='/api/tjdc/cases'),agent=calls.find(c=>c.path==='/api/agents/example'),collection=calls.find(c=>c.path.startsWith('/collection-api'))
 assert.equal(business.headers.Authorization,'Bearer biz-A');assert.equal(business.headers['X-OAuth-Token'],'oauth-A')
 assert.equal(agent.headers.Authorization,'Bearer agent-A');assert.equal(collection.headers.Authorization,'Bearer agent-A');assert.equal(agent.headers['X-OAuth-Token'],undefined)
}))
test('concurrent business 401s refresh business once and never replace research identity',()=>fixture(async(m,saved)=>{
 m.saveTokens('agent-A','agent-refresh-A');m.saveTokens('biz-A','biz-refresh-A','biz');saved.set('user_id','agent-id-A')
 let refreshes=0
 globalThis.fetch=async(url,options)=>{const path=new URL(url).pathname;if(path==='/business-auth/refresh'){refreshes++;await tick();return json(credentials('biz','next'))}return options.headers.Authorization==='Bearer biz-next'?json([]):json({message:'expired'},401)}
 await Promise.all([m.http.get('/api/tjdc/cases'),m.http.get('/api/tjdc/member/overview')])
 assert.equal(refreshes,1);assert.equal(m.getAccessToken(),'agent-A');assert.equal(saved.get('user_id'),'agent-id-A');assert.equal(m.getAccessToken('biz'),'biz-next')
}))
test('business refresh failure leaves working research credentials intact',()=>fixture(async(m)=>{
 m.saveTokens('agent-A','agent-refresh-A');m.saveTokens('biz-A','biz-refresh-A','biz')
 globalThis.fetch=async()=>json({message:'expired'},401)
 await assert.rejects(m.http.get('/api/tjdc/cases'),e=>e.status===401)
 assert.equal(m.getAccessToken(),'agent-A');assert.equal(m.getRefreshToken(),'agent-refresh-A');assert.equal(m.getAccessToken('biz'),'')
}))
test('missing business login never sends an agent token to business or refreshes it',()=>fixture(async(m)=>{
 m.saveTokens('agent-A','agent-refresh-A');let calls=0;globalThis.fetch=async()=>{calls++;return json([])}
 await assert.rejects(m.http.get('/api/tjdc/cases'),e=>e.status===401)
 assert.equal(calls,0);assert.equal(m.getAccessToken(),'agent-A')
}))
test('business refresh arriving after account switch cannot overwrite new credentials',()=>fixture(async(m)=>{
 m.saveTokens('agent-A','agent-refresh-A');m.saveTokens('biz-A','biz-refresh-A','biz');let finish
 globalThis.fetch=()=>new Promise(resolve=>finish=resolve)
 const pending=m.ensureFreshToken('biz');await tick()
 m.saveTokens('agent-B','agent-refresh-B');m.saveTokens('biz-B','biz-refresh-B','biz')
 finish(json(credentials('biz','old')))
 assert.equal(await pending,false);assert.equal(m.getAccessToken('biz'),'biz-B');assert.equal(m.getAccessToken(),'agent-B')
}))
test('logout clears both credentials even when one endpoint fails',()=>fixture(async(m,saved)=>{
 m.saveTokens('agent-A','agent-refresh-A');m.saveTokens('biz-A','biz-refresh-A','biz');saved.set('oauth_access_token','oauth-A')
 const calls=[];globalThis.fetch=async(url)=>{calls.push(new URL(url).pathname);return json({},500)}
 await m.authApi.logout();assert.deepEqual(calls.sort(),['/api/auth/logout','/business-auth/logout'].sort())
 assert.equal(m.getAccessToken(),'');assert.equal(m.getAccessToken('biz'),'');assert.equal(saved.has('oauth_access_token'),false)
}))
test('late parallel login cannot restore credentials after logout',()=>fixture(async(m)=>{
 const finishes=[];globalThis.fetch=(url)=>new Promise(resolve=>finishes.push(()=>resolve(json(credentials(new URL(url).pathname.startsWith('/business-auth')?'biz':'agent')))))
 const pending=m.authApi.login('A','synthetic-password').catch(e=>e);await tick();m.clearTokens();for(const finish of finishes)finish()
 assert.match((await pending).message,/登录状态已变化/);assert.equal(m.getAccessToken(),'');assert.equal(m.getAccessToken('biz'),'')
}))

test('visible logout clears user immediately and a late logout cannot erase the next login',()=>fixture(async(m,saved)=>{
 m.setActivePinia(m.createPinia());const store=m.useUserStore()
 globalThis.fetch=async(url,options)=>json(credentials(new URL(url).pathname.startsWith('/business-auth')?'biz':'agent',JSON.parse(options.body).username))
 await store.login('A','synthetic-password');assert.equal(store.isLogged,true)
 const finishes=[];globalThis.fetch=()=>new Promise(resolve=>finishes.push(resolve))
 const pending=store.logout();assert.equal(store.isLogged,false);assert.equal(store.user,null);assert.equal(saved.has(m.USER_KEY),false)
 globalThis.fetch=async(url,options)=>json(credentials(new URL(url).pathname.startsWith('/business-auth')?'biz':'agent',JSON.parse(options.body).username))
 await store.login('B','synthetic-password');for(const finish of finishes)finish(json({}))
 await pending;assert.equal(store.user.userId,'agent-id-B');assert.equal(store.isLogged,true)
}))
test('either side failing login leaves no half authenticated session',()=>fixture(async(m)=>{
 globalThis.fetch=async(url)=>new URL(url).pathname.startsWith('/business-auth')?json({message:'synthetic business rejection'},401):json(credentials('agent'))
 await assert.rejects(m.authApi.login('A','synthetic-password'))
 assert.equal(m.getAccessToken(),'');assert.equal(m.getAccessToken('biz'),'')
}))

test('agent renewal keeps business permissions and the original research identity',()=>fixture(async(m,saved)=>{
 globalThis.fetch=async(url)=>json(credentials(new URL(url).pathname.startsWith('/business-auth')?'biz':'agent'))
 await m.authApi.login('A','synthetic-password')
 globalThis.fetch=async()=>json({...credentials('agent'),accessToken:'agent-renewed'})
 assert.equal(await m.ensureFreshToken(),true)
 assert.equal(saved.get('user_id'),'agent-id-A');assert.deepEqual(JSON.parse(saved.get('user_info')).permissions,['case:view'])
 const result=await m.authApi.refresh();assert.deepEqual(result.permissions,['case:view']);assert.equal(result.userId,'agent-id-A')
}))
