import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {seedDemo} from '../server/db/seed';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {bootstrapOwnedWorkspaces} from '../server/services/owned-workspaces';
import {bootstrapOrganizationAccess} from '../server/services/organization-access';
import {saveTeamAccount} from '../server/team-auth';
import {sqliteSnapshot,applyPostgresMigrations,importPostgresSnapshot} from '../server/db/postgres-migration';

async function main(){
 const adminUrl=new URL(process.env.TEST_POSTGRES_ADMIN_URL||'postgres://localhost:5432/postgres');
 if(!['localhost','127.0.0.1','[::1]'].includes(adminUrl.hostname))throw new Error('Only disposable local PostgreSQL databases may be used.');
 const admin=postgres(adminUrl.toString(),{max:1,ssl:false,onnotice:()=>{}}),id=randomUUID().replaceAll('-',''),database=`iriva_team_${id}`,role=`iriva_team_${id}`;
 let child:ReturnType<typeof spawn>|undefined;
 try{
  await admin.unsafe(`CREATE ROLE ${role} LOGIN`);await admin.unsafe(`CREATE DATABASE ${database}`);
  const url=new URL(adminUrl);url.pathname='/'+database;
  const setup=postgres(url.toString(),{max:1,ssl:false,onnotice:()=>{}});
  try{
   await applyPostgresMigrations(setup);
   const sqlite=new SqliteRepository(':memory:');seedDemo(sqlite);await bootstrapOwnedWorkspaces(sqlite);const facade=asyncSqliteRepository(sqlite);await bootstrapOrganizationAccess(facade);
   await saveTeamAccount(facade,{email:'admin@team-test.example',name:'测试管理员',password:'test-admin-password',role:'admin'});
   await importPostgresSnapshot(setup,sqliteSnapshot(sqlite));sqlite.db.close();
  }finally{await setup.end();}
  await admin.unsafe(`GRANT iriva_runtime TO ${role}`);url.username=role;url.password='';
  const port=3119,base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_URL:url.toString(),PG_LOCAL_TEST:'1',NODE_ENV:'production'}});
  let serverOutput='';child.stdout?.on('data',v=>{serverOutput+=v});child.stderr?.on('data',v=>{serverOutput+=v});
  for(let i=0;i<100;i++){try{if((await fetch(base+'/signin')).ok)break}catch{}if(i===99)throw new Error(serverOutput);await new Promise(r=>setTimeout(r,200));}
  let cookie='';
  async function api(path:string,body?:unknown,otherCookie?:string){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,Cookie:otherCookie??cookie},body:body?JSON.stringify(body):undefined,redirect:'manual'});const text=await r.text();let data:any;try{data=JSON.parse(text)}catch{data=text}return {r,data};}
  function updateCookie(r:Response){for(const h of r.headers.getSetCookie()){const pair=h.split(';')[0],key=pair.split('=')[0];cookie=cookie.split('; ').filter(v=>v&&!v.startsWith(key+'=')).concat(pair).join('; ');}}
  let result=await api('/api/auth',{action:'begin',email:'admin@team-test.example'});assert.equal(result.data.method,'password');assert.equal(result.data.challengeId,undefined);
  result=await api('/api/auth/password',{email:'admin@team-test.example',password:'test-admin-password'});assert.equal(result.r.status,200);updateCookie(result.r);
  result=await api('/api/team');assert.equal(result.r.status,200,JSON.stringify(result.data));assert.equal(result.data.role,'admin');const first=result.data.organization.id;
  result=await api('/api/team/organizations',{action:'create',name:'第二个测试团队'});assert.equal(result.r.status,200,JSON.stringify(result.data));const second=result.data.organization.id;
  result=await api('/api/team/organizations',{action:'switch',organizationId:second});assert.equal(result.r.status,200);updateCookie(result.r);
  result=await api('/api/team');assert.equal(result.data.organization.id,second);assert.equal(result.data.households.length,0);
  result=await api('/api/team',{action:'task',title:'组织隔离验证',assignee:'测试管理员'});assert.equal(result.r.status,200,JSON.stringify(result.data));
  result=await api('/api/team');const task=result.data.tasks[0];assert.equal(task.title,'组织隔离验证');
  result=await api('/api/team',{action:'staff',email:'partner@team-test.example',name:'测试协作成员',role:'partner',password:'test-partner-password'});assert.equal(result.r.status,200,JSON.stringify(result.data));
  result=await api('/api/auth/password',{email:'partner@team-test.example',password:'test-partner-password'},'');assert.equal(result.r.status,200);const partnerCookie=result.r.headers.getSetCookie().map(h=>h.split(';')[0]).join('; ');
  result=await api('/api/team',{action:'staff',email:'forged@team-test.example',name:'Forged',role:'admin',password:'test-password'},partnerCookie);assert.equal(result.r.status,403);
  result=await api('/api/team/audit',undefined,partnerCookie);assert.equal(result.r.status,403);
  result=await api('/api/team',{action:'task',title:'协作待办'},partnerCookie);assert.equal(result.r.status,200);
  result=await api('/api/team/organizations',{action:'switch',organizationId:first},partnerCookie);assert.equal(result.r.status,403);
  result=await api('/api/team/audit?result=denied');assert.equal(result.r.status,200,JSON.stringify(result.data));assert.ok(result.data.items.some((x:any)=>x.action==='staff'));assert.ok(!JSON.stringify(result.data).includes('test-password'));
  result=await api('/api/team/organizations',{action:'switch',organizationId:first});assert.equal(result.r.status,200);updateCookie(result.r);
  result=await api('/api/team',{action:'complete',id:task.id,done:true});assert.equal(result.r.status,404);
  result=await api('/api/team');assert.ok(!result.data.tasks.some((x:any)=>x.id===task.id));
  result=await api('/api/team/audit?result=denied&action=complete');assert.equal(result.data.total,1);
  console.log('PASS: unified password login, organization switching, cross-tenant writes, partner restrictions, collaboration and filtered audit trail.');
  if(process.argv.includes('--serve')){console.log(`Preview ready: ${base}/signin (synthetic accounts only)`);await new Promise<void>(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve)});}
 }finally{if(child){child.kill('SIGTERM');await new Promise(r=>child!.once('exit',r));}await admin.unsafe(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);await admin.unsafe(`DROP ROLE IF EXISTS ${role}`);await admin.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
