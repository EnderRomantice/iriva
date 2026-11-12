import { workspaceRepository } from '@/server/container';
import { digest, sessionToken } from '@/server/auth';
import { errorResponse } from '@/server/http';
import { DomainError } from '@/domain/commands';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {id}=await params,repo=await workspaceRepository(),token=sessionToken(request);
  const session=token?await repo.db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').get(digest(token),Date.now()):undefined;
  if(!session)throw new DomainError(401,'请先登录。');
  const user=await repo.db.prepare(`SELECT u.version FROM users u WHERE u.id=? AND (u.id=? OR EXISTS (SELECT 1 FROM organization_memberships a JOIN organization_memberships b ON a.organization_id=b.organization_id WHERE a.user_id=? AND b.user_id=u.id))`).get(id,session.user_id,session.user_id);
  if(!user)throw new DomainError(404,'头像不存在。');
  const etag=`"avatar-${id}-${user.version}"`,headers={'Cache-Control':'private, max-age=3600','ETag':etag,'Vary':'Cookie','X-Content-Type-Options':'nosniff'};
  if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
  const row=await repo.db.prepare("SELECT data_url FROM profile_avatars WHERE user_id=? UNION ALL SELECT avatar AS data_url FROM users WHERE id=? AND avatar LIKE 'data:image/%' LIMIT 1").get(id,id);
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(row?.data_url||'');
  if(!match)throw new DomainError(404,'头像不存在。');
  return new Response(Buffer.from(match[2],'base64'),{headers:{...headers,'Content-Type':match[1]}});
 }catch(error){return errorResponse(error);}
}
