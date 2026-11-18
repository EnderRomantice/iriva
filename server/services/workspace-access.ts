import type {DatabaseRepository} from '../repositories/database-repository';
import {DomainError} from '../../domain/commands';
import {defaultOrganizationId} from '../../domain/workspace';
import {isTeamRole,type WorkspaceAccess,type WorkspaceOrganization} from '../../domain/workspace-access';
import {teamOrganizations,type TeamActor} from './organization-access';
type User=TeamActor&{authMethod?:'email'|'password'};

/** Platform organizations are shared by operators, hosts, and their learners. */
export async function workspaceOrganizations(repo:DatabaseRepository,user:User):Promise<WorkspaceOrganization[]> {
 const teams=user.authMethod==='password'?await teamOrganizations(repo,user.userId):[];
 const hosts:WorkspaceOrganization[]=await repo.db.prepare(`SELECT DISTINCT o.id,o.name,'host' AS role FROM organizations o WHERE o.kind='platform' AND (
 EXISTS(SELECT 1 FROM organization_hosts h WHERE h.organization_id=o.id AND h.email=?) OR
 EXISTS(SELECT 1 FROM memberships m JOIN households h ON h.id=m.household_id JOIN organizations ho ON ho.id=h.organization_id WHERE m.user_id=? AND m.role='host' AND (ho.id=o.id OR ho.parent_id=o.id)) OR
 EXISTS(SELECT 1 FROM organization_memberships m WHERE m.user_id=? AND m.role='host' AND (m.organization_id=o.id OR m.organization_id IN (SELECT id FROM organizations WHERE parent_id=o.id))) OR
 EXISTS(SELECT 1 FROM host_grants g WHERE g.platform_id=o.id AND g.email=?)
 ) ORDER BY o.name,o.id`).all(user.email.toLowerCase(),user.userId,user.userId,user.email.toLowerCase());
 const options=new Map<string,WorkspaceOrganization>();for(const org of [...hosts,...teams])options.set(org.id,org);
 return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
export async function workspaceAccess(repo:DatabaseRepository,user:User,selected?:string,strict=false):Promise<WorkspaceAccess> {
 const organizations=await workspaceOrganizations(repo,user);
 if(organizations.length){
  const chosen=organizations.find(o=>o.id===selected);
  if(strict&&selected&&!chosen)throw new DomainError(403,'你没有访问这个组织的权限。');
  const organization=chosen||organizations.find(o=>o.id===defaultOrganizationId)||organizations[0];
  return {organization,organizations,canSwitch:true};
 }
 const organization:WorkspaceOrganization|undefined=await repo.db.prepare(`SELECT CASE WHEN o.kind='platform' THEN o.id ELSE p.id END AS id,CASE WHEN o.kind='platform' THEN o.name ELSE p.name END AS name,'learner' AS role
 FROM memberships m JOIN households h ON h.id=m.household_id JOIN organizations o ON o.id=h.organization_id LEFT JOIN organizations p ON p.id=o.parent_id WHERE m.user_id=? AND m.role='learner' ORDER BY m.created_at,m.id LIMIT 1`).get(user.userId)
 ||await repo.db.prepare("SELECT o.id,o.name,'learner' AS role FROM member_applications a JOIN organizations o ON o.id=a.organization_id WHERE a.user_id=?").get(user.userId)
 ||await repo.db.prepare("SELECT id,name,'learner' AS role FROM organizations WHERE id=?").get(defaultOrganizationId);
 if(!organization)throw new DomainError(403,'暂时找不到你的组织。');
 if(strict&&selected&&selected!==organization.id)throw new DomainError(403,'学生不能切换组织。');
 return {organization,organizations:[],canSwitch:false};
}
export async function workspaceMembership(repo:DatabaseRepository,user:User,organizationId?:string){
 const {organization}=await workspaceAccess(repo,user,organizationId,!!organizationId);
 if(isTeamRole(organization.role))return null;
 const row=await repo.db.prepare(`SELECT m.household_id,m.role,m.user_id,COALESCE(NULLIF(m.display_name,''),u.name) AS name FROM memberships m JOIN users u ON u.id=m.user_id JOIN households h ON h.id=m.household_id JOIN organizations o ON o.id=h.organization_id
 WHERE m.user_id=? AND m.role=? AND (o.id=? OR o.parent_id=?) ORDER BY m.created_at,m.id LIMIT 1`).get(user.userId,organization.role==='host'?'host':'learner',organization.id,organization.id);
 return row?{household:String(row.household_id),role:row.role as 'host'|'learner',name:String(row.name),user:String(row.user_id)}:null;
}
