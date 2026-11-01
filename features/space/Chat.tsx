"use client";
import { cardKey, findCard, type MessageCard } from "@/domain/message-cards";
import { MessageCards, ShareCardPicker, DraftCards, CardDetails } from "./MessageCards";
import { useEffect, useRef, useState } from "react";
import { Hash, LockKeyhole, MessagesSquare, SendHorizontal, Smile, PanelsTopLeft, X } from "lucide-react";
import type { Channel, Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import type { PendingOperation } from "@/local/database";
import { localDb, saveDraft } from "@/local/database";
import { workspaceScope } from "@/domain/workspace";
import { MemberName, Avatar, Empty } from "./primitives";
import { MessageReactions } from "./MessageReactions";
import { channelName, directPeer } from "./chat-utils";

const chatDay = new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"long",day:"numeric"});
const chatTime = new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false});

export function ConversationPlaceholder({ direct }: { direct: boolean }) {
  return <section className="sp-conversation-placeholder" aria-label={direct ? "未选择私聊" : "未选择频道"}>{direct ? <MessagesSquare aria-hidden="true"/> : <Hash aria-hidden="true"/>}<h2>{direct ? "选择一个会话" : "选择一个频道"}</h2></section>;
}

export function Chat({ channel, data, operations, mutate, onlineMutation, query, openDirect, showSync, onOpenCard }: { channel: Channel; data: Snapshot; operations: PendingOperation[]; mutate: (command: Command) => Promise<void>; onlineMutation: (command: Command) => Promise<unknown>; query: string; openDirect: (id: string) => void; showSync: () => void; onOpenCard: (card: MessageCard) => Promise<void> }) {
  const scope = workspaceScope(data.actor.role, data.actor.organizationId), draftId = `message-${channel.id}`;
  const title = channelName(data,channel), peer = directPeer(data,channel.id);
  const [body,setBody] = useState(""), [ready,setReady] = useState(false), [error,setError] = useState(""), [sending,setSending] = useState(false), [emoji,setEmoji] = useState(false);
  const [cards,setCards] = useState<MessageCard[]>([]), [sharing,setSharing] = useState(false), [detail,setDetail] = useState<MessageCard>();
  const shareAnchor = useRef<HTMLButtonElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<string>();
  const textarea = useRef<HTMLTextAreaElement>(null), stream = useRef<HTMLDivElement>(null);
  const writes = useRef(Promise.resolve()), stickToBottom = useRef(true);
  const messages = data.messages.filter(m => m.channelId === channel.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const visible = messages.filter(m => !query || [m.body,...(m.cards || []).map(c => findCard(data.cardCatalog,c)?.title || "")].join(" ").toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    let active = true;
    void localDb.drafts.get(`${scope}:${draftId}`).then(draft => { if (active) { setBody(draft?.body || ""); setCards(draft?.cards || []); setReady(true); } }).catch(() => { if (active) setError("无法读取本机草稿，请重试。"); });
    return () => { active = false; };
  },[scope,draftId]);
  useEffect(() => { if (stickToBottom.current && stream.current) stream.current.scrollTop = stream.current.scrollHeight; },[messages.length,query]);
  function change(value: string, nextCards = cards) {
    setBody(value); setCards(nextCards);
    writes.current = writes.current.catch(() => {}).then(() => saveDraft(scope,draftId,value,nextCards));
    void writes.current.catch(() => setError("本机草稿保存失败，请复制内容后重试。"));
  }
  async function send() {
    if (!ready || sending || (!body.trim() && !cards.length)) return;
    setSending(true); setError("");
    try {
      await writes.current;
      await mutate({ id:crypto.randomUUID(),entityId:crypto.randomUUID(),baseVersion:0,kind:"message.send",payload:{channelId:channel.id,body:body.trim(),cards} });
      setBody(""); setCards([]); setSharing(false); stickToBottom.current = true; setEmoji(false);
      await localDb.drafts.delete(`${scope}:${draftId}`);
      textarea.current?.focus();
    } catch(e) { setError(e instanceof Error ? e.message : "未能发送，内容已保留。"); }
    finally { setSending(false); }
  }
  function addEmoji(value: string) {
    const el = textarea.current, start = el?.selectionStart ?? body.length, end = el?.selectionEnd ?? start;
    const next = body.slice(0,start)+value+body.slice(end);
    if(next.length>12000) return;
    change(next); setEmoji(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start+value.length,start+value.length); });
  }
  const day = (value: string) => chatDay.format(new Date(value));
  const time = (value: string) => chatTime.format(new Date(value));
  const authors = new Map(data.users.map(u => [u.id,u]));
  const pending = new Map(operations.map(o => [o.entityId,o]));
  return <section className="sp-chat" aria-label={`${title} 对话`}>
    <div className="sp-chat-stream" ref={stream} onScroll={() => { const el=stream.current; if(el) stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80; }}>
      {!messages.length && !query && <div className="sp-chat-welcome">{channel.kind === "direct" ? <Avatar user={peer}/> : channel.kind === "private" ? <LockKeyhole size={46}/> : <Hash size={46}/>}<h2>{channel.kind === "direct" ? `和 ${title} 聊聊` : channel.kind === "private" ? `这是你的 ${title}` : `欢迎来到 # ${title}`}</h2><p>{channel.kind === "direct" ? "从一句问候开始。这段对话只有你们能看到。" : channel.kind === "private" ? "记下想法，收集灵感。这里的内容只属于你。" : "这里可以分享日常、聊聊近况，也可以什么主题都没有。"}</p></div>}
      <div role="log" aria-label="消息记录" aria-live="polite" aria-relevant="additions text">{visible.map((m,index) => {
        const previous = visible[index-1], date = day(m.createdAt), newDay = !previous || day(previous.createdAt)!==date;
        const compact = !newDay && previous.authorId===m.authorId && Date.parse(m.createdAt)-Date.parse(previous.createdAt)<300000;
        const author = authors.get(m.authorId), operation=pending.get(m.id);
        return <div key={m.id}>{newDay && <div className="sp-chat-date"><span>{date}</span></div>}<article tabIndex={0} aria-label={`${author?.name || '成员'}的消息`} onClick={() => setSelectedMessage(m.id)} onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMessage(m.id); } if (e.key === 'Escape') setSelectedMessage(undefined); }} className={`sp-chat-message ${compact ? "is-continuation" : ""} ${selectedMessage === m.id ? 'is-selected' : ''}`}>
          <div className="sp-chat-author-avatar">{!compact && <Avatar user={author}/>}</div><div className="sp-chat-message-content">{!compact && <div className="sp-chat-meta"><button onClick={() => { if(m.authorId!==data.actor.userId) openDirect(m.authorId); }} disabled={m.authorId===data.actor.userId}><MemberName user={author}/></button><time dateTime={m.createdAt} title="北京时间">{time(m.createdAt)}</time></div>}{m.body && <p>{m.body}</p>}{!!m.cards?.length && <MessageCards cards={m.cards} data={data} select={setDetail}/>}<MessageReactions message={m} data={data} pending={!!operation} save={onlineMutation}/>{operation && (operation.status === "conflict" ? <button className="sp-message-failed" onClick={showSync}>发送失败，查看原因</button> : <small className="sp-caption">待发送</small>)}</div></article></div>;
      })}</div>{query && !visible.length && <Empty>没有找到相关消息。</Empty>}
    </div>
    <div className="sp-chat-compose-area"><form className="sp-chat-composer" onSubmit={e=>{e.preventDefault();void send();}}>
      {!!cards.length && <DraftCards cards={cards} data={data} disabled={!ready || sending} remove={index => change(body,cards.filter((_,i) => i !== index))}/>}
      <textarea ref={textarea} aria-label={`给${title}发送消息`} placeholder={channel.kind === "direct" ? `发消息给 ${title}` : `发消息到 # ${title}`} value={body} maxLength={12000} disabled={!ready || sending} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
      <div className="sp-chat-compose-tools"><button ref={shareAnchor} type="button" className="sp-icon-button" aria-label="分享卡片" aria-haspopup="dialog" aria-expanded={sharing} disabled={!ready || sending || cards.length >= 5} onClick={() => setSharing(!sharing)}><PanelsTopLeft/></button><button type="button" className="sp-icon-button" aria-label="插入表情" aria-expanded={emoji} disabled={!ready || sending} onClick={()=>setEmoji(!emoji)}><Smile/></button><span>Enter 发送，Shift + Enter 换行</span><button type="submit" className="sp-send-message" aria-label="发送消息" disabled={!ready || sending || (!body.trim() && !cards.length)}><SendHorizontal/></button></div>
      {sharing && <ShareCardPicker data={data} anchor={shareAnchor} selected={cards} choose={card => { if(cards.length<5 && !cards.some(c => cardKey(c) === cardKey(card))) change(body,[...cards,card]); }} close={() => setSharing(false)}/>}
      {emoji && <div className="sp-emoji-picker" aria-label="选择表情">{["😊","👋","❤️","🙌","🎉","☕"].map(value=><button key={value} type="button" aria-label={`插入 ${value}`} onClick={()=>addEmoji(value)}>{value}</button>)}<button className="sp-icon-button" aria-label="关闭表情" type="button" onClick={()=>setEmoji(false)}><X/></button></div>}
    </form>{error && <p className="sp-error" role="alert">{error}</p>}</div>
    {detail && <CardDetails card={detail} data={data} onClose={() => setDetail(undefined)} onAction={onOpenCard}/>}
  </section>;
}
