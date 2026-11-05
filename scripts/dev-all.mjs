import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import net from 'node:net'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(process.env.TJDC_BACKEND_DIR || 'D:/Codex/projects/agents-backend-tjdc')
const companyDatabase=existsSync(resolve(backend,'.env.company.local')) || process.env.SPRING_PROFILES_ACTIVE?.split(',').includes('company')
const authMode=process.env.TJDC_AUTH_MODE || (companyDatabase?'remote':'local')
const children = new Set()
const checkOnly = process.argv.includes('--check')
let stopping = false

function command(program, args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(program, args, {windowsHide:true, ...options, stdio:['ignore','pipe','pipe']})
    let output = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { output += data })
    const timer = setTimeout(() => { child.kill(); reject(Error(program+' 检查超时。')) }, 20000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => {
      clearTimeout(timer)
      if(code===0)resolveResult(output.trim())
      else reject(Error(program+' 执行失败。'+(program==='docker'?' 请打开 Docker Desktop 并等待引擎就绪。':'')))
    })
  })
}

function launch(program, args, options = {}) {
  const child = spawn(program, args, {windowsHide:true,stdio:'inherit',...options})
  children.add(child)
  child.on('error', () => { console.error('启动失败，请检查 '+program+' 是否可用。'); void stop(1) })
  child.on('close', code => {
    children.delete(child)
    if(!stopping){ console.error('本次启动的服务已退出，退出码 '+code); void stop(code || 1) }
  })
  return child
}

async function stop(code=0) {
  if(stopping)return
  stopping=true
  await Promise.all([...children].map(async child => {
    if(!child.pid || child.exitCode!==null)return
    if(process.platform==='win32') {
      await command('taskkill',['/PID',String(child.pid),'/T','/F']).catch(()=>{})
    } else child.kill('SIGTERM')
  }))
  process.exit(code)
}
process.on('SIGINT',()=>{void stop()})
process.on('SIGTERM',()=>{void stop()})

function portOpen(port) {
  return new Promise(resolveResult => {
    const socket=net.createConnection({host:'127.0.0.1',port})
    const done=value=>{socket.destroy();resolveResult(value)}
    socket.setTimeout(1500,()=>done(false))
    socket.once('connect',()=>done(true));socket.once('error',()=>done(false))
  })
}
async function collectionReady() {
  try {
    const health=await fetch('http://127.0.0.1:8090/actuator/health',{signal:AbortSignal.timeout(3000)})
    if(!health.ok || (await health.json()).status!=='UP')return false
    const probe=await fetch('http://127.0.0.1:8090/api/public/surveys/__startup_readonly_check__',{signal:AbortSignal.timeout(3000)})
    return probe.status===404 && (await probe.text()).includes('问卷不存在')
  } catch {return false}
}
async function existingFrontend(){
  try{
    const response=await fetch('http://127.0.0.1:5185/package.json',{signal:AbortSignal.timeout(3000)})
    return response.ok && (await response.json()).name==='shidiaoyanzhen-workbench'
  }catch{return false}
}
async function waitFor(check, label, timeout=90000) {
  const deadline=Date.now()+timeout
  while(Date.now()<deadline && !stopping){
    if(await check())return
    await new Promise(resolveResult=>setTimeout(resolveResult,1000))
  }
  throw Error(label+'未在等待时间内就绪，请查看上方日志。')
}
async function inspectContainer(name) {
  const result=await command('docker',['container','ls','-a','--filter','name=^/'+name+'$','--format','{{.Names}}'])
  if(!result)return null
  return JSON.parse(await command('docker',['inspect',name]))[0]
}
function mappedPort(container, internalPort) {
  const ports=container.NetworkSettings.Ports?.[internalPort+'/tcp'] || container.HostConfig.PortBindings?.[internalPort+'/tcp']
  if(!ports?.length)throw Error(container.Name+' 没有映射端口 '+internalPort+'，请核对现有容器配置。')
  return ports[0].HostPort
}
async function dependency(service, name, internalPort, defaultPort, variable) {
  let container=await inspectContainer(name)
  if(!container){
    if(checkOnly)throw Error('缺少 '+name+' 容器。正式启动时会按现有 Compose 配置创建。')
    const port=Number(process.env[variable] || defaultPort)
    if(await portOpen(port))throw Error('端口 '+port+' 已被其他服务占用，请核对后再启动 '+service+'。')
    console.log('创建 '+name+'…')
    const hostVariable=service==='postgres'?'TJDC_PG_HOST_PORT':'TJDC_REDIS_HOST_PORT'
    await command('docker',['compose','up','-d','--no-recreate',service],{cwd:backend,env:{...process.env,[hostVariable]:String(port)}})
    container=await inspectContainer(name)
  }
  if(!container)throw Error(name+' 创建后未找到。')
  const port=mappedPort(container,internalPort)
  const configured=process.env[variable]
  if(configured && String(configured)!==port)throw Error(variable+' 与已有容器端口 '+port+' 不一致，请核对配置。')
  if(!container.State.Running){
    if(checkOnly)throw Error(name+' 尚未运行。')
    await command('docker',['start',name])
  }
  if(!checkOnly)await waitFor(async()=>{
    try {
      const args=service==='postgres'?['pg_isready','-U',process.env.TJDC_DB_USER || 'agent_platform','-d',process.env.TJDC_DB_NAME || 'tjdc_survey']:['redis-cli','ping']
      const output=await command('docker',['exec',name,...args])
      return service==='postgres'?output.includes('accepting connections'):output==='PONG'
    }catch{return false}
  },name)
  console.log(name+' 已就绪，端口 '+port)
  return port
}

