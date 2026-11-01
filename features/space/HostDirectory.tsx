"use client";
import { useState } from 'react';
import { ArrowRight, Clock3, LockKeyhole, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { isProfileComplete } from '@/domain/account';
import { canContactHost, countryFlag, countryName, filterHosts } from '@/domain/hosts';
import { accountRequest, type Account } from './account-client';
import { billingHref } from './billing-navigation';
import { demoPortraits } from './avatars';
import { Avatar } from './primitives';

type HostKind = 'all' | 'full-time' | 'featured';
const kinds: { value: HostKind; label: string }[] = [{ value: 'all', label: '全部 Host' }, { value: 'full-time', label: '全职' }, { value: 'featured', label: '明星' }];
export function HostDirectory({ account, org, query, resetSearch, openConversation, completeProfile }: {
  completeProfile: () => void; account: Account; org: string; query: string; resetSearch: () => void;
  openConversation: (id: string, isNew: boolean) => Promise<void>;
}) {
  const [qualification, setQualification] = useState('all');
  const [kind, setKind] = useState<HostKind>('all');
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function contact(hostId: string) {
    if (busy) return;
    setBusy(hostId); setError('');
    try {
      const booking = account.bookings.find(b => b.host_id === hostId);
      if (!booking && !isProfileComplete(account.user)) { completeProfile(); return; }
      const channelId = booking?.channel_id || (await accountRequest({ action: 'contact', hostId })).channelId;
      await openConversation(channelId, !booking);
    } catch (e) { setError(e instanceof Error ? e.message : '暂时无法联系，请重试。'); }
    finally { setBusy(''); }
  }
  const qualifications = Array.from(new Set(account.hosts.flatMap(h => h.hostQualifications || [])));
  const visible = filterHosts(account.hosts, qualification, query)
    .filter(h => kind === 'all' || (kind === 'full-time' ? h.hostFullTime : h.hostFeatured))
    .sort((a, b) => Number(!!b.hostFeatured) - Number(!!a.hostFeatured));
  function reset() { setQualification('all'); setKind('all'); resetSearch(); }
  return <section className="sp-host-directory" aria-label="Host 列表">
    <div className="sp-host-toolbar">
      <div className="sp-host-tabs" role="group" aria-label="Host 类型">{kinds.map(item => <button key={item.value} aria-pressed={kind === item.value} onClick={() => setKind(item.value)}>{item.label}</button>)}</div>
      <label className="sp-host-filter"><SlidersHorizontal aria-hidden="true"/><select aria-label="按专业资质筛选" value={qualification} onChange={e => setQualification(e.target.value)}><option value="all">全部资质</option>{qualifications.map(q => <option key={q}>{q}</option>)}</select></label>
      {(qualification !== 'all' || query) && <button className="sp-icon-button" aria-label="清除筛选" onClick={reset}><X /></button>}
    </div>
    <div className="sp-host-list-meta"><span role="status">{visible.length} 位 Host{query && ` · “${query}”`}</span><div><span><i className="sp-host-legend-gold"/>全职</span><span><i className="sp-host-legend-rainbow"/>明星 · Pro+</span></div></div>
    {error && <p className="sp-error" role="alert">{error}</p>}
    <div key={`${qualification}:${kind}:${query}`} className="sp-host-grid t-panel-slide" data-open="true">
      {visible.map(host => {
        const allowed = canContactHost(account.user.plan, !!host.hostFeatured);
        const booking = account.bookings.find(b => b.host_id === host.id);
        const photo = host.avatar.startsWith('data:') ? host.avatar : demoPortraits[host.id];
        return <article key={host.id} className={`sp-host-card ${host.hostFeatured ? 'is-featured' : host.hostFullTime ? 'is-full-time' : ''}`}>
          <div className="sp-host-identity"><div className="sp-host-photo">{photo ? <img src={photo} alt={host.name} width={64} height={64} loading="lazy" /> : <Avatar user={host}/>}</div><div><h2>{host.name}</h2><p>{host.occupation || '英语交流 · 口语表达'}</p><span className="sp-host-country"><span role="img" aria-label={countryName(host.countryCode)}>{countryFlag(host.countryCode)}</span>{host.city || countryName(host.countryCode)}</span></div></div>
          <div className="sp-host-details"><span><Clock3 aria-hidden="true"/>{host.timezone}</span>{host.hostFeatured ? <span className="sp-host-badge"><Sparkles aria-hidden="true"/>明星 Host</span> : host.hostFullTime ? <span className="sp-host-badge">全职 Host</span> : null}</div>
          <div className="sp-host-qualifications" aria-label="专业资质">{host.hostQualifications?.map(q => <span key={q}>{q}</span>)}</div>
          <p className="sp-host-bio">{host.signature || '用真实对话，陪你把英语说得更自然。'}</p>
          <div className="sp-host-card-footer"><small>{booking ? { pending: '已发送约谈邀请', accepted: '已确定 · 等待运营', rejected: '约谈已结束' }[booking.status] : host.hostFeatured ? 'Pro / Max 专属' : '可预约交流'}</small>
            {booking || allowed ? <button disabled={!!busy} onClick={() => void contact(host.id)}>{busy === host.id ? '正在打开…' : booking ? '打开私聊' : '联系'}<ArrowRight aria-hidden="true"/></button> : <a href={billingHref('plans', org)}><LockKeyhole aria-hidden="true"/>{host.hostFeatured ? '升级 Pro' : '选择套餐'}</a>}
          </div>
        </article>;
      })}
      {!visible.length && <div className="sp-host-empty"><p>没有符合条件的 Host</p><button onClick={reset}>清除筛选</button></div>}
    </div>
  </section>;
}
