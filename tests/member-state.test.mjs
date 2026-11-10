import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
test('membership reset prevents an old account response replacing a new account balance',async()=>{
 let actor='A';const calls=[]
 class ApiError extends Error{}
 const source=readFileSync(new URL('../src/stores/member.ts',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 const mocks={'@/api/http':{ApiError,authSnapshot:()=>actor,sameAuth:value=>value===actor},'@/api/member':{INSUFFICIENT_STATUS:402,memberApi:{overview:()=>new Promise(resolve=>calls.push(resolve))}}}
 new Function('require','module','exports',js)(name=>mocks[name]||require(name),module,module.exports)
 const {setActivePinia,createPinia}=require('pinia');setActivePinia(createPinia())
 const store=module.exports.useMemberStore(),old=store.ensureLoaded()
 actor='B';store.reset();const current=store.ensureLoaded()
 calls[1]({balance:22,ownedPapers:[],chargedWorks:[]});await current
 calls[0]({balance:999,ownedPapers:[],chargedWorks:[]});await old
 assert.equal(store.balance,22)
 actor='';store.reset();assert.equal(store.balance,0)
})
