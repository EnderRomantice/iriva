import { test, after, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const folder=mkdtempSync(path.join(os.tmpdir(),'iriva-account-'));
process.env.SQLITE_PATH=path.join(folder,'accounts.sqlite');
import { GET, POST } from '../app/api/account/route';
import { workspaceRepository,workspaceService } from '../server/container';
import { actorFromRequest } from '../server/http';
import { demoActors } from '../domain/models';
import { seedId } from '../server/db/seed';
after(async ()=>{await (await workspaceRepository()).db.close();rmSync(folder,{recursive:true,force:true});});
function request(body?:object,cookie='',role='learn'){return new Request('http://localhost/api/account',{method:body?'POST':'GET',headers:{host:'localhost',origin:'http://localhost','content-type':'application/json',...(cookie?{cookie}:{'x-demo-role':role})},body:body?JSON.stringify(body):undefined});}
function mailFixture(t: TestContext) {
 const messages: {email:string;code:string}[]=[];
 const key=process.env.RESEND_API_KEY, from=process.env.AUTH_EMAIL_FROM;
 process.env.RESEND_API_KEY='test-only';process.env.AUTH_EMAIL_FROM='iriva <auth@example.test>';
 t.after(()=>{if(key===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=key;if(from===undefined)delete process.env.AUTH_EMAIL_FROM;else process.env.AUTH_EMAIL_FROM=from;});
 t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{const body=JSON.parse(String(init.body));messages.push({email:body.to[0],code:body.text.match(/\b[0-9]{6}\b/)[0]});return Response.json({id:randomUUID()});});
 return messages;
}
test('registration → support → pending order → paid fixture → booking → ops enrollment, with role and payment gates',async t=>{
 const messages=mailFixture(t);
 const start=await POST(request({action:'email.begin',email:'new@example.test'}));assert.equal(start.status,200);
 const challenge=await start.json();assert.equal(challenge.delivery,'email');assert.equal(challenge.code,undefined);
 assert.ok(!(await (await workspaceRepository()).read()).users.some(u=>u.email==='new@example.test'));
 const response=await POST(request({action:'email.verify',challengeId:challenge.challengeId,code:messages.at(-1)!.code}));assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie')!.split(';')[0];assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
 const actor=await actorFromRequest(request(undefined,cookie,'ops'));assert.equal(actor.role,'learn');
 const mismatch=new Request('http://localhost/api/workspace',{headers:{host:'localhost',cookie,'x-account-id':randomUUID()}});await assert.rejects(async ()=>(await actorFromRequest(mismatch)),{status:401});
 const apply=await POST(request({action:'apply',goal:'Travel and conversations',availability:'Weekends'},cookie));assert.equal(apply.status,200);const supportId=(await apply.json()).supportId;
 const state=await (await workspaceRepository()).read();assert.equal(state.channelParticipants.filter(p=>p.channelId===supportId).length,2);assert.ok(state.messages.some(m=>m.channelId===supportId&&m.authorId===demoActors.ops.userId));
 assert.equal((await POST(request({action:'contact',hostId:demoActors.host.userId},cookie))).status,403);
 const order=await POST(request({action:'checkout',plan:'pro',frequency:1,amountMinor:1},cookie));assert.equal(order.status,200);const orderId=(await order.json()).id;
 const duplicate=await POST(request({action:'checkout',plan:'pro',frequency:1},cookie));assert.equal((await duplicate.json()).id,orderId);
 let account=await (await GET(request(undefined,cookie))).json();assert.equal(account.user.plan,'free');assert.equal(account.orders[0].amount_minor,318000);
 assert.equal((await POST(request({action:'paid',id:orderId},cookie))).status,400);
 const application=(await (await workspaceRepository()).read()).applications.find(a=>a.userId===actor.userId)!;
 const enroll={id:randomUUID(),entityId:application.id,baseVersion:1,kind:'application.enroll' as const,payload:{householdId:seedId(202)}};
 await assert.rejects((await workspaceService()).execute(demoActors.ops,enroll),{status:422});
 // Test payment is local-only, owned by the current learner, and idempotent.
 assert.equal((await POST(request({action:'checkout.pay-test',orderId}))).status,404);
 assert.equal((await POST(request({action:'checkout.pay-test',orderId},'','host'))).status,403);
 const mode=process.env.NODE_ENV;
 Object.assign(process.env,{NODE_ENV:'production'});
 try { assert.equal((await POST(request({action:'checkout.pay-test',orderId},cookie))).status,403); }
 finally { if(mode===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:mode}); }
 const remotePay=new Request('http://192.168.1.2/api/account',{method:'POST',headers:{host:'192.168.1.2',cookie,'content-type':'application/json'},body:JSON.stringify({action:'checkout.pay-test',orderId})});
 assert.equal((await POST(remotePay)).status,403);
 assert.equal((await POST(request({action:'checkout.pay-test',orderId},cookie))).status,200);
 const paidUser=(await (await workspaceRepository()).read()).users.find(u=>u.id===actor.userId)!;
 assert.equal(paidUser.plan,'pro');
 assert.equal((await POST(request({action:'checkout.pay-test',orderId},cookie))).status,200);
 assert.equal((await (await workspaceRepository()).read()).users.find(u=>u.id===actor.userId)!.version,paidUser.version);
 await (await workspaceRepository()).db.prepare("UPDATE users SET plan='lite' WHERE id=?").run(actor.userId);
 assert.equal((await POST(request({action:'contact',hostId:demoActors.host.userId},cookie))).status,403);
 assert.equal((await (await workspaceRepository()).db.prepare('SELECT id FROM bookings WHERE learner_id=?').all(actor.userId)).length,0);
 await (await workspaceRepository()).db.prepare("UPDATE users SET plan='pro' WHERE id=?").run(actor.userId);
 const beforeContact=await (await workspaceRepository()).read();
 const incomplete=await POST(request({action:'contact',hostId:demoActors.host.userId},cookie));
 assert.equal(incomplete.status,422);assert.match((await incomplete.json()).error,/完善个人资料/);
 assert.equal((await (await workspaceRepository()).db.prepare('SELECT id FROM bookings WHERE learner_id=?').all(actor.userId)).length,0);
 assert.equal((await (await workspaceRepository()).read()).channels.length,beforeContact.channels.length);
 assert.equal((await (await workspaceRepository()).read()).messages.length,beforeContact.messages.length);
 const profile={name:'New Learner',signature:'Hello world',avatar:'data:image/png;base64,iVBORw0KGgo=',mbti:'INFP',timezone:'Asia/Shanghai',city:'上海',zodiac:'',birthChart:'private',occupation:''};
 assert.equal((await POST(request({action:'profile',profile},cookie))).status,200);
 const contact=await POST(request({action:'contact',hostId:demoActors.host.userId},cookie));assert.equal(contact.status,200);const channelId=(await contact.json()).channelId;
 await POST(request({action:'contact',hostId:demoActors.host.userId},cookie));
 account=await (await GET(request(undefined,cookie))).json();assert.equal(account.bookings.length,1);assert.equal(account.bookings[0].channel_id,channelId);
 const hostAccount=await (await GET(request(undefined,'','host'))).json();assert.equal(hostAccount.bookings[0].learner_id,actor.userId);
 assert.equal((await POST(request({action:'booking',id:account.bookings[0].id,status:'accepted'},cookie))).status,403);
 assert.equal((await POST(request({action:'booking',id:account.bookings[0].id,status:'accepted'},'','host'))).status,200);
 await assert.rejects((await workspaceService()).execute(demoActors.host,enroll),{status:403});
 await (await workspaceRepository()).db.prepare("UPDATE users SET signature='' WHERE id=?").run(actor.userId);
 await assert.rejects((await workspaceService()).execute(demoActors.ops,enroll),{status:422});
 assert.equal((await POST(request({action:'profile',profile:{name:'New'}},cookie))).status,400);
 assert.equal((await POST(request({action:'profile',profile},cookie))).status,200);
 await (await workspaceService()).execute(demoActors.ops,enroll);
 assert.ok((await (await workspaceRepository()).read()).memberships.some(m=>m.userId===actor.userId&&m.householdId===seedId(202)));
 const enrollment=(await (await workspaceRepository()).read()).enrollments.find(e=>e.userId===actor.userId)!;assert.equal(enrollment.plan,'pro');assert.equal(enrollment.paymentStatus,'paid');
 const hostSnapshot=await (await workspaceService()).snapshot(demoActors.host);assert.equal(hostSnapshot.users.find(u=>u.id===actor.userId)?.birthChart,'');
 assert.equal((await POST(request({action:'logout'},cookie))).status,200);
 assert.equal((await GET(request(undefined,cookie))).status,401);
 assert.equal((await POST(request({action:'email.verify',challengeId:challenge.challengeId,code:messages[0].code}))).status,401);
 await (await workspaceRepository()).db.prepare('UPDATE email_challenges SET created_at=created_at-61000 WHERE id=?').run(challenge.challengeId);
 const again=await (await POST(request({action:'email.begin',email:'NEW@example.test'}))).json();
 assert.equal((await POST(request({action:'email.verify',challengeId:again.challengeId,code:messages.at(-1)!.code}))).status,200);
 assert.equal((await POST(request({action:'wechat'}))).status,503);
 assert.equal((await POST(request({action:'google'}))).status,503);
 assert.equal((await (await workspaceRepository()).read()).users.filter(u=>u.email==='new@example.test').length,1);
});

