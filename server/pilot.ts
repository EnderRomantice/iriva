import {ORGANIZATION_COOKIE,ORGANIZATION_HEADER,isTeamRole} from '../domain/workspace-access';
import {workspaceAccess,workspaceMembership} from './services/workspace-access';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { workspaceRepository } from './container';
import { digest } from './auth';
import { teamOrganizations, teamContext } from './services/organization-access';
import { defaultOrganizationId } from '../domain/workspace';

/**
 * 青鸟 Pilot 的服务端上下文：身份来自现有的邮箱验证码会话（iriva_session），
 * 数据走现有的 SQLite / Postgres 适配器。所有 SQL 只用两边都支持的写法，
 * camelCase 别名一律加双引号，否则 Postgres 会把它们转成小写。
 */
export type PilotUser = { userId: string; email: string; displayName: string; authMethod?: 'email'|'password' };
export type Member = { household: string; role: 'learner' | 'host'; name: string; user: string };
type Row = Record<string, unknown>;

export async function pilotDb() { return (await workspaceRepository()).db; }
export async function pilotTransaction<T>(work: () => Promise<T>) { return (await workspaceRepository()).transaction(async () => work()); }
/** 当前账号自己的加入资料（/apply 页面与 GET /api/apply 共用）。 */
export const ownApplicationFields = 'id,name,role,plan,language,goal,level,timezone,availability,availability_slots,interests,contact,contact_preference,age_band,life_stage,location,mbti,partner_preferences,suggestion,status,household,revision,updated';
export async function ownApplication(userId: string): Promise<(Row & { revision: number; household: string | null; status: string }) | null> {
  const a = await (await pilotDb()).prepare(`SELECT ${ownApplicationFields} FROM member_applications WHERE user_id=?`).get(userId) as Row | undefined;
  return a ? { ...a, revision: Number(a.revision), household: a.household ? String(a.household) : null, status: String(a.status) } : null;
}

async function userForToken(token: string | undefined): Promise<PilotUser | null> {
  if (!token) return null;
  const db = await pilotDb();
  const row = await db.prepare('SELECT u.id,u.email,u.name,s.auth_method FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token), Date.now()) as Row | undefined;
  return row ? { userId: String(row.id), email: String(row.email), displayName: String(row.name || row.email), authMethod: row.auth_method as 'email'|'password' } : null;
}
/** For server components and route handlers. */
export async function currentUser(): Promise<PilotUser | null> {
  return userForToken((await cookies()).get('iriva_session')?.value);
}
export async function requireUser(returnTo: string): Promise<PilotUser> {
  const user = await currentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}
export function signInPath(returnTo: string) { return `/signin?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`; }
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app';
  try { const url = new URL(value, 'https://app.local'); return url.origin === 'https://app.local' && url.pathname !== '/signin' ? `${url.pathname}${url.search}${url.hash}` : '/app'; } catch { return '/app'; }
}

/** Team roles are organization-scoped; business roles never grant administrative access. */
export async function teamRole(user: PilotUser | null): Promise<'admin' | 'staff' | null> {
  if (!user || (user.authMethod && user.authMethod!=='password')) return null;
  const organizations=await teamOrganizations(await workspaceRepository(),user.userId);
  return organizations.some(o=>o.role==='owner'||o.role==='admin')?'admin':organizations.length?'staff':null;
}
export async function currentWorkspace(user?:PilotUser,requested?:string) {
  const u=user||await currentUser();if(!u)return null;
  const incoming=requested||(await headers()).get(ORGANIZATION_HEADER)||undefined;
  const jar=await cookies();
  return workspaceAccess(await workspaceRepository(),u,incoming||jar.get(ORGANIZATION_COOKIE)?.value||jar.get('iriva_team')?.value,!!incoming);
}
export async function currentTeamContext() {
  const user=await currentUser();if(!user||user.authMethod!=='password')return null;
  const access=await currentWorkspace(user);
  if(!access||!isTeamRole(access.organization.role))return null;
  return teamContext(await workspaceRepository(),user,access.organization.id);
}
export async function currentMember(userId:string,requested?:string):Promise<Member|null> {
  const user=await currentUser();if(!user||user.userId!==userId)return null;
  const access=await currentWorkspace(user,requested);
  return access?workspaceMembership(await workspaceRepository(),user,access.organization.id):null;
}

export async function member(userId: string): Promise<Member | null> {
  const db = await pilotDb();
  const row = await db.prepare("SELECT m.household_id,m.role,m.user_id,COALESCE(NULLIF(m.display_name,''),u.name) AS name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.user_id=? ORDER BY m.created_at ASC LIMIT 1").get(userId) as Row | undefined;
  return row ? { household: String(row.household_id), role: row.role === 'host' ? 'host' : 'learner', name: String(row.name), user: String(row.user_id) } : null;
}
export function membershipRow(householdId: string, userId: string, role: 'learner' | 'host', name: string) {
  const now = new Date().toISOString();
  return [randomUUID(), householdId, userId, role, 1, now, now, name] as const;
}
export const insertMembership = 'INSERT INTO memberships (id,household_id,user_id,role,version,created_at,updated_at,display_name) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING';

