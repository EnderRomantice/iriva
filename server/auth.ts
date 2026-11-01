import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { workspaceRepository } from './container';
import { DomainError } from '../domain/commands';
import { defaultOrganizationId } from '../domain/workspace';
import type { Actor } from '../domain/models';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, hash: string) { const [salt,key] = hash.split(':'); return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex')); }
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== `${new URL(request.url).protocol}//${request.headers.get('host')}`) throw new DomainError(403,'不接受跨站请求。');
}
export function sessionToken(request: Request) { return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('iriva_session='))?.slice(14); }
export function sessionActor(request: Request): Actor | undefined {
  const token=sessionToken(request); if(!token) return;
  const repo=workspaceRepository();
  const session=repo.db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').get(digest(token),Date.now()) as {user_id:string}|undefined;
  if(!session) throw new DomainError(401,'登录已过期，请重新登录。');
  const organizationId=request.headers.get('x-workspace-id') || defaultOrganizationId;
  const membership=repo.read().organizationMemberships.find(m=>m.userId===session.user_id && m.organizationId===organizationId);
  if(!membership) throw new DomainError(403,'你没有访问这个工作区的权限。');
  return {userId:session.user_id,role:membership.role,organizationId};
}
export function newSession(userId: string) { const token=randomBytes(32).toString('hex'); workspaceRepository().db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(digest(token),userId,Date.now()+30*86400000); return token; }
export function sessionCookie(token:string) { return `iriva_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token?2592000:0}${process.env.NODE_ENV==='production'?'; Secure':''}`; }

// Refresh an active session at most once a week; cookies stay HttpOnly and same-site.
export function renewSession(request: Request): Record<string,string> {
  const token = sessionToken(request);
  if (!token) return {};
  const now = Date.now();
  const result = workspaceRepository().db.prepare('UPDATE auth_sessions SET expires_at=? WHERE token_hash=? AND expires_at>? AND expires_at<?').run(now+30*86400000,digest(token),now,now+23*86400000);
  return result.changes ? {'Set-Cookie':sessionCookie(token)} : {};
}
