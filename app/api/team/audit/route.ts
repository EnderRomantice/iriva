import { currentTeamContext } from '../../../../server/pilot';
import { workspaceRepository } from '../../../../server/container';
import { errorResponse } from '../../../../server/http';
import { organizationAudit } from '../../../../server/services/organization-audit';
import { auditOperation } from '../../../../server/services/organization-access';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const ctx=await currentTeamContext();if(!ctx)return Response.json({error:'请使用密码登录。'},{status:401});
 const repo=await workspaceRepository();
 const result=await organizationAudit(repo,ctx,Object.fromEntries(new URL(req.url).searchParams));
 await auditOperation(repo,ctx,'audit.view','',200,{page:result.page});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e)}}
