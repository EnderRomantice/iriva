"use client";
import { useEffect, useState } from "react";
import type { Application, Assignment, Role, Session, Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { Avatar, dateLabel, timeLabel, Sheet, Empty } from "./primitives";
import { Practice } from "./Practice";
import { memberTime } from "./member-time";
export interface ViewProps {
  data: Snapshot; role: Role; pending: Set<string>; navigate: (view: string) => void;
  openPractice: (assignment: Assignment, submissionId?: string) => void; openSession: (session: Session) => void;
  mutate: (command: Command) => Promise<void>; onlineMutation: (command: Command) => Promise<void>; notify: (message: string) => void;
}
export function Overview(props: ViewProps) {
  const { data, role, openSession, navigate } = props;
  const [finished, setFinished] = useState(false);
  const upcoming = data.sessions.filter(s => s.status === "scheduled" && Date.parse(s.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const nextPractice = data.assignments.filter(a => !data.submissions.some(s => s.assignmentId === a.id && s.learnerId === data.actor.userId && s.completed)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const waiting = data.submissions.filter(s => s.status === "submitted" && !data.feedback.some(f => f.submissionId === s.id && f.status === "published"));
  return <div className="sp-home">
    <div className="sp-welcome"><span>{data.terms[0]?.name || "IRIVA Household"}</span><h1>{role === "learn" ? "在这里，慢慢开口。" : role === "host" ? "让每一种声音被听见。" : "把合适的人，聚在一起。"}</h1><p>{role === "learn" ? `${data.memberships.filter(m => m.role === "learner").length} 位学员，1 位 Host。下一次见面，从你的小故事开始。` : role === "host" ? `${waiting.length} 份练习等待你的回应。` : `${data.applications.filter(a => a.status === "new").length} 位新学员，等待第一次交流。`}</p></div>
    {upcoming && <section className="sp-next"><div><small>下一次圆桌 · {dateLabel(upcoming.startsAt)} · {timeLabel(upcoming.startsAt)} 北京时间</small><h2>{upcoming.title}</h2></div><button onClick={() => openSession(upcoming)}>查看安排</button></section>}
    {role === "learn" ? <div className="sp-home-practice">{finished ? <div className="sp-saved"><h2>已经留下你的进步。</h2><p>可以在练习与反馈中查看保存和同步状态。</p><button onClick={() => { setFinished(false); navigate("tasks"); }}>查看练习</button></div> : nextPractice ? <Practice key={nextPractice.id} {...props} assignment={nextPractice} onSaved={() => setFinished(true)} /> : <Empty>本周练习已经完成。下次圆桌见。</Empty>}</div> : role === "host" ? <Tasks {...props} onlyWaiting /> : <Applications {...props} concise />}
  </div>;
}
export function Tasks(props: ViewProps & { query?: string; onlyWaiting?: boolean }) {
  const { data, role, pending, openPractice, mutate, notify, query = "", onlyWaiting = false } = props;
  const [filter, setFilter] = useState(onlyWaiting ? "todo" : "all");
  const assignments = data.assignments.filter(a => `${a.title} ${a.description}`.toLowerCase().includes(query.toLowerCase()));
  const rows = role === "host" ? data.submissions.filter(s => s.status === "submitted" && assignments.some(a => a.id === s.assignmentId)).map(s => ({ assignment: assignments.find(a => a.id === s.assignmentId)!, submission: s, done: data.feedback.some(f => f.submissionId === s.id && f.status === "published") })) : assignments.map(a => ({ assignment: a, submission: data.submissions.find(s => s.assignmentId === a.id && s.learnerId === data.actor.userId), done: data.submissions.some(s => s.assignmentId === a.id && s.learnerId === data.actor.userId && s.completed) }));
  const visible = rows.filter(r => filter === "all" || (filter === "done" ? r.done : !r.done));
  async function toggle(assignment: Assignment, completed: boolean) {
    const old = data.submissions.find(s => s.assignmentId === assignment.id && s.learnerId === data.actor.userId);
    try { await mutate({ id: crypto.randomUUID(), entityId: old?.id || crypto.randomUUID(), baseVersion: old?.version ?? 0, kind: "submission.save", payload: { assignmentId: assignment.id, body: old?.body || "", status: old?.status || "draft", completed } }); } catch(e) { notify(e instanceof Error ? e.message : "无法保存"); }
  }
  return <section className="sp-task-section"><div className="sp-section-head"><h2>{query ? `“${query}” 的搜索结果` : role === "host" ? "练习反馈" : "我的练习"}</h2><div className="sp-filters" aria-label="练习筛选">{[{ value: "all", label: "全部" }, { value: "todo", label: role === "host" ? "待反馈" : "待完成" }, { value: "done", label: "已完成" }].map(option => <button key={option.value} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div></div>
    <div className="sp-list">{visible.map(({ assignment, submission, done }) => {
      const feedback = data.feedback.find(f => f.submissionId === submission?.id);
      const unsynced = role === "host" ? !!feedback && pending.has(feedback.id) : !!submission && pending.has(submission.id);
      return <div className="sp-task-row" key={submission?.id || assignment.id}>{role === "learn" && <input type="checkbox" aria-label={`完成：${assignment.title}`} checked={done} onChange={e => void toggle(assignment, e.target.checked)} />}<button className="sp-row-content" onClick={() => openPractice(assignment, role === "host" ? submission?.id : undefined)}><strong>{assignment.title}</strong><small>{role === "host" ? data.users.find(u => u.id === submission?.learnerId)?.name : `第 ${assignment.week} 周 · ${dateLabel(assignment.dueAt)}前`}</small></button><span className="sp-row-status">{unsynced ? "待同步" : done ? role === "host" ? "已反馈" : "已完成" : ""}</span><button className="sp-text" onClick={() => openPractice(assignment, role === "host" ? submission?.id : undefined)}>{done ? "查看" : role === "host" ? "回应" : "开始"}</button></div>;
    })}{visible.length === 0 && <Empty>这里暂时没有{query ? "相关练习" : "待办"}。</Empty>}</div>
  </section>;
}
export function Calendar({ data, openSession }: ViewProps) {
  const [scope, setScope] = useState("upcoming");
  const sessions = data.sessions.filter(s => scope === "all" || s.status === "scheduled" && Date.parse(s.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return <section className="sp-page-section"><div className="sp-section-head"><h1>日程</h1><div className="sp-filters"><button aria-pressed={scope === "upcoming"} onClick={() => setScope("upcoming")}>即将开始</button><button aria-pressed={scope === "all"} onClick={() => setScope("all")}>全部</button></div></div><p className="sp-caption">北京时间 · 课程详情包含 Host 当地时间</p><div className="sp-list">{sessions.map(s => <button className="sp-schedule-row" key={s.id} onClick={() => openSession(s)}><span>{dateLabel(s.startsAt)}<small>{timeLabel(s.startsAt)}–{timeLabel(s.endsAt)}</small></span><span><strong>{s.title}</strong><small>{data.households.find(h => h.id === s.householdId)?.name}</small></span><small>{s.status === "completed" ? "已结束" : s.status === "cancelled" ? "已取消" : "查看安排"}</small></button>)}{!sessions.length && <Empty>还没有排定的圆桌。</Empty>}</div></section>;
}
export function Members({ data, activeId }: ViewProps & { activeId?: string }) {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      setNow(new Date());
      timer = setTimeout(tick, 60000 - Date.now() % 60000 + 20);
    };
    tick();
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return <section className="sp-page-section"><h1>Household 伙伴</h1>{data.households.map(h => <details className="sp-household" key={h.id} open={data.households.length === 1 || h.id === activeId}><summary><strong>{h.name}</strong><span>{data.memberships.filter(m => m.householdId === h.id && m.role === "learner").length}/{h.capacity} 位学员</span></summary><p>{h.theme}</p>{data.memberships.filter(m => m.householdId === h.id).map(m => { const user = data.users.find(u => u.id === m.userId); const local = now && memberTime(user?.timezone, now); return <div className="sp-member" key={m.id}><Avatar user={user} /><div className="sp-member-info"><strong>{user?.name}</strong><p className="sp-member-location"><span>{user?.city || "城市未填写"}</span>{local ? <><time dateTime={now?.toISOString()} title={`${local.date} · ${user?.timezone}`}>{local.time}</time><span title={user?.timezone}>{local.offset}</span></> : <span>{now ? "时区未设置" : "读取当地时间…"}</span>}</p></div><small>{m.role === "host" ? "Host" : "学员"}</small></div>; })}</details>)}</section>;
}
export function Journey({ data }: ViewProps) {
  const start = data.terms[0]?.startsOn;
  const week = start ? Math.max(0, Math.min(6, Math.floor((Date.now() - Date.parse(start + "T00:00:00+08:00")) / 604800000) + 1)) : 0;
  return <section className="sp-page-section"><h1>六周旅程</h1><p className="sp-caption">{data.terms[0]?.name}</p><ol className="sp-journey">{["相识", "讲自己的故事", "日常与社交", "表达观点", "走进真实场景", "共同作品", "带着连接出发"].map((label, index) => <li key={label} aria-current={index === week ? "step" : undefined}><span>{index === 0 ? "出发前" : `第 ${index} 周`}</span><strong>{label}</strong><small>{index === week ? "进行中" : index < week ? "已走过" : ""}</small></li>)}</ol></section>;
}
export function SessionDetail({ session, data, role, onlineMutation, notify, onClose }: ViewProps & { session: Session; onClose: () => void }) {
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [start, setStart] = useState(session.startsAt.slice(0, 16)), [end, setEnd] = useState(session.endsAt.slice(0, 16));
  const household = data.households.find(h => h.id === session.householdId), host = data.users.find(u => u.id === household?.hostId);
  async function reschedule(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await onlineMutation({ id: crypto.randomUUID(), entityId: session.id, baseVersion: session.version, kind: "session.reschedule", payload: { startsAt: new Date(start + "Z").toISOString(), endsAt: new Date(end + "Z").toISOString() } }); notify("课程时间已更新。"); onClose(); } catch(e) { setError(e instanceof Error ? e.message : "无法改期"); } finally { setBusy(false); } }
  return <Sheet title="圆桌安排" onClose={onClose}><p className="sp-caption">{household?.name}</p><h2 className="sp-detail-title">{session.title}</h2><p>{session.description}</p><dl className="sp-facts"><dt>北京时间</dt><dd>{dateLabel(session.startsAt)} {timeLabel(session.startsAt)}–{timeLabel(session.endsAt)}</dd><dt>{host?.timezone}</dt><dd>{dateLabel(session.startsAt, host?.timezone)} {timeLabel(session.startsAt, host?.timezone)}</dd><dt>Host</dt><dd>{host?.name}</dd></dl>{session.meetingUrl ? <a className="sp-primary" href={session.meetingUrl} target="_blank" rel="noreferrer">进入会议</a> : <p className="sp-notice">会议链接将在上课前确认。</p>}{role !== "learn" && session.status === "scheduled" && <button onClick={() => setEditing(!editing)}>{editing ? "取消调整" : "调整时间"}</button>}{editing && <form className="sp-form" onSubmit={reschedule}><label>开始时间（UTC）<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></label><label>结束时间（UTC）<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required /></label>{error && <p className="sp-error">{error}</p>}<button className="sp-primary" disabled={busy}>保存安排</button></form>}</Sheet>;
}
export function Applications({ data, onlineMutation, notify, concise = false, query = "" }: ViewProps & { concise?: boolean; query?: string }) {
  const [filter, setFilter] = useState(concise ? "new" : "all"), [selected, setSelected] = useState<Application>();
  const [household, setHousehold] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const labels = { new: "待联系", contacted: "待组班", enrolled: "已入组" };
  const rows = data.applications.filter(a => (filter === "all" || a.status === filter) && `${data.users.find(u => u.id === a.userId)?.name} ${a.goal}`.toLowerCase().includes(query.toLowerCase()));
  async function act(enroll: boolean) {
    if (!selected) return; setBusy(true); setError("");
    try { const base = { id: crypto.randomUUID(), entityId: selected.id, baseVersion: selected.version }; await onlineMutation(enroll ? { ...base, kind: "application.enroll", payload: { householdId: household } } : { ...base, kind: "application.contact", payload: {} }); notify(enroll ? "已加入 Household。" : "联系进度已记录。"); setSelected(undefined); } catch(e) { setError(e instanceof Error ? e.message : "操作失败"); } finally { setBusy(false); }
  }
  return <section className={concise ? "sp-applications" : "sp-page-section"}><div className="sp-section-head"><h2>{concise ? "等待联系" : "报名与组班"}</h2><a className="sp-text" href="/apply">新增报名</a></div><div className="sp-filters sp-filters-space">{[{ value: "all", label: "全部" }, ...Object.entries(labels).map(([value,label]) => ({ value, label })), ...(!concise ? [{ value: "payments", label: "付款记录" }] : [])].map(f => <button key={f.value} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>)}</div>{filter === "payments" ? <div className="sp-list">{data.enrollments.map(e => <div className="sp-payment" key={e.id}><strong>{data.users.find(u => u.id === e.userId)?.name}</strong><span>{data.households.find(h => h.id === e.householdId)?.name}<small>{e.plan}</small></span><span>¥{(e.amountMinor/100).toLocaleString()}</span><small>{e.paymentStatus === "paid" ? "已付款" : "待确认"}</small></div>)}</div> : <div className="sp-list">{rows.map(a => { const user = data.users.find(u => u.id === a.userId); return <button className="sp-application-row" key={a.id} onClick={() => { setSelected(a); setHousehold(""); setError(""); }}><Avatar user={user} /><span><strong>{user?.name}</strong><small>{a.goal}</small></span><small>{labels[a.status]}</small></button>; })}{!rows.length && <Empty>这里暂时没有报名。</Empty>}</div>}
    {selected && <Sheet title="报名详情" onClose={() => setSelected(undefined)}><h2>{data.users.find(u => u.id === selected.userId)?.name}</h2><p className="sp-caption">{data.users.find(u => u.id === selected.userId)?.email}</p><dl className="sp-facts"><dt>学习目标</dt><dd>{selected.goal}</dd><dt>可用时间</dt><dd>{selected.availability}</dd><dt>当前进度</dt><dd>{labels[selected.status]}</dd></dl>{selected.status !== "enrolled" && <><label className="sp-field">安排到 Household<select value={household} onChange={e => setHousehold(e.target.value)}><option value="">选择小组</option>{data.households.map(h => { const n = data.memberships.filter(m => m.householdId === h.id && m.role === "learner").length; return <option key={h.id} value={h.id} disabled={n >= h.capacity}>{h.name} · {n}/{h.capacity}</option>; })}</select></label><p className="sp-caption">母语档 · 每周 1 次 · ¥3,180。入组后付款状态为待确认。</p>{error && <p className="sp-error">{error}</p>}<div className="sp-actions">{selected.status === "new" && <button disabled={busy} onClick={() => void act(false)}>标记已联系</button>}<button className="sp-primary" disabled={!household || busy} onClick={() => void act(true)}>确认入组</button></div></>}</Sheet>}
  </section>;
}
