import type { User } from './models';
export function canContactHost(plan: User['plan'], featured: boolean) {
  return featured ? plan === 'pro' || plan === 'max' : plan === 'lite' || plan === 'pro' || plan === 'max';
}
export function countryFlag(code?: string) {
  return code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))) : '🌐';
}
export function countryName(code?: string) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return '国家待完善';
  return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) || code;
}
export function filterHosts(hosts: User[], qualification: string, query: string) {
  const search = query.trim().toLowerCase();
  return hosts.filter(host => (qualification === 'all' || host.hostQualifications?.includes(qualification)) &&
    `${host.name} ${host.city || ''} ${host.occupation || ''}`.toLowerCase().includes(search));
}
