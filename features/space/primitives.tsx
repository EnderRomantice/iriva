"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { demoPortraits } from "./avatars";
import type { User } from "@/domain/models";
export const dateLabel = (value: string, timezone = "Asia/Shanghai", options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "long", day: "numeric", ...options }).format(new Date(value));
export const timeLabel = (value: string, timezone = "Asia/Shanghai") => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
export function Avatar({ user, presence }: { user?: Pick<User, "id" | "name" | "avatar" | "plan">; presence?: "online" | "offline" }) {
  const photo = user && (user.avatar.startsWith("data:image/") ? user.avatar : demoPortraits[user.id]);
  const content = photo ? <img className="sp-avatar sp-avatar-photo" src={photo} alt="" width={30} height={30} /> : <span className={`sp-avatar sp-avatar-${user?.avatar || "blue"}`} aria-hidden="true">{user?.name.includes(" ") ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2) : user?.name.slice(-2) || "I"}</span>;
  if (!presence) return content;
  const label = presence === "online" ? "在线" : "离线";
  return <span className="sp-avatar-presence" role="img" aria-label={`${user?.name || "当前用户"} · ${label}`} title={label}>{content}<span className="sp-presence-dot" data-presence={presence} aria-hidden="true" /></span>;
}

export function PlanTag({ plan }: { plan?: User['plan'] }) {
  if (!plan || plan === 'free') return null;
  return <span className={`sp-plan-tag sp-plan-tag-${plan}`} aria-label={`${plan.toUpperCase()} 会员`}>{plan.toUpperCase()}</span>;
}
export function MemberName({ user, fallback = '成员' }: { user?: Pick<User, 'name' | 'plan'>; fallback?: string }) {
  return <span className="sp-member-name"><span>{user?.name || fallback}</span><PlanTag plan={user?.plan}/></span>;
}

export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className={`sp-sheet ${wide ? "sp-sheet-wide" : ""}`} aria-label={title} onCancel={onClose} onClick={event => {
    if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); }
  }}><header><h2>{title}</h2><button onClick={onClose}>关闭</button></header><div className="sp-sheet-body">{children}</div></dialog>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="sp-empty">{children}</p>; }
