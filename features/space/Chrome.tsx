"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Clock3, Search, CircleHelp, Home, MessageCircle, CalendarDays, MoreHorizontal, Settings, Moon, Sun, Plus, ChevronDown, Check, Hash, Star, PanelLeftClose, PanelLeftOpen, X, UsersRound, ListTodo, Map, ContactRound, Menu } from "lucide-react";
import type { Household, Role, Snapshot, User } from "@/domain/models";
import { viewLabels, type Preferences, type View } from "./preferences";
import { readRoute, type SpaceNavigation } from "./navigation";
import { Avatar } from "./primitives";
import { Popover } from "./Popover";
const icons = { overview: Home, tasks: ListTodo, calendar: CalendarDays, household: UsersRound, applications: ContactRound, journey: Map };
interface Props {
  role: Role; data?: Snapshot; user?: User; household?: Household; navigation: SpaceNavigation;
  preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>>;
  view: View; query: string; setQuery: (query: string) => void; search: RefObject<HTMLInputElement | null>;
  navigate: (view: string) => void; navigateOrganization: (view: string) => void; selectHousehold: (id: string) => void; selectOrganization: (id: string) => void;
  settings: () => void; offline: boolean; children: ReactNode;
}
export function Chrome({ role, data, user, household, navigation, preferences, setPreferences, view, query, setQuery, search, navigate, navigateOrganization, selectHousehold, selectOrganization, settings, offline, children }: Props) {
  const [mobile, setMobile] = useState(false), [menu, setMenu] = useState<"organizations" | "history" | "more" | "profile" | "help" | "channel">();
  const [groupQuery, setGroupQuery] = useState("");
  const anchor = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobile(false); };
    window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape);
  }, []);
  const organization = data?.organizations?.find(o => o.id === navigation.route?.organizationId);
  const [favorite, setFavorite] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { const saved = JSON.parse(localStorage.getItem(`iriva-starred-${navigation.route?.organizationId}`) || "[]"); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []; } catch { return []; } });
  const starred = !!household && favorite.includes(household.id);
  function toggleStar() { if (!household) return; const next = starred ? favorite.filter(id => id !== household.id) : [...favorite, household.id]; setFavorite(next); try { localStorage.setItem(`iriva-starred-${navigation.route?.organizationId}`, JSON.stringify(next)); } catch {} }
  function open(kind: typeof menu, element: HTMLElement) { if (menu === kind && anchor.current === element) { setMenu(undefined); return; } anchor.current = element; setMenu(kind); }
  function go(value: string, global = false) { (global ? navigateOrganization : navigate)(value); setMobile(false); setMenu(undefined); }
  const allowed = (v: View) => role === "ops" ? v !== "tasks" : v !== "applications";
  const navItems = preferences.order.filter(v => v !== "journey" && allowed(v) && !preferences.hidden.includes(v));
  const globalLabels: Record<View, string> = { overview: "主页", tasks: "练习", applications: "报名", calendar: "日程", household: "伙伴", journey: "旅程" };
  const groups = data?.households.filter(h => h.name.toLowerCase().includes(groupQuery.trim().toLowerCase())) || [];
  const globalTitle = view === "overview" ? "主页" : view === "calendar" ? "全部日程" : view === "household" ? "工作区伙伴" : view === "tasks" ? "全部练习与反馈" : viewLabels[view];
  const work = role === "ops" ? "applications" : "tasks";
  const memberCount = data?.memberships.filter(m => m.householdId === household?.id).length;
  const title = organization?.name || "工作区";
  const menuAction = (action: () => void) => { setMenu(undefined); action(); };
  return <>
    <header className="sp-topbar">
      <button className="sp-mobile-menu sp-icon-button" aria-label="打开导航" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu /></button>
      <div className="sp-history-controls">
        <button className="sp-icon-button" title="后退" aria-label="后退" disabled={!navigation.canBack} onClick={navigation.back}><ArrowLeft /></button>
        <button className="sp-icon-button" title="前进" aria-label="前进" disabled={!navigation.canForward} onClick={navigation.forward}><ArrowRight /></button>
        <button className="sp-icon-button" title="历史记录" aria-label="历史记录" aria-expanded={menu === "history"} onClick={e => open("history", e.currentTarget)}><Clock3 /></button>
      </div>
      <div className="sp-global-search"><Search aria-hidden="true" /><input ref={search} aria-label={role === "ops" ? "搜索报名" : "搜索练习"} placeholder={`搜索 ${title}`} value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="sp-icon-button" aria-label="清除搜索" onClick={() => setQuery("")}><X /></button>}</div>
      <button className="sp-help sp-icon-button" title="帮助" aria-label="帮助" onClick={e => open("help", e.currentTarget)}><CircleHelp /></button>
    </header>
    <div className="sp-frame">
      <aside className="sp-rail" aria-label="主导航">
        <button className="sp-organization-avatar" title="切换工作区" aria-label="切换工作区" aria-expanded={menu === "organizations"} onClick={e => open("organizations", e.currentTarget)}><span>{organization?.initials || "I"}</span></button>
        <div className="sp-rail-links">
          {navItems.map(item => { const Icon = icons[item]; return <button key={item} className="sp-rail-item" aria-current={!navigation.route?.householdId && !query && view === item ? "page" : undefined} onClick={() => go(item, true)}><span><Icon /></span><strong>{globalLabels[item]}</strong></button>; })}
          <button className="sp-rail-item" aria-expanded={menu === "more"} onClick={e => open("more", e.currentTarget)}><span><MoreHorizontal /></span><strong>更多</strong></button>
        </div>
        <button className="sp-rail-item sp-rail-admin" onClick={settings}><span><Settings /></span><strong>设置</strong></button>
        <div className="sp-rail-bottom">
          <button className="sp-rail-circle" aria-label="查看所有工作区" title="查看所有工作区" onClick={e => open("organizations", e.currentTarget)}><Plus /></button>
          <button className="sp-rail-circle" aria-label={preferences.dark ? "切换浅色模式" : "切换深色模式"} title={preferences.dark ? "切换浅色模式" : "切换深色模式"} onClick={() => setPreferences(p => ({ ...p, dark: !p.dark }))}>{preferences.dark ? <Sun /> : <Moon />}</button>
          <button className="sp-profile" aria-label="个人资料与身份" onClick={e => open("profile", e.currentTarget)}><Avatar user={user} presence={offline ? "offline" : data ? "online" : undefined} /></button>
        </div>
      </aside>
      {mobile && <button className="sp-nav-backdrop" aria-label="关闭导航遮罩" onClick={() => setMobile(false)} />}
      <aside className={`sp-sidebar ${mobile ? "is-open" : ""}`} aria-label="工作区侧栏">
        <div className="sp-workspace-title"><button className="sp-workspace-name" aria-label={`${title} 工作区菜单`} aria-expanded={menu === "organizations"} onClick={e => open("organizations", e.currentTarget)}><strong>{title}</strong><ChevronDown /></button><button className="sp-icon-button" aria-label="自定义工作区" title="自定义工作区" onClick={settings}><Settings /></button><button className="sp-mobile-close sp-icon-button" aria-label="关闭导航" onClick={() => setMobile(false)}><X /></button></div>
        <div className="sp-sidebar-scroll">
          <nav className="sp-mobile-global" aria-label="移动端主导航">{navItems.map(item => { const Icon = icons[item]; return <button key={item} aria-current={!navigation.route?.householdId && view === item ? "page" : undefined} onClick={() => go(item, true)}><Icon /><span>{globalLabels[item]}</span></button>; })}<button onClick={e => open("more", e.currentTarget)}><MoreHorizontal /><span>更多</span></button></nav>
          <label className="sp-find"><Search /><input aria-label="查找小组" placeholder="查找小组…" value={groupQuery} onChange={e => setGroupQuery(e.target.value)} /></label>
          <details className="sp-sidebar-section" open><summary><ChevronDown /><span>已加星标</span></summary>{groups.filter(h => favorite.includes(h.id)).map(h => <button key={h.id} onClick={() => { selectHousehold(h.id); setMobile(false); }}><Hash /><span>{h.name}</span></button>)}{!data?.households.some(h => favorite.includes(h.id)) && <p>给常用的小组加个星标</p>}</details>
          <details className="sp-sidebar-section sp-channel-section" open><summary><ChevronDown /><span>Households</span></summary>{groups.map(h => <button key={h.id} aria-pressed={household?.id === h.id} onClick={() => { selectHousehold(h.id); setMobile(false); }}><Hash /><span>{h.name}</span></button>)}</details>
          {!groups.length && <p className="sp-sidebar-empty">{groupQuery ? "没有找到这个小组" : "还没有加入小组"}</p>}
        </div>
        <div className="sp-sidebar-footer"><button className="sp-mobile-profile sp-icon-button" aria-label="个人资料与身份" onClick={e => open("profile", e.currentTarget)}><Avatar user={user} /></button><button onClick={settings}><Settings />工作区设置</button><button className="sp-icon-button" aria-label="收起侧栏" title="收起侧栏" onClick={() => { setMobile(false); setPreferences(p => ({ ...p, collapsed: true })); }}><PanelLeftClose /></button></div>
      </aside>
      <div className="sp-main">
        <header className="sp-channel-header"><div>{preferences.collapsed && <button className="sp-icon-button" aria-label="展开侧栏" onClick={() => setPreferences(p => ({ ...p, collapsed: false }))}><PanelLeftOpen /></button>}{household && !query && <button className="sp-icon-button sp-star" aria-label={starred ? "取消小组星标" : "将小组加星标"} aria-pressed={starred} onClick={toggleStar}><Star fill={starred ? "currentColor" : "none"} /></button>}<h1>{query ? "工作区搜索" : household ? <><Hash />{household.name}</> : globalTitle}</h1>{!household && !query && <span className="sp-header-context">{title}</span>}</div>{household && !query && <div className="sp-channel-tools"><button className="sp-member-count" aria-label="查看小组成员" onClick={() => go("household")}><Avatar user={data?.users.find(u => u.id === household.hostId)} /><span>{memberCount ?? "—"}</span></button><button className="sp-icon-button" aria-label="小组菜单" onClick={e => open("channel", e.currentTarget)}><MoreHorizontal /></button></div>}</header>
        {household && !query && <nav className="sp-page-tabs" aria-label="小组内容导航">{(["overview", ...(role === "ops" ? [] : [work]), "calendar", "household", "journey"] as View[]).map(item => { const Icon = item === "overview" ? MessageCircle : icons[item]; return <button key={item} aria-current={view === item ? "page" : undefined} onClick={() => go(item)}><Icon />{item === "overview" ? "本周" : item === "household" ? "成员" : viewLabels[item]}</button>; })}</nav>}
        {children}
      </div>
    </div>
    {menu && <Popover key={menu} anchor={anchor} label={{ organizations: "切换工作区", history: "历史记录", more: "更多功能", profile: "个人资料", help: "帮助", channel: "小组菜单" }[menu]} onClose={() => setMenu(undefined)} className={menu === "organizations" ? "sp-workspace-picker" : ""}>
      {menu === "organizations" && <><div className="sp-popover-heading"><strong>工作区</strong><small>切换机构</small></div>{(data?.organizations || []).map(org => <button className="sp-workspace-option" key={org.id} aria-pressed={org.id === organization?.id} onClick={() => menuAction(() => selectOrganization(org.id))}><span className="sp-workspace-tile" style={{ background: org.color }}>{org.initials}</span><span><strong>{org.name}</strong><small>{org.id === organization?.id ? "当前工作区" : "打开工作区"}</small></span>{org.id === organization?.id && <Check />}</button>)}<div className="sp-popover-divider" /><button onClick={() => menuAction(settings)}><Settings />工作区偏好设置</button></>}
      {menu === "history" && <><div className="sp-popover-heading"><strong>历史记录</strong><small>最近访问</small></div>{navigation.recent.map(visit => <button key={visit.href} onClick={() => menuAction(() => navigation.go(readRoute(visit.href, role), visit.title))}><Clock3 /><span>{visit.title}</span></button>)}</>}
      {menu === "more" && <>{preferences.order.filter(v => v !== "journey" && allowed(v) && preferences.hidden.includes(v)).map(item => { const Icon = icons[item]; return <button key={item} onClick={() => go(item, true)}><Icon />{globalLabels[item]}</button>; })}<button onClick={() => menuAction(settings)}><Settings />工作区设置</button></>}
      {menu === "profile" && <><div className="sp-profile-summary"><Avatar user={user} presence={offline ? "offline" : "online"} /><div><strong>{user?.name}</strong><small>{offline ? "离线" : "在线"}</small></div></div><label className="sp-profile-role">本地演示身份<select aria-label="切换演示身份" value={role} onChange={e => { location.href = `/${e.target.value}?org=${navigation.route?.organizationId}`; }}><option value="learn">学员</option><option value="host">Host</option><option value="ops">运营</option></select></label><button onClick={() => menuAction(settings)}><Settings />偏好设置</button></>}
      {menu === "help" && <><div className="sp-popover-heading"><strong>{title} 工作区</strong></div><p className="sp-popover-copy">左上角切换机构。最左侧查看机构汇总，侧栏选择小组，小组内的标签只显示该组内容。使用顶部箭头返回之前的页面，历史记录可以重新打开最近访问的内容。</p><p className="sp-popover-copy">⌘ / Ctrl + K 搜索<br />草稿会自动保存在当前工作区。</p></>}
      {menu === "channel" && <><button onClick={() => menuAction(toggleStar)}><Star />{starred ? "取消星标" : "加入星标"}</button><button onClick={() => go("household")}><UsersRound />查看成员</button><button onClick={() => go("calendar")}><CalendarDays />查看日程</button><button onClick={() => menuAction(settings)}><Settings />工作区偏好设置</button></>}
    </Popover>}
  </>;
}
