import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {defaultOrganizationId} from '../domain/workspace';
import {handleStripeEvent,learnerPayment,paymentUrl,setManualPayment,verifyStripeSignature} from '../server/services/pilot-payments';

async function fixture(){
 const repo=asyncSqliteRepository(new SqliteRepository(':memory:'));const now=new Date().toISOString();
 const user={id:randomUUID(),name:'Lin',email:'lin@example.test',avatar:'',timezone:'UTC',version:1,createdAt:now,updatedAt:now};await repo.saveUser(user);
 const term=randomUUID(),household=randomUUID(),membership=randomUUID();
 await repo.db.prepare('INSERT INTO terms (id,name,starts_on,ends_on,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').run(term,'Pilot','2026-12-01','2026-12-29',now,now);
 await repo.db.prepare("INSERT INTO households (id,organization_id,name,term_id,host_id,timezone,capacity,theme,version,created_at,updated_at,code,week,duration) VALUES (?,?,?,?,?,'Asia/Shanghai',4,'t',1,?,?,?,1,4)").run(household,defaultOrganizationId,'Dawn',term,user.id,now,now,randomUUID());
 await repo.db.prepare("INSERT INTO memberships (id,household_id,user_id,role,version,created_at,updated_at,display_name) VALUES (?,?,?,'learner',1,?,?,'Lin')").run(membership,household,user.id,now,now);
 return {repo,user,household,membership};
}
const sign=(payload:string,secret:string,t=Math.floor(Date.now()/1000))=>`t=${t},v1=${createHmac('sha256',secret).update(`${t}.${payload}`).digest('hex')}`;

test('Stripe signatures must match the secret and be recent',()=>{
 const body='{"id":"evt_1"}';
 assert.ok(verifyStripeSignature(body,sign(body,'whsec_a'),'whsec_a'));
 assert.ok(!verifyStripeSignature(body,sign(body,'whsec_b'),'whsec_a'));
 assert.ok(!verifyStripeSignature(body+' ',sign(body,'whsec_a'),'whsec_a'));
 assert.ok(!verifyStripeSignature(body,sign(body,'whsec_a',Math.floor(Date.now()/1000)-3600),'whsec_a'));
 assert.ok(!verifyStripeSignature(body,null,'whsec_a'));
});

test('payment link carries the learner membership and email',()=>{
 const url=new URL(paymentUrl('m-1','lin@example.test','https://buy.stripe.com/test_x'));
 assert.equal(url.searchParams.get('client_reference_id'),'m-1');
 assert.equal(url.searchParams.get('prefilled_email'),'lin@example.test');
});

test('checkout marks the learner paid; a full refund marks it refunded',async t=>{
 const {repo,user,household,membership}=await fixture();t.after(()=>repo.db.close());
 assert.deepEqual(await learnerPayment(repo,household,user.id),{status:'unpaid',membership});
 const session={id:'cs_1',client_reference_id:membership,payment_status:'paid',amount_total:198000,currency:'cny',payment_intent:'pi_1'};
 assert.equal(await handleStripeEvent(repo,{type:'checkout.session.completed',data:{object:{...session,payment_status:'unpaid'}}}),'awaiting-payment');
 assert.equal(await handleStripeEvent(repo,{type:'checkout.session.completed',data:{object:session}}),'paid');
 assert.equal(await handleStripeEvent(repo,{type:'checkout.session.completed',data:{object:session}}),'paid');
 assert.equal((await learnerPayment(repo,household,user.id)).status,'paid');
 assert.equal(await handleStripeEvent(repo,{type:'charge.refunded',data:{object:{payment_intent:'pi_1',amount_refunded:50000,refunded:false}}}),'partially-refunded');
 assert.equal((await learnerPayment(repo,household,user.id)).status,'paid');
 assert.equal(await handleStripeEvent(repo,{type:'charge.refunded',data:{object:{payment_intent:'pi_1',amount_refunded:198000,refunded:true}}}),'refunded');
 assert.equal((await learnerPayment(repo,household,user.id)).status,'refunded');
 assert.equal(await handleStripeEvent(repo,{type:'checkout.session.completed',data:{object:{...session,client_reference_id:'someone-else'}}}),'unmatched');
});

test('the team can mark offline payments and undo them',async t=>{
 const {repo,user,household}=await fixture();t.after(()=>repo.db.close());
 assert.ok(await setManualPayment(repo,household,user.id,'paid'));
 assert.equal((await learnerPayment(repo,household,user.id)).status,'paid');
 assert.ok(await setManualPayment(repo,household,user.id,'unpaid'));
 assert.equal((await learnerPayment(repo,household,user.id)).status,'unpaid');
 assert.equal(await setManualPayment(repo,household,randomUUID(),'paid'),false);
});
