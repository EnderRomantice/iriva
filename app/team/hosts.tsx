'use client';
import { useState, type FormEvent } from 'react';
export type TeamHost = { email: string; name: string; user_id: string | null; household: string | null };
export default function Hosts({ hosts, households, busy, save }: {
  hosts: TeamHost[];
  households: { id: string; name: string }[];
  busy: boolean;
  save: (body: unknown) => Promise<boolean>;
}) {
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [copied, setCopied] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await save({ action: 'host', email, name })) { setEmail(''); setName(''); }
  }
  return <>
    <form className="team-match" onSubmit={submit}>
      <h2>手动添加 Host</h2>
      <div className="team-host-fields">
        <label>Host 姓名<input required maxLength={60} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
        <label>Host 登录邮箱<input required type="email" maxLength={200} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></label>
      </div>
      <p>添加后，用这个邮箱验证登录就是 Host，无需填写学员申请。尚未分组时会显示等待团队安排。</p>
      <button className="team-primary" disabled={busy}>{busy ? '正在保存…' : '保存 Host'}</button>
    </form>
    <p className="team-help">同一邮箱再次保存可更新姓名。添加不会发送邮件，请将登录链接发给 Host。</p>
    <button className="team-primary" onClick={async () => {
      const url = `${location.origin}/signin?return_to=%2Flearn`;
      try { await navigator.clipboard.writeText(url); setCopied('登录链接已复制。'); }
      catch { setCopied(`请复制登录链接：${url}`); }
    }}>复制 Host 登录链接</button>
    {copied && <p role="status" className="team-help">{copied}</p>}
    <div className="team-list">
      {hosts.length ? hosts.map(host => <article key={host.email}>
        <div><small>Host · {host.user_id ? '已注册' : '待首次登录'}</small><h3>{host.name}</h3><p>{host.email}</p><span>{households.find(h => h.id === host.household)?.name || '待团队安排 Household'}</span></div>
        <button disabled={busy} onClick={() => { setEmail(host.email); setName(host.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>编辑姓名</button>
      </article>) : <p className="team-help">还没有 Host。填写姓名和登录邮箱即可添加。</p>}
    </div>
  </>;
}
