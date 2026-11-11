import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname} from 'node:path'
const require=createRequire(import.meta.url),{parse,compileScript}=require(require.resolve('@vue/compiler-sfc',{paths:[dirname(require.resolve('vue'))]}))
test('actual workbench Vue script compiles including the HTML export string',()=>{
 const source=readFileSync(new URL('../src/views/ResearchReplayView.vue',import.meta.url),'utf8'),result=parse(source)
 assert.deepEqual(result.errors,[])
 assert.doesNotThrow(()=>compileScript(result.descriptor,{id:'workbench-syntax-check'}))
})
