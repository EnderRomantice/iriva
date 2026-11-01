"use client";
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Hash, ListTodo, TrendingUp, UsersRound, Video } from 'lucide-react';
import { dateLabel, timeLabel } from './primitives';
import { dashboardData } from './dashboard-data';
import type { ViewProps } from './views';

export function OrganizationHome({ data, role, openSession, openPractice, navigate, selectHousehold }: ViewProps & { selectHousehold: (id: string) => void }) {
  const [now, setNow] = useState(() => Date.parse(data.serverTime));
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 60000); window.addEventListener('focus', tick); return () => { clearInterval(timer); window.removeEventListener('focus', tick); }; }, []);
  const user = data.users.find(u => u.id === data.actor.userId);
  const tz = user?.timezone || 'Asia/Shanghai';
  const stats = dashboardData(data, now);
  const newApplications = data.applications.filter(a => a.status === 'new');
  const taskCount = role === 'ops' ? newApplications.length : stats.tasks.length;
  return <section className="sp-dashboard" aria-label="学习概览">
    <header className="sp-dashboard-heading"><div><h2>欢迎回来，{user?.name || '朋友'}。</h2><p>{role === 'learn' ? '你的学习进度和接下来的安排，都在这里。' : '查看各小组的进度与待办安排。'}</p></div><span>{new Intl.DateTimeFormat('zh-CN', { timeZone: tz, month: 'long', day: 'numeric', weekday: 'long' }).format(now)}</span></header>
    <div className="sp-dashboard-metrics">
      <div><span><UsersRound/>参与小组</span><strong>{stats.groups.length}<small>个</small></strong><p>{role === 'learn' ? '当前工作区内的小组' : '当前可管理的小组'}</p></div>
      <div><span><CheckCircle2/>任务完成率</span><strong>{stats.completion === null ? '—' : `${stats.completion}%`}</strong><p>{stats.completed} / {stats.total} 项已完成</p></div>
      <div><span><TrendingUp/>综合分数</span><strong>{stats.score ?? '—'}<small>/ 100</small></strong><p>{stats.total ? '按实际任务进度计算' : '发布任务后开始计算'}</p></div>
      <div><span><Video/>iriva meeting</span><strong>{stats.meetingsThisWeek}<small>场</small></strong><p>未来 7 天的安排</p></div>
    </div>
    <section className="sp-dashboard-panel sp-dashboard-groups"><header><h3>小组进度 <span>{stats.groups.length}</span></h3>{role === 'learn' && <button onClick={() => navigate('hosts')}>寻找 Host <ArrowRight/></button>}</header>
      {stats.groups.length ? <div className="sp-dashboard-group-list"><div className="sp-dashboard-group-columns" aria-hidden="true"><span>小组 / 学期</span><span>任务完成</span><span>iriva meeting</span><span>综合分数</span></div>{stats.groups.map(g => <button className="sp-dashboard-group-row" key={g.household.id} onClick={() => selectHousehold(g.household.id)}><span className="sp-dashboard-group-name"><Hash/><span><strong>{g.household.name}</strong><small>{g.termLabel}</small></span></span><span className="sp-dashboard-progress"><span>{g.completed} / {g.total}<small>{g.progress}%</small></span><progress value={g.completed} max={g.total || 1} aria-label={`${g.household.name} 任务完成率`}/></span><span className="sp-dashboard-meeting-progress">{g.meetingsCompleted} / {g.meetingsTotal}<small>场已完成</small></span><span className="sp-dashboard-score">{g.score ?? '—'}<ArrowRight/></span></button>)}</div> : <div className="sp-dashboard-empty"><UsersRound/><strong>还没有加入小组</strong><p>{role === 'learn' ? '与 Host 约谈后，运营会为你安排小组。加入后可在这里查看进度。' : '建立小组后，进度会显示在这里。'}</p></div>}
      <details className="sp-dashboard-scoring"><summary>分数如何计算</summary><p>综合分数 = 任务完成率 × 70 + 正式提交率 × 30。跨小组按任务数量汇总；没有任务时不计分。这是学习进度分，不是语言能力评级。{role === 'host' && ' Host 视图仅统计可见的已提交记录。'}</p></details>
    </section>
    <div className="sp-dashboard-bottom">
      <section className="sp-dashboard-panel"><header><h3><ListTodo/>{role === 'ops' ? '待跟进报名' : role === 'host' ? '待反馈 task' : '待办 task'} <span>{taskCount}</span></h3><button onClick={() => navigate(role === 'ops' ? 'applications' : 'tasks')}>查看全部 <ArrowRight/></button></header>
        {role === 'ops' ? newApplications.slice(0,5).map(a => <button className="sp-dashboard-task" key={a.id} onClick={() => navigate('applications')}><span className="sp-dashboard-task-dot"/><span><strong>{data.users.find(u => u.id === a.userId)?.name || '新学员'}</strong><small>{a.goal}</small></span><ArrowRight/></button>) : stats.tasks.slice(0,5).map(({ assignment, submission }) => <button className="sp-dashboard-task" key={`${assignment.id}:${submission?.id || 'todo'}`} onClick={() => openPractice(assignment, submission?.id)}><span className="sp-dashboard-task-dot"/><span><strong>{assignment.title}</strong><small>{data.households.find(h => h.id === assignment.householdId)?.name}{role === 'host' && ` · ${data.users.find(u => u.id === submission?.learnerId)?.name || '学员'}`}</small></span><span className={Date.parse(assignment.dueAt) < now ? 'is-overdue' : ''}>{Date.parse(assignment.dueAt) < now ? '已逾期' : dateLabel(assignment.dueAt,tz)}<small>{role === 'host' ? '待反馈' : '待完成'}</small></span></button>)}
        {!taskCount && <div className="sp-dashboard-empty"><CheckCircle2/><strong>{stats.total ? '当前待办已处理完成' : '暂无待办'}</strong><p>新的任务会出现在这里。</p></div>}
      </section>
      <section className="sp-dashboard-panel"><header><h3><CalendarDays/>iriva meeting <span>{stats.meetings.length}</span></h3><button onClick={() => navigate('calendar')}>查看日程 <ArrowRight/></button></header>
        {stats.meetings.slice(0,4).map(meeting => <button className="sp-dashboard-meeting" key={meeting.id} onClick={() => openSession(meeting)}><span className="sp-dashboard-meeting-date"><strong>{new Intl.DateTimeFormat('zh-CN',{timeZone:tz,day:'numeric'}).format(new Date(meeting.startsAt))}</strong><small>{new Intl.DateTimeFormat('zh-CN',{timeZone:tz,month:'short'}).format(new Date(meeting.startsAt))}</small></span><span><strong>{meeting.title}</strong><small>{data.households.find(h => h.id === meeting.householdId)?.name} · {timeLabel(meeting.startsAt,tz)}–{timeLabel(meeting.endsAt,tz)}</small></span><span className="sp-dashboard-meeting-state">{Date.parse(meeting.startsAt) <= now ? '进行中' : '待开始'}<ArrowRight/></span></button>)}
        {!stats.meetings.length && <div className="sp-dashboard-empty"><CalendarDays/><strong>暂无即将开始的 meeting</strong><p>Host 安排后会自动出现在这里。</p></div>}
        <p className="sp-dashboard-timezone">时间按 {tz} 显示</p>
      </section>
    </div>
  </section>;
}
