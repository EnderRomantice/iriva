"use client";
import { useEffect, useState } from 'react';
import { CodeInput } from '@/features/space/CodeInput';
import { AuthGarden } from '@/features/space/AuthGarden';
import { billingHref, needsPlan } from "@/features/space/billing-navigation";
import { accountRequest, type Account } from '@/features/space/account-client';

function GoogleIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.1Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.4a12.2 12.2 0 0 1 0-7.8v-5.4H5.7a20 20 0 0 0 0 18.6l6.9-5.4Z"/><path fill="#EA4335" d="M24 11.2c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 3 20.4 20.4 0 0 0 5.7 14.2l6.9 5.4c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}
function WeChatIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#07C160" d="M19 5C9.6 5 2 11.3 2 19c0 4.4 2.5 8.3 6.5 10.9L7 35l5.9-3.1c1.5.5 3 .8 4.6.9a12.9 12.9 0 0 1-.6-3.8c0-8 7.5-14.5 16.8-14.5h1.7C33.1 9 26.6 5 19 5Z"/><path fill="#07C160" d="M46 29c0-6.5-6.1-11.8-13.6-11.8S18.8 22.5 18.8 29s6.1 11.8 13.6 11.8c1.5 0 3-.2 4.4-.6l5 2.8-1.3-4.4C43.9 36.4 46 32.9 46 29Z"/><g fill="white"><circle cx="13" cy="16" r="2"/><circle cx="24" cy="16" r="2"/><circle cx="28" cy="26" r="1.6"/><circle cx="37" cy="26" r="1.6"/></g></svg>;
}

export default function Apply() {
  const [account, setAccount] = useState<Account>();
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<{id:string;delivery:'email'|'console'}>();
  const [retryAt, setRetryAt] = useState(0), [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt-Date.now())/1000)));
    update(); const timer = setInterval(update,1000);
    return () => clearInterval(timer);
  },[retryAt]);
  function enter(a: Account) {
    const params = new URLSearchParams(location.search);
    const org = params.get('org');
    if (needsPlan(a)) { location.replace(billingHref('plans', org || undefined)); return; }
    const next = new URLSearchParams();
    if (org) next.set('org',org);
    if (a.role === 'learn') { next.set('view','direct'); if(a.supportId) next.set('channel',a.supportId); }
    location.replace(`/${a.role}${next.size ? `?${next}` : ''}`);
  }
  async function sendCode(value: string) {
    const result = await accountRequest({action:'email.begin',email:value});
    setEmail(result.email); setChallenge({id:result.challengeId,delivery:result.delivery});
    setRetryAt(Date.now()+result.retryAfter*1000);
  }
  async function resend() {
    setBusy(true);setError('');
    try { await sendCode(email); }
    catch(e) { setError(e instanceof Error ? e.message : '无法发送验证码。'); }
    finally { setBusy(false); }
  }
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ready, setReady] = useState(false);
  useEffect(() => {
    accountRequest().then((a: Account) => {
      if (a.application || a.role !== 'learn') enter(a);
      else setAccount(a);
    }).catch(() => {}).finally(() => setReady(true));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      if (account) {
        await accountRequest({ action: 'apply', ...values });
        enter(await accountRequest());
      } else if (!challenge) {
        await sendCode(String(values.email));
      } else {
        await accountRequest({ action: 'email.verify', challengeId:challenge.id, code:values.code });
        const a: Account = await accountRequest();
        if (a.application || a.role !== 'learn') enter(a);
        else setAccount(a);
      }
    } catch (e) { setError(e instanceof Error ? e.message : '暂时无法提交。'); }
    finally { setBusy(false); }
  }
  async function social(provider: 'google' | 'wechat') {
    setBusy(true); setError('');
    try { await accountRequest({ action: provider }); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法登录。'); }
    finally { setBusy(false); }
  }
  return <main className={`sp-apply ${account ? '' : 'sp-auth-page'}`}>
    {!account && <AuthGarden />}
    <section>
      <a className="sp-auth-wordmark" href="/" aria-label="iriva 首页">iriva</a>
      {account && <><h1>让我们认识你。</h1><p>告诉我们你的学习目标和时间。</p></>}
      {ready && !account && !challenge && <>
        <div className="sp-social-cards">
          <button className="sp-social-card" type="button" aria-label="使用 Google 继续" disabled={busy} onClick={() => void social('google')}><GoogleIcon /><span>使用 Google 继续</span></button>
          <button className="sp-social-card" type="button" aria-label="使用微信继续" disabled={busy} onClick={() => void social('wechat')}><WeChatIcon /><span>使用微信继续</span></button>
        </div>
        <div className="sp-email-divider"><span>或使用邮箱</span></div>
      </>}
      {ready ? <form key={account ? 'application' : challenge?.id || 'email'} onSubmit={submit}>
        {account ? <>
          <label>你希望用英语做什么？<textarea name="goal" minLength={4} maxLength={2000} required placeholder="旅行、留学、工作，或更自在地交流。" /></label>
          <label>通常什么时间方便？<input name="availability" minLength={2} maxLength={1000} required placeholder="例如：周末 20:00，北京时间" /></label>
        </> : challenge ? <>
          <div className="sp-code-destination"><span>{email}</span><button type="button" disabled={busy} onClick={() => {setChallenge(undefined);setError('');}}>更换邮箱</button></div>
          <p className="sp-code-hint" role="status">{challenge.delivery === 'console' ? '本地测试可输入 000000，未发送邮件。' : '验证码已发送至你的邮箱，10 分钟内有效。'}</p>
          <CodeInput busy={busy} invalid={!!error} />
        </> : <input aria-label="邮箱" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={email} placeholder="you@example.com" autoFocus />}
        {error && <p className="sp-error" role="alert">{error}</p>}
        <button className="sp-primary" disabled={busy}>{busy ? '请稍候…' : account ? '进入 Workspace' : challenge ? '验证并继续' : '使用邮箱继续'}</button>
        {!account && challenge && <button className="sp-code-resend" type="button" disabled={busy || remaining > 0} onClick={() => void resend()}>{remaining > 0 ? `${remaining} 秒后可重新发送` : '重新发送验证码'}</button>}
      </form> : <p role="status">正在加载…</p>}
    </section>
  </main>;
}
