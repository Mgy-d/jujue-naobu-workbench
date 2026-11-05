import http from 'node:http'
import https from 'node:https'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

// The website origin is a candidate API gateway, pending verification on company LAN.
const target=new URL(process.env.COMPANY_BACKEND_URL||'http://192.168.1.245:8084')
if(!['http:','https:'].includes(target.protocol)||target.username||target.password||target.search||target.hash||target.pathname!=='/'||['localhost','127.0.0.1','[::1]'].includes(target.hostname))throw Error('Company backend must be a non-local HTTP(S) origin without credentials or path.')
const endpoint=new URL('/api/agents',target)
console.log('Company API candidate:',target.origin)
console.log('Checking unauthenticated GET /api/agents; no password or token is sent.')
try{
  const result=await new Promise((resolve,reject)=>{
    const req=(target.protocol==='https:'?https:http).get(endpoint,{headers:{accept:'application/json'}},res=>{
      const status=res.statusCode||0,type=String(res.headers['content-type']||'')
      res.resume()
      resolve({status,type})
    })
    req.setTimeout(8000,()=>req.destroy(Error('Company network/API timed out after 8 seconds.')))
    req.on('error',reject)
  })
  console.log('API check:',result.status,result.type)
  if(![200,401,403].includes(result.status)||!result.type.toLowerCase().includes('json'))throw Error('Expected a JSON API response. The website may require a different API gateway address.')
  console.log('API reachable. Agent identity and cloud conversation visibility still require authenticated verification.')
  if(!process.argv.includes('--check')){
    console.log('Open http://localhost:5185/ and log in with the actual company account. Local admin alias is disabled.')
    const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'--mode','company','--host',process.env.FRONTEND_HOST==='0.0.0.0'?'0.0.0.0':'127.0.0.1','--port','5185','--strictPort'],{
      cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit',
      env:{...process.env,VITE_BACKEND_TARGET:target.origin,VITE_AUTH_MODE:'real',VITE_RESEARCH_AGENT_MODE:'real',VITE_RESEARCH_BUSINESS_MODE:'real',VITE_LOCAL_LOGIN_ALIAS_TARGET:''},
    })
    child.on('error',error=>{console.error(error.message);process.exitCode=1})
    child.on('exit',code=>{process.exitCode=code??1})
  }
}catch(error){console.error('Stopped:',error.message);console.error('No fallback to local backend. Connect company LAN and confirm the API gateway address.');process.exitCode=1}