test('OTP cooldown, wrong attempts, expiry, resend invalidation, and no password bypass',async t=>{
 const mail=mailFixture(t),repo=await workspaceRepository();
 const begin=await POST(request({action:'email.begin',email:'limits@example.test'}));
 const first=await begin.json();
 assert.equal((await POST(request({action:'email.begin',email:'limits@example.test'}))).status,429);
 const wrong=mail[0].code==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal((await POST(request({action:'email.verify',challengeId:first.challengeId,code:wrong}))).status,401);
 assert.equal((await POST(request({action:'email.verify',challengeId:first.challengeId,code:mail[0].code}))).status,401);
 await repo.db.prepare('UPDATE email_challenges SET created_at=created_at-61000 WHERE email=?').run('limits@example.test');
 const second=await (await POST(request({action:'email.begin',email:'limits@example.test'}))).json();
 await repo.db.prepare('UPDATE email_challenges SET created_at=created_at-61000 WHERE email=?').run('limits@example.test');
 const third=await (await POST(request({action:'email.begin',email:'limits@example.test'}))).json();
 assert.equal((await POST(request({action:'email.verify',challengeId:second.challengeId,code:mail[1].code}))).status,401);
 await repo.db.prepare('UPDATE email_challenges SET expires_at=0 WHERE id=?').run(third.challengeId);
 assert.equal((await POST(request({action:'email.verify',challengeId:third.challengeId,code:mail[2].code}))).status,401);
 assert.ok(!(await repo.read()).users.some(u=>u.email==='limits@example.test'));
 assert.equal((await POST(request({action:'authenticate',email:'bypass@example.test',password:'old-password'}))).status,400);
});
test('delivery failure never creates an active code or account; active sessions renew without needing payment',async t=>{
 mailFixture(t);
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'failed'},{status:500}));
 assert.equal((await POST(request({action:'email.begin',email:'failure@example.test'}))).status,503);
 const repo=await workspaceRepository();
 const failed=(await repo.db.prepare('SELECT consumed,delivered FROM email_challenges WHERE email=?').get('failure@example.test')) as {consumed:number;delivered:number};
 assert.equal(failed.consumed,1);assert.equal(failed.delivered,0);
 const {newSession,digest}=await import('../server/auth');
 const token=await newSession(demoActors.learn.userId);
 await repo.db.prepare('UPDATE auth_sessions SET expires_at=? WHERE token_hash=?').run(Date.now()+86400000,digest(token));
 const account=await GET(request(undefined,`iriva_session=${token}`));
 assert.equal(account.status,200);assert.match(account.headers.get('set-cookie')!,/Max-Age=2592000/);
 assert.equal((await account.json()).user.plan,'free');
});
test('000000 accepts only an active local development challenge and cannot bypass production, remote hosts or replay',async t=>{
 mailFixture(t);
 const mode=process.env.NODE_ENV;
 t.after(()=>{if(mode===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:mode});});
 const challenge=await (await POST(request({action:'email.begin',email:'test-code@example.test'}))).json();
 const {digest}=await import('../server/auth');
 await (await workspaceRepository()).db.prepare('UPDATE email_challenges SET code_hash=? WHERE id=?').run(digest(`${challenge.challengeId}:123456`),challenge.challengeId);
 const payload={action:'email.verify',challengeId:challenge.challengeId,code:'000000'};
 Object.assign(process.env,{NODE_ENV:'production'});
 assert.equal((await POST(request(payload))).status,401);
 Object.assign(process.env,{NODE_ENV:'development'});
 const remote=new Request('http://192.168.1.2/api/account',{method:'POST',headers:{host:'192.168.1.2','content-type':'application/json'},body:JSON.stringify(payload)});
 assert.equal((await POST(remote)).status,401);
 assert.equal((await POST(request(payload))).status,200);
 assert.equal((await POST(request(payload))).status,401);
});

test('staff cannot create learner subscription orders',async()=>{
  const repo=await workspaceRepository();
  const count=async ()=> ((await repo.db.prepare('SELECT COUNT(*) AS n FROM plan_orders').get()) as {n:number}).n;
  const before=await count();
  for(const role of ['host','ops']) {
    const response=await POST(request({action:'checkout',plan:'pro',frequency:1},'',role));
    assert.equal(response.status,403);
    assert.match((await response.json()).error,/学员/);
  }
  assert.equal(await count(),before);
});
