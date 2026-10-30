"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Assignment, Role, Session } from "@/domain/models";
import { useWorkspace } from "@/local/use-workspace";
import { localDb } from "@/local/database";
import { resolveConflict } from "@/local/sync";
import { accentInk, onColor, usePreferences, viewLabels, type View } from "./preferences";
import { Settings } from "./Settings";
import { Avatar, Sheet } from "./primitives";
import { Practice } from "./Practice";
import { Applications, Calendar, Journey, Members, Overview, SessionDetail, Tasks } from "./views";
const roleNames = { learn: "学员", host: "Host", ops: "运营" };
export function Space({ role }: { role: Role }) {
  const { data, operations, offline, mode, error, busy, shellStatus, mutate, onlineMutation, refresh } = useWorkspace(role);
  const { preferences, setPreferences, preferenceError } = usePreferences();
  const [view, setView] = useState<View>("overview"), [query, setQuery] = useState("");
  const [settings, setSettings] = useState(false), [sync, setSync] = useState(false), [mobileNav, setMobileNav] = useState(false);
  const [practice, setPractice] = useState<{ assignment: Assignment; submissionId?: string }>();
  const [session, setSession] = useState<Session>(), [householdId, setHouseholdId] = useState("");
  const [toast, setToast] = useState(""), [resolving, setResolving] = useState(false), [syncError, setSyncError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLElement>(null);
  const allowed = (value: string): value is View => Object.hasOwn(viewLabels, value) && (role === "ops" ? value !== "tasks" : value !== "applications");
  useEffect(() => {
    const restore = () => { const value = new URLSearchParams(location.search).get("view") || "overview"; setView(allowed(value) ? value : "overview"); };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); search.current?.focus(); } if (e.key === "Escape") setMobileNav(false); };
    restore(); window.addEventListener("popstate", restore); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("keydown", key); clearTimeout(timer.current); };
    // Role defines the valid route set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  function navigate(value: string) { if (!allowed(value)) return; setView(value); setQuery(""); setMobileNav(false); history.pushState({}, "", `/${role}${value === "overview" ? "" : `?view=${value}`}`); scroll.current?.scrollTo({ top: 0 }); }
  function notify(message: string) { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(""), 4500); }
  const user = data?.users.find(u => u.id === data.actor.userId), household = data?.households.find(h => h.id === householdId) || data?.households[0];
  const visibleNav = preferences.order.filter(v => allowed(v) && !preferences.hidden.includes(v));
  const failed = operations.filter(o => o.status === "conflict");
  const status = failed.length ? "有更改需要处理" : offline ? "离线 · 已存本机" : error ? "连接中断 · 已存本机" : operations.length ? `${operations.length} 项待同步` : busy && !data ? "连接中…" : "所有更改已同步";
  const props = data ? { data, role, pending: new Set(operations.map(o => o.entityId)), navigate, openPractice: (assignment: Assignment, submissionId?: string) => setPractice({ assignment, submissionId }), openSession: setSession, mutate, onlineMutation, notify } : undefined;
  // Household selection scopes the learning content; operations retain their complete queue.
  const assignments = data?.assignments.filter(a => a.householdId === household?.id) ?? [];
  const assignmentIds = new Set(assignments.map(a => a.id));
  const submissions = data?.submissions.filter(s => assignmentIds.has(s.assignmentId)) ?? [];
  const submissionIds = new Set(submissions.map(s => s.id));
  const scoped = props && household && role !== "ops" ? { ...props, data: { ...props.data, households: [household], sessions: props.data.sessions.filter(s => s.householdId === household.id), assignments, submissions, feedback: props.data.feedback.filter(f => submissionIds.has(f.submissionId)), memberships: props.data.memberships.filter(m => m.householdId === household.id) } } : props;
  async function resolve(entityId: string, choice: "local" | "server") { setResolving(true); setSyncError(""); try { await resolveConflict(role, entityId, choice); await refresh(); } catch(e) { setSyncError(e instanceof Error ? e.message : "无法同步"); } finally { setResolving(false); } }
  return <div className="sp-app" data-dark={preferences.dark} data-compact={preferences.compact} data-collapsed={preferences.collapsed} style={{ "--sp-brand": preferences.color, "--sp-on-brand": onColor(preferences.color), "--sp-action-ink": accentInk(preferences.color) } as CSSProperties}>
    <header className="sp-topbar"><a href="/" className="sp-wordmark">iriva</a><button className="sp-show-sidebar" onClick={() => { if (matchMedia("(max-width: 760px)").matches) setMobileNav(!mobileNav); else setPreferences(p => ({ ...p, collapsed: !p.collapsed })); }}>{preferences.collapsed ? "展开侧栏" : "导航"}</button><div className="sp-global-search"><input ref={search} aria-label={role === "ops" ? "搜索报名" : "搜索练习"} placeholder={role === "ops" ? "搜索 IRIVA 的报名" : "搜索你的练习"} value={query} onChange={e => setQuery(e.target.value)} />{query ? <button onClick={() => setQuery("")} aria-label="清除搜索">清除</button> : <kbd>⌘ K</kbd>}</div><button className="sp-top-settings" onClick={() => setSettings(true)}>自定义</button></header>
    <div className="sp-frame"><aside className="sp-rail" aria-label="快捷导航"><button className="sp-initial" onClick={() => navigate("overview")} aria-label="IRIVA 首页">I</button><button aria-current={view === "overview" ? "page" : undefined} onClick={() => navigate("overview")}>主页</button><button aria-current={view === (role === "ops" ? "applications" : "tasks") ? "page" : undefined} onClick={() => navigate(role === "ops" ? "applications" : "tasks")}>{role === "ops" ? "报名" : "练习"}</button><button aria-current={view === "calendar" ? "page" : undefined} onClick={() => navigate("calendar")}>日程</button><div className="sp-rail-bottom"><button onClick={() => setSettings(true)}>外观</button><span className="sp-profile" title={user?.name}><Avatar user={user} presence={offline || error ? "offline" : data ? "online" : undefined} /></span></div></aside>
      {mobileNav && <button className="sp-nav-backdrop" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}
      <aside className={`sp-sidebar ${mobileNav ? "is-open" : ""}`} aria-label="工作区侧栏"><div className="sp-workspace-title"><strong>{role === "ops" ? "IRIVA Studio" : "IRIVA Household"}</strong><button onClick={() => { setMobileNav(false); setPreferences(p => ({ ...p, collapsed: true })); }}>收起</button></div><nav aria-label="工作区导航">{visibleNav.map(item => <button key={item} aria-current={!query && view === item ? "page" : undefined} onClick={() => navigate(item)}>{viewLabels[item]}</button>)}</nav><div className="sp-channel-section"><p>Households</p>{data?.households.map(h => <button key={h.id} aria-pressed={household?.id === h.id} onClick={() => { setHouseholdId(h.id); navigate(role === "ops" ? "household" : "overview"); }}><span className="sp-channel-prefix" aria-hidden="true">#</span>{h.name}</button>)}</div><div className="sp-sidebar-bottom"><button onClick={() => setSettings(true)}>自定义侧栏</button><label className="sp-identity"><strong>{user?.name || "正在加载"}</strong><select aria-label="切换演示身份" value={role} onChange={e => { location.href = `/${e.target.value}`; }}><option value="learn">学员 · 本地演示</option><option value="host">Host · 本地演示</option><option value="ops">运营 · 本地演示</option></select></label></div></aside>
      <div className="sp-main"><header className="sp-channel-header"><div><h1>{role === "ops" ? "IRIVA Studio" : household?.name || "Household"}</h1><span>{roleNames[role]}</span></div><button onClick={() => navigate("household")}>{data ? data.memberships.filter(m => m.householdId === household?.id).length : "—"} 位成员</button></header><nav className="sp-page-tabs" aria-label="内容导航">{(role === "ops" ? ["overview", "applications", "calendar", "household"] : ["overview", "tasks", "calendar", "household"]).map(item => <button key={item} aria-current={!query && view === item ? "page" : undefined} onClick={() => navigate(item)}>{item === "overview" ? "概览" : item === "household" ? "成员" : viewLabels[item as View]}</button>)}{view === "journey" && <button aria-current="page">六周旅程</button>}</nav>
        <main className="sp-scroll" ref={scroll}>{!data || !props || !scoped ? <div className="sp-loading"><h1>正在打开你的空间</h1><p>{error || "读取本机内容…"}</p>{error && <button onClick={() => void refresh()}>重试</button>}</div> : <div className="sp-content" key={`${query ? "search" : view}:${household?.id}`}>
          {offline && <p className="sp-offline">当前离线。草稿留在本机，恢复连接后同步。</p>}
          {query ? role === "ops" ? <Applications {...props} query={query} /> : <Tasks {...scoped} query={query} /> : view === "overview" ? <Overview {...scoped} /> : view === "tasks" ? <Tasks {...scoped} /> : view === "calendar" ? <Calendar {...scoped} /> : view === "household" ? <Members {...props} activeId={household?.id} /> : view === "journey" ? <Journey {...scoped} /> : <Applications {...props} />}
        </div>}</main><footer className="sp-statusbar"><button onClick={() => setSync(true)}>{status}</button></footer>
      </div>
    </div>
    {toast && <div className="sp-toast" role="status">{toast}<button onClick={() => setToast("")}>关闭</button></div>}
    {settings && <Settings role={role} preferences={preferences} setPreferences={setPreferences} mode={mode} error={preferenceError} onClose={() => setSettings(false)} />}
    {practice && props && <Sheet title={role === "host" ? "练习反馈" : "我的练习"} wide onClose={() => setPractice(undefined)}><Practice key={practice.submissionId || practice.assignment.id} {...props} assignment={practice.assignment} submissionId={practice.submissionId} onSaved={() => setPractice(undefined)} /></Sheet>}
    {session && props && <SessionDetail {...props} session={session} onClose={() => setSession(undefined)} />}
    {sync && <Sheet title="同步详情" onClose={() => setSync(false)}><h2>{status}</h2><p className="sp-caption">{shellStatus}</p>{error && <p className="sp-notice">{error}</p>}{operations.map(operation => <div className="sp-sync-operation" key={operation.id}><strong>{operation.command.kind === "feedback.save" ? "Host 反馈" : "练习"}</strong><span>{operation.status === "conflict" ? "需要处理" : "待同步"}</span>{operation.status === "conflict" && <><p>{operation.error}</p><Conflict role={role} id={operation.entityId} body={"body" in operation.command.payload ? operation.command.payload.body : ""} /><div className="sp-actions"><button disabled={resolving} onClick={() => void resolve(operation.entityId, "server")}>采用服务器版本</button><button className="sp-primary" disabled={resolving} onClick={() => void resolve(operation.entityId, "local")}>保留我的版本</button></div></>}</div>)}{syncError && <p className="sp-error">{syncError}</p>}<div className="sp-actions"><button className="sp-primary" disabled={busy || resolving} onClick={() => void refresh()}>立即同步</button></div></Sheet>}
  </div>;
}
function Conflict({ role, id, body }: { role: Role; id: string; body: string }) {
  const cache = useLiveQuery(() => localDb.snapshots.get(role), [role]);
  const record = [...cache?.data.submissions ?? [], ...cache?.data.feedback ?? []].find(r => r.id === id);
  return <div className="sp-conflict"><div><small>服务器版本</small><p>{record?.body || "尚无内容"}</p></div><div><small>我的版本</small><p>{body || "尚无内容"}</p></div></div>;
}