/** 运营分组后写下 placement；成员用这个邮箱登录时自动进入 Household。 */
export async function claimPlacement(user: PilotUser) {
  const db = await pilotDb();
  const p = await db.prepare('SELECT * FROM placements WHERE email=?').get(user.email.toLowerCase()) as Row | undefined;
  if (!p) return;
  if(p.role==='host'){if(await db.prepare('SELECT 1 FROM memberships WHERE user_id=? AND household_id=?').get(user.userId,p.household))return;}else if(await member(user.userId))return;
  const role = p.role === 'host' ? 'host' : 'learner';
  await db.prepare(insertMembership).run(...membershipRow(String(p.household), user.userId, role, String(p.name)));
  if (role === 'host') await db.prepare('UPDATE households SET host_id=? WHERE id=?').run(user.userId, p.household);
}

/** 按邀请码加入 Household（仅学员，四人上限）。必须在 pilotTransaction 内调用。 */
export async function joinByCode(code: string, userId: string, name: string): Promise<{ household: string } | { error: string; status: number }> {
  const db = await pilotDb();
  await db.prepare('UPDATE users SET id=id WHERE id=?').run(userId);
  // Lock the household before counting seats so simultaneous invites cannot overfill it.
  await db.prepare('UPDATE households SET code=code WHERE code=?').run(code);
  const h = await db.prepare('SELECT id FROM households WHERE code=?').get(code) as Row | undefined;
  if (!h) return { error: '没有找到这个邀请码，请核对后再试。', status: 400 };
  if (await member(userId)) return { error: '你已经在一个 Household 里了。', status: 409 };
  if (count(await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE household_id=? AND role='learner'").get(h.id)) >= 4) return { error: '这个 Household 已经有四位学员了。', status: 409 };
  await db.prepare(insertMembership).run(...membershipRow(String(h.id), userId, 'learner', name));
  return { household: String(h.id) };
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const url = new URL(req.url);
  return origin === url.origin || origin === `${url.protocol}//${req.headers.get('host')}`;
}
export const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const text = (b: Row, key: string, max: number) => typeof b[key] === 'string' ? (b[key] as string).trim().slice(0, max) : '';
export const count = (row: unknown) => Number((row as Row | undefined)?.n ?? 0);

// 会话可见性：Host 看全部；学员只看小组圆桌、自己的一对一和自己配对的伙伴练习。
export const visibleSession = (alias = 's') => `${alias}.household_id=? AND ${alias}.status<>'cancelled' AND (?='host' OR ((${alias}.participant_id IS NULL OR ${alias}.participant_id=?) AND (${alias}.pair_id IS NULL OR EXISTS(SELECT 1 FROM practice_pairs p WHERE p.id=${alias}.pair_id AND p.household=${alias}.household_id AND (p.first=? OR p.second=?)))))`;
export const visibilityArgs = (household: string, role: string, user: string) => [household, role, user, user, user];
export const sessionColumns = (alias = 's') => `${alias}.id,${alias}.title,${alias}.kind,${alias}.starts_at AS at,${alias}.meeting_url AS url`;
export const reminderKinds = [{ kind: 'day', minutes: 1440 }, { kind: 'soon', minutes: 15 }];
export function reminderDue(at: string, now = new Date()) {
  const start = Date.parse(at);
  if (!Number.isFinite(start) || start <= now.getTime()) return [];
  return reminderKinds.map(r => ({ kind: r.kind, due: new Date(start - r.minutes * 60000).toISOString() }));
}
/** 圆桌两小时，其余半小时；与 .ics 导出保持一致。 */
export function sessionEnd(at: string, kind: string) { return new Date(Date.parse(at) + (kind === 'roundtable' ? 120 : 30) * 60000).toISOString(); }
export const insertSession = "INSERT INTO sessions (id,household_id,title,description,starts_at,ends_at,status,meeting_url,version,created_at,updated_at,kind,creator_id,pair_id,participant_id) VALUES (?,?,?,'',?,?,'scheduled',?,1,?,?,?,?,?,?)";
export const insertNotification = 'INSERT INTO notifications (id,user_id,session,kind,due,read) VALUES (?,?,?,?,?,0) ON CONFLICT DO NOTHING';

/** 建一个四周 Pilot 小组：沿用现有 households / terms / memberships 结构。 */
export async function createHousehold(name: string, hostId: string, topic: string, people: { userId: string; role: 'learner' | 'host'; name: string }[], organizationId=defaultOrganizationId) {
  const d = await pilotDb(), id = randomUUID(), termId = randomUUID(), now = new Date(), iso = now.toISOString();
  const day = (n: number) => new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);
  await pilotTransaction(async () => {
    await d.prepare('INSERT INTO terms (id,name,starts_on,ends_on,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)').run(termId, `${name} · 四周 Pilot`, day(0), day(28), iso, iso);
    await d.prepare("INSERT INTO households (id,organization_id,name,term_id,host_id,timezone,capacity,theme,version,created_at,updated_at,code,week,duration) VALUES (?,?,?,?,?,'Asia/Shanghai',4,?,1,?,?,?,1,4)").run(id, organizationId, name, termId, hostId, topic, iso, iso, randomUUID().replaceAll('-', ''));
    for (const p of people) await d.prepare(insertMembership).run(...membershipRow(id, p.userId, p.role, p.name));
  });
  return id;
}
