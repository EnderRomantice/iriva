import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DatabaseRepository } from '../repositories/database-repository';

/**
 * 四周 Pilot 的付款：学员通过 Stripe Payment Link 付款，Webhook 把结果记到 pilot_payments。
 * 没有记录就是待付款。退款由客服在 Stripe 后台手动操作，charge.refunded 再同步回来。
 */
export { PAYMENT_LINK, paymentUrl } from './payment-link';
import { receiveApplicationPayment, receiveApplicationRefund } from './application-payments';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
type Row = Record<string, unknown>;

export async function learnerPayment(repo: DatabaseRepository, household: string, userId: string): Promise<{ status: PaymentStatus; membership: string | null }> {
  const membership = await repo.db.prepare("SELECT id FROM memberships WHERE household_id=? AND user_id=? AND role='learner'").get(household, userId) as Row | undefined;
  const row = await repo.db.prepare('SELECT status FROM pilot_payments WHERE household=? AND user_id=?').get(household, userId) as Row | undefined;
  return { status: row ? row.status as PaymentStatus : 'unpaid', membership: membership ? String(membership.id) : null };
}

/** 运营手动标记：线下收款、Webhook 未送达，或修正状态。unpaid 会删除记录。 */
export async function setManualPayment(repo: DatabaseRepository, household: string, userId: string, status: PaymentStatus) {
  if (!await repo.db.prepare("SELECT 1 FROM memberships WHERE household_id=? AND user_id=? AND role='learner'").get(household, userId)) return false;
  if (await repo.db.prepare('SELECT 1 FROM member_applications a JOIN application_orders ao ON ao.application_id=a.id JOIN application_payments ap ON ap.order_id=ao.id WHERE a.household=? AND a.user_id=?').get(household,userId)) return false;
  if (status === 'unpaid') { await repo.db.prepare('DELETE FROM pilot_payments WHERE household=? AND user_id=?').run(household, userId); return true; }
  await repo.db.prepare("INSERT INTO pilot_payments (household,user_id,status,source,updated) VALUES (?,?,?,'manual',?) ON CONFLICT(household,user_id) DO UPDATE SET status=excluded.status,updated=excluded.updated").run(household, userId, status, new Date().toISOString());
  return true;
}

/** Stripe-Signature: t=<unix>,v1=<hex hmac of "t.payload">. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now(), toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = header.split(',').map(p => p.split('=') as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest();
  return parts.filter(([k]) => k === 'v1').some(([, v]) => {
    const given = Buffer.from(v || '', 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type StripeEvent = { type?: string; data?: { object?: Row } };
/** 返回处理结果，供日志查看；未识别的事件直接忽略。 */
export async function handleStripeEvent(repo: DatabaseRepository, event: StripeEvent): Promise<string> {
  const o = event.data?.object ?? {};
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const applicationResult = await receiveApplicationPayment(repo,o);
    if (applicationResult !== null) return applicationResult;
    if (o.payment_status !== 'paid') return 'awaiting-payment';
    const ref = typeof o.client_reference_id === 'string' ? o.client_reference_id : '';
    const m = ref ? await repo.db.prepare("SELECT household_id,user_id FROM memberships WHERE id=? AND role='learner'").get(ref) as Row | undefined : undefined;
    if (!m) return 'unmatched';
    await repo.db.prepare(`INSERT INTO pilot_payments (household,user_id,status,amount_minor,refunded_minor,currency,source,stripe_session,payment_intent,updated) VALUES (?,?,'paid',?,0,?,'stripe',?,?,?)
      ON CONFLICT(household,user_id) DO UPDATE SET status='paid',amount_minor=excluded.amount_minor,refunded_minor=0,currency=excluded.currency,source='stripe',stripe_session=excluded.stripe_session,payment_intent=excluded.payment_intent,updated=excluded.updated`)
      .run(m.household_id, m.user_id, Number(o.amount_total) || 0, String(o.currency || ''), String(o.id || ''), typeof o.payment_intent === 'string' ? o.payment_intent : null, new Date().toISOString());
    return 'paid';
  }
  if (event.type === 'charge.refunded') {
    const applicationRefund = await receiveApplicationRefund(repo,o);
    if (applicationRefund) return o.refunded === true ? 'refunded' : 'partially-refunded';
    const intent = typeof o.payment_intent === 'string' ? o.payment_intent : '';
    if (!intent) return 'unmatched';
    const refunded = Number(o.amount_refunded) || 0, full = o.refunded === true;
    const r = await repo.db.prepare('UPDATE pilot_payments SET refunded_minor=?,status=?,updated=? WHERE payment_intent=?').run(refunded, full ? 'refunded' : 'paid', new Date().toISOString(), intent);
    return r.changes ? (full ? 'refunded' : 'partially-refunded') : 'unmatched';
  }
  return 'ignored';
}
