import type { Actor, Snapshot } from '../../domain/models';
import type { QueryDatabase } from '../repositories/queries';
import { accessCTE,viewerValues } from './workspace-queries';
export async function workspaceStats(repo:QueryDatabase,actor:Actor,groupIds:string[]):Promise<NonNullable<Snapshot['stats']>> {
 const now=new Date().toISOString(),week=new Date(Date.now()+7*86400000).toISOString();
 const result=await repo.db.prepare(`${accessCTE}, group_stats AS (
 SELECT h.id,
 (SELECT count(*) FROM assignments a WHERE a.household_id=h.id)*(SELECT count(*) FROM memberships m WHERE m.household_id=h.id AND m.role='learner' AND ((SELECT role FROM viewer)<>'learn' OR m.user_id=(SELECT user_id FROM viewer))) AS total,
 (SELECT count(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN memberships m ON m.household_id=a.household_id AND m.user_id=s.learner_id AND m.role='learner' WHERE a.household_id=h.id AND s.id IN (SELECT id FROM visible_submissions) AND s.completed=1) AS completed,
 (SELECT count(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN memberships m ON m.household_id=a.household_id AND m.user_id=s.learner_id AND m.role='learner' WHERE a.household_id=h.id AND s.id IN (SELECT id FROM visible_submissions) AND s.status='submitted') AS submitted,
 (SELECT count(*) FROM sessions s WHERE s.household_id=h.id AND s.status<>'cancelled') AS meetings_total,
 (SELECT count(*) FROM sessions s WHERE s.household_id=h.id AND s.status='completed') AS meetings_completed,
 (SELECT count(*) FROM sessions s WHERE s.household_id=h.id AND s.status='scheduled' AND s.ends_at>? AND s.starts_at<=?) AS meetings_this_week,
 (SELECT count(*) FROM memberships m WHERE m.household_id=h.id AND m.role='learner') AS learners,
 (SELECT count(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.household_id=h.id AND s.id IN (SELECT id FROM visible_submissions) AND s.status='submitted' AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.submission_id=s.id AND f.status='published')) AS waiting
 FROM households h WHERE h.id IN (SELECT id FROM allowed_groups))
 SELECT id,total,completed,submitted,meetings_total,meetings_completed,meetings_this_week,learners,waiting,1 AS groups FROM group_stats WHERE id IN (${groupIds.length?groupIds.map(()=>'?').join(','):"''"})
 UNION ALL SELECT '',coalesce(sum(total),0),coalesce(sum(completed),0),coalesce(sum(submitted),0),coalesce(sum(meetings_total),0),coalesce(sum(meetings_completed),0),coalesce(sum(meetings_this_week),0),coalesce(sum(learners),0),coalesce(sum(waiting),0),count(*) FROM group_stats`).all(...viewerValues(actor),now,week,...groupIds);
 const numeric=(row:Record<string,unknown>)=>({total:Number(row.total),completed:Number(row.completed),submitted:Number(row.submitted),meetingsTotal:Number(row.meetings_total),meetingsCompleted:Number(row.meetings_completed),meetingsThisWeek:Number(row.meetings_this_week),learners:Number(row.learners),waiting:Number(row.waiting),groupCount:Number(row.groups)});
 return {groups:Object.fromEntries(result.filter(r=>r.id).map(r=>[r.id,numeric(r)])),...numeric(result.find(r=>!r.id))};
}
