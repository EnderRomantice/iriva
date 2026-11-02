"use client";
import { useState } from "react";
import { Hash, LockKeyhole } from "lucide-react";
import type { Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { MemberName, Avatar, Empty, Sheet } from "./primitives";
import { memberTime } from "./member-time";
export function ChatDialog({ kind, data, save, openDirect, openChannel, onClose }: { kind: "channel" | "direct"; data: Snapshot; save: (command: Command) => Promise<unknown>; openDirect: (userId: string) => void; openChannel: (id: string, kind: "public" | "private" | "direct", name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(""), [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">(data.actor.role === "host" && data.organizations.find(o=>o.id===data.actor.organizationId)?.kind !== "platform" ? "public" : "private");
  const [query, setQuery] = useState(""), [error, setError] = useState("");
  // Optimistic: open the conversation immediately; the server confirms in the background.
  function create(peerId?: string) {
    setError("");
    if (peerId) { openDirect(peerId); onClose(); return; }
    const payload = { name: name.trim(), description: description.trim(), kind: visibility };
    // Check what the server would reject before the dialog closes.
    if (data.channels.some(c => c.kind === payload.kind && c.name.toLowerCase() === payload.name.toLowerCase() && (c.kind === "public" || c.ownerId === data.actor.userId))) { setError("已有同名频道。"); return; }
    const entityId = crypto.randomUUID();
    void save({ id: crypto.randomUUID(), entityId, baseVersion: 0, kind: "channel.create", payload }).catch(() => {});
    openChannel(entityId, visibility, payload.name);
    onClose();
  }
  const people = data.users.filter(u => u.id !== data.actor.userId && u.name.toLowerCase().includes(query.toLowerCase()));
  return <Sheet title={kind === "channel" ? "建立频道" : "新私聊"} onClose={onClose}>
    {kind === "channel" ? <form className="sp-form" onSubmit={e => { e.preventDefault(); void create(); }}><label>频道名称<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="例如：咖啡与日常" /></label><label>频道介绍<textarea maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="这里想聊些什么？" /></label>{data.actor.role === "host" && data.organizations.find(o=>o.id===data.actor.organizationId)?.kind !== "platform" ? <label>谁可以看到<select value={visibility} onChange={e => setVisibility(e.target.value as "public" | "private")}><option value="public">公开 — 当前工作区所有成员</option><option value="private">仅自己可见</option></select></label> : <p className="sp-caption"><LockKeyhole size={15} /> 这个频道仅你自己可见，可以用来记想法、收集灵感。</p>}<button className="sp-primary" disabled={!name.trim()}>{visibility === "public" ? <Hash size={16} /> : <LockKeyhole size={16} />} 建立频道</button></form> : <><label className="sp-field">发给<input placeholder="搜索成员" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="sp-dm-people">{people.map(u => { const clock = memberTime(u.timezone, new Date()); return <button key={u.id} onClick={() => void create(u.id)}><Avatar user={u} /><span><strong><MemberName user={u}/></strong><small>{u.city} {clock?.time} {clock?.offset}</small></span></button>; })}{!people.length && <Empty>没有找到这位成员。</Empty>}</div></>}
    {error && <p className="sp-error" role="alert">{error}</p>}
  </Sheet>;
}
