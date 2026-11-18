import { currentTeamContext, sameOrigin } from '../../../../server/pilot';
import { workspaceRepository } from '../../../../server/container';
import { auditedOperation, auditOperation, teamOrganizations, teamContext, createTeamOrganization, transferOwnership } from '../../../../server/services/organization-access';
import { errorResponse } from '../../../../server/http';
export const dynamic='force-dynamic';
export async function GET(){try{const ctx=await currentTeamContext();if(!ctx)return Response.json({error:'请使用密码登录。'},{status:401});const repo=await workspaceRepository();await auditOperation(repo,ctx,'organization.list');return Response.json({organization:ctx.organization,organizations:await teamOrganizations(repo,ctx.user.userId)},{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e)}}
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return Response.json({error:'请求来源不正确。'},{status:403});
  const ctx=await currentTeamContext();if(!ctx)return Response.json({error:'请使用密码登录。'},{status:401});
  const b=await req.json() as {action?:string;organizationId?:string;name?:string;userId?:string};
  const repo=await workspaceRepository();
  return await auditedOperation(repo,ctx,`organization.${b.action||'unknown'}`,String(b.organizationId||b.userId||'').slice(0,100),async current=>{
   if(b.action==='switch'){
    const next=await teamContext(repo,current.user,String(b.organizationId||''));
    await auditOperation(repo,next,'organization.enter',current.organization.id);
    return Response.json({ok:true},{headers:{'Set-Cookie':`iriva_team=${next.organization.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`,'Cache-Control':'no-store'}});
   }
   if(b.action==='create'){
    const organization=await createTeamOrganization(repo,current,b.name||'');
    await auditOperation(repo,{...current,organization:{...organization,role:'owner'}},'organization.created',organization.id);
    return Response.json({ok:true,organization});
   }
   if(b.action==='transfer'){await transferOwnership(repo,current,b.userId||'');return Response.json({ok:true});}
   return Response.json({error:'无效操作。'},{status:400});
  });
 }catch(e){return errorResponse(e)}
}
