"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowUpRight, ContactRound, ListTodo, UsersRound, Sparkles, CreditCard, X, Search, LockKeyhole } from 'lucide-react';
import { canManageSubscription } from '@/domain/workspace-access';
import { cardKey, cardLabels, findCard, type CardPreview, type CardType, type MessageCard } from '@/domain/message-cards';
import type { Snapshot } from '@/domain/models';
import { Avatar } from './primitives';
import { Popover } from './Popover';

const icons = { user:ContactRound, task:ListTodo, group:UsersRound, host:Sparkles, plan:CreditCard };
const types = Object.keys(cardLabels) as CardType[];
function CardMark({ card, data }: { card:MessageCard; data:Snapshot }) {
  const user = (card.type === 'user' || card.type === 'host') && data.users.find(u => u.id === card.entityId);
  const Icon = icons[card.type];
  return user ? <Avatar user={user}/> : <span className={`sp-card-mark is-${card.type}`}><Icon aria-hidden="true"/></span>;
}
export function MessageCards({ cards, data, select }: { cards:MessageCard[]; data:Snapshot; select:(card:MessageCard)=>void }) {
  return <div className="sp-message-cards">{cards.map(card => {
    const preview = findCard(data.cardCatalog,card);
    return <button type="button" className="sp-shared-card" key={cardKey(card)} disabled={!preview} aria-label={preview ? `查看${cardLabels[card.type]}：${preview.title}` : '卡片内容不可用或无访问权限'} onClick={() => select(card)}>
      <div className="sp-shared-card-heading">{preview ? <CardMark card={card} data={data}/> : <LockKeyhole aria-hidden="true"/>}<span><small>{cardLabels[card.type]}</small><strong>{preview?.title || '内容不可用或无访问权限'}</strong></span>{preview && <ArrowUpRight aria-hidden="true"/>}</div>
      {preview && <><p>{preview.description}</p><div className="sp-shared-card-meta">{preview.metadata.slice(0,2).join(' · ')}</div></>}
    </button>;
  })}</div>;
}
export function ShareCardPicker({ data, anchor, selected, choose, close }: { data:Snapshot; anchor:RefObject<HTMLElement|null>; selected:MessageCard[]; choose:(card:MessageCard)=>void; close:()=>void }) {
  const [type,setType] = useState<CardType>('user'), [query,setQuery] = useState('');
  const catalog = (data.cardCatalog || []).filter(c => c.reference.type === type && `${c.title} ${c.description} ${c.metadata.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <Popover anchor={anchor} label="分享卡片" className="sp-card-picker" onClose={close}>
    <div className="sp-card-picker-head"><strong>分享卡片</strong><button type="button" className="sp-icon-button" aria-label="关闭卡片选择" onClick={close}><X/></button></div>
    <div className="sp-card-types" role="group" aria-label="卡片类型">{types.map(value => <button type="button" key={value} aria-pressed={type === value} onClick={() => { setType(value); setQuery(''); }}>{cardLabels[value]}</button>)}</div>
    <label className="sp-card-search"><Search aria-hidden="true"/><input aria-label="搜索可分享内容" placeholder={`搜索${cardLabels[type]}`} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}/></label>
    <div className="sp-card-results">{catalog.map(card => {
      const added = selected.some(c => cardKey(c) === cardKey(card.reference));
      return <button type="button" key={cardKey(card.reference)} disabled={added || selected.length >= 5} onClick={() => { choose(card.reference); close(); anchor.current?.focus(); }}><CardMark card={card.reference} data={data}/><span><strong>{card.title}</strong><small>{card.metadata.slice(0,2).join(' · ') || card.description || cardLabels[type]}</small></span>{added && <small>已添加</small>}</button>;
    })}{!catalog.length && <p className="sp-card-no-results">没有可分享的{cardLabels[type]}</p>}</div>
  </Popover>;
}
export function DraftCards({ cards, data, remove, disabled }: { cards:MessageCard[]; data:Snapshot; remove:(index:number)=>void; disabled:boolean }) {
  return <div className="sp-draft-cards" aria-label="待发送卡片">{cards.map((card,index) => <div key={cardKey(card)}><CardMark card={card} data={data}/><span><small>{cardLabels[card.type]}</small><strong>{findCard(data.cardCatalog,card)?.title || '内容不可用'}</strong></span><button type="button" disabled={disabled} aria-label={`移除卡片 ${findCard(data.cardCatalog,card)?.title || cardLabels[card.type]}`} onClick={() => remove(index)}><X/></button></div>)}</div>;
}
export function CardDetails({ card, data, onClose, onAction }: { card:MessageCard; data:Snapshot; onClose:()=>void; onAction:(card:MessageCard)=>Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); },[]);
  const preview:CardPreview|undefined = findCard(data.cardCatalog,card);
  const joined = data.households.some(h => h.id === card.entityId);
  const action = card.type === 'user' ? card.entityId === data.actor.userId ? '个人资料' : '发消息' : card.type === 'host' ? card.entityId === data.actor.userId ? '个人资料' : '联系 Host' : card.type === 'task' ? data.actor.role === 'learn' ? '打开 Task' : '查看所属小组' : card.type === 'group' ? joined ? '进入小组' : '联系运营了解小组' : canManageSubscription(data.actor.role) ? '查看套餐' : '';
  async function activate() { if (busy) return; setBusy(true); setError(''); try { await onAction(card); onClose(); } catch (e) { setError(e instanceof Error ? e.message : '暂时无法打开，请重试。'); } finally { setBusy(false); } }
  return <dialog ref={ref} className="sp-card-detail" aria-label={`${cardLabels[card.type]}详情`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const box=e.currentTarget.getBoundingClientRect(); if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom) onClose(); } }}>
    <header><span>{cardLabels[card.type]}</span><button type="button" className="sp-icon-button" aria-label="关闭卡片详情" onClick={onClose}><X/></button></header>
    {preview ? <><div className="sp-card-detail-title"><CardMark card={card} data={data}/><h2>{preview.title}</h2></div><p>{preview.description}</p><ul>{preview.metadata.map((value,index) => <li key={index}>{value}</li>)}</ul>{action && <button type="button" className="sp-primary" disabled={busy} onClick={() => void activate()}>{busy ? '正在打开…' : action}<ArrowUpRight aria-hidden="true"/></button>}</> : <p>内容已不可用，或你没有访问权限。</p>}
    {error && <p className="sp-error" role="alert">{error}</p>}
  </dialog>;
}
