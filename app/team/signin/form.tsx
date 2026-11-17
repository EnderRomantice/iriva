'use client';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function TeamSignInForm() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await r.json().catch(() => ({})) as { error?: string };
      if (!r.ok) throw new Error(d.error || '暂时无法登录，请稍后再试。');
      location.assign('/team');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className="apply-page signin-page">
    <a className="apply-brand" href="/">iriva <span>青鸟</span></a>
    <div className="apply-heading"><h1>团队工作台登录</h1><p>使用管理员为你开通的团队账号和密码。</p></div>
    <form onSubmit={submit}>
      <label>邮箱<input id="team-email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label>密码<input id="team-password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p className="apply-error" role="alert">{error}</p>}
      <button className="apply-button" disabled={busy}>{busy ? '正在登录…' : '登录'}<ArrowUpRight size={16} /></button>
    </form>
    <a className="apply-back" href="/signin">学员和 Host 用邮箱验证码登录</a>
  </main>;
}
