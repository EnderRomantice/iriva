import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { workspaceRepository } from './container';
import type { DatabaseRepository } from './repositories/database-repository';
import { exists, userByEmail } from './repositories/queries';
import { hashPassword, newSession, sessionCookie, verifyPassword } from './auth';
import { DomainError } from '../domain/commands';
import { teamIdentity, teamContext, auditOperation } from './services/organization-access';
import { defaultOrganizationId } from '../domain/workspace';

/**
 * 团队工作台使用邮箱 + 密码登录（学员和 Host 仍用邮箱验证码）。
 * 只有组织成员能用密码登录；同一邮箱 15 分钟内失败 5 次即暂停。
 */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200));
export const passwordSchema = z.string().min(8, '密码至少 8 位。').max(200, '密码过长。');
const WINDOW = 15 * 60_000, LIMIT = 5;
const meta = () => ({ id: randomUUID(), version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

export async function passwordSignIn(input: unknown) {
  const { email, password } = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).parse(input);
  const repo = await workspaceRepository(), now = Date.now();
  const failures = await repo.db.prepare('SELECT COUNT(*) AS n FROM password_attempts WHERE email=? AND created_at>?').get(email, now - WINDOW) as { n: number | string };
  const identity=await teamIdentity(repo,email);
  const user=identity?await userByEmail(repo,email):null;
  const ctx=user?await teamContext(repo,{userId:user.id,email,displayName:user.name}):null;
  if (Number(failures.n) >= LIMIT){if(ctx)await auditOperation(repo,ctx,'auth.login','',429);throw new DomainError(429, '尝试次数过多，请 15 分钟后再试。');}
  const row = await repo.db.prepare('SELECT c.user_id,c.password_hash FROM credentials c JOIN users u ON u.id=c.user_id WHERE lower(u.email)=?').get(email) as { user_id: string; password_hash: string } | undefined;
  if (!identity || !row || !verifyPassword(password, row.password_hash)) {
    await repo.db.prepare('DELETE FROM password_attempts WHERE created_at<?').run(now - 86_400_000);
    await repo.db.prepare('INSERT INTO password_attempts (email,created_at) VALUES (?,?)').run(email, now);
    if(ctx)await auditOperation(repo,ctx,'auth.login','',401);
    throw new DomainError(401, '邮箱或密码不正确。');
  }
  return repo.transaction(async()=>{
    const current=await teamContext(repo,{userId:row.user_id,email,displayName:user!.name});
    await repo.db.prepare('DELETE FROM password_attempts WHERE email=?').run(email);
    const token=await newSession(row.user_id,'password');
    await auditOperation(repo,current,'auth.login');
    const headers=new Headers({'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'});
    headers.append('Set-Cookie',`iriva_team=${current.organization.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);
    return Response.json({ok:true},{headers});
  });
}

/** Grant team access and set a password. Creates the account if the email has never signed in. Caller authorizes. */
export async function saveTeamAccount(repo: DatabaseRepository, input: { email: string; name: string; password?: string; role?: 'admin' | 'staff' }) {
  const email = emailSchema.parse(input.email), name = z.string().trim().min(1).max(60).parse(input.name);
  const password = input.password === undefined || input.password === '' ? undefined : passwordSchema.parse(input.password);
  return repo.transaction(async () => {
    let user = await userByEmail(repo, email);
    if (!user && !password) throw new DomainError(400, '新成员需要设置初始密码。');
    if (!user) {
      user = { ...meta(), name, email, timezone: 'Asia/Shanghai', city: '', avatar: 'blue' };
      await repo.saveUser(user);
    }
    if (!await exists(repo, 'SELECT 1 FROM organization_memberships WHERE organization_id=? AND user_id=?', [defaultOrganizationId, user.id]))
      await repo.saveOrganizationMembership({ ...meta(), organizationId: defaultOrganizationId, userId: user.id, role: 'learn' });
    await repo.db.prepare(input.role
      ? 'INSERT INTO team_members (email,name,role) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role'
      : 'INSERT INTO team_members (email,name) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name').run(...(input.role ? [email, name, input.role] : [email, name]));
    const existingAccess=await repo.db.prepare('SELECT role FROM organization_access WHERE organization_id=? AND user_id=?').get(defaultOrganizationId,user.id);
    const accessRole=existingAccess?.role==='owner'?'owner':input.role?input.role==='admin'?'admin':'partner':existingAccess?.role||'partner';
    await repo.db.prepare('INSERT INTO organization_access VALUES (?,?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role').run(defaultOrganizationId,user.id,accessRole,new Date().toISOString());
    if (password) {
      await repo.db.prepare('INSERT INTO credentials (user_id,password_hash) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash').run(user.id, hashPassword(password));
      // A new password signs out every existing session of that account.
      await repo.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user.id);
    }
    return { email, name };
  });
}
