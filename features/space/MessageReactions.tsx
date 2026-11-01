"use client";
import { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { Message, Snapshot } from '@/domain/models';
import type { Command } from '@/domain/commands';
import { reactionEmojis, reactionLabels, type ReactionEmoji } from '@/domain/reactions';
import { Popover } from './Popover';

export function MessageReactions({ message, data, pending, save }: { message: Message; data: Snapshot; pending: boolean; save: (command: Command) => Promise<unknown> }) {
  const anchor = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const reactions = message.reactions || [];
  const own = (emoji: ReactionEmoji) => reactions.some(r => r.emoji === emoji && r.userId === data.actor.userId);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('scroll', close, true);
    return () => document.removeEventListener('scroll', close, true);
  }, [open]);
  async function react(emoji: ReactionEmoji) {
    if (pending || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setOpen(false);
    if (open) anchor.current?.focus();
    try { await save({ id: crypto.randomUUID(), entityId: message.id, baseVersion: message.version, kind: 'message.react', payload: { emoji, active: !own(emoji) } }); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法保存反应，请重试。'); }
    finally { inFlight.current = false; setBusy(false); requestAnimationFrame(() => { if (document.activeElement === document.body) anchor.current?.focus(); }); }
  }
  return <>
    <div className="sp-message-tools" role="group" aria-label="消息反应工具条">
      {(['👍', '❤️', '🎉'] as const).map(emoji => <button key={emoji} type="button" className="sp-quick-reaction" disabled={pending} aria-disabled={pending || busy} aria-label={`快速反应：${reactionLabels[emoji]}`} aria-pressed={own(emoji)} title={reactionLabels[emoji]} onClick={() => void react(emoji)}>{emoji}</button>)}
      <span className="sp-message-tools-divider" aria-hidden="true"/>
      <button ref={anchor} className="sp-icon-button" type="button" aria-haspopup="dialog" disabled={pending} aria-disabled={pending || busy} aria-label="添加表情反应" title={pending ? '消息发送成功后可添加反应' : '添加表情反应'} aria-expanded={open} onClick={() => { if (busy) return; setOpen(!open); }}><SmilePlus/></button></div>
    <div className="sp-message-reactions" aria-label="消息表情反应" aria-busy={busy}>
      {reactionEmojis.map(emoji => {
        const users = reactions.filter(r => r.emoji === emoji).map(r => r.userId);
        if (!users.length) return null;
        const mine = users.includes(data.actor.userId);
        const names = users.map(id => data.users.find(u => u.id === id)?.name || '成员').join('、');
        return <button type="button" key={emoji} className="sp-reaction-chip" aria-pressed={mine} disabled={pending} aria-disabled={pending || busy} aria-label={`${reactionLabels[emoji]}，${names}${mine ? '，点击取消反应' : '，点击添加反应'}`} title={`${names} · ${reactionLabels[emoji]}`} onClick={() => void react(emoji)}><span aria-hidden="true">{emoji}</span><span className="sp-reaction-names">{names}</span></button>;
      })}
      {busy && <small role="status">保存中…</small>}
    </div>
    {error && <p className="sp-reaction-error" role="alert">{error}</p>}
    {open && <Popover anchor={anchor} label="选择消息反应" className="sp-reaction-picker" onClose={() => setOpen(false)}><div className="sp-reaction-options">{reactionEmojis.map(emoji => <button type="button" key={emoji} aria-label={reactionLabels[emoji]} aria-pressed={own(emoji)} title={reactionLabels[emoji]} onClick={() => void react(emoji)}>{emoji}</button>)}</div></Popover>}
  </>;
}
