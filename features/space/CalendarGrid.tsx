"use client";
import { useCollection } from "@/local/use-collection";
import { PageControls } from "./PageControls";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Assignment, Role, Session, Snapshot, Term } from "@/domain/models";
import { timeLabel } from "./primitives";

/** All calendar dates are Beijing dates; keys are YYYY-MM-DD. */
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });
const partsFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", weekday: "short" });
export const dayKey = (value: string | number | Date) => dayFormat.format(new Date(value));
const midnight = (key: string) => Date.parse(`${key}T00:00:00+08:00`);
export const DAY = 86400000;
export interface CalendarDay { key: string; month: string; day: string; weekday: string }
export function calendarDay(time: number): CalendarDay {
  const parts = Object.fromEntries(partsFormat.formatToParts(time).map(p => [p.type, p.value]));
  return { key: dayKey(time), month: parts.month, day: parts.day, weekday: parts.weekday };
}

export type EventKind = "meeting" | "review" | "task" | "due" | "plan";
export interface CalendarEvent { id: string; day: string; kind: EventKind; label: string; title: string; time?: string; session?: Session; assignment?: Assignment }

export const termWeekStart = (term: Term, week: number) => midnight(term.startsOn) + (week - 1) * 7 * DAY;
/** 验收日 = the last scheduled iriva meeting in week 6 of each term (the graduation share). */
function reviewSessions(data: Snapshot) {
  const ids = new Set<string>();
  for (const term of data.terms) {
    const households = new Set(data.households.filter(h => h.termId === term.id).map(h => h.id));
    const from = termWeekStart(term, 6), to = from + 7 * DAY;
    const byHousehold = new Map<string, Session>();
    for (const s of data.sessions) {
      const t = Date.parse(s.startsAt);
      if (!households.has(s.householdId) || s.status === "cancelled" || t < from || t >= to) continue;
      const current = byHousehold.get(s.householdId);
      if (!current || s.startsAt > current.startsAt) byHousehold.set(s.householdId, s);
    }
    byHousehold.forEach(s => ids.add(s.id));
  }
  return ids;
}
export function calendarEvents(data: Snapshot, role: Role): CalendarEvent[] {
  const many = data.households.length > 1;
  const group = (householdId: string) => many ? ` · ${data.households.find(h => h.id === householdId)?.name || ""}` : "";
  const review = reviewSessions(data);
  const events: CalendarEvent[] = [];
  for (const s of data.sessions) {
    if (s.status === "cancelled") continue;
    const kind = review.has(s.id) ? "review" : "meeting";
    events.push({ id: s.id, day: dayKey(s.startsAt), kind, label: kind === "review" ? "验收日" : "iriva meeting", title: `${s.title}${group(s.householdId)}`, time: timeLabel(s.startsAt), session: s });
  }
  for (const a of data.assignments) {
    const household = data.households.find(h => h.id === a.householdId), term = data.terms.find(t => t.id === household?.termId);
    if (term) events.push({ id: `${a.id}:start`, day: dayKey(termWeekStart(term, a.week)), kind: "task", label: "任务开始", title: `${a.title}${group(a.householdId)}`, assignment: a });
    events.push({ id: `${a.id}:due`, day: dayKey(a.dueAt), kind: "due", label: "任务截止", title: `${a.title}${group(a.householdId)}`, time: timeLabel(a.dueAt), assignment: a });
  }
  for (const term of data.terms) events.push({ id: `${term.id}:end`, day: term.endsOn, kind: "plan", label: role === "learn" ? "套餐到期" : "学期结束", title: term.name });
  const order: Record<EventKind, number> = { plan: 0, review: 1, meeting: 2, task: 3, due: 4 };
  return events.sort((a, b) => order[a.kind] - order[b.kind] || (a.time || "").localeCompare(b.time || ""));
}

