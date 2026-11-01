import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const folder=mkdtempSync(path.join(os.tmpdir(),'iriva-owned-'));
process.env.SQLITE_PATH=path.join(folder,'test.sqlite');
import { GET,POST } from '../app/api/account/route';
import { workspaceRepository,workspaceService } from '../server/container';
import { newSession,digest } from '../server/auth';
import { seedDemo,seedId } from '../server/db/seed';
import { bootstrapOwnedWorkspaces } from '../server/services/owned-workspaces';
import { defaultOrganizationId } from '../domain/workspace';
import type { Account } from '../features/space/account-client';
let repo: Awaited<ReturnType<typeof workspaceRepository>>;
after(async()=>{await repo.db.close();rmSync(folder,{recursive:true,force:true});});
let ops:string;
before(async()=>{repo=await workspaceRepository();ops=`iriva_session=${await newSession(seedId(6))}`;});
function req(body?:object,cookie=ops,org=defaultOrganizationId) {return new Request('http://localhost/api/account',{method:body?'POST':'GET',headers:{host:'localhost',origin:'http://localhost','content-type':'application/json',cookie,'x-workspace-id':org},body:body?JSON.stringify(body):undefined});}
async function account(cookie:string,org?:string):Promise<Account> {const response=await GET(req(undefined,cookie,org));assert.equal(response.status,200);return response.json();}
async function login(email:string,org=defaultOrganizationId) {
 const id=randomUUID(),code='123456';
 await repo.db.prepare('INSERT INTO email_challenges (id,email,organization_id,code_hash,created_at,expires_at,delivered) VALUES (?,?,?,?,?,?,1)').run(id,email,org,digest(`${id}:${code}`),Date.now(),Date.now()+600000);
 const response=await POST(req({action:'email.verify',challengeId:id,code},'',org));
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 return response.headers.get('set-cookie')!.split(';')[0];
}

test('registered mailbox upgrades its original space, preserving notes; ownership and member isolation survive switching',async()=>{
 const cookie=await login('owner@example.test'),learner=await login('student@example.test');
 const before=await account(cookie),student=await account(learner);
 const original=before.homeWorkspaceId!;
 assert.equal((await account(cookie,original)).management?.space?.kind,'personal');
 const actor={userId:before.user.id,role:'learn' as const,organizationId:original};
 const channelId=randomUUID();
 await (await workspaceService()).execute(actor,{id:randomUUID(),entityId:channelId,baseVersion:0,kind:'channel.create',payload:{name:'My notes',description:'',kind:'private'}});
 assert.equal((await POST(req({action:'group.member.add',email:student.user.email},cookie,original))).status,403);
 assert.equal((await POST(req({action:'host.add',email:student.user.email},cookie,original))).status,403);
 assert.equal((await POST(req({action:'host.add',email:' OWNER@EXAMPLE.TEST '}))).status,200);
 assert.equal((await POST(req({action:'host.add',email:'owner@example.test'}))).status,200);
 const promoted=await account(cookie,original);
 assert.equal(promoted.role,'host');assert.equal(promoted.homeWorkspaceId,original);
 assert.equal(promoted.management?.space?.kind,'host');
 assert.equal((await repo.read()).organizations.filter(o=>o.ownerId===before.user.id).length,1);
 assert.ok((await repo.read()).channels.some(c=>c.id===channelId&&c.organizationId===original));
 assert.equal((await repo.read()).households.filter(h=>h.organizationId===original).length,1);
 assert.equal((await GET(req(undefined,learner,original))).status,403);
 assert.equal((await POST(req({action:'group.member.add',email:student.user.email},cookie,original))).status,200);
 assert.equal((await POST(req({action:'group.member.add',email:student.user.email},cookie,original))).status,200);
 const joined=await account(learner,original);assert.equal(joined.role,'learn');assert.equal(joined.homeWorkspaceId,student.homeWorkspaceId);
 assert.equal(student.landingWorkspaceId,student.homeWorkspaceId);assert.equal((await account(learner)).landingWorkspaceId,original);assert.equal(promoted.landingWorkspaceId,original);
 const group=(await repo.read()).households.find(h=>h.organizationId===original)!;
 assert.equal((await repo.read()).memberships.filter(m=>m.householdId===group.id&&m.userId===student.user.id).length,1);
 const hostActor={...actor,role:'host' as const};
 const publicId=randomUUID();
 await (await workspaceService()).execute(hostActor,{id:randomUUID(),entityId:publicId,baseVersion:0,kind:'channel.create',payload:{name:'Group chat',description:'',kind:'public'}});
 const view=await (await workspaceService()).snapshot({userId:student.user.id,role:'learn',organizationId:original});
 assert.ok(view.channels.some(c=>c.id===publicId));assert.ok(!view.channels.some(c=>c.id===channelId));
 const own=await (await workspaceService()).snapshot({userId:student.user.id,role:'learn',organizationId:student.homeWorkspaceId});
 assert.ok(!own.channels.some(c=>c.id===publicId));
 assert.equal((await POST(req({action:'group.member.add',email:'missing@example.test'},cookie,original))).status,422);
 assert.equal((await POST(req({action:'group.member.add',email:'owner@example.test'},learner,original))).status,403);
 await assert.rejects((await workspaceService()).execute({...hostActor,organizationId:defaultOrganizationId},{id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'channel.create',payload:{name:'Leak',description:'',kind:'public'}}),{status:403});
});

