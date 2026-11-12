import type { Actor, State } from '../../domain/models';
import { collectionPage,emptyState,accessCTE,viewerValues } from './workspace-queries';
import type { QueryDatabase,Table } from '../repositories/queries';
import { cardCatalog } from './message-cards';
import { rows } from '../repositories/queries';
import { defaultOrganizationId } from '../../domain/workspace';
/** Only references of one bounded page are hydrated; no collection-wide fetches. */
export async function hydratePage(repo:QueryDatabase,actor:Actor,table:Table,items:State[Table][number][]) {
 const related=emptyState();(related[table] as unknown[])=items;
 const need=async(key:Table,ids:string[])=>{
  const unique=[...new Set(ids)].filter(id=>!related[key].some(row=>row.id===id));
  for(let i=0;i<unique.length;i+=100){const page=await collectionPage(repo,actor,key,{ids:unique.slice(i,i+100),limit:100});(related[key] as unknown[]).push(...page.items);}
 };
 if(table==='assignments'&&actor.role==='learn'){
  const ids=related.assignments.map(a=>a.id);if(ids.length)related.submissions.push(...await rows(repo,'submissions',`t.learner_id=? AND t.assignment_id IN (${ids.map(()=>'?').join(',')})`,[actor.userId,...ids],100));
 }
 await need('submissions',related.feedback.map(f=>f.submissionId));
 if(related.submissions.length){const ids=related.submissions.map(s=>s.id);related.feedback.push(...await rows(repo,'feedback',`t.submission_id IN (${ids.map(()=>'?').join(',')}) AND ${actor.role==='learn'?"t.status='published'":'t.author_id=?'}`,[...ids,...(actor.role==='learn'?[]:[actor.userId])],100));}
 await need('assignments',[...related.submissions.map(s=>s.assignmentId),...related.messages.flatMap(m=>(m.cards||[]).filter(c=>c.type==='task').map(c=>c.entityId))]);
 await need('households',[...related.assignments,...related.sessions,...related.memberships,...related.enrollments].map(a=>a.householdId));
 await need('terms',related.households.map(h=>h.termId));
 await need('channels',[...related.messages,...related.channelParticipants].map(m=>m.channelId));
 // The actor's membership makes shared task previews reflect the same SQL permission.
 if(related.households.length){const ids=related.households.map(h=>h.id);related.memberships.push(...await rows(repo,'memberships',`t.household_id IN (${ids.map(()=>'?').join(',')}) AND t.user_id=?`,[...ids,actor.userId],100));}
 if(table==='channels'){const ids=(items as State['channels']).filter(c=>c.kind==='direct').map(c=>c.id);if(ids.length)related.channelParticipants.push(...await rows(repo,'channelParticipants',`t.channel_id IN (${ids.map(()=>'?').join(',')})`,ids,300));}
 await need('users',[...related.messages.map(m=>m.authorId),...related.submissions.map(s=>s.learnerId),...related.feedback.map(f=>f.authorId),...related.households.map(h=>h.hostId),...related.applications.map(a=>a.userId),...related.memberships.map(m=>m.userId),...related.enrollments.map(e=>e.userId),...related.channelParticipants.map(p=>p.userId)]);
 if(related.users.length){const ids=related.users.map(u=>u.id);related.organizationMemberships.push(...await rows(repo,'organizationMemberships',`t.organization_id=? AND t.user_id IN (${ids.map(()=>'?').join(',')})`,[actor.organizationId||defaultOrganizationId,...ids],300));}
 const sharedIds=[...new Set(related.messages.flatMap(m=>(m.cards||[]).filter(c=>c.type==='group').map(c=>c.entityId)))];
 const shared:State['households']=[];
 for(let i=0;i<sharedIds.length;i+=100){const ids=sharedIds.slice(i,i+100);shared.push(...await rows(repo,'households',`t.organization_id=? AND t.id IN (${ids.map(()=>'?').join(',')})`,[actor.organizationId||defaultOrganizationId,...ids],100));}
 return {related,cardCatalog:cardCatalog({...related,households:[...related.households,...shared]},actor)};
}
