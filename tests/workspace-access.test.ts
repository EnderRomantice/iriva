import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {defaultOrganizationId} from '../domain/workspace';
import {workspaceAccess,workspaceMembership} from '../server/services/workspace-access';
import {ActivityReviews} from '../server/services/activity-reviews';
import {reviewFixture} from './helpers/review-fixture';

async function fixture(){
 const repo=asyncSqliteRepository(new SqliteRepository(':memory:')),ids=await reviewFixture(repo),now=new Date().toISOString();
 const second=randomUUID(),house=randomUUID();
 await repo.put('organizations',{id:second,name:'Second organization',initials:'S',color:'#123456',kind:'platform',version:1,createdAt:now,updatedAt:now});
 await repo.saveHousehold({id:house,name:'Second Household',termId:ids.term,hostId:ids.host,organizationId:second,capacity:4,timezone:'UTC',theme:'Second topic',version:1,createdAt:now,updatedAt:now});
 await repo.saveMembership({id:randomUUID(),householdId:house,userId:ids.host,role:'host',version:1,createdAt:now,updatedAt:now});
 const host={userId:ids.host,email:`${ids.host}@example.test`,displayName:'Host',authMethod:'email' as const};
 return {repo,ids,second,house,host,now};
}
test('Host sees all organizations and reads the selected membership; revoked and foreign selections are denied',async t=>{
 const {repo,ids,second,house,host}=await fixture();t.after(()=>repo.db.close());
 const access=await workspaceAccess(repo,host,second,true);assert.equal(access.canSwitch,true);assert.equal(access.organization.id,second);assert.equal(access.organizations.length,2);
 assert.equal((await workspaceMembership(repo,host,defaultOrganizationId))?.household,ids.house);
 assert.equal((await workspaceMembership(repo,host,second))?.household,house);
 await assert.rejects(workspaceAccess(repo,host,randomUUID(),true),{status:403});
 await repo.db.prepare('DELETE FROM memberships WHERE household_id=?').run(house);
 await assert.rejects(workspaceAccess(repo,host,second,true),{status:403});
 assert.equal((await workspaceAccess(repo,host,second)).organization.id,defaultOrganizationId,'a stale cookie falls back safely');
});
test('learners cannot select another organization; operations role requires password and is organization-specific',async t=>{
 const {repo,ids,second,host,now}=await fixture();t.after(()=>repo.db.close());
 const learner={userId:ids.learner,email:`${ids.learner}@example.test`,displayName:'Learner',authMethod:'email' as const};
 const access=await workspaceAccess(repo,learner);assert.equal(access.canSwitch,false);assert.deepEqual(access.organizations,[]);
 await assert.rejects(workspaceAccess(repo,learner,second,true),{status:403});
 await repo.db.prepare("INSERT INTO organization_access VALUES (?,?,'admin',?)").run(defaultOrganizationId,ids.host,now);
 assert.equal((await workspaceAccess(repo,host)).organization.role,'host');
 assert.equal((await workspaceAccess(repo,{...host,authMethod:'password'},defaultOrganizationId,true)).organization.role,'admin');
 assert.equal((await workspaceAccess(repo,{...host,authMethod:'password'},second,true)).organization.role,'host');
});
test('Host reviews stay in the selected organization even when the same Host leads both',async t=>{
 const {repo,ids,second,house,host,now}=await fixture();t.after(()=>repo.db.close());
 await repo.saveMembership({id:randomUUID(),householdId:house,userId:ids.outsider,role:'learner',version:1,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:now});
 const session=randomUUID();await repo.saveSession({id:session,householdId:house,title:'Other organization session',description:'',startsAt:'2026-02-01T10:00:00.000Z',endsAt:'2026-02-01T12:00:00.000Z',status:'scheduled',meetingUrl:'',version:1,createdAt:now,updatedAt:now});
 const reviews=new ActivityReviews(repo);
 const first=await reviews.list({userId:host.userId,team:false,organizationId:defaultOrganizationId});
 assert.ok(!JSON.stringify(first).includes(session));
 const other=await reviews.list({userId:host.userId,team:false,organizationId:second});
 assert.ok(JSON.stringify(other).includes(session));assert.ok(!JSON.stringify(other).includes(ids.session));
});