interface GridProps {
  weeks: CalendarDay[][]; events: CalendarEvent[]; label?: (week: number) => React.ReactNode; currentWeek?: number;
  muted?: (day: CalendarDay) => boolean; onSession: (s: Session) => void; onAssignment: (a: Assignment) => void;
}
export function CalendarGrid({ weeks, events, label, currentWeek, muted, onSession, onAssignment }: GridProps) {
  const today = dayKey(Date.now());
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.day, [...byDay.get(e.day) || [], e]);
  return <div className={`sp-cal${label ? "" : " sp-cal-plain"}`} role="grid">
    <div className="sp-cal-head" role="row">{label && <span aria-hidden="true" />}{weeks[0].map(d => <span role="columnheader" key={d.weekday}>{d.weekday}</span>)}</div>
    {weeks.map((days, w) => <div className="sp-cal-week" role="row" key={days[0].key} aria-current={w === currentWeek ? "true" : undefined}>
      {label && <div className="sp-cal-label" role="rowheader">{label(w)}</div>}
      {days.map((d, i) => {
        const list = byDay.get(d.key) || [];
        const first = d.day === "1" || (w === 0 && i === 0);
        return <div role="gridcell" key={d.key} aria-label={`${d.month}月${d.day}日 ${d.weekday}`} className={`sp-cal-day${d.key === today ? " is-today" : ""}${d.key < today ? " is-past" : ""}${muted?.(d) ? " is-outside" : ""}${list.length ? " has-events" : ""}`}>
          <span className="sp-cal-date" aria-current={d.key === today ? "date" : undefined}><span className="sp-cal-weekday">{d.weekday}</span>{first ? `${d.month}月${d.day}日` : d.day}{d.key === today && " 今天"}</span>
          {d.key === today && !list.length && <span className="sp-caption">今天暂无日程</span>}
          {list.map(e => {
            const content = <>
              <span className="sp-cal-event-meta">{e.time && <time>{e.time}</time>}{e.label}</span>
              <span>{e.title}</span>
            </>;
            const open = e.session ? () => onSession(e.session!) : e.assignment ? () => onAssignment(e.assignment!) : undefined;
            return open ? <button key={e.id} className={`sp-cal-event is-${e.kind}`} onClick={open}>{content}</button>
              : <span key={e.id} className={`sp-cal-event is-${e.kind}`}>{content}</span>;
          })}
        </div>;
      })}
    </div>)}
  </div>;
}

/** Month view, Monday first, with previous/next navigation. */
export function MonthCalendar({ data, role, onSession, onAssignment }: { data: Snapshot; role: Role; onSession: (s: Session) => void; onAssignment: (a: Assignment) => void }) {
  const [anchor, setAnchor] = useState(() => dayKey(Date.now()).slice(0, 7));
  const [year, month] = anchor.split("-").map(Number);
  const firstOfMonth = midnight(`${anchor}-01`);
  const weekday = (new Date(firstOfMonth + 8 * 3600000).getUTCDay() + 6) % 7; // Monday = 0, in Beijing
  const start = firstOfMonth - weekday * DAY;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = Math.ceil((weekday + daysInMonth) / 7);
  const weeks = Array.from({ length: rows }, (_, w) => Array.from({ length: 7 }, (_, d) => calendarDay(start + (w * 7 + d) * DAY + 12 * 3600000)));
  const shift = (delta: number) => { const date = new Date(Date.UTC(year, month - 1 + delta, 1)); setAnchor(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`); };
  const thisMonth = dayKey(Date.now()).slice(0, 7);
  const range={from:new Date(start).toISOString(),to:new Date(start+rows*7*DAY).toISOString(),householdId:data.households.length===1?data.households[0].id:undefined};
  const sessions=useCollection(data,'sessions',range),assignments=useCollection(data,'assignments',range);
  data={...sessions.data,...assignments.data,sessions:sessions.items,assignments:assignments.items};
  const events = calendarEvents(data, role);
  const hasMonthlyEvents = events.some(e => e.day.startsWith(anchor));
  return <>
    <div className="sp-cal-toolbar"><strong>{year} 年 {month} 月</strong><div><button className="sp-icon-button" aria-label="上个月" onClick={() => shift(-1)}><ChevronLeft /></button>{anchor !== thisMonth && <button onClick={() => setAnchor(thisMonth)}>今天</button>}<button className="sp-icon-button" aria-label="下个月" onClick={() => shift(1)}><ChevronRight /></button></div></div>
    {!hasMonthlyEvents && <p className="sp-cal-empty" role="status">{month} 月暂无已安排的日程</p>}
    <PageControls page={sessions}/><PageControls page={assignments}/><CalendarGrid weeks={weeks} events={events} muted={d => !d.key.startsWith(anchor)} onSession={onSession} onAssignment={onAssignment} />
  </>;
}
