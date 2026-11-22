import { randomUUID } from 'node:crypto';
import type { DatabaseRepository } from '../repositories/database-repository';
import { DomainError } from '../../domain/commands';
import { applicationPlans } from '../../lib/application-plans';
import { paymentUrl } from './payment-link';

type Row = Record<string, any>;
/** Trusted SQL fragment for the application alias `a`. Never interpolate request values. */
export const paidApplicationSql = `EXISTS (SELECT 1 FROM application_orders ao JOIN application_payments ap ON ap.order_id=ao.id WHERE ao.application_id=a.id AND ao.plan=a.plan AND ao.language=a.language AND ap.status='paid')`;
export async function hasApplicationPayment(repo: DatabaseRepository, applicationId: string) {
  return !!await repo.db.prepare(`SELECT 1 FROM member_applications a WHERE a.id=? AND ${paidApplicationSql}`).get(applicationId);
}
export async function startApplicationPayment(repo: DatabaseRepository, userId: string, planId: string) {
  const plan = applicationPlans.find(p => p.id === planId);
  if (!plan?.available || !plan.amountMinor) throw new DomainError(400, '此套餐暂未开放，请选择可购买的套餐。');
  return repo.transaction(async () => {
    await repo.db.prepare('UPDATE member_applications SET id=id WHERE user_id=?').run(userId);
    const a = await repo.db.prepare('SELECT * FROM member_applications WHERE user_id=?').get(userId) as Row | undefined;
    if (!a) throw new DomainError(409, '请先填写并提交报名资料。');
    if (a.role !== 'learner' || a.household) throw new DomainError(409, '当前资料不需要报名付款。');
    if (a.contact_preference !== 'wechat' || !String(a.contact).trim()) throw new DomainError(409, '请先补充微信号，方便客服人员添加。');
    if (await hasApplicationPayment(repo, a.id)) throw new DomainError(409, '已完成付款，无需重复支付。');
    const now = new Date().toISOString();
    await repo.db.prepare('INSERT INTO application_orders (id,application_id,plan,language,amount_minor,currency,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(application_id,plan,language) DO NOTHING').run(randomUUID(), a.id, plan.id, plan.language, plan.amountMinor, plan.currency, now);
    const order = await repo.db.prepare('SELECT id FROM application_orders WHERE application_id=? AND plan=? AND language=?').get(a.id, plan.id, plan.language) as Row;
    await repo.db.prepare("UPDATE member_applications SET plan=?,language=?,status='awaiting_payment',updated=?,revision=revision+1 WHERE id=?").run(plan.id, plan.language, now, a.id);
    return { url: paymentUrl(`application_${order.id}`, a.email) };
  });
}

/** Keep the existing household payment view compatible after an upfront payment. */
export async function syncApplicationPayment(repo: DatabaseRepository, applicationId: string) {
  const a = await repo.db.prepare('SELECT household,user_id FROM member_applications WHERE id=?').get(applicationId) as Row | undefined;
  if (!a?.household) return;
  const p = await repo.db.prepare(`SELECT ap.* FROM application_payments ap JOIN application_orders ao ON ao.id=ap.order_id JOIN member_applications a ON a.id=ao.application_id WHERE a.id=? AND ao.plan=a.plan AND ao.language=a.language ORDER BY CASE WHEN ap.status='paid' THEN 0 ELSE 1 END,ap.updated DESC LIMIT 1`).get(applicationId) as Row | undefined;
  if (!p) return;
  await repo.db.prepare(`INSERT INTO pilot_payments (household,user_id,status,amount_minor,refunded_minor,currency,source,stripe_session,payment_intent,updated) VALUES (?,?,?,?,?,?,'stripe',?,?,?) ON CONFLICT(household,user_id) DO UPDATE SET status=excluded.status,amount_minor=excluded.amount_minor,refunded_minor=excluded.refunded_minor,currency=excluded.currency,source='stripe',stripe_session=excluded.stripe_session,payment_intent=excluded.payment_intent,updated=excluded.updated`).run(a.household,a.user_id,p.status,p.amount_minor,p.refunded_minor,p.currency,p.stripe_session,p.payment_intent,p.updated);
}

