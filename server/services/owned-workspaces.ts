import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Actor, Organization, Role, User } from '../../domain/models';
import { DomainError } from '../../domain/commands';
import { defaultOrganizationId } from '../../domain/workspace';
import type { DatabaseRepository } from '../repositories/database-repository';

const meta = () => ({ id:randomUUID(), version:1, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200));
function requireRule(ok:unknown, message:string, status=403):asserts ok { if(!ok) throw new DomainError(status,message); }
export async function platformId(repo:DatabaseRepository, organizationId=defaultOrganizationId) {
  const org=(await repo.read()).organizations.find(o=>o.id===organizationId);
  requireRule(org,'工作空间不存在。',404);
  return org.parentId || org.id;
}
async function membership(repo:DatabaseRepository, organizationId:string, userId:string, role:Role) {
  const existing=(await repo.read()).organizationMemberships.find(m=>m.organizationId===organizationId&&m.userId===userId);
  if(existing) {
    if(existing.role!==role) await repo.saveOrganizationMembership({...existing,role,version:existing.version+1,updatedAt:new Date().toISOString()});
  } else await repo.saveOrganizationMembership({...meta(),organizationId,userId,role});
}
export async function ensurePersonalWorkspace(repo:DatabaseRepository,user:User,parentId=defaultOrganizationId) {
  const existing=(await repo.read()).organizations.find(o=>o.ownerId===user.id&&o.isPrimary);
  if(existing) return existing;
  const space:Organization={...meta(),name:`${user.name}的空间`,initials:user.name.slice(0,1),color:'#12658a',kind:'personal',ownerId:user.id,parentId,isPrimary:1};
  await repo.put('organizations',space);
  await membership(repo,space.id,user.id,'learn');
  return space;
}
async function upgradeSpace(repo:DatabaseRepository,space:Organization,user:User,name?:string,existingGroupId?:string) {
  const current={...space,kind:'host' as const,name:name||space.name,version:space.version+1,updatedAt:new Date().toISOString()};
  await repo.put('organizations',current);
  await membership(repo,space.id,user.id,'host');
  const state=await repo.read();
  // Operators can administer groups, but are never added to personal spaces.
  for(const operator of state.organizationMemberships.filter(m=>m.organizationId===space.parentId&&m.role==='ops')) {
    if(operator.userId!==user.id) await membership(repo,space.id,operator.userId,'ops');
  }
  if(existingGroupId) {
    await repo.db.prepare('UPDATE households SET organization_id=? WHERE id=?').run(space.id,existingGroupId);
    for(const member of state.memberships.filter(m=>m.householdId===existingGroupId&&m.userId!==user.id)) await membership(repo,space.id,member.userId,'learn');
  } else if(!state.households.some(h=>h.organizationId===space.id)) {
    const term={...meta(),name:'首期学习',startsOn:new Date().toISOString().slice(0,10),endsOn:new Date(Date.now()+42*86400000).toISOString().slice(0,10)};
    await repo.put('terms',term);
    const group={...meta(),organizationId:space.id,name:current.name,termId:term.id,hostId:user.id,timezone:user.timezone,capacity:12,theme:'一起学习与交流'};
    await repo.saveHousehold(group);
    await repo.saveMembership({...meta(),householdId:group.id,userId:user.id,role:'host'});
  }
  return current;
}
async function extraSpace(repo:DatabaseRepository,user:User,parentId:string,name:string,existingGroupId?:string) {
  const space:Organization={...meta(),name,initials:name.slice(0,1),color:'#12658a',kind:'personal',ownerId:user.id,parentId,isPrimary:0};
  await repo.put('organizations',space);
  return await upgradeSpace(repo,space,user,name,existingGroupId);
}
export async function activateHostGrants(repo:DatabaseRepository,user:User) {
  const grants=(await repo.db.prepare('SELECT platform_id FROM host_grants WHERE email=?').all(user.email.toLowerCase())) as {platform_id:string}[];
  for(const grant of grants) {
    const space=await ensurePersonalWorkspace(repo,user,grant.platform_id);
    requireRule(space.parentId===grant.platform_id,'该账号的个人空间属于其他平台，请联系运营。',409);
    await membership(repo,grant.platform_id,user.id,'host');
    if(space.kind!=='host') await upgradeSpace(repo,space,user);
    await repo.db.prepare('UPDATE host_grants SET user_id=? WHERE platform_id=? AND email=?').run(user.id,grant.platform_id,user.email.toLowerCase());
  }
}
/** One-time conversion preserves group IDs, tasks, messages and personal channel IDs. */
export async function bootstrapOwnedWorkspaces(repo:DatabaseRepository) {
  await repo.transaction(async ()=>{
    if((await repo.db.prepare("SELECT 1 FROM audit_events WHERE kind='workspaces.migrated'").get())) return;
    const state=await repo.read();
    for(const user of state.users) await ensurePersonalWorkspace(repo,user);
    for(const host of state.organizationMemberships.filter(m=>m.role==='host')) {
      const user=state.users.find(u=>u.id===host.userId)!;
      const groups=state.households.filter(h=>h.hostId===user.id&&h.organizationId===host.organizationId);
      let first:Organization|undefined;
      for(const [index,group] of groups.entries()) {
        const primary=await ensurePersonalWorkspace(repo,user);
        const space=index===0&&primary.kind==='personal'&&primary.parentId===host.organizationId
          ? (await upgradeSpace(repo,primary,user,group.name,group.id))
          : (await extraSpace(repo,user,host.organizationId,group.name,group.id));
        first ||= space;
      }
      if(!first) {
        const primary=await ensurePersonalWorkspace(repo,user);
        first=primary.kind==='personal'&&primary.parentId===host.organizationId ? (await upgradeSpace(repo,primary,user)) : primary;
      }
      // Public channels belong to their Host's first group, never the whole platform.
      await repo.db.prepare("UPDATE channels SET organization_id=? WHERE owner_id=? AND organization_id=? AND kind='public'").run(first.id,user.id,host.organizationId);
    }
    for(const user of state.users) {
      const space=await ensurePersonalWorkspace(repo,user);
      await repo.db.prepare("UPDATE channels SET organization_id=? WHERE owner_id=? AND kind='private' AND organization_id IN (SELECT id FROM organizations WHERE kind='platform')").run(space.id,user.id);
    }
    if(state.users[0]) await repo.audit(state.users[0].id,'workspaces.migrated',defaultOrganizationId);
  });
}
async function operator(repo:DatabaseRepository,actor:Actor,parent:string) {
  requireRule(actor.role==='ops'&&(await repo.read()).organizationMemberships.some(m=>m.userId===actor.userId&&m.organizationId===parent&&m.role==='ops'),'只有所属平台运营可以执行此操作。');
}
async function host(repo:DatabaseRepository,actor:Actor,parent:string) {
  requireRule(actor.role==='host'&&(await repo.read()).organizationMemberships.some(m=>m.userId===actor.userId&&m.organizationId===parent&&m.role==='host'),'只有 Host 可以申请额外小组。');
}
export async function manageWorkspace(repo:DatabaseRepository,actor:Actor,input:unknown) {
  const body=z.object({action:z.string()}).passthrough().parse(input);
  return await repo.transaction(async ()=>{
    const parent=await platformId(repo,actor.organizationId);
    if(body.action==='host.add') {
      await operator(repo,actor,parent);
      const {email}=z.object({email:emailSchema}).parse(body);
      const user=(await repo.read()).users.find(u=>u.email.toLowerCase()===email);
      if(user) {
        const primary=await ensurePersonalWorkspace(repo,user,parent);
        requireRule(primary.parentId===parent,'该账号的空间属于其他平台。',409);
        requireRule(!(await repo.read()).organizationMemberships.some(m=>m.organizationId===parent&&m.userId===user.id&&m.role==='ops'),'运营账号不能转为 Host。',409);
      }
      await repo.db.prepare('INSERT INTO host_grants VALUES (?,?,?,?,?,?) ON CONFLICT(platform_id,email) DO NOTHING').run(randomUUID(),parent,email,user?.id||null,actor.userId,new Date().toISOString());
      if(user) await activateHostGrants(repo,user);
      await repo.audit(actor.userId,'host.add',email);
      return {ok:true,pending:!user};
    }
    if(body.action==='group.request') {
      await host(repo,actor,parent);
      const {name,reason}=z.object({name:z.string().trim().min(1).max(80),reason:z.string().trim().min(4).max(1000)}).parse(body);
      requireRule(!(await repo.db.prepare("SELECT id FROM group_requests WHERE platform_id=? AND host_id=? AND status='pending'").get(parent,actor.userId)),'已有待审批申请，请等待运营处理。',409);
      const id=randomUUID();
      await repo.db.prepare('INSERT INTO group_requests (id,platform_id,host_id,name,reason,created_at) VALUES (?,?,?,?,?,?)').run(id,parent,actor.userId,name,reason,new Date().toISOString());
      await repo.audit(actor.userId,'group.request',id);
      return {ok:true};
    }
    if(body.action==='group.review') {
      await operator(repo,actor,parent);
      const {id,decision,note}=z.object({id:z.uuid(),decision:z.enum(['approved','rejected']),note:z.string().trim().max(1000).default('')}).parse(body);
      const request=(await repo.db.prepare('SELECT * FROM group_requests WHERE id=? AND platform_id=?').get(id,parent)) as {status:string;host_id:string;name:string;workspace_id:string|null}|undefined;
      requireRule(request,'申请不存在。',404);
      if(request.status===decision) return {ok:true,workspaceId:request.workspace_id};
      requireRule(request.status==='pending','该申请已经处理。',409);
      let workspaceId:string|null=null;
      if(decision==='approved') {
        const user=(await repo.read()).users.find(u=>u.id===request.host_id)!;
        requireRule((await repo.read()).organizationMemberships.some(m=>m.organizationId===parent&&m.userId===user.id&&m.role==='host'),'申请人已不具备 Host 资格。',409);
        workspaceId=(await extraSpace(repo,user,parent,request.name)).id;
      }
      await repo.db.prepare('UPDATE group_requests SET status=?,workspace_id=?,reviewed_by=?,review_note=?,reviewed_at=? WHERE id=?').run(decision,workspaceId,actor.userId,note,new Date().toISOString(),id);
      await repo.audit(actor.userId,`group.${decision}`,id);
      return {ok:true,workspaceId};
    }
    if(body.action==='group.member.add') {
      const {email}=z.object({email:emailSchema}).parse(body);
      const space=(await repo.read()).organizations.find(o=>o.id===(actor.organizationId||defaultOrganizationId))!;
      requireRule(space.kind==='host','个人空间不能添加成员。');
      requireRule(actor.role==='host'&&space.ownerId===actor.userId||actor.role==='ops'&&(await repo.read()).organizationMemberships.some(m=>m.organizationId===parent&&m.userId===actor.userId&&m.role==='ops'),'只能管理自己的小组。');
      const state=await repo.read(),user=state.users.find(u=>u.email.toLowerCase()===email);
      requireRule(user,'该邮箱尚未注册，请先让成员验证邮箱登录。',422);
      requireRule(state.organizationMemberships.some(m=>m.organizationId===parent&&m.userId===user.id),'该成员不属于当前平台。');
      const group=state.households.find(h=>h.organizationId===space.id);
      requireRule(group,'小组尚未就绪。',409);
      if(state.memberships.some(m=>m.householdId===group.id&&m.userId===user.id)) return {ok:true};
      requireRule(!state.organizationMemberships.some(m=>m.organizationId===space.id&&m.userId===user.id&&m.role==='ops'),'运营已具备管理权限，无需加入为学员。',409);
      requireRule(state.memberships.filter(m=>m.householdId===group.id&&m.role==='learner').length<group.capacity,'小组人数已满。',409);
      await membership(repo,space.id,user.id,'learn');
      await repo.saveMembership({...meta(),householdId:group.id,userId:user.id,role:'learner'});
      await repo.audit(actor.userId,'group.member.add',user.id);
      return {ok:true};
    }
    throw new DomainError(400,'未知空间管理操作。');
  });
}
export async function managementSnapshot(repo:DatabaseRepository,actor:Actor) {
  const parent=await platformId(repo,actor.organizationId);
  const state=await repo.read();
  const space=state.organizations.find(o=>o.id===actor.organizationId);
  const isOps=actor.role==='ops'&&state.organizationMemberships.some(m=>m.organizationId===parent&&m.userId===actor.userId&&m.role==='ops');
  const requests=actor.role==='learn'?[]:(await repo.db.prepare(`SELECT r.*,u.name host_name FROM group_requests r JOIN users u ON u.id=r.host_id WHERE r.platform_id=? ${isOps?'':'AND r.host_id=?'} ORDER BY r.created_at DESC`).all(...(isOps?[parent]:[parent,actor.userId])));
  return {space,platformId:parent,canManageHosts:isOps,canAddMembers:space?.kind==='host'&&(isOps||space.ownerId===actor.userId&&actor.role==='host'),requests,
    grants:isOps?(await repo.db.prepare('SELECT email,user_id,created_at FROM host_grants WHERE platform_id=? ORDER BY created_at DESC').all(parent)):[]};
}
