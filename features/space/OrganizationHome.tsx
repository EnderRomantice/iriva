"use client";
import { ArrowUpRight, Hash } from "lucide-react";
import { Avatar, dateLabel, timeLabel, Empty } from "./primitives";
import type { ViewProps } from "./views";

export function OrganizationHome({ data, role, openSession, navigate, selectHousehold }: ViewProps & { selectHousehold: (id: string) => void }) {
  const user = data.users.find(u => u.id === data.actor.userId);
  const upcoming = data.sessions.filter(s => s.status === "scheduled" && Date.parse(s.endsAt) > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const waiting = role === "ops" ? data.applications.filter(a => a.status === "new").length : role === "host" ? data.submissions.filter(s => s.status === "submitted" && !data.feedback.some(f => f.submissionId === s.id && f.status === "published")).length : data.assignments.filter(a => !data.submissions.some(s => s.assignmentId === a.id && s.learnerId === data.actor.userId && s.completed)).length;
  return <section className="sp-organization-home sp-page-section">
    <div className="sp-organization-greeting"><p className="sp-caption">你的工作区</p><h1>欢迎回来，{user?.name || "朋友"}。</h1><p>从一个小组开始，继续你们的对话。</p></div>
    {waiting > 0 && <button className="sp-work-summary" onClick={() => navigate(role === "ops" ? "applications" : "tasks")}><span>{role === "ops" ? `${waiting} 位新学员等待联系` : role === "host" ? `${waiting} 份练习等待反馈` : `${waiting} 份练习等待完成`}</span><ArrowUpRight /></button>}
    <div className="sp-section-head"><h2>{role === "ops" ? "机构的小组" : "我的小组"}</h2><span className="sp-caption">{data.households.length} 个 Household</span></div>
    <div className="sp-group-list">{data.households.map(h => <button key={h.id} onClick={() => selectHousehold(h.id)}><span className="sp-group-mark"><Hash /></span><span className="sp-group-copy"><strong>{h.name}</strong><small>{h.theme}</small></span><span className="sp-group-host"><Avatar user={data.users.find(u => u.id === h.hostId)} /><small>{data.memberships.filter(m => m.householdId === h.id).length} 位成员</small></span><ArrowUpRight /></button>)}{!data.households.length && <Empty>还没有加入小组。</Empty>}</div>
    {upcoming && <section className="sp-next"><div><small>下一次见面 / {data.households.find(h => h.id === upcoming.householdId)?.name}</small><h2>{upcoming.title}</h2><p className="sp-caption">{dateLabel(upcoming.startsAt)} {timeLabel(upcoming.startsAt)} 北京时间</p></div><button onClick={() => openSession(upcoming)}>查看安排</button></section>}
  </section>;
}
