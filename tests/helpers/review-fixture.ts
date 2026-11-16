import { randomUUID } from 'node:crypto';
import type { DatabaseRepository } from '../../server/repositories/database-repository';
import { defaultOrganizationId } from '../../domain/workspace';
export async function reviewFixture(repo:DatabaseRepository){
 const ids={host:randomUUID(),learner:randomUUID(),peer:randomUUID(),outsider:randomUUID(),team:randomUUID(),house:randomUUID(),term:randomUUID(),session:randomUUID(),future:randomUUID(),privateSession:randomUUID()};
 const old='2026-01-01T00:00:00.000Z',now=new Date().toISOString();
 for(const [name,id] of Object.entries(ids).slice(0,5))await repo.saveUser({id,name:`Review ${name}`,email:`${id}@example.test`,timezone:'UTC',avatar:'',createdAt:old,updatedAt:old,version:1});
 await repo.db.prepare('INSERT INTO terms (id,name,starts_on,ends_on,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').run(ids.term,'Review term','2026-01-01','2030-01-01',old,old);
 await repo.saveHousehold({id:ids.house,name:'Sage Household',termId:ids.term,hostId:ids.host,organizationId:defaultOrganizationId,capacity:4,timezone:'UTC',theme:'A small win',createdAt:old,updatedAt:old,version:1});
 for(const key of ['host','learner','peer'] as const)await repo.saveMembership({id:randomUUID(),householdId:ids.house,userId:ids[key],role:key==='host'?'host':'learner',createdAt:old,updatedAt:old,version:1});
 for(const key of ['session','privateSession','future'] as const){const start=key==='future'?'2099-01-01T00:00:00.000Z':'2026-02-01T10:00:00.000Z';await repo.saveSession({id:ids[key],householdId:ids.house,title:key==='session'?'A small win':key,description:'',startsAt:start,endsAt:key==='future'?'2099-01-01T02:00:00.000Z':'2026-02-01T12:00:00.000Z',status:'scheduled',meetingUrl:'',createdAt:old,updatedAt:now,version:1});}
 await repo.db.prepare("UPDATE sessions SET kind='one-to-one',participant_id=? WHERE id=?").run(ids.peer,ids.privateSession);
 return ids;
}