async function main() {
  if(process.argv.includes('--help')){
    console.log('npm run dev:all       启动本机采集依赖、采集服务及公司联调前端\nnpm run dev:all -- --check  只检查环境\n公司数据库模式默认远程认证，无需共享签名密钥；local 模式需在 IDEA 配置 TJDC_JWT_SECRET。可用 TJDC_BACKEND_DIR 指定采集仓库目录。\n停止运行会结束本次新建的程序进程，Docker 数据库与已运行服务继续保留。')
    return
  }
  if(process.platform!=='win32')throw Error('当前一键入口使用 Windows PowerShell，请在本机 Windows 运行。')
  if(!existsSync(resolve(backend,'scripts/start-survey-local.ps1')))throw Error('未找到采集服务，请设置 TJDC_BACKEND_DIR。')
  if(!existsSync(resolve(frontend,'node_modules/vite/bin/vite.js')))throw Error('前端依赖不完整，请先安装项目依赖。')
  for(const variable of ['TJDC_DB_HOST','TJDC_REDIS_HOST']){
    if(!(companyDatabase && variable==='TJDC_DB_HOST') && process.env[variable] && !['localhost','127.0.0.1','::1'].includes(process.env[variable]))throw Error(variable+' 指向远程服务，请核对本机一键启动配置。')
  }
  if(process.env.VITE_COLLECTION_TARGET && process.env.VITE_COLLECTION_TARGET.replace(/\/$/,'')!=='http://127.0.0.1:8090')throw Error('当前 VITE_COLLECTION_TARGET 指向其他服务，请使用本机 8090 地址运行此入口。')
  const reuse=await collectionReady()
  if(!reuse){
    if(authMode!=='remote' && !process.env.TJDC_JWT_SECRET?.trim())throw Error('缺少 TJDC_JWT_SECRET。请在 IDEA 的此运行配置中设置与公司平台匹配的密钥，再重新启动。')
    if(await portOpen(8090))throw Error('8090 端口已占用，但问卷服务健康检查未通过，请核对已有进程。')
    await command('powershell.exe',['-NoProfile','-Command','if (!(Get-Command mvn -ErrorAction SilentlyContinue) -or !(Get-Command java -ErrorAction SilentlyContinue)) { exit 1 }'])
  }
  const frontendOccupied=await portOpen(5185)
  const reuseFrontend=frontendOccupied && await existingFrontend()
  if(frontendOccupied && !reuseFrontend)throw Error('5185 端口被其他程序占用，请核对后再启动。')
  try {
    await command(process.execPath,[resolve(frontend,'scripts/dev-company.mjs'),'--check'],{cwd:frontend,env:process.env})
  } catch {throw Error('公司接口检查失败，请连接公司内网并核对 COMPANY_BACKEND_URL。')}
  console.log('公司接口可访问。')
  if(reuse)console.log('复用已就绪的本机问卷采集服务。')
  else {
    await command('docker',['info','--format','{{.ServerVersion}}'])
    const dbPort=companyDatabase?String(process.env.TJDC_DB_PORT || '5432'):await dependency('postgres','agents-backend-tjdc-postgres',5432,5433,'TJDC_DB_PORT')
    if(companyDatabase)console.log('使用公司数据库配置，跳过本机 PostgreSQL 启动。')
    const redisPort=await dependency('redis','agents-backend-tjdc-redis',6379,6379,'TJDC_REDIS_PORT')
    if(!checkOnly){
      console.log('启动问卷采集服务，首次 Maven 编译可能需要几分钟…')
      launch('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve(backend,'scripts/start-survey-local.ps1')],{cwd:backend,env:{...process.env,TJDC_DB_PORT:dbPort,TJDC_REDIS_PORT:redisPort,TJDC_AUTH_MODE:authMode,TJDC_PLATFORM_URL:process.env.TJDC_PLATFORM_URL || process.env.COMPANY_BACKEND_URL || 'http://192.168.1.245:8084',SERVER_PORT:'8090'}})
      await waitFor(collectionReady,'问卷采集服务',180000)
    }
  }
  if(checkOnly){console.log('环境检查完成。尚未启动新服务。');return}
  if(reuseFrontend){
    const probe=await fetch('http://127.0.0.1:5185/collection-api/public/surveys/__startup_readonly_check__',{signal:AbortSignal.timeout(5000)})
    if(probe.status!==404 || !(await probe.text()).includes('问卷不存在'))throw Error('已有前端未正确连接问卷服务，请停止原前端后重新运行一键入口。')
    console.log('复用已有前端 http://127.0.0.1:5185/，问卷接口检查通过。')
    return
  }
  console.log('问卷采集服务已就绪。启动前端 http://127.0.0.1:5185/')
  launch(process.execPath,[resolve(frontend,'scripts/dev-company.mjs')],{cwd:frontend,env:{...process.env,VITE_COLLECTION_TARGET:'http://127.0.0.1:8090'}})
}
main().catch(error=>{console.error('启动停止：'+error.message);void stop(1)})
