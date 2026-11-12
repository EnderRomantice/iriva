import { workspaceRepository } from '@/server/container';
import { actorFromRequest, errorResponse } from '@/server/http';
import { sessionToken } from '@/server/auth';
import { syncWorkspace } from '@/server/services/workspace-sync';
export const runtime='nodejs';
export async function GET(request:Request) {
 try {
  const actor=await actorFromRequest(request);
  const result=await syncWorkspace(await workspaceRepository(),actor,request.headers.get('if-none-match'));
  const headers={'Cache-Control':'private, no-cache','ETag':result.etag,'Vary':'Cookie, x-workspace-id, x-account-id, x-demo-role'};
  return result.snapshot?Response.json({...result.snapshot,authenticated:!!sessionToken(request)},{headers}):new Response(null,{status:304,headers});
 }catch(error){return errorResponse(error);}
}
