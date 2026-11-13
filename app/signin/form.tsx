'use client';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function SignInForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState(''), [challenge, setChallenge] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  async function call(body: object) {
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})) as { error?: string; challengeId?: string; delivery?: string };
    if (!r.ok) throw new Error(d.error || '暂时无法登录，请稍后再试。');
    return d;
  }
  async function begin(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const d = await call({ action: 'begin', email }); setChallenge(d.challengeId || ''); setNote(d.delivery === 'console' ? '本地开发：验证码已打印在服务器日志里，也可以直接填 000000。' : `验证码已发到 ${email}，10 分钟内有效。`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function verify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await call({ action: 'verify', challengeId: challenge, code }); location.assign(returnTo); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className="apply-page signin-page">
    <a className="apply-brand" href="/">iriva <span>青鸟</span></a>
    <div className="apply-heading"><h1>用邮箱登录青鸟。</h1><p>我们会给你的邮箱发一个 6 位验证码，不需要设置密码。</p></div>
    {!challenge
      ? <form onSubmit={begin}>
          <label>邮箱<input id="signin-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          {error && <p className="apply-error" role="alert">{error}</p>}
          <button className="apply-button" disabled={busy}>{busy ? '正在发送…' : '发送验证码'}<ArrowUpRight size={16} /></button>
        </form>
      : <form onSubmit={verify}>
          <p className="apply-note" role="status">{note}</p>
          <label>验证码<input id="signin-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 位数字" /></label>
          {error && <p className="apply-error" role="alert">{error}</p>}
          <button className="apply-button" disabled={busy}>{busy ? '正在登录…' : '登录'}<ArrowUpRight size={16} /></button>
          <button type="button" className="apply-back signin-switch" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>换一个邮箱</button>
        </form>}
    <a className="apply-back" href="/">返回青鸟首页</a>
  </main>;
}
