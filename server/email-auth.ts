import { activateHostGrants, ensurePersonalWorkspace } from './services/owned-workspaces';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { workspaceRepository } from './container';
import { digest, newSession, sessionCookie } from './auth';
import { sendSignInCode } from './email';
import { DomainError } from '../domain/commands';

interface Challenge { id:string; email:string; organization_id:string; code_hash:string; expires_at:number; attempts:number; consumed:number; delivered:number }
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200));
const meta = () => ({id:randomUUID(),version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
export async function beginEmailSignIn(input: unknown, organizationId: string, request: Request) {
  const { email } = z.object({email:emailSchema}).parse(input);
  const repo = await workspaceRepository(), now = Date.now(), id = randomUUID();
  const code = String(randomInt(0,1000000)).padStart(6,'0');
  await repo.transaction(async () => {
    if (!(await repo.read()).organizations.some(o => o.id === organizationId && o.kind === 'platform')) throw new DomainError(404,'工作区不存在。');
    const recent = (await repo.db.prepare('SELECT created_at FROM email_challenges WHERE email=? AND created_at>? ORDER BY created_at DESC').all(email,now-3600000)) as {created_at:number}[];
    if (recent[0] && now-recent[0].created_at < 60000) throw new DomainError(429,'请等待 60 秒后重新获取验证码。');
    if (recent.length >= 5) throw new DomainError(429,'验证码发送次数过多，请一小时后再试。');
    await repo.db.prepare('DELETE FROM email_challenges WHERE created_at<?').run(now-86400000);
    await repo.db.prepare('INSERT INTO email_challenges (id,email,organization_id,code_hash,created_at,expires_at) VALUES (?,?,?,?,?,?)').run(id,email,organizationId,digest(`${id}:${code}`),now,now+600000);
  });
  const host = new URL(`${new URL(request.url).protocol}//${request.headers.get('host') || new URL(request.url).host}`).hostname;
  try {
    const delivery = await sendSignInCode(email,code,['localhost','127.0.0.1','[::1]'].includes(host));
    await repo.transaction(async () => {
      await repo.db.prepare('UPDATE email_challenges SET consumed=1 WHERE email=? AND id<>?').run(email,id);
      await repo.db.prepare('UPDATE email_challenges SET delivered=1 WHERE id=?').run(id);
    });
    return Response.json({challengeId:id,email,delivery,retryAfter:60}, {headers:{'Cache-Control':'no-store'}});
  } catch(e) {
    await repo.db.prepare('UPDATE email_challenges SET consumed=1 WHERE id=?').run(id);
    throw e;
  }
}
export async function verifyEmailSignIn(input: unknown, organizationId: string, request: Request) {
  const { challengeId, code } = z.object({challengeId:z.uuid(),code:z.string().regex(/^\d{6}$/)}).parse(input);
  const repo = await workspaceRepository();
  const hostname = new URL(`${new URL(request.url).protocol}//${request.headers.get('host') || new URL(request.url).host}`).hostname;
  const localTestCode = process.env.NODE_ENV === 'development'
    && ['localhost','127.0.0.1','[::1]'].includes(hostname) && code === '000000';
  const result = await repo.transaction(async () => {
    const challenge = (await repo.db.prepare('SELECT * FROM email_challenges WHERE id=? AND organization_id=?').get(challengeId,organizationId)) as Challenge | undefined;
    if (!challenge || !challenge.delivered || challenge.consumed || challenge.expires_at <= Date.now() || challenge.attempts >= 5) return {error:'验证码已过期或失效，请重新获取。'};
    await repo.db.prepare('UPDATE email_challenges SET attempts=attempts+1 WHERE id=?').run(challengeId);
    if (!localTestCode && !timingSafeEqual(Buffer.from(challenge.code_hash,'hex'),Buffer.from(digest(`${challengeId}:${code}`),'hex'))) return {error:'验证码不正确，请重试。'};
    if (!(await repo.read()).organizations.some(o=>o.id===organizationId&&o.kind==='platform')) return {error:'请从平台登录入口验证邮箱。'};
    let user = (await repo.read()).users.find(u=>u.email.toLowerCase()===challenge.email);
    if (!user) {
      user={...meta(),name:challenge.email.split('@')[0],email:challenge.email,timezone:'Asia/Shanghai',city:'',avatar:'blue'};
      await repo.saveUser(user);
      await repo.saveOrganizationMembership({...meta(),organizationId,userId:user.id,role:'learn'});
    }
    if (!(await repo.read()).organizationMemberships.some(m=>m.organizationId===organizationId && m.userId===user.id)) return {error:'这个账号没有访问该工作区的权限。'};
    await ensurePersonalWorkspace(repo,user,organizationId);
    await activateHostGrants(repo,user);
    await repo.db.prepare('UPDATE email_challenges SET consumed=1 WHERE email=?').run(challenge.email);
    await repo.db.prepare('INSERT INTO email_identities VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET verified_at=excluded.verified_at').run(user.id,Date.now());
    return {token:(await newSession(user.id))};
  });
  if ('error' in result) throw new DomainError(401,result.error!);
  return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(result.token),'Cache-Control':'no-store'}});
}
