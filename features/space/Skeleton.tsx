"use client";
import type { CSSProperties } from "react";
import { accentInk, onColor, usePreferences, type View } from "./preferences";
import "./skeleton.css";

/** A single shimmering placeholder block. Width/height accept any CSS length. */
export function Bone({ w, h = 12, r, className = "" }: { w?: number | string; h?: number | string; r?: number | string; className?: string }) {
  return <span aria-hidden="true" className={`sp-bone ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

const widths = ["72%", "54%", "86%", "63%", "78%", "47%"];

function Rows({ count = 5, avatar = false }: { count?: number; avatar?: boolean }) {
  return <div className="sp-skel-rows">{Array.from({ length: count }, (_, i) => <div className="sp-skel-row" key={i}>
    {avatar && <Bone w={36} h={36} r={8} />}
    <div className="sp-skel-lines"><Bone w={widths[i % widths.length]} h={14} /><Bone w={widths[(i + 3) % widths.length]} h={10} /></div>
    <Bone w={56} h={10} />
  </div>)}</div>;
}

export function ChatSkeleton() {
  return <div className="sp-skel-chat" role="status" aria-label="正在打开对话">
    <div className="sp-skel-chat-stream">{[0, 1, 2, 3].map(i => <div className="sp-skel-message" key={i}>
      <Bone w={36} h={36} r={6} />
      <div className="sp-skel-lines"><span className="sp-skel-meta"><Bone w={72} h={13} /><Bone w={36} h={10} /></span><Bone w={widths[i]} h={12} />{i % 2 === 0 && <Bone w={widths[i + 1]} h={12} />}</div>
    </div>)}</div>
    <div className="sp-skel-composer"><Bone w="100%" h={84} r={8} /></div>
  </div>;
}

export function HostsSkeleton() {
  return <div className="sp-skel-hosts" role="status" aria-label="正在加载 Host">{Array.from({ length: 6 }, (_, i) => <div className="sp-skel-card" key={i}>
    <span className="sp-skel-meta"><Bone w={64} h={64} r={14} /><span className="sp-skel-lines"><Bone w="70%" h={16} /><Bone w="50%" h={11} /></span></span>
    <Bone w="40%" h={10} /><Bone w="92%" h={11} /><Bone w="64%" h={11} />
  </div>)}</div>;
}

/** Body-only placeholder that roughly matches the view that is about to render. */
export function ContentSkeleton({ view, chat }: { view?: View; chat?: boolean }) {
  if (chat) return <ChatSkeleton />;
  if (view === "hosts") return <HostsSkeleton />;
  return <div className="sp-content sp-skel-page" role="status" aria-label="正在加载">
    <div className="sp-skel-heading"><Bone w={220} h={26} /><Bone w={320} h={12} /></div>
    {view === "overview" && <div className="sp-skel-tiles">{[0, 1, 2].map(i => <Bone key={i} h={96} r={10} />)}</div>}
    <Rows count={view === "calendar" || view === "tasks" ? 6 : 4} avatar={view !== "calendar" && view !== "tasks"} />
  </div>;
}

/** Whole-app placeholder shown before the account is known (first visit / workspace switch). */
export function AppSkeleton({ organizationId, view, chat }: { organizationId?: string; view?: View; chat?: boolean }) {
  const { preferences } = usePreferences(organizationId);
  return <div className="sp-app sp-skel-app" data-dark={preferences.dark} data-collapsed={preferences.collapsed} aria-busy="true" style={{ "--sp-brand": preferences.color, "--sp-on-brand": onColor(preferences.color), "--sp-action-ink": accentInk(preferences.color) } as CSSProperties}>
    <header className="sp-topbar"><span className="sp-skel-search"><Bone className="sp-bone-on-brand" w="100%" h={28} r={5} /></span></header>
    <div className="sp-frame">
      <aside className="sp-rail" aria-hidden="true"><Bone className="sp-bone-on-brand" w={36} h={36} r={8} />{[0, 1, 2, 3, 4].map(i => <span className="sp-skel-rail-item" key={i}><Bone className="sp-bone-on-brand" w={36} h={36} r={8} /><Bone className="sp-bone-on-brand" w={28} h={8} /></span>)}</aside>
      <aside className="sp-sidebar" aria-hidden="true"><div className="sp-workspace-title"><Bone w={150} h={18} /></div><div className="sp-sidebar-scroll sp-skel-sidebar"><Bone w="100%" h={28} r={7} />{[64, 82, 58, 74, 49, 68].map((w, i) => <Bone key={i} w={`${w}%`} h={14} />)}</div></aside>
      <div className="sp-main"><header className="sp-channel-header"><Bone w={160} h={20} /></header><main className="sp-scroll">{<ContentSkeleton view={view} chat={chat} />}</main></div>
    </div>
  </div>;
}

export function BillingSkeleton() {
  return <div className="sp-skel-billing" role="status" aria-label="正在准备你的学习计划">
    <div className="sp-skel-heading"><Bone w={260} h={28} /><Bone w={200} h={12} /></div>
    <div className="sp-skel-plans">{[0, 1, 2].map(i => <div className="sp-skel-card" key={i}><Bone w="40%" h={22} /><Bone w="60%" h={30} /><Bone w="90%" h={11} /><Bone w="76%" h={11} /><Bone w="84%" h={11} /><Bone w="100%" h={38} r={8} /></div>)}</div>
  </div>;
}
