import { workspaceRepository } from '../../../../server/container';
import { handleStripeEvent, verifyStripeSignature } from '../../../../server/services/pilot-payments';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Stripe 调用的 Webhook：只认带正确签名的请求，签名密钥来自 STRIPE_WEBHOOK_SECRET。 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { console.error('STRIPE_WEBHOOK_SECRET is not set'); return Response.json({ error: 'not configured' }, { status: 503 }); }
  const payload = await req.text();
  if (payload.length > 1_000_000) return Response.json({ error: 'too large' }, { status: 413 });
  if (!verifyStripeSignature(payload, req.headers.get('stripe-signature'), secret)) return Response.json({ error: 'invalid signature' }, { status: 400 });
  let event;
  try { event = JSON.parse(payload); } catch { return Response.json({ error: 'invalid payload' }, { status: 400 }); }
  try {
    const result = await handleStripeEvent(await workspaceRepository(), event);
    if (result === 'unmatched' || result === 'payment-mismatch') console.warn(`Stripe ${event.type} ${event.id} did not match a learner payment`);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error(e);
    // 5xx 让 Stripe 稍后重试。
    return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
  }
}
