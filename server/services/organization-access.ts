import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type { DatabaseRepository } from '../repositories/database-repository';
import { DomainError } from '../../domain/commands';
import { defaultOrganizationId } from '../../domain/workspace';
import { hashPassword } from '../auth';
import { userByEmail } from '../repositories/queries';

import type {AccessRole} from '../../domain/models';
export type {AccessRole} from '../../domain/models';
export type TeamOrganization = { id:string; name:string; role:AccessRole };
export type TeamActor = { userId:string; email:string; displayName:string };
export type TeamContext = { user:TeamActor; organization:TeamOrganization };
export const canManage = (role:AccessRole) => role==='owner'||role==='admin';
const meta=()=>({id:randomUUID(),version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});

export async function teamOrganizations(repo:DatabaseRepository,userId:string):Promise<TeamOrganization[]> {
 return repo.db.prepare("SELECT o.id,o.name,a.role FROM organization_access a JOIN organizations o ON o.id=a.organization_id WHERE a.user_id=? AND o.kind='platform' ORDER BY o.name,o.id").all(userId);
}
export async function teamIdentity(repo:DatabaseRepository,email:string) {
 return repo.db.prepare("SELECT u.id FROM users u WHERE lower(u.email)=? AND EXISTS(SELECT 1 FROM organization_access a JOIN organizations o ON o.id=a.organization_id WHERE a.user_id=u.id AND o.kind='platform')").get(email.trim().toLowerCase());
}
export async function teamContext(repo:DatabaseRepository,user:TeamActor,requested?:string):Promise<TeamContext> {
 const organizations=await teamOrganizations(repo,user.userId);
 const organization=requested?organizations.find(o=>o.id===requested):organizations.find(o=>o.id===defaultOrganizationId)||organizations[0];
 if(!organization)throw new DomainError(403,'你没有访问这个组织的权限。');
 return {user,organization};
}
export async function auditOperation(repo:DatabaseRepository,ctx:TeamContext,action:string,target='',status=200,details:Record<string,unknown>={}) {
 // Callers pass only explicit metadata. Never persist passwords, codes or application bodies.
 await repo.db.prepare('INSERT INTO organization_audit (id,organization_id,actor_id,actor_name,actor_email,action,target,result,status,details,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
 .run(randomUUID(),ctx.organization.id,ctx.user.userId,ctx.user.displayName,ctx.user.email,action,target,status<400?'success':status<500?'denied':'failed',status,JSON.stringify(details),new Date().toISOString());
}
class RejectedResponse { constructor(public response:Response){} }
export async function auditedOperation(repo:DatabaseRepository,ctx:TeamContext,action:string,target:string,work:(current:TeamContext)=>Promise<Response>,details:Record<string,unknown>={}) {
 try{return await repo.transaction(async()=>{
   // Serialize membership changes and recheck authorization at the point of use.
   await repo.db.prepare('UPDATE organizations SET version=version WHERE id=?').run(ctx.organization.id);
   ctx=await teamContext(repo,ctx.user,ctx.organization.id);
   const response=await work(ctx);
   if(!response.ok)throw new RejectedResponse(response);
   await auditOperation(repo,ctx,action,target,response.status,details);
   return response;
 });}catch(error){
   const status=error instanceof RejectedResponse?error.response.status:error instanceof DomainError?error.status:error instanceof ZodError?400:500;
   await auditOperation(repo,ctx,action,target,status,details);
   if(error instanceof RejectedResponse)return error.response;
   throw error;
 }
}
export async function saveOrganizationMember(repo:DatabaseRepository,ctx:TeamContext,input:unknown) {
 const b=z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(200)),name:z.string().trim().min(1).max(60),role:z.enum(['admin','partner']),password:z.string().max(200).optional()}).parse(input);
 return repo.transaction(async()=>{
  await repo.db.prepare('UPDATE organizations SET version=version WHERE id=?').run(ctx.organization.id);
  const current=await teamContext(repo,ctx.user,ctx.organization.id);
  if(!canManage(current.organization.role))throw new DomainError(403,'只有 owner 或 admin 可以管理成员。');
  let user=await userByEmail(repo,b.email);
  if(user?.id===ctx.user.userId)throw new DomainError(409,'不能修改自己的权限，请由其他管理员操作。');
  const existing=user?await repo.db.prepare('SELECT role FROM organization_access WHERE organization_id=? AND user_id=?').get(ctx.organization.id,user.id):null;
  if(existing?.role==='owner')throw new DomainError(403,'Owner 只能通过所有权转移变更。');
  const credential=user?await repo.db.prepare('SELECT 1 FROM credentials WHERE user_id=?').get(user.id):null;
  if(b.password && b.password.length<8)throw new DomainError(400,'密码至少 8 位。');
  if(!credential&&!b.password)throw new DomainError(400,'请为新账号设置至少 8 位的初始密码。');
  // Credentials belong to the person, not an organization. A tenant admin cannot reset another tenant's account.
  if(credential&&b.password)throw new DomainError(409,'此账号已有密码，添加到组织时请留空。');
  if(!user){user={...meta(),name:b.name,email:b.email,timezone:'Asia/Shanghai',city:'',avatar:'blue'};await repo.saveUser(user);}
  if(!credential)await repo.db.prepare('INSERT INTO credentials (user_id,password_hash) VALUES (?,?)').run(user.id,hashPassword(b.password!));
  await repo.db.prepare('INSERT INTO organization_access (organization_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role').run(ctx.organization.id,user.id,b.role,new Date().toISOString());
  // Granting team access must not upgrade an existing email-only session.
  await repo.db.prepare("DELETE FROM auth_sessions WHERE user_id=? AND auth_method<>'password'").run(user.id);
  return {email:b.email,name:user.name,role:b.role};
 });
}
export async function removeOrganizationMember(repo:DatabaseRepository,ctx:TeamContext,email:string) {
 await repo.db.prepare('UPDATE organizations SET version=version WHERE id=?').run(ctx.organization.id);
 const current=await teamContext(repo,ctx.user,ctx.organization.id);
 if(!canManage(current.organization.role))throw new DomainError(403,'只有管理员可以移除成员。');
 const user=await userByEmail(repo,email.trim().toLowerCase());
 const row=user?await repo.db.prepare('SELECT role FROM organization_access WHERE organization_id=? AND user_id=?').get(ctx.organization.id,user.id):null;
 if(!row||!user)throw new DomainError(404,'成员不存在。');
 if(row.role==='owner'||user.id===ctx.user.userId)throw new DomainError(409,'不能移除 owner 或自己。');
 await repo.db.prepare('DELETE FROM organization_access WHERE organization_id=? AND user_id=?').run(ctx.organization.id,user.id);
}
export async function createTeamOrganization(repo:DatabaseRepository,ctx:TeamContext,name:string) {
 if(!canManage((await teamContext(repo,ctx.user,ctx.organization.id)).organization.role))throw new DomainError(403,'只有管理员可以创建组织。');
 name=z.string().trim().min(1).max(60).parse(name);
 const org={...meta(),name,initials:name.slice(0,1),color:'#12658a',kind:'platform' as const,ownerId:ctx.user.userId};
 await repo.put('organizations',org);
 await repo.db.prepare("INSERT INTO organization_access VALUES (?,?,'owner',?)").run(org.id,ctx.user.userId,org.createdAt);
 return org;
}
export async function transferOwnership(repo:DatabaseRepository,ctx:TeamContext,userId:string) {
 await repo.db.prepare('UPDATE organizations SET version=version WHERE id=?').run(ctx.organization.id);
 if((await teamContext(repo,ctx.user,ctx.organization.id)).organization.role!=='owner')throw new DomainError(403,'只有 owner 可以转移所有权。');
 const target=await repo.db.prepare("SELECT 1 FROM organization_access WHERE organization_id=? AND user_id=? AND role='admin'").get(ctx.organization.id,userId);
 if(!target||userId===ctx.user.userId)throw new DomainError(400,'请选择本组织的其他 admin。');
 await repo.db.prepare("UPDATE organization_access SET role='admin' WHERE organization_id=? AND user_id=?").run(ctx.organization.id,ctx.user.userId);
 await repo.db.prepare("UPDATE organization_access SET role='owner' WHERE organization_id=? AND user_id=?").run(ctx.organization.id,userId);
 await repo.db.prepare('UPDATE organizations SET owner_id=?,version=version+1 WHERE id=?').run(userId,ctx.organization.id);
}

