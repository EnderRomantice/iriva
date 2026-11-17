import {teamOrganizations,teamContext,auditOperation} from '../../server/services/organization-access';
import { workspaceRepository } from '../../server/container';
import { digest, sessionCookie, sessionToken } from '../../server/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = sessionToken(request);
  if(token){const repo=await workspaceRepository();await repo.transaction(async()=>{const u=await repo.db.prepare('SELECT u.id,u.name,u.email,s.auth_method FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(digest(token));if(u?.auth_method==='password'&&(await teamOrganizations(repo,u.id)).length){const selected=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('iriva_team='))?.slice(11);const orgs=await teamOrganizations(repo,u.id);const ctx=await teamContext(repo,{userId:u.id,email:u.email,displayName:u.name},orgs.some(o=>o.id===selected)?selected:undefined);await auditOperation(repo,ctx,'auth.logout');}await repo.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token));});}
  const to = new URL(request.url).searchParams.get('return_to') || '/';
  const target = to.startsWith('/') && !to.startsWith('//') ? to : '/';
  const headers=new Headers({Location:target,'Set-Cookie':sessionCookie(''),'Cache-Control':'no-store'});
  headers.append('Set-Cookie','iriva_team=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  return new Response(null,{status:303,headers});
}
