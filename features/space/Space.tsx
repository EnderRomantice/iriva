"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Channel, Assignment, Role, Session } from "@/domain/models";
import { useWorkspace } from "@/local/use-workspace";
import { localDb } from "@/local/database";
import { resolveConflict } from "@/local/sync";
import { accentInk, onColor, usePreferences, viewLabels, type View } from "./preferences";
import { WorkspaceManagement } from "./WorkspaceManagement";
import "./workspace-management.css";
import { defaultOrganizationId } from "@/domain/workspace";
import { AdmissionsPage } from "./AdmissionsPage";
import { canAccessWorkspaceView, canManageSubscription, workspaceHomeHref } from "@/domain/workspace-access";
import { findCard, type MessageCard } from "@/domain/message-cards";
import { canContactHost } from "@/domain/hosts";
import { isProfileComplete } from "@/domain/account";
import { billingHref, hasChosenChat, needsPlan } from "./billing-navigation";
import { accountRequest, logout, type Account } from "./account-client";
import { Chat, ConversationPlaceholder } from "./Chat";
import { ChatDialog } from "./ChatDialog";
import { channelName } from "./chat-utils";
import { ProfileForm } from "./ProfileForm";
import { HostDirectory } from "./HostDirectory";
import { Chrome } from "./Chrome";
import { useSpaceNavigation, readRoute, viewRoute, type SpaceNavigation } from "./navigation";
import { workspaceScope, type WorkspaceScope } from "@/domain/workspace";
import { householdSnapshot } from "./content-scope";
import { OrganizationHome } from "./OrganizationHome";
import { Create, createLabels, type CreateKind } from "./Create";
import { Settings } from "./Settings";
import { Sheet } from "./primitives";
import { Practice } from "./Practice";
import { Applications, Calendar, Journey, Members, Overview, SessionDetail, Tasks } from "./views";
export function Space({ role }: { role: Role }) {
  const navigation = useSpaceNavigation(role);
  const [account, setAccount] = useState<Account>();
  const [authError, setAuthError] = useState("");
  async function refreshAccount() { const result:Account = await accountRequest(); if(result.role!==role) { location.replace(workspaceHomeHref(result.role,result.organizationId)); return; } setAccount(result); }
  useEffect(() => { accountRequest().then((a: Account) => {
    const org = new URLSearchParams(location.search).get("org") || undefined;
    if (!org && !new URLSearchParams(location.search).get('view') && a.authenticated && a.role !== 'ops' && (a.landingWorkspaceId || a.homeWorkspaceId)) { location.replace(workspaceHomeHref(a.role,a.landingWorkspaceId || a.homeWorkspaceId)); return; }
    if (a.role !== role) { location.replace(workspaceHomeHref(a.role,org)); return; }
    if (role === "learn" && !a.application && !a.management?.space?.kind?.match(/personal|host/)) { location.replace(`/apply${org ? `?org=${encodeURIComponent(org)}` : ''}`); return; }
    if (new URLSearchParams(location.search).get("panel") === "hosts") { location.replace(canAccessWorkspaceView(a.role,"hosts") ? billingHref("hosts",org) : workspaceHomeHref(a.role,org)); return; }
    if (a.management?.space?.kind !== "personal" && a.management?.space?.kind !== "host" && readRoute(location.href, role).view !== "profile" && needsPlan(a) && !hasChosenChat(a.user.id, org) && new URLSearchParams(location.search).get("chat") !== "1") { location.replace(billingHref("plans", org)); return; }
    setAccount(a);
  }).catch(e => { if(role === "learn") location.replace("/apply"); else setAuthError(e.message); }); }, [role, navigation.route?.organizationId]);
  if (!navigation.route || !account) return <div className="sp-loading">{authError || "正在打开你的空间…"}</div>;
  return <SpaceContent key={`${account.user.id}:${role}:${navigation.route.organizationId}`} role={role} navigation={navigation} account={account} refreshAccount={refreshAccount} />;
}
function SpaceContent({ role, navigation, account, refreshAccount }: { role: Role; navigation: SpaceNavigation; account: Account; refreshAccount: () => Promise<void> }) {
  const route = navigation.route!;
  const scope: WorkspaceScope = account.authenticated ? `${role}:${route.organizationId}:${account.user.id}` : workspaceScope(role, route.organizationId);
  useEffect(() => { const interval=setInterval(() => { void refreshAccount().catch(() => {}); }, 10000); return () => clearInterval(interval); }, []);
  const { data, operations, offline, mode, error, busy, shellStatus, mutate, onlineMutation, refresh } = useWorkspace(scope);
  const { preferences, setPreferences, preferenceError } = usePreferences(route.organizationId);
  const view = route.view;
  const profileIncomplete = role === "learn" && !isProfileComplete(account.user);
  const profileCheckedRoute = useRef<string | undefined>(undefined);
  useEffect(() => {
    const key = `${route.organizationId}:${view}`;
    if (profileCheckedRoute.current === key) return;
    profileCheckedRoute.current = key;
    if (view === "hosts" && profileIncomplete) editProfile(true);
  }, [view, route.organizationId, profileIncomplete]);
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState(false), [sync, setSync] = useState(false);
  const [openingChannel, setOpeningChannel] = useState<string>();
  const [chatDialog, setChatDialog] = useState<"channel" | "direct">();
  const [creating, setCreating] = useState<CreateKind>();
  const [practice, setPractice] = useState<{ assignment: Assignment; submissionId?: string }>();
  const [session, setSession] = useState<Session>();
  const [toast, setToast] = useState(""), [resolving, setResolving] = useState(false), [syncError, setSyncError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLElement>(null);
  const allowed = (value: string): value is View => canAccessWorkspaceView(role,value);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); search.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); clearTimeout(timer.current); };
  }, []);
  useEffect(() => { setQuery(""); setPractice(undefined); setSession(undefined); scroll.current?.scrollTo({ top: 0 }); }, [route.view, route.householdId, route.channelId]);
  function navigate(value: string, level: "organization" | "household" = "household") {
    if (!allowed(value)) return;
    if (value === "hosts" && account.management?.platformId && account.management.platformId !== route.organizationId) { location.assign(billingHref("hosts",account.management.platformId)); return; }
    const organization = data?.organizations?.find(o => o.id === route.organizationId);
    const next = viewRoute(route, value, level);
    navigation.go(next, `${organization?.name || "IRIVA"} / ${next.householdId ? household?.name || "小组" : "全部小组"} / ${value === "overview" && !next.householdId ? "主页" : viewLabels[value]}`);
    setQuery("");
  }
  function openAdmissions(tab?: "bookings") {
    if(role === "learn") return;
    navigation.go({...viewRoute(route,"applications","organization"),...(tab?{applicationTab:tab}:{})},tab?"报名 / 约谈":"报名");
  }
  function editProfile(returnToHosts = false) {
    navigation.go({ ...viewRoute(route, "profile", "organization"), ...(returnToHosts ? { profileReturn: "hosts" as const } : {}) }, "个人资料");
    setQuery("");
  }
  function notify(message: string) { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(""), 4500); }
  const user = data?.users.find(u => u.id === data.actor.userId);
  const currentSpace = data?.organizations.find(o=>o.id===route.organizationId);
  const household = data?.households.find(h => h.id === route.householdId || !route.householdId && currentSpace?.kind === 'host' && h.organizationId === route.organizationId);
  const channel = data?.channels.find(c => c.id === route.channelId);
  const isChat = view === "channels" || view === "direct";
  useEffect(() => { if (channel || route.channelId !== openingChannel) setOpeningChannel(undefined); },[channel?.id,route.channelId,openingChannel]);
  const failed = operations.filter(o => o.status === "conflict");
  const status = failed.length ? "有更改需要处理" : offline ? "离线 · 已存本机" : error ? "连接中断 · 已存本机" : operations.length ? `${operations.length} 项待同步` : busy && !data ? "连接中…" : "所有更改已同步";
  const props = data ? { data, role, pending: new Set(operations.map(o => o.entityId)), navigate, openPractice: (assignment: Assignment, submissionId?: string) => setPractice({ assignment, submissionId }), openSession: setSession, mutate, onlineMutation, notify, openDirect } : undefined;
  const content = data && householdSnapshot(data, household?.id || route.householdId);
  const scoped = props && content ? { ...props, data: content } : undefined;
  function selectHousehold(id: string) {
    const h = data?.households.find(h => h.id === id);
    if (h) navigation.go({ ...route, channelId: undefined, householdId: id, view: "overview" }, `${data?.organizations.find(o => o.id === route.organizationId)?.name} / ${h.name} / 本周`);
  }
  function openChannel(id: string, kind: Channel["kind"], name: string) {
    setOpeningChannel(id);
    navigation.go({ ...route, householdId: "", channelId: id, view: kind === "direct" ? "direct" : "channels" }, `${data?.organizations.find(o => o.id === route.organizationId)?.name} / ${name}`);
    setQuery("");
  }
  async function openSharedCard(card: MessageCard) {
    if (!data || !findCard(data.cardCatalog,card)) throw new Error("内容不可用，或你没有访问权限。");
    if (card.type === "user") { if(card.entityId === data.actor.userId) editProfile(); else await openDirect(card.entityId); return; }
    if (card.type === "host") {
      if (card.entityId === data.actor.userId) { editProfile(); return; }
      if (role !== "learn") { await openDirect(card.entityId); return; }
      const booking = account.bookings.find(b => b.host_id === card.entityId);
      if (booking) { openChannel(booking.channel_id,"direct",findCard(data.cardCatalog,card)!.title); return; }
      if (!isProfileComplete(account.user)) { editProfile(true); return; }
      const host = account.hosts.find(h => h.id === card.entityId);
      if (!host) throw new Error("这个 Host 暂时不可联系。");
      if (!canContactHost(account.user.plan,!!host.hostFeatured)) { location.assign(billingHref("plans",route.organizationId)); return; }
      const result = await accountRequest({action:"contact",hostId:card.entityId});
      await Promise.all([refreshAccount(),refresh()]);
      openChannel(result.channelId,"direct",host.name); return;
    }
    if (card.type === "plan") { if (!canManageSubscription(role)) throw new Error("套餐购买仅面向学员。"); location.assign(`${billingHref("plans",route.organizationId)}#plan-${card.entityId}`); return; }
    const task = card.type === "task" ? data.assignments.find(a => a.id === card.entityId) : undefined;
    if (card.type === "task" && !task) throw new Error("你没有查看这个 Task 的权限。");
    if (task && role === "learn") { setPractice({assignment:task}); return; }
    const group = data.households.find(h => h.id === (task?.householdId || card.entityId));
    if (group) { navigation.go({...viewRoute(route,"overview","organization"),householdId:group.id},group.name); return; }
    if (account.supportId) { openChannel(account.supportId,"direct","IRIVA 运营"); return; }
    throw new Error("请联系运营了解如何加入这个小组。");
  }
  function selectChannel(id: string) { const c = data?.channels.find(c => c.id === id); if (c && data) openChannel(id,c.kind,channelName(data,c)); }
  async function openDirect(userId: string) {
    try { const result = await onlineMutation({ id: crypto.randomUUID(), entityId: crypto.randomUUID(), baseVersion: 0, kind: "conversation.open", payload: { userId } }); if (result.entityId) openChannel(result.entityId,"direct",data?.users.find(u => u.id === userId)?.name || "私聊"); }
    catch(e) { notify(e instanceof Error ? e.message : "无法打开私聊。"); }
  }
  async function resolve(entityId: string, choice: "local" | "server") { setResolving(true); setSyncError(""); try { await resolveConflict(scope, entityId, choice); await refresh(); } catch(e) { setSyncError(e instanceof Error ? e.message : "无法同步"); } finally { setResolving(false); } }
  return <div className="sp-app" data-dark={preferences.dark} data-compact={preferences.compact} data-collapsed={preferences.collapsed} style={{ "--sp-brand": preferences.color, "--sp-on-brand": onColor(preferences.color), "--sp-action-ink": accentInk(preferences.color) } as CSSProperties}>
    <Chrome role={role} data={data} user={user} household={household} channel={channel} selectChannel={selectChannel} createChat={setChatDialog} navigation={navigation} preferences={preferences} setPreferences={setPreferences} view={view} query={query} setQuery={setQuery} search={search} navigate={navigate} navigateOrganization={value => navigate(value, "organization")}
      selectOrganization={id => { const org = data?.organizations?.find(o => o.id === id); if (id !== route.organizationId) { const targetRole=data?.organizationMemberships.find(m=>m.userId===account.user.id&&m.organizationId===id)?.role || role; location.assign(workspaceHomeHref(targetRole,id)); } }}
      selectHousehold={selectHousehold}
      create={setCreating} settings={() => setSettings(true)} offline={offline || !!error}>
        {profileIncomplete && view !== "profile" && <div className="sp-profile-reminder" role="status"><span>完善个人资料，让 Host 更了解你。</span><button onClick={() => editProfile(view === "hosts")}>去完善 <span aria-hidden="true">→</span></button></div>}
        <main className={`sp-scroll ${isChat && (channel || !route.channelId) ? "sp-chat-scroll" : ""}`} ref={scroll}>{!data || !props ? <div className="sp-loading"><h1>正在打开你的空间</h1><p>{error || "读取本机内容…"}</p>{error && <button onClick={() => void refresh()}>重试</button>}</div> : <div className={isChat && (channel || !route.channelId) ? "sp-chat-screen" : view === "hosts" ? "sp-content sp-host-content" : "sp-content"} key={`${isChat || view === "hosts" || view === "profile" || view === "applications" ? view : query ? "search" : view}:${route.channelId || household?.id}`}>
          {role !== "learn" && view !== "applications" && account.bookings.some(b => b.status === "pending") && <div className="sp-upgrade-banner"><strong>有新的学生想约谈</strong><button onClick={() => openAdmissions("bookings")}>查看约谈</button></div>}
          {offline && <p className="sp-offline">当前离线。草稿留在本机，恢复连接后同步。</p>}
          {view === "manage" ? <WorkspaceManagement account={account} onRefresh={async()=>{await Promise.all([refreshAccount(),refresh()]);}}/> : view === "profile" ? <section className="sp-profile-page" aria-label="个人资料页面"><header><div><h2>个人资料</h2><p>管理你的头像、个人信息与账号。</p></div><button onClick={() => navigate("overview", "organization")}>返回主页</button></header><ProfileForm key={account.user.id} account={account} onSaved={async () => { await Promise.all([refreshAccount(), refresh()]); if (route.profileReturn === "hosts") navigate("hosts", "organization"); else notify("个人资料已保存。"); }} onLogout={() => { void logout().catch(e => notify(e.message)); }}/></section> : view === "hosts" ? <HostDirectory account={account} org={route.organizationId} query={query} resetSearch={() => setQuery("")} completeProfile={() => editProfile(true)} openConversation={async (id, isNew) => { if (isNew) { await Promise.all([refreshAccount(), refresh()]); } openChannel(id, "direct", "私聊"); }} /> : view === "applications" ? <AdmissionsPage {...props} account={account} tab={route.applicationTab} setTab={openAdmissions} query={query} onRefresh={async () => { await Promise.all([refreshAccount(),refresh()]); }} contact={booking => { if(role === "host") { const parent=account.management?.platformId||defaultOrganizationId; location.assign(`${workspaceHomeHref(role,parent)}&view=direct&channel=${booking.channel_id}`); } else void openDirect(booking.learner_id); }}/> : isChat ? channel ? <Chat key={channel.id} channel={channel} data={data} operations={operations} mutate={mutate} onlineMutation={onlineMutation} query={query} openDirect={id => void openDirect(id)} showSync={() => setSync(true)} onOpenCard={openSharedCard} /> : route.channelId && openingChannel === route.channelId ? <div className="sp-loading"><p>正在打开对话…</p>{error && <button onClick={() => void refresh()}>重新连接</button>}</div> : route.channelId ? <div className="sp-page-section"><h1>无法打开这个对话</h1><p>频道不存在，或你没有查看权限。</p><button onClick={() => navigate(view,"organization")}>返回对话列表</button></div> : <ConversationPlaceholder direct={view === "direct"}/> : query ? role === "ops" ? <Applications {...props} query={query} /> : <Tasks {...props} query={query} /> : !scoped ? <div className="sp-page-section"><h1>无法打开这个小组</h1><p>小组不存在，或你当前没有访问权限。</p><button onClick={() => navigate("overview", "organization")}>返回工作区主页</button></div> : view === "overview" ? household ? <Overview {...scoped} /> : <OrganizationHome {...props} selectHousehold={selectHousehold} /> : view === "tasks" ? <Tasks {...scoped} /> : view === "calendar" ? <Calendar {...scoped} /> : view === "household" ? <Members {...scoped} activeId={household?.id} /> : view === "journey" ? <Journey {...scoped} /> : <Applications {...props} />}
        </div>}</main><footer className="sp-statusbar"><button onClick={() => setSync(true)}>{status}</button></footer>
    </Chrome>
    {toast && <div className="sp-toast" role="status">{toast}<button onClick={() => setToast("")}>关闭</button></div>}
    {settings && <Settings role={role} preferences={preferences} setPreferences={setPreferences} mode={mode} error={preferenceError} onClose={() => setSettings(false)} />}
    {chatDialog && data && <ChatDialog kind={chatDialog} data={data} save={onlineMutation} openChannel={openChannel} onClose={() => setChatDialog(undefined)} />}
    {creating && data && <Create key={creating} kind={creating} data={data} householdId={route.householdId} save={onlineMutation} onClose={() => setCreating(undefined)} openPractice={assignment => { setCreating(undefined); setPractice({ assignment }); }} onCreated={(kind, householdId) => { setCreating(undefined); notify(`${createLabels[kind]}成功。`); navigation.go({ ...route, channelId: undefined, householdId, view: kind === "session" ? "calendar" : kind === "assignment" ? "tasks" : "household" }, `${createLabels[kind]} / ${data.organizations.find(o => o.id === route.organizationId)?.name}`); }} />}
    {practice && props && <Sheet title={role === "host" ? "练习反馈" : "我的练习"} wide onClose={() => setPractice(undefined)}><Practice key={practice.submissionId || practice.assignment.id} {...props} assignment={practice.assignment} submissionId={practice.submissionId} onSaved={() => setPractice(undefined)} /></Sheet>}
    {session && props && <SessionDetail {...props} session={session} onClose={() => setSession(undefined)} />}
    {sync && <Sheet title="同步详情" onClose={() => setSync(false)}><h2>{status}</h2><p className="sp-caption">{shellStatus}</p>{error && <p className="sp-notice">{error}</p>}{operations.map(operation => <div className="sp-sync-operation" key={operation.id}><strong>{operation.command.kind === "message.send" ? "聊天消息" : operation.command.kind === "feedback.save" ? "Host 反馈" : "练习"}</strong><span>{operation.status === "conflict" ? "需要处理" : "待同步"}</span>{operation.status === "conflict" && <><p>{operation.error}</p><Conflict scope={scope} id={operation.entityId} body={"body" in operation.command.payload ? operation.command.payload.body : ""} /><div className="sp-actions"><button disabled={resolving} onClick={() => void resolve(operation.entityId, "server")}>采用服务器版本</button><button className="sp-primary" disabled={resolving} onClick={() => void resolve(operation.entityId, "local")}>保留我的版本</button></div></>}</div>)}{syncError && <p className="sp-error">{syncError}</p>}<div className="sp-actions"><button className="sp-primary" disabled={busy || resolving} onClick={() => void refresh()}>立即同步</button></div></Sheet>}
  </div>;
}
function Conflict({ scope, id, body }: { scope: WorkspaceScope; id: string; body: string }) {
  const cache = useLiveQuery(() => localDb.snapshots.get(scope), [scope]);
  const record = [...cache?.data.submissions ?? [], ...cache?.data.feedback ?? [], ...cache?.data.messages ?? []].find(r => r.id === id);
  return <div className="sp-conflict"><div><small>服务器版本</small><p>{record?.body || "尚无内容"}</p></div><div><small>我的版本</small><p>{body || "尚无内容"}</p></div></div>;
}
