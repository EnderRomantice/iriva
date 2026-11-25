'use client';
import {useLocale} from '../locale-provider';
import { useId, useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import './invite-code.css';

export default function InviteCode() {const {t:tr}=useLocale();
  const id = useId();
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/apply/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
      const data = await response.json() as { error?: string; household?: string };
      if (!response.ok || !data.household) throw new Error(data.error || '暂时无法加入，请稍后重试。');
      window.location.assign('/learn');
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <section className="invite-code" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{tr("已有邀请码？直接进入学习空间。")}</h2>
    <p id={`${id}-help`}>{tr("资料已保存。输入 Host 或青鸟团队给你的邀请码，即可加入对应 Household。没有邀请码也可以稍后再来。")}</p>
    <form onSubmit={join}>
      <label htmlFor={`${id}-code`}>{tr("Household 邀请码")}</label>
      <div className="invite-code-controls">
        <input id={`${id}-code`} required maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} disabled={busy} onChange={event => { setCode(event.target.value); setError(''); }} placeholder={tr("粘贴你的邀请码")} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={!!error} />
        <button disabled={busy || !code.trim()}>{busy ? tr("正在进入…") : tr("进入学习空间")} <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="invite-code-error">{tr(error)}</p>}
    </form>
  </section>;
}
