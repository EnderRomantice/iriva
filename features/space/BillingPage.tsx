"use client";
import { useEffect, useState } from 'react';
import { canManageSubscription, workspaceHomeHref } from '@/domain/workspace-access';
import { plans } from '@/domain/account';
import { defaultOrganizationId } from '@/domain/workspace';
import { accountRequest, AccountError, type Account } from './account-client';
import { billingHref, continueToSupport } from './billing-navigation';

export function BillingPage({ checkout = false }: { checkout?: boolean }) {
  const [account, setAccount] = useState<Account>();
  const [org, setOrg] = useState(defaultOrganizationId);
  const [orderId, setOrderId] = useState('');
  const [frequency, setFrequency] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function load() {
    setError('');
    const params = new URLSearchParams(location.search);
    const organizationId = params.get('org') || defaultOrganizationId;
    setOrg(organizationId); setOrderId(params.get('order') || '');
    try {
      const a: Account = await accountRequest();
      if (!canManageSubscription(a.role)) { location.replace(workspaceHomeHref(a.role,organizationId)); return; }
      if (!a.application) { location.replace(`/apply${organizationId !== defaultOrganizationId ? `?org=${organizationId}` : ''}`); return; }
      setAccount(a);
    } catch (e) {
      if (e instanceof AccountError && e.status === 401) { location.replace(`/apply${organizationId !== defaultOrganizationId ? `?org=${organizationId}` : ''}`); return; }
      setError(e instanceof Error ? e.message : '暂时无法加载，请重试。');
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!account || checkout) return;
    const id = location.hash.slice(1);
    if (plans.some(plan => id === `plan-${plan.id}`)) document.getElementById(id)?.scrollIntoView({block:'center'});
  }, [account,checkout]);
  async function choose(plan: 'lite' | 'pro' | 'max') {
    setBusy(plan); setError('');
    try {
      const result = await accountRequest({ action: 'checkout', plan, frequency });
      location.assign(billingHref('checkout', org, result.id));
    } catch (e) { setError(e instanceof Error ? e.message : '暂时无法创建订单。'); setBusy(''); }
  }
  async function pay() {
    setBusy('payment'); setError('');
    try {
      await accountRequest({ action: 'checkout.pay', orderId });
      setAccount(await accountRequest());
    } catch (e) { setError(e instanceof Error ? e.message : '支付失败，请重试。'); }
    finally { setBusy(''); }
  }
  const order = account?.orders.find(o => o.id === orderId);
  const selected = plans.find(p => p.id === order?.plan);
  return <main className="sp-billing-page">
    <header className="sp-billing-header"><a href="/" className="sp-billing-logo">iriva</a><span>{checkout ? '确认你的学习计划' : '选择你的学习计划'}</span></header>
    {!account ? <div className="sp-billing-loading"><p role="status">{error || '正在准备你的学习计划…'}</p>{error && <button onClick={() => void load()}>重新加载</button>}</div> : checkout ? <>
      <div className="sp-checkout-wrap">
        <a className="sp-billing-back" href={billingHref('plans', org)}>← 返回套餐</a>
        {!order || !selected ? <div className="sp-checkout-empty"><h1>未找到这个订单</h1><p>请返回套餐页重新选择。</p></div> : <div className="sp-checkout-grid">
          <section className="sp-checkout-summary"><h1>{selected.name}<br/><span>开启六周同行。</span></h1><p>{selected.description}</p><ul>{selected.benefits.map(b => <li key={b}>✓ {b}</li>)}</ul><div className="sp-checkout-detail"><span>学习周期</span><strong>6 周 / 学期</strong><span>iriva meeting 频次</span><strong>每周 {order.frequency} 次</strong></div></section>
          <section className="sp-checkout-payment"><h2>订单确认</h2><div className="sp-checkout-line"><span>{selected.name} · 一个学期</span><strong>¥{(order.amount_minor / 100).toLocaleString()}</strong></div><div className="sp-checkout-total"><span>应付金额</span><strong>¥{(order.amount_minor / 100).toLocaleString()}</strong></div><p className="sp-billing-caption">一次付清，无自动续费</p><div className="sp-checkout-status" role="status">{order.status === 'paid' ? '支付成功！套餐已开通，可以开始选择 Host。' : account.testPaymentsAvailable ? '体验支付 · 点击即可开通套餐，不会实际扣款。' : '当前账号无法支付，请刷新页面或重新登录。'}</div>{order.status === 'paid' ? <a className="sp-billing-primary" href={billingHref('hosts', org)}>选择 Host →</a> : <button className="sp-billing-primary" disabled={!account.testPaymentsAvailable || !!busy} onClick={() => void pay()}>{busy === 'payment' ? '正在支付…' : account.testPaymentsAvailable ? `支付 ¥${(order.amount_minor / 100).toLocaleString()}` : '暂时无法支付'}</button>}{error && <p className="sp-error" role="alert">{error}</p>}<button className="sp-checkout-contact" onClick={() => continueToSupport(account, org)}>联系运营</button></section>
        </div>}
      </div>
    </> : <section className="sp-plans-content">
      <div className="sp-plans-intro"><h1>选择你的节奏，<br/>开始一段新的同行。</h1><p>一个学期六周，和真实的人一起开口、探索、成长。</p></div>
      <div className="sp-plans-toolbar"><span>当前：{(account.user.plan || 'free').toUpperCase()}{(!account.user.plan || account.user.plan === 'free') ? ' · 访客' : ''}</span><div className="sp-billing-frequency" role="group" aria-label="每周 iriva meeting 频次">{([1, 2] as const).map(n => <button key={n} aria-pressed={frequency === n} disabled={!!busy} onClick={() => setFrequency(n)}>每周 {n} 次 iriva meeting</button>)}</div></div>
      <div className="sp-billing-plans">{plans.map(plan => <article id={`plan-${plan.id}`} key={plan.id} className={`sp-billing-plan sp-billing-plan-${plan.id}`}><div className="sp-plan-heading"><span>{plan.label}</span>{plan.id === 'pro' && <small>推荐</small>}</div><h2>{plan.name}</h2><p className="sp-billing-plan-description">{plan.description}</p><div className="sp-billing-price">¥{(plan.prices[frequency - 1] / 100).toLocaleString()}<small>{plan.id === 'free' ? '' : ' / 学期'}</small></div><button className={plan.id === 'pro' ? 'sp-billing-primary' : 'sp-billing-secondary'} disabled={!!busy || plan.id === 'free' || account.user.plan === plan.id} onClick={() => { if (plan.id !== 'free') void choose(plan.id); }}>{busy === plan.id ? '正在准备订单…' : (account.user.plan || 'free') === plan.id ? '当前套餐' : plan.id === 'free' ? '免费访客' : `选择 ${plan.name} →`}</button><ul>{plan.benefits.map(b => <li key={b}><span>✓</span>{b}</li>)}</ul></article>)}</div>
      <p className="sp-billing-caption">首期价格 · 按学期付费 · 入组由运营协助安排</p>
      {error && <p className="sp-error" role="alert">{error}</p>}
      {account.orders.length > 0 && <details className="sp-billing-orders"><summary>我的订单（{account.orders.length}）</summary>{account.orders.map(o => <a key={o.id} href={billingHref('checkout', org, o.id)}><span>{o.plan.toUpperCase()} · 每周 {o.frequency} 次</span><span>¥{o.amount_minor / 100} · {o.status === 'paid' ? '已付款' : '待付款'} →</span></a>)}</details>}
    </section>}
    {account && <footer className="sp-billing-footer"><button onClick={() => continueToSupport(account, org)}>先聊聊看 <span aria-hidden="true">↗</span></button></footer>}
  </main>;
}
