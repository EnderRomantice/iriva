import {createHmac,randomUUID} from 'node:crypto';
import type {APIRequestContext} from '@playwright/test';
import type {Sql} from 'postgres';
export const testWebhookSecret='whsec_local_application_e2e';
export async function sendPaymentEvent(request:APIRequestContext,object:Record<string,unknown>,type='checkout.session.completed'){
 const payload=JSON.stringify({id:`evt_${randomUUID()}`,type,data:{object}}),t=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256',testWebhookSecret).update(`${t}.${payload}`).digest('hex');
 return request.post('/api/stripe/webhook',{headers:{'stripe-signature':`t=${t},v1=${signature}`,'content-type':'application/json'},data:payload});
}
export async function payApplication(request:APIRequestContext){
 const checkout=await request.post('/api/apply/checkout',{headers:{origin:'http://127.0.0.1:3117'},data:{plan:'native'}});
 if(!checkout.ok())throw new Error(await checkout.text());
 const ref=new URL((await checkout.json()).url).searchParams.get('client_reference_id');
 const object={id:`cs_${randomUUID()}`,client_reference_id:ref,payment_status:'paid',amount_total:198000,currency:'cny',payment_intent:`pi_${randomUUID()}`,mode:'payment'};
 const result=await sendPaymentEvent(request,object);if(!result.ok())throw new Error(await result.text());return object;
}
/** Other feature tests start with already-paid applicants. */
export async function seedPaidApplication(db:Sql,id:string){
 const order=randomUUID(),now=new Date().toISOString();
 const [application]=await db`SELECT language FROM iriva.member_applications WHERE id=${id}`;
 await db`INSERT INTO iriva.application_orders (id,application_id,plan,language,amount_minor,currency,created) VALUES (${order},${id},'native',${application.language},198000,'cny',${now})`;
 await db`INSERT INTO iriva.application_payments (stripe_session,order_id,payment_intent,status,amount_minor,currency,updated) VALUES (${randomUUID()},${order},${randomUUID()},'paid',198000,'cny',${now})`;
}
