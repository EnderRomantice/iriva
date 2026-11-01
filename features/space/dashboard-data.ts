import type { Snapshot } from '@/domain/models';
const DAY = 86400000;
export function progressScore(completed: number, submitted: number, total: number) {
  return total ? Math.round(70 * completed / total + 30 * submitted / total) : null;
}
// Uses only the authorized workspace snapshot; learners never aggregate peers' submissions.
export function dashboardData(data: Snapshot, now: number) {
  const groups = data.households.map(household => {
    const assignments = data.assignments.filter(a => a.householdId === household.id);
    const learners = new Set(data.memberships.filter(m => m.householdId === household.id && m.role === 'learner' && (data.actor.role !== 'learn' || m.userId === data.actor.userId)).map(m => m.userId));
    const rows = assignments.flatMap(assignment => [...learners].map(id => ({ assignment, submission: data.submissions.find(s => s.assignmentId === assignment.id && s.learnerId === id) })));
    const total = rows.length, completed = rows.filter(r => r.submission?.completed).length, submitted = rows.filter(r => r.submission?.status === 'submitted').length;
    const meetings = data.sessions.filter(s => s.householdId === household.id && s.status !== 'cancelled');
    const term = data.terms.find(t => t.id === household.termId);
    const start = term ? Date.parse(`${term.startsOn}T00:00:00Z`) : NaN;
    const end = term ? Date.parse(`${term.endsOn}T23:59:59Z`) : NaN;
    const weeks = Number.isFinite(start + end) && end >= start ? Math.max(1, Math.ceil((end - start - DAY + 1) / (7 * DAY))) : 0;
    const week = weeks ? Math.min(weeks, Math.max(0, Math.floor((now - start) / (7 * DAY)) + 1)) : 0;
    return { household, rows, total, completed, submitted, score: progressScore(completed, submitted, total), progress: total ? Math.round(completed / total * 100) : 0,
      meetingsTotal: meetings.length, meetingsCompleted: meetings.filter(s => s.status === 'completed').length,
      termLabel: !weeks ? '学期待安排' : now < start ? '尚未开始' : now > end ? '学期已结束' : `第 ${week} / ${weeks} 周` };
  });
  const total = groups.reduce((sum, g) => sum + g.total, 0), completed = groups.reduce((sum, g) => sum + g.completed, 0), submitted = groups.reduce((sum, g) => sum + g.submitted, 0);
  const tasks = groups.flatMap(g => g.rows).filter(r => data.actor.role === 'host'
    ? r.submission?.status === 'submitted' && !data.feedback.some(f => f.submissionId === r.submission?.id && f.status === 'published')
    : !r.submission?.completed).sort((a,b) => Date.parse(a.assignment.dueAt) - Date.parse(b.assignment.dueAt));
  const meetings = data.sessions.filter(s => groups.some(g => g.household.id === s.householdId) && s.status === 'scheduled' && Date.parse(s.endsAt) > now).sort((a,b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return { groups, total, completed, submitted, score: progressScore(completed, submitted, total), completion: total ? Math.round(completed / total * 100) : null,
    tasks, meetings, meetingsThisWeek: meetings.filter(s => Date.parse(s.startsAt) <= now + 7 * DAY).length };
}
