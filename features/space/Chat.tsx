"use client";
import { useEffect, useRef, useState } from "react";
import { Hash, LockKeyhole, MessageCircle, SendHorizontal, Smile, X } from "lucide-react";
import type { Channel, Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import type { PendingOperation } from "@/local/database";
import { localDb, saveDraft } from "@/local/database";
import { workspaceScope } from "@/domain/workspace";
import { Avatar, Empty } from "./primitives";
import { channelName, directPeer } from "./chat-utils";

const chatDay = new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"long",day:"numeric"});
const chatTime = new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false});

export function ChannelDirectory({ data, direct, query, open, create }: { data: Snapshot; direct: boolean; query: string; open: (channel: Channel) => void; create: () => void }) {
  const channels = data.channels.filter(c => (c.kind === "direct") === direct && channelName(data,c).toLowerCase().includes(query.toLowerCase()));
  return <section className="sp-page-section sp-chat-directory"><div className="sp-section-head"><h1>{direct ? "私聊" : "频道"}</h1><button className="sp-primary" onClick={create}>{direct ? "新私聊" : "建立频道"}</button></div><p className="sp-caption">{direct ? "一对一聊聊，只有你们能看到。" : "分享日常、交流想法，随时加入对话。"}</p><div className="sp-list">{channels.map(c => <button className="sp-channel-row" key={c.id} onClick={() => open(c)}>{direct ? <Avatar user={directPeer(data,c.id)} /> : c.kind === "private" ? <LockKeyhole /> : <Hash />}<span><strong>{channelName(data,c)}</strong><small>{c.kind === "private" ? "仅自己可见" : c.kind === "public" ? c.description || "工作区公开频道" : data.messages.filter(m => m.channelId === c.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0]?.body || "开始你们的对话"}</small></span></button>)}</div>{!channels.length && <Empty>{query ? "没有找到相关对话。" : direct ? "还没有私聊，选择一位成员开始吧。" : "还没有频道。"}</Empty>}</section>;
}

export function Chat({ channel, data, operations, mutate, query, openDirect, showSync }: { channel: Channel; data: Snapshot; operations: PendingOperation[]; mutate: (command: Command) => Promise<void>; query: string; openDirect: (id: string) => void; showSync: () => void }) {
  const scope = workspaceScope(data.actor.role, data.actor.organizationId), draftId = `message-${channel.id}`;
  const title = channelName(data,channel), peer = directPeer(data,channel.id);
  const [body,setBody] = useState(""), [ready,setReady] = useState(false), [error,setError] = useState(""), [sending,setSending] = useState(false), [emoji,setEmoji] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null), stream = useRef<HTMLDivElement>(null);
  const writes = useRef(Promise.resolve()), stickToBottom = useRef(true);
  const messages = data.messages.filter(m => m.channelId === channel.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const visible = messages.filter(m => !query || m.body.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    let active = true;
    void localDb.drafts.get(`${scope}:${draftId}`).then(draft => { if (active) { setBody(draft?.body || ""); setReady(true); } }).catch(() => { if (active) setError("无法读取本机草稿，请重试。"); });
    return () => { active = false; };
  },[scope,draftId]);
  useEffect(() => { if (stickToBottom.current && stream.current) stream.current.scrollTop = stream.current.scrollHeight; },[messages.length,query]);
  function change(value: string) {
    setBody(value);
    writes.current = writes.current.catch(() => {}).then(() => saveDraft(scope,draftId,value));
    void writes.current.catch(() => setError("本机草稿保存失败，请复制内容后重试。"));
  }
  async function send() {
    if (!ready || sending || !body.trim()) return;
    setSending(true); setError("");
    try {
      await writes.current;
      await mutate({ id:crypto.randomUUID(),entityId:crypto.randomUUID(),baseVersion:0,kind:"message.send",payload:{channelId:channel.id,body:body.trim()} });
      setBody(""); stickToBottom.current = true; setEmoji(false);
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
    <div className="sp-chat-subheader"><MessageCircle size={16}/><strong>消息</strong><span>{channel.kind === "direct" ? "仅你们两人可见" : channel.kind === "private" ? "仅自己可见" : channel.description}</span></div>
    <div className="sp-chat-stream" ref={stream} onScroll={() => { const el=stream.current; if(el) stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80; }}>
      {!messages.length && !query && <div className="sp-chat-welcome">{channel.kind === "direct" ? <Avatar user={peer}/> : channel.kind === "private" ? <LockKeyhole size={46}/> : <Hash size={46}/>}<h2>{channel.kind === "direct" ? `和 ${title} 聊聊` : channel.kind === "private" ? `这是你的 ${title}` : `欢迎来到 # ${title}`}</h2><p>{channel.kind === "direct" ? "从一句问候开始。这段对话只有你们能看到。" : channel.kind === "private" ? "记下想法，收集灵感。这里的内容只属于你。" : "这里可以分享日常、聊聊近况，也可以什么主题都没有。"}</p></div>}
      <div role="log" aria-label="消息记录" aria-live="polite" aria-relevant="additions text">{visible.map((m,index) => {
        const previous = visible[index-1], date = day(m.createdAt), newDay = !previous || day(previous.createdAt)!==date;
        const compact = !newDay && previous.authorId===m.authorId && Date.parse(m.createdAt)-Date.parse(previous.createdAt)<300000;
        const author = authors.get(m.authorId), operation=pending.get(m.id);
        return <div key={m.id}>{newDay && <div className="sp-chat-date"><span>{date}</span></div>}<article className={`sp-chat-message ${compact ? "is-continuation" : ""}`}>
          <div className="sp-chat-author-avatar">{!compact && <Avatar user={author}/>}</div><div className="sp-chat-message-content">{!compact && <div className="sp-chat-meta"><button onClick={() => { if(m.authorId!==data.actor.userId) openDirect(m.authorId); }} disabled={m.authorId===data.actor.userId}>{author?.name || "成员"}</button><time dateTime={m.createdAt} title="北京时间">{time(m.createdAt)}</time></div>}<p>{m.body}</p>{operation && (operation.status === "conflict" ? <button className="sp-message-failed" onClick={showSync}>发送失败，查看原因</button> : <small className="sp-caption">待发送</small>)}</div></article></div>;
      })}</div>{query && !visible.length && <Empty>没有找到相关消息。</Empty>}
    </div>
    <div className="sp-chat-compose-area"><form className="sp-chat-composer" onSubmit={e=>{e.preventDefault();void send();}}>
      <textarea ref={textarea} aria-label={`给${title}发送消息`} placeholder={channel.kind === "direct" ? `发消息给 ${title}` : `发消息到 # ${title}`} value={body} maxLength={12000} disabled={!ready || sending} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
      <div className="sp-chat-compose-tools"><button type="button" className="sp-icon-button" aria-label="插入表情" aria-expanded={emoji} disabled={!ready || sending} onClick={()=>setEmoji(!emoji)}><Smile/></button><span>Enter 发送，Shift + Enter 换行</span><button type="submit" className="sp-send-message" aria-label="发送消息" disabled={!ready || sending || !body.trim()}><SendHorizontal/></button></div>
      {emoji && <div className="sp-emoji-picker" aria-label="选择表情">{["😊","👋","❤️","🙌","🎉","☕"].map(value=><button key={value} type="button" aria-label={`插入 ${value}`} onClick={()=>addEmoji(value)}>{value}</button>)}<button className="sp-icon-button" aria-label="关闭表情" type="button" onClick={()=>setEmoji(false)}><X/></button></div>}
    </form>{error && <p className="sp-error" role="alert">{error}</p>}</div>
  </section>;
}
