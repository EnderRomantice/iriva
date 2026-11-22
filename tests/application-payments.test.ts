import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {hasApplicationPayment,startApplicationPayment} from '../server/services/application-payments';
import {handleStripeEvent} from '../server/services/pilot-payments';
import {supportGroupExpired} from '../lib/support-group';

async function fixture(){
 const repo=asyncSqliteRepository(new SqliteRepository(':memory:')),user=randomUUID(),id=randomUUID(),now=new Date().toISOString();
 await repo.saveUser({id:user,name:'Lin',email:'lin@example.test',avatar:'',timezone:'UTC',version:1,createdAt:now,updatedAt:now});
 await repo.db.prepare("INSERT INTO member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,contact_preference,status,created) VALUES (?,?,'lin@example.test','Lin','learner','English','Speaking','intermediate','+08:00','Saturday','Books','lin_wechat','wechat','awaiting_payment',?)").run(id,user,now);
 const checkout=()=>startApplicationPayment(repo,user,'native');
 const state=()=>repo.db.prepare('SELECT status,revision FROM member_applications WHERE id=?').get(id);
 return {repo,user,id,checkout,state};
}
const event=(o:Record<string,unknown>,type='checkout.session.completed')=>({type,data:{object:o}});
const paid=(ref:string,session='cs_application',intent='pi_application')=>({id:session,client_reference_id:ref,payment_status:'paid',amount_total:198000,currency:'cny',mode:'payment',payment_intent:intent});

test('checkout requires an application, available plan and WeChat; the price is server-owned',async t=>{
 const f=await fixture();t.after(()=>f.repo.db.close());
 await assert.rejects(()=>startApplicationPayment(f.repo,randomUUID(),'native'),/先填写/);
 await assert.rejects(()=>startApplicationPayment(f.repo,f.user,'everyday'),/暂未开放/);
 await f.repo.db.prepare("UPDATE member_applications SET contact='' WHERE id=?").run(f.id);
 await assert.rejects(f.checkout,/补充微信/);
 await f.repo.db.prepare("UPDATE member_applications SET contact='lin_wechat' WHERE id=?").run(f.id);
 const url=new URL((await f.checkout()).url),second=new URL((await f.checkout()).url);
 assert.equal(url.searchParams.get('client_reference_id'),second.searchParams.get('client_reference_id'));
 assert.equal((await f.state()).status,'awaiting_payment');assert.equal(await hasApplicationPayment(f.repo,f.id),false);
 assert.equal((await f.repo.db.prepare('SELECT amount_minor FROM application_orders WHERE application_id=?').get(f.id)).amount_minor,198000);
});

test('only confirmed correct payments enqueue once; duplicates preserve later review progress',async t=>{
 const f=await fixture();t.after(()=>f.repo.db.close());const ref=new URL((await f.checkout()).url).searchParams.get('client_reference_id')!,o=paid(ref);
 for(const mutation of [{payment_status:'unpaid'},{amount_total:1},{currency:'usd'},{payment_intent:''}]){
  await handleStripeEvent(f.repo,event({...o,...mutation}));assert.equal(await hasApplicationPayment(f.repo,f.id),false);assert.equal((await f.state()).status,'awaiting_payment');
 }
 assert.equal(await handleStripeEvent(f.repo,event(o,'checkout.session.async_payment_succeeded')),'paid');
 assert.equal((await f.state()).status,'pending');assert.equal(await hasApplicationPayment(f.repo,f.id),true);
 const revision=(await f.state()).revision;
 await handleStripeEvent(f.repo,event(o));assert.equal((await f.state()).revision,revision);
 await f.repo.db.prepare("UPDATE member_applications SET status='shortlist' WHERE id=?").run(f.id);
 await handleStripeEvent(f.repo,event(o));assert.equal((await f.state()).status,'shortlist');
 await assert.rejects(f.checkout,/无需重复/);
});

test('refunds are monotonic and replay cannot put refunded learners back in the queue',async t=>{
 const f=await fixture();t.after(()=>f.repo.db.close());const ref=new URL((await f.checkout()).url).searchParams.get('client_reference_id')!,o=paid(ref);
 await handleStripeEvent(f.repo,event(o));
 await handleStripeEvent(f.repo,event({payment_intent:o.payment_intent,amount_refunded:50000,refunded:false},'charge.refunded'));
 assert.equal(await hasApplicationPayment(f.repo,f.id),true);
 await handleStripeEvent(f.repo,event({payment_intent:o.payment_intent,amount_refunded:198000,refunded:true},'charge.refunded'));
 await handleStripeEvent(f.repo,event({payment_intent:o.payment_intent,amount_refunded:50000,refunded:false},'charge.refunded'));
 await handleStripeEvent(f.repo,event(o));
 assert.equal((await f.state()).status,'awaiting_payment');assert.equal(await hasApplicationPayment(f.repo,f.id),false);
 await f.checkout();await handleStripeEvent(f.repo,event(paid(ref,'cs_second','pi_second')));
 assert.equal((await f.state()).status,'pending');
 await handleStripeEvent(f.repo,event(o));assert.equal((await f.state()).status,'pending');
});

test('refund delivered before checkout completion cannot grant queue access',async t=>{
 const f=await fixture();t.after(()=>f.repo.db.close());const ref=new URL((await f.checkout()).url).searchParams.get('client_reference_id')!,o=paid(ref);
 await handleStripeEvent(f.repo,event({payment_intent:o.payment_intent,amount_refunded:198000,refunded:true},'charge.refunded'));
 await handleStripeEvent(f.repo,event(o));assert.equal(await hasApplicationPayment(f.repo,f.id),false);assert.equal((await f.state()).status,'awaiting_payment');
});

test('the supplied group QR expires at its announced China-time deadline',()=>{
 assert.equal(supportGroupExpired(Date.parse('2026-11-28T23:59:59+08:00')),false);
 assert.equal(supportGroupExpired(Date.parse('2026-11-29T00:00:00+08:00')),true);
});
