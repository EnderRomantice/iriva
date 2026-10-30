"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Assignment, Role, Session } from "@/domain/models";
import { useWorkspace } from "@/local/use-workspace";
import { localDb } from "@/local/database";
import { resolveConflict } from "@/local/sync";
import { accentInk, onColor, usePreferences, viewLabels, type View } from "./preferences";
import { Chrome } from "./Chrome";
import { useSpaceNavigation, type SpaceNavigation } from "./navigation";
import { workspaceScope, type WorkspaceScope } from "@/domain/workspace";
import { Settings } from "./Settings";
import { Sheet } from "./primitives";
import { Practice } from "./Practice";
import { Applications, Calendar, Journey, Members, Overview, SessionDetail, Tasks } from "./views";
export function Space({ role }: { role: Role }) {
  const navigation = useSpaceNavigation(role);
  if (!navigation.route) return null;
  return <SpaceContent key={`${role}:${navigation.route.organizationId}`} role={role} navigation={navigation} />;
}
function SpaceContent({ role, navigation }: { role: Role; navigation: SpaceNavigation }) {
  const route = navigation.route!;
  const scope = workspaceScope(role, route.organizationId);
  const { data, operations, offline, mode, error, busy, shellStatus, mutate, onlineMutation, refresh } = useWorkspace(scope);
  const { preferences, setPreferences, preferenceError } = usePreferences(route.organizationId);
  const view = route.view;
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState(false), [sync, setSync] = useState(false);
  const [practice, setPractice] = useState<{ assignment: Assignment; submissionId?: string }>();
  const [session, setSession] = useState<Session>();
  const [toast, setToast] = useState(""), [resolving, setResolving] = useState(false), [syncError, setSyncError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLElement>(null);
  const allowed = (value: string): value is View => Object.hasOwn(viewLabels, value) && (role === "ops" ? value !== "tasks" : value !== "applications");
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); search.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); clearTimeout(timer.current); };
  }, []);
  useEffect(() => { setQuery(""); setPractice(undefined); setSession(undefined); scroll.current?.scrollTo({ top: 0 }); }, [route.view, route.householdId]);
  function navigate(value: string) {
    if (!allowed(value)) return;
    const organization = data?.organizations?.find(o => o.id === route.organizationId);
    navigation.go({ ...route, view: value }, `${organization?.name || "IRIVA"} / ${household?.name || "工作区"} / ${viewLabels[value]}`);
    setQuery("");
  }
  function notify(message: string) { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(""), 4500); }
  const user = data?.users.find(u => u.id === data.actor.userId), household = data?.households.find(h => h.id === route.householdId) || data?.households[0];
  const failed = operations.filter(o => o.status === "conflict");
  const status = failed.length ? "有更改需要处理" : offline ? "离线 · 已存本机" : error ? "连接中断 · 已存本机" : operations.length ? `${operations.length} 项待同步` : busy && !data ? "连接中…" : "所有更改已同步";
  const props = data ? { data, role, pending: new Set(operations.map(o => o.entityId)), navigate, openPractice: (assignment: Assignment, submissionId?: string) => setPractice({ assignment, submissionId }), openSession: setSession, mutate, onlineMutation, notify } : undefined;
  // Household selection scopes the learning content; operations retain their complete queue.
  const assignments = data?.assignments.filter(a => a.householdId === household?.id) ?? [];
  const assignmentIds = new Set(assignments.map(a => a.id));
  const submissions = data?.submissions.filter(s => assignmentIds.has(s.assignmentId)) ?? [];
  const submissionIds = new Set(submissions.map(s => s.id));
  const scoped = props && household && role !== "ops" ? { ...props, data: { ...props.data, households: [household], sessions: props.data.sessions.filter(s => s.householdId === household.id), assignments, submissions, feedback: props.data.feedback.filter(f => submissionIds.has(f.submissionId)), memberships: props.data.memberships.filter(m => m.householdId === household.id) } } : props;
  async function resolve(entityId: string, choice: "local" | "server") { setResolving(true); setSyncError(""); try { await resolveConflict(scope, entityId, choice); await refresh(); } catch(e) { setSyncError(e instanceof Error ? e.message : "无法同步"); } finally { setResolving(false); } }
  return <div className="sp-app" data-dark={preferences.dark} data-compact={preferences.compact} data-collapsed={preferences.collapsed} style={{ "--sp-brand": preferences.color, "--sp-on-brand": onColor(preferences.color), "--sp-action-ink": accentInk(preferences.color) } as CSSProperties}>
    <Chrome role={role} data={data} user={user} household={household} navigation={navigation} preferences={preferences} setPreferences={setPreferences} view={view} query={query} setQuery={setQuery} search={search} navigate={navigate}
      selectOrganization={id => { const org = data?.organizations?.find(o => o.id === id); if (id !== route.organizationId) navigation.go({ organizationId: id, householdId: "", view: "overview" }, `${org?.name || "工作区"} / 本周`); }}
      selectHousehold={id => { const h = data?.households.find(h => h.id === id); navigation.go({ ...route, householdId: id, view: "overview" }, `${data?.organizations?.find(o => o.id === route.organizationId)?.name} / ${h?.name} / 本周`); }}
      settings={() => setSettings(true)} offline={offline || !!error}>
        <main className="sp-scroll" ref={scroll}>{!data || !props || !scoped ? <div className="sp-loading"><h1>正在打开你的空间</h1><p>{error || "读取本机内容…"}</p>{error && <button onClick={() => void refresh()}>重试</button>}</div> : <div className="sp-content" key={`${query ? "search" : view}:${household?.id}`}>
          {offline && <p className="sp-offline">当前离线。草稿留在本机，恢复连接后同步。</p>}
          {query ? role === "ops" ? <Applications {...props} query={query} /> : <Tasks {...scoped} query={query} /> : view === "overview" ? <Overview {...scoped} /> : view === "tasks" ? <Tasks {...scoped} /> : view === "calendar" ? <Calendar {...scoped} /> : view === "household" ? <Members {...props} activeId={household?.id} /> : view === "journey" ? <Journey {...scoped} /> : <Applications {...props} />}
        </div>}</main><footer className="sp-statusbar"><button onClick={() => setSync(true)}>{status}</button></footer>
    </Chrome>
    {toast && <div className="sp-toast" role="status">{toast}<button onClick={() => setToast("")}>关闭</button></div>}
    {settings && <Settings role={role} preferences={preferences} setPreferences={setPreferences} mode={mode} error={preferenceError} onClose={() => setSettings(false)} />}
    {practice && props && <Sheet title={role === "host" ? "练习反馈" : "我的练习"} wide onClose={() => setPractice(undefined)}><Practice key={practice.submissionId || practice.assignment.id} {...props} assignment={practice.assignment} submissionId={practice.submissionId} onSaved={() => setPractice(undefined)} /></Sheet>}
    {session && props && <SessionDetail {...props} session={session} onClose={() => setSession(undefined)} />}
    {sync && <Sheet title="同步详情" onClose={() => setSync(false)}><h2>{status}</h2><p className="sp-caption">{shellStatus}</p>{error && <p className="sp-notice">{error}</p>}{operations.map(operation => <div className="sp-sync-operation" key={operation.id}><strong>{operation.command.kind === "feedback.save" ? "Host 反馈" : "练习"}</strong><span>{operation.status === "conflict" ? "需要处理" : "待同步"}</span>{operation.status === "conflict" && <><p>{operation.error}</p><Conflict scope={scope} id={operation.entityId} body={"body" in operation.command.payload ? operation.command.payload.body : ""} /><div className="sp-actions"><button disabled={resolving} onClick={() => void resolve(operation.entityId, "server")}>采用服务器版本</button><button className="sp-primary" disabled={resolving} onClick={() => void resolve(operation.entityId, "local")}>保留我的版本</button></div></>}</div>)}{syncError && <p className="sp-error">{syncError}</p>}<div className="sp-actions"><button className="sp-primary" disabled={busy || resolving} onClick={() => void refresh()}>立即同步</button></div></Sheet>}
  </div>;
}
function Conflict({ scope, id, body }: { scope: WorkspaceScope; id: string; body: string }) {
  const cache = useLiveQuery(() => localDb.snapshots.get(scope), [scope]);
  const record = [...cache?.data.submissions ?? [], ...cache?.data.feedback ?? []].find(r => r.id === id);
  return <div className="sp-conflict"><div><small>服务器版本</small><p>{record?.body || "尚无内容"}</p></div><div><small>我的版本</small><p>{body || "尚无内容"}</p></div></div>;
}