test('pre-added unregistered Host activates on verified login, bypasses student role, and is idempotent',async()=>{
 assert.equal((await POST(req({action:'host.add',email:'future@example.test'}))).status,200);
 assert.equal((await repo.read()).users.some(u=>u.email==='future@example.test'),false);
 const cookie=await login('future@example.test'),a=await account(cookie);
 assert.equal(a.role,'host');assert.equal(a.application,undefined);
 const home=await account(cookie,a.homeWorkspaceId);assert.equal(home.role,'host');assert.equal(home.management?.space?.kind,'host');
 const again=await account(await login('future@example.test'));
 assert.equal(again.homeWorkspaceId,a.homeWorkspaceId);
 assert.equal((await repo.read()).organizations.filter(o=>o.ownerId===a.user.id&&o.isPrimary).length,1);
 assert.ok((await account(ops)).management?.grants.find(g=>g.email===a.user.email)?.user_id);
});

test('additional groups require scoped approval, and rejection creates nothing',async()=>{
 const cookie=await login('requester@example.test');await POST(req({action:'host.add',email:'requester@example.test'}));
 const a=await account(cookie),home=a.homeWorkspaceId!;
 const before=(await repo.read()).organizations.length;
 assert.equal((await POST(req({action:'group.request',name:'Evening group',reason:'晚上学习的同学越来越多'},cookie,home))).status,200);
 assert.equal((await repo.read()).organizations.length,before);
 assert.equal((await POST(req({action:'group.request',name:'Duplicate',reason:'重复申请应该被阻止'},cookie,home))).status,409);
 const request=(await account(cookie,home)).management!.requests[0];
 assert.equal((await POST(req({action:'group.review',id:request.id,decision:'approved'},cookie,home))).status,403);
 assert.equal((await POST(req({action:'group.review',id:request.id,decision:'approved'},ops,seedId(1002)))).status,404);
 const approved=await POST(req({action:'group.review',id:request.id,decision:'approved'}));assert.equal(approved.status,200);
 const {workspaceId}=await approved.json();assert.ok(workspaceId);
 assert.equal((await POST(req({action:'group.review',id:request.id,decision:'approved'}))).status,200);
 assert.equal((await repo.read()).organizations.length,before+1);
 assert.equal((await account(cookie,workspaceId)).role,'host');
 assert.equal((await repo.read()).households.filter(h=>h.organizationId===workspaceId).length,1);
 assert.equal((await account(cookie)).homeWorkspaceId,home);
 await POST(req({action:'group.request',name:'Third',reason:'再开一个测试小组'},cookie,home));
 const second=(await account(cookie,home)).management!.requests.find(r=>r.status==='pending')!;
 assert.equal((await POST(req({action:'group.review',id:second.id,decision:'rejected',note:'请先运营好现有小组'}))).status,200);
 assert.equal((await repo.read()).organizations.length,before+1);
 assert.equal((await POST(req({action:'group.review',id:second.id,decision:'approved'}))).status,409);
 await assert.rejects((await workspaceService()).execute({userId:seedId(6),role:'ops',organizationId:home},{id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'household.create',payload:{name:'Bypass',theme:'Bypass approval',hostId:a.user.id,termId:(await repo.read()).terms[0].id,capacity:4}}),{status:409});
});

test('migration and reseeding preserve groups and channel ownership across restarts',async ()=>{
 const before=await repo.read();if(!process.env.DATABASE_URL){const {SqliteRepository}=await import('../server/repositories/sqlite-repository');const source=new SqliteRepository(process.env.SQLITE_PATH!);try{seedDemo(source);}finally{source.db.close();}}await bootstrapOwnedWorkspaces(repo);const after=await repo.read();
 assert.deepEqual(after.organizations,before.organizations);
 assert.deepEqual(after.households,before.households);
 assert.deepEqual(after.channels,before.channels);
 assert.equal(after.channels.filter(c=>c.kind==='public'&&after.organizations.some(o=>o.id===c.organizationId&&o.kind==='platform')).length,0);
 if(!process.env.DATABASE_URL)assert.deepEqual((await repo.db.prepare('PRAGMA foreign_key_check').all()),[]);
});

test('rescheduling checks the same Host across separate group spaces',async()=>{
 const cookie=await login('schedule@example.test');await POST(req({action:'host.add',email:'schedule@example.test'}));
 const a=await account(cookie),home=a.homeWorkspaceId!;
 await POST(req({action:'group.request',name:'Second schedule group',reason:'需要第二个小组安排课程'},cookie,home));
 const application=(await account(cookie,home)).management!.requests[0];
 const response=await POST(req({action:'group.review',id:application.id,decision:'approved'}));
 const {workspaceId}=await response.json();
 const state=await repo.read();
 const groups=[home,workspaceId].map(org=>state.households.find(h=>h.organizationId===org)!);
 const start=Date.now()+7*86400000,sessionIds=[randomUUID(),randomUUID()];
 for(const [i,group] of groups.entries()) {
  await (await workspaceService()).execute({userId:a.user.id,role:'host',organizationId:group.organizationId},{id:randomUUID(),entityId:sessionIds[i],baseVersion:0,kind:'session.create',payload:{householdId:group.id,title:'Conversation',description:'Test',startsAt:new Date(start+i*7200000).toISOString(),endsAt:new Date(start+i*7200000+3600000).toISOString()}});
 }
 await assert.rejects((await workspaceService()).execute({userId:a.user.id,role:'host',organizationId:workspaceId},{id:randomUUID(),entityId:sessionIds[1],baseVersion:1,kind:'session.reschedule',payload:{startsAt:new Date(start).toISOString(),endsAt:new Date(start+3600000).toISOString()}}),{status:409});
});
