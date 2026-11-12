import type { Actor, State } from '../../domain/models';
import type { Command } from '../../domain/commands';
import { defaultOrganizationId } from '../../domain/workspace';
import { one, rows, type QueryDatabase, type Table } from '../repositories/queries';
import { authorize, emptyState } from './workspace-queries';

/** Load only the command's targets, dependencies and conflicting records inside its transaction. */
export async function commandState(repo:QueryDatabase,actor:Actor,command:Command):Promise<State> {
 await authorize(repo,actor);
 const state=emptyState(),org=actor.organizationId||defaultOrganizationId;
 const add=async<K extends Table>(table:K,where:string,values:unknown[],limit=1)=>{
  const found=await rows(repo,table,where,values,limit);
  for(const row of found)if(!state[table].some(r=>r.id===row.id))(state[table] as unknown[]).push(row);
  return found;
 };
 const id=async(table:Table,value:string|undefined)=>{if(value)await add(table,'t.id=?',[value]);};
 await id('users',actor.userId);
 await id('organizations',org);
 await add('organizationMemberships','t.organization_id=? AND t.user_id=? AND t.role=?',[org,actor.userId,actor.role]);
 const target:Table=command.kind.startsWith('message.')?'messages':command.kind==='channel.create'||command.kind==='conversation.open'?'channels':command.kind==='submission.save'?'submissions':command.kind==='feedback.save'?'feedback':command.kind.startsWith('session.')?'sessions':command.kind==='assignment.create'?'assignments':command.kind==='household.create'?'households':'applications';
 await id(target,command.entityId);
 switch(command.kind){
  case 'channel.create':
   await add('channels','t.organization_id=? AND t.kind=? AND lower(t.name)=lower(?) AND (t.kind=\'public\' OR t.owner_id=?)',[org,command.payload.kind,command.payload.name,actor.userId]);
   await add('organizations',"t.kind='host' AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id=t.id AND m.user_id=?)",[actor.userId]);break;
  case 'conversation.open':
   await add('organizationMemberships','t.organization_id=? AND t.user_id=?',[org,command.payload.userId]);break;
  case 'message.send':
   await id('channels',command.payload.channelId);
   for(const card of command.payload.cards||[]){
    if(card.type==='user'||card.type==='host'){
     await id('users',card.entityId);
     await add('organizationMemberships','t.organization_id=? AND t.user_id=?',[org,card.entityId],3);
    }else if(card.type==='group')await id('households',card.entityId);
    else if(card.type==='task')await id('assignments',card.entityId);
   }break;
  case 'assignment.create':case 'session.create': await id('households',command.payload.householdId);break;
  case 'submission.save':
   await id('assignments',command.payload.assignmentId);
   await add('submissions','t.assignment_id=? AND t.learner_id=? AND t.id<>?',[command.payload.assignmentId,actor.userId,command.entityId]);break;
  case 'feedback.save':
   await id('submissions',command.payload.submissionId);
   await add('feedback','t.submission_id=? AND t.author_id=? AND t.id<>?',[command.payload.submissionId,actor.userId,command.entityId]);break;
  case 'household.create':
   await add('organizations',"(t.kind='host' OR t.kind='personal') AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id=t.id AND m.user_id=?)",[actor.userId]);
   await add('organizationMemberships',"t.organization_id=? AND t.user_id=? AND t.role='host'",[org,command.payload.hostId]);
   await add('households','t.organization_id=? AND t.term_id=?',[org,command.payload.termId]);
   await add('households','t.organization_id=? AND t.term_id=? AND lower(t.name)=lower(?)',[org,command.payload.termId,command.payload.name]);break;
  case 'application.enroll':await id('households',command.payload.householdId);break;
 }
 for(const message of state.messages)await id('channels',message.channelId);
 for(const channel of state.channels)await add('channelParticipants','t.channel_id=? AND t.user_id=?',[channel.id,actor.userId]);
 for(const feedback of state.feedback)await id('submissions',feedback.submissionId);
 for(const submission of state.submissions)await id('assignments',submission.assignmentId);
 for(const assignment of state.assignments)await id('households',assignment.householdId);
 for(const session of state.sessions)await id('households',session.householdId);
 if(command.kind==='session.create'||command.kind==='session.reschedule'){
  const host=command.kind==='session.create'?actor.userId:state.households.find(h=>h.id===state.sessions.find(s=>s.id===command.entityId)?.householdId)?.hostId;
  if(host){
   await add('sessions',"t.id<>? AND t.status='scheduled' AND t.starts_at<? AND t.ends_at>? AND EXISTS (SELECT 1 FROM households h WHERE h.id=t.household_id AND h.host_id=?)",[command.entityId,command.payload.endsAt,command.payload.startsAt,host]);
   for(const session of state.sessions)await id('households',session.householdId);
  }
 }
 for(const application of state.applications){
  await id('users',application.userId);
  await add('organizationMemberships','t.organization_id=? AND t.user_id=?',[org,application.userId]);
  if(command.kind==='application.enroll'){
   const group=state.households.find(h=>h.id===command.payload.householdId);
   if(group){
    await add('enrollments','t.user_id=? AND t.term_id=?',[application.userId,group.termId]);
    await add('memberships','t.household_id=? AND t.user_id=?',[group.id,application.userId]);
    await add('organizationMemberships','t.organization_id=? AND t.user_id=?',[group.organizationId,application.userId]);
   }
  }
 }
 for(const group of state.households){
  await id('organizations',group.organizationId);
  await id('terms',group.termId);
  await add('memberships','t.household_id=? AND t.user_id=?',[group.id,actor.userId]);
 }
 for(const organization of state.organizations)await add('organizationMemberships','t.organization_id=? AND t.user_id=?',[organization.id,actor.userId],3);
 return state;
}
