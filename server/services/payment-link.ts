export const PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/00wdRa6Lzffy2ad7j83ZK00';
export function paymentUrl(reference: string, email: string, link = PAYMENT_LINK) {
  const url = new URL(link);
  url.searchParams.set('client_reference_id', reference);
  if (email) url.searchParams.set('prefilled_email', email);
  return url.toString();
}