/** One-time compatibility import for installations whose demo/config data is created after migrations. */
export async function bootstrapOrganizationAccess(repo:DatabaseRepository) {
 await repo.transaction(async()=>{
  if(await repo.db.prepare("SELECT 1 FROM audit_events WHERE kind='organizations.access.migrated'").get())return;
  await repo.db.prepare("INSERT INTO organization_access SELECT id,owner_id,'owner',created_at FROM organizations WHERE owner_id IS NOT NULL ON CONFLICT(organization_id,user_id) DO NOTHING").run();
  await repo.db.prepare("INSERT INTO organization_access SELECT m.organization_id,m.user_id,CASE WHEN m.role='ops' AND o.kind='platform' THEN 'admin' ELSE 'partner' END,m.created_at FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id WHERE o.kind<>'platform' OR m.role='ops' ON CONFLICT(organization_id,user_id) DO NOTHING").run();
  const emails=(process.env.IRIVA_ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  for(const email of emails){const user=await userByEmail(repo,email);if(user)await repo.db.prepare("INSERT INTO organization_access VALUES (?,?,'admin',?) ON CONFLICT(organization_id,user_id) DO NOTHING").run(defaultOrganizationId,user.id,new Date().toISOString());}
  await repo.db.prepare("UPDATE organization_access SET role='owner' WHERE role='admin' AND user_id=(SELECT a.user_id FROM organization_access a JOIN users u ON u.id=a.user_id WHERE a.organization_id=organization_access.organization_id AND a.role='admin' ORDER BY CASE WHEN EXISTS(SELECT 1 FROM team_members t WHERE t.email=lower(u.email) AND t.role='admin') THEN 0 ELSE 1 END,a.created_at,a.user_id LIMIT 1) AND organization_id NOT IN (SELECT organization_id FROM organization_access WHERE role='owner')").run();
  await repo.db.prepare("UPDATE organizations SET owner_id=(SELECT user_id FROM organization_access a WHERE a.organization_id=organizations.id AND a.role='owner') WHERE owner_id IS NULL").run();
  const actor=await repo.db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
  if(actor)await repo.audit(actor.id,'organizations.access.migrated',defaultOrganizationId);
 });
}
