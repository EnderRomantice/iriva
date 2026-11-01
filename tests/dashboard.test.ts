import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Snapshot } from '../domain/models';
import { dashboardData } from '../features/space/dashboard-data';
const now = Date.parse('2026-11-02T12:00:00Z');
const meta = { version: 1, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
function fixture(): Snapshot {
  return {
    actor: { role: 'learn', userId: 'me' }, serverTime: new Date(now).toISOString(), organizations: [], organizationMemberships: [], users: [], channels: [], channelParticipants: [], messages: [], applications: [], enrollments: [], feedback: [],
    terms: [{ ...meta, id: 'term', name: 'Term', startsOn: '2026-11-01', endsOn: '2026-12-13' }],
    households: ['a','b'].map(id => ({ ...meta, id, name: id, termId: 'term', hostId: 'host', timezone: 'Asia/Shanghai', capacity: 4, theme: '' })),
    memberships: ['a','b'].flatMap(householdId => ['me','peer'].map(userId => ({ ...meta, id: `${householdId}-${userId}`, householdId, userId, role: 'learner' as const }))),
    assignments: ['a','a','a','b'].map((householdId,i) => ({ ...meta, id: `task-${i}`, householdId, title: `Task ${i}`, description: '', category: 'practice', dueAt: `2026-11-0${i+1}T08:00:00Z`, week: 1 })),
    submissions: [{ ...meta, id:'s1', assignmentId:'task-0', learnerId:'me', body:'Done', completed:true, status:'submitted' }, { ...meta, id:'s2', assignmentId:'task-1', learnerId:'me', body:'Draft', completed:true, status:'draft' }, { ...meta, id:'s3', assignmentId:'task-3', learnerId:'peer', body:'Peer', completed:true, status:'submitted' }],
    sessions: [
      { ...meta,id:'ongoing',householdId:'a',title:'Now',description:'',startsAt:'2026-11-02T11:00:00Z',endsAt:'2026-11-02T13:00:00Z',status:'scheduled',meetingUrl:'' },
      { ...meta,id:'past',householdId:'a',title:'Past',description:'',startsAt:'2026-11-01T11:00:00Z',endsAt:'2026-11-01T13:00:00Z',status:'scheduled',meetingUrl:'' },
      { ...meta,id:'done',householdId:'a',title:'Done',description:'',startsAt:'2026-11-01T09:00:00Z',endsAt:'2026-11-01T10:00:00Z',status:'completed',meetingUrl:'' },
      { ...meta,id:'cancelled',householdId:'b',title:'Cancelled',description:'',startsAt:'2026-11-03T09:00:00Z',endsAt:'2026-11-03T10:00:00Z',status:'cancelled',meetingUrl:'' },
      { ...meta,id:'later',householdId:'b',title:'Later',description:'',startsAt:'2026-11-12T09:00:00Z',endsAt:'2026-11-12T10:00:00Z',status:'scheduled',meetingUrl:'' },
    ]
  };
}
test('dashboard aggregates task-weighted progress without counting peers or drafts as submissions', () => {
  const stats = dashboardData(fixture(),now);
  assert.equal(stats.total,4); assert.equal(stats.completed,2); assert.equal(stats.submitted,1);
  assert.equal(stats.completion,50); assert.equal(stats.score,43);
  assert.deepEqual(stats.groups.map(g => g.score),[57,0]);
  assert.equal(stats.groups[0].termLabel,'第 1 / 6 周');
  assert.deepEqual(stats.tasks.map(r=>r.assignment.id),['task-2','task-3']);
});
test('meeting summaries include ongoing sessions, exclude cancelled and elapsed scheduled sessions', () => {
  const stats = dashboardData(fixture(),now);
  assert.deepEqual(stats.meetings.map(s=>s.id),['ongoing','later']); assert.equal(stats.meetingsThisWeek,1);
  assert.equal(stats.groups[0].meetingsCompleted,1); assert.equal(stats.groups[0].meetingsTotal,3);
  assert.equal(stats.groups[1].meetingsTotal,1);
});
test('new learner dashboard has no fabricated score or completion and Host backlog uses published feedback', () => {
  const empty=fixture(); empty.households=[]; empty.sessions=[];
  const stats=dashboardData(empty,now); assert.equal(stats.score,null); assert.equal(stats.completion,null); assert.equal(stats.tasks.length,0);
  const host=fixture(); host.actor={role:'host',userId:'host'};
  host.feedback=[{...meta,id:'feedback',submissionId:'s1',authorId:'host',body:'Great',status:'published'}];
  assert.deepEqual(dashboardData(host,now).tasks.map(r=>r.submission?.id),['s3']);
});
