import type { Account } from './account-client';
import { defaultOrganizationId } from '@/domain/workspace';

export function billingHref(page: 'plans' | 'checkout' | 'hosts', organizationId = defaultOrganizationId, orderId?: string) {
  const params = new URLSearchParams();
  if (organizationId !== defaultOrganizationId) params.set('org', organizationId);
  if (orderId) params.set('order', orderId);
  if (page === 'hosts') { params.set('view', 'hosts'); return `/learn?${params}`; }
  return `/${page}${params.size ? `?${params}` : ''}`;
}
export function needsPlan(account: Pick<Account, 'role' | 'user'>) {
  return account.role === 'learn' && (!account.user.plan || account.user.plan === 'free');
}
const skipKey = (userId: string, org: string) => `iriva-chat-first:${userId}:${org}`;
export function hasChosenChat(userId: string, org = defaultOrganizationId) {
  try { return sessionStorage.getItem(skipKey(userId, org)) === 'yes'; } catch { return false; }
}
export function continueToSupport(account: Account, org = defaultOrganizationId) {
  const params = new URLSearchParams({ view: 'direct' });
  if (org !== defaultOrganizationId) params.set('org', org);
  if (account.supportId) params.set('channel', account.supportId);
  try { sessionStorage.setItem(skipKey(account.user.id, org), 'yes'); }
  catch { params.set('chat', '1'); }
  location.assign(`/learn?${params}`);
}