async function reconcileApplication(repo: DatabaseRepository, applicationId: string) {
  const paid = await hasApplicationPayment(repo, applicationId), now = new Date().toISOString();
  if (paid) await repo.db.prepare("UPDATE member_applications SET status='pending',updated=?,revision=revision+1 WHERE id=? AND household IS NULL AND status='awaiting_payment'").run(now,applicationId);
  else await repo.db.prepare("UPDATE member_applications SET status='awaiting_payment',updated=?,revision=revision+1 WHERE id=? AND household IS NULL AND status IN ('pending','new','contacted','shortlist','hold')").run(now,applicationId);
  await syncApplicationPayment(repo, applicationId);
}

export async function receiveApplicationPayment(repo: DatabaseRepository, o: Row) {
  const reference = String(o.client_reference_id || '');
  if (!reference.startsWith('application_')) return null;
  if (o.payment_status !== 'paid') return 'awaiting-payment';
  return repo.transaction(async () => {
    const order = await repo.db.prepare('SELECT * FROM application_orders WHERE id=?').get(reference.slice(12)) as Row | undefined;
    if (!order) return 'unmatched';
    if (!o.id || typeof o.payment_intent !== 'string' || !o.payment_intent || Number(o.amount_total) !== Number(order.amount_minor) || o.currency !== order.currency || (o.mode && o.mode !== 'payment')) return 'payment-mismatch';
    // Same lock order as editing, matching and refund handling.
    await repo.db.prepare('UPDATE member_applications SET id=id WHERE id=?').run(order.application_id);
    const refund = await repo.db.prepare('SELECT * FROM stripe_refunds WHERE payment_intent=?').get(o.payment_intent) as Row | undefined;
    const existing = await repo.db.prepare('SELECT order_id FROM application_payments WHERE stripe_session=? OR payment_intent=?').get(o.id,o.payment_intent) as Row | undefined;
    if (existing && existing.order_id !== order.id) return 'payment-mismatch';
    await repo.db.prepare(`INSERT INTO application_payments (stripe_session,order_id,payment_intent,status,amount_minor,currency,refunded_minor,updated) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(stripe_session) DO NOTHING`).run(o.id,order.id,o.payment_intent,refund?.full_refund?'refunded':'paid',order.amount_minor,order.currency,refund?.amount_minor||0,new Date().toISOString());
    await reconcileApplication(repo,order.application_id);
    return refund?.full_refund ? 'refunded' : 'paid';
  });
}

export async function receiveApplicationRefund(repo: DatabaseRepository, o: Row) {
  const intent = typeof o.payment_intent === 'string' ? o.payment_intent : '';
  if (!intent) return false;
  return repo.transaction(async () => {
    const a = await repo.db.prepare('SELECT ao.application_id FROM application_payments ap JOIN application_orders ao ON ao.id=ap.order_id WHERE ap.payment_intent=?').get(intent) as Row | undefined;
    if (a) await repo.db.prepare('UPDATE member_applications SET id=id WHERE id=?').run(a.application_id);
    const amount = Number(o.amount_refunded);
    if (!Number.isSafeInteger(amount) || amount < 0) return false;
    await repo.db.prepare(`INSERT INTO stripe_refunds (payment_intent,amount_minor,full_refund,updated) VALUES (?,?,?,?) ON CONFLICT(payment_intent) DO UPDATE SET amount_minor=CASE WHEN excluded.amount_minor>stripe_refunds.amount_minor THEN excluded.amount_minor ELSE stripe_refunds.amount_minor END,full_refund=CASE WHEN excluded.full_refund=1 THEN 1 ELSE stripe_refunds.full_refund END,updated=excluded.updated`).run(intent,amount,o.refunded===true?1:0,new Date().toISOString());
    const refund = await repo.db.prepare('SELECT * FROM stripe_refunds WHERE payment_intent=?').get(intent) as Row;
    await repo.db.prepare('UPDATE application_payments SET refunded_minor=?,status=?,updated=? WHERE payment_intent=?').run(refund.amount_minor,refund.full_refund?'refunded':'paid',new Date().toISOString(),intent);
    if (a) await reconcileApplication(repo,a.application_id);
    return !!a;
  });
}
