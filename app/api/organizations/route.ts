import {currentUser,currentWorkspace,reply,sameOrigin} from '../../../server/pilot';
import {workspaceRepository} from '../../../server/container';
import {workspaceAccess} from '../../../server/services/workspace-access';
import {ORGANIZATION_COOKIE,isTeamRole} from '../../../domain/workspace-access';
import {auditOperation,teamContext} from '../../../server/services/organization-access';
import {errorResponse} from '../../../server/http';
export const dynamic='force-dynamic';
export async function GET(){try{const access=await currentWorkspace();return access?reply(access):reply({error:'请先登录。'},401);}catch(e){return errorResponse(e);}}
export async function POST(req:Request){
 try{
  const user=await currentUser();if(!user)return reply({error:'请先登录。'},401);
  if(!sameOrigin(req))return reply({error:'请求来源不正确。'},403);
  const b=await req.json();if(typeof b.organizationId!=='string'||b.organizationId.length>100)return reply({error:'无效操作。'},400);
  const repo=await workspaceRepository();const access=await workspaceAccess(repo,user,b.organizationId,true);
  if(!access.canSwitch)return reply({error:'学生不能切换组织。'},403);
  if(isTeamRole(access.organization.role))await auditOperation(repo,await teamContext(repo,user,access.organization.id),'organization.enter');
  const headers=new Headers({'Cache-Control':'no-store'});
  const suffix=`; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`;
  headers.append('Set-Cookie',`${ORGANIZATION_COOKIE}=${access.organization.id}${suffix}`);
  // Keep older team links compatible during the rollout.
  headers.append('Set-Cookie',`iriva_team=${access.organization.id}${suffix}`);
  return Response.json({ok:true,organization:access.organization},{headers});
 }catch(e){return errorResponse(e);}
}
