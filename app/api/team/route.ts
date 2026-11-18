import {workspaceOrganizations} from '../../../server/services/workspace-access';
import {randomUUID} from 'node:crypto';
import { auditOperation, auditedOperation, canManage, saveOrganizationMember, removeOrganizationMember } from '../../../server/services/organization-access';
import { addPilotHost } from '../../../server/services/pilot-hosts';
import { DomainError } from '../../../domain/commands';
import { errorResponse } from '../../../server/http';
import { currentUser, pilotDb, pilotTransaction, reply as out, sameOrigin, currentTeamContext, text, createHousehold } from '../../../server/pilot';
import { userByEmail } from '../../../server/repositories/queries';
import { workspaceRepository } from '../../../server/container';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  let ctx;try{ctx=await currentTeamContext()}catch(e){return errorResponse(e)} if(!ctx)return out({error:'请使用密码登录。'},401);
  const organizationId=ctx.organization.id, role=canManage(ctx.organization.role)?'admin':'staff';
  try {
    const db = await pilotDb();
    const organizations=await workspaceOrganizations(await workspaceRepository(),u);
    const [applications, households, tasks, staff, placements, pairs, feedback, hosts] = await Promise.all([
      role==='admin'?db.prepare('SELECT * FROM member_applications WHERE organization_id=? ORDER BY created DESC LIMIT 500').all(organizationId):Promise.resolve([]),
      db.prepare('SELECT id,name,week,theme AS topic,duration FROM households WHERE organization_id=? OR organization_id IN (SELECT id FROM organizations WHERE parent_id=?) ORDER BY name LIMIT 500').all(organizationId,organizationId),
      db.prepare('SELECT * FROM team_tasks WHERE organization_id=? ORDER BY done ASC,created DESC LIMIT 200').all(organizationId),
      role === 'admin' ? db.prepare('SELECT u.id,u.email,u.name,a.role FROM organization_access a JOIN users u ON u.id=a.user_id WHERE a.organization_id=? ORDER BY u.name LIMIT 200').all(organizationId) : Promise.resolve([]),
      role==='admin'?db.prepare('SELECT p.* FROM placements p JOIN households h ON h.id=p.household WHERE h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?) LIMIT 2000').all(organizationId,organizationId):Promise.resolve([]),
      role==='admin'?db.prepare("SELECT p.id,p.household,p.url,COALESCE(NULLIF(a.display_name,''),ua.name) AS \"firstName\",COALESCE(NULLIF(b.display_name,''),ub.name) AS \"secondName\" FROM practice_pairs p JOIN memberships a ON a.user_id=p.first AND a.household_id=p.household JOIN users ua ON ua.id=a.user_id JOIN memberships b ON b.user_id=p.second AND b.household_id=p.household JOIN users ub ON ub.id=b.user_id JOIN households h ON h.id=p.household WHERE h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?) LIMIT 1000").all(organizationId,organizationId):Promise.resolve([]),
      role==='admin'?db.prepare('SELECT * FROM suggestions WHERE organization_id=? ORDER BY created DESC LIMIT 200').all(organizationId):Promise.resolve([]),
      role==='admin'?db.prepare("SELECT h.email,h.name,u.id AS user_id,COALESCE(p.household,(SELECT m.household_id FROM memberships m WHERE m.user_id=u.id AND m.role='host' AND m.household_id IN (SELECT id FROM households WHERE organization_id=h.organization_id OR organization_id IN (SELECT id FROM organizations WHERE parent_id=h.organization_id)) ORDER BY m.created_at ASC LIMIT 1)) AS household FROM organization_hosts h LEFT JOIN users u ON lower(u.email)=h.email LEFT JOIN placements p ON p.email=h.email AND p.role='host' AND p.household IN (SELECT id FROM households WHERE organization_id=h.organization_id OR organization_id IN (SELECT id FROM organizations WHERE parent_id=h.organization_id)) WHERE h.organization_id=? ORDER BY h.created DESC LIMIT 2000").all(organizationId):Promise.resolve([]),
    ]);
    const num = (rows: unknown[]) => (rows as Row[]).map(r => ({ ...r, ...('revision' in r ? { revision: Number(r.revision) } : {}), ...('done' in r ? { done: Number(r.done) } : {}), ...('week' in r ? { week: Number(r.week), duration: Number(r.duration) } : {}) }));
    await auditOperation(await workspaceRepository(),ctx,'team.view');
    return out({ organization:ctx.organization,organizations,hosts, feedback, pairs, role, applications: num(applications), households: num(households), tasks: num(tasks), staff, placements });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取运营工作台。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if(!sameOrigin(req))return out({error:'请求来源不正确。'},403);
  try {
    const raw = await req.text(); if (raw.length > 20000) return out({ error: '内容过长。' }, 413);
    const b = JSON.parse(raw) as Row, db = await pilotDb(), val = (k: string, n: number) => text(b, k, n);
    const action = val('action', 30), id = val('id', 100);
    const ctx=await currentTeamContext();if(!ctx)return out({error:'请使用密码登录。'},401);
    return await auditedOperation(await workspaceRepository(),ctx,action,id||val('email',200)||val('name',70)||val('title',200),async current=>{
    const organizationId=current.organization.id,role=canManage(current.organization.role)?'admin':'staff';
    if(role!=='admin'&&!['task','complete'].includes(action))return out({error:'Partner 只能参与协作，不能执行管理操作。'},403);
    if (action === 'host') {
      try { await addPilotHost(await workspaceRepository(), b,organizationId); } catch (e) { return errorResponse(e); }
    } else if (action === 'review') {
      const status = val('status', 20);
      if (!['new', 'contacted', 'shortlist', 'hold', 'declined', 'interest'].includes(status)) return out({ error: '无效状态。' }, 400);
      if (!Number.isInteger(b.revision) || (b.revision as number) < 0) return out({ error: '请刷新后读取最新资料。' }, 409);
      const oralLevel = val('oral_level', 20);
      if (oralLevel && !['beginner', 'intermediate', 'advanced'].includes(oralLevel)) return out({ error: '无效的口语确认结果。' }, 400);
      const r = await db.prepare('UPDATE member_applications SET status=?,notes=?,oral_level=?,oral_notes=? WHERE id=? AND revision=? AND household IS NULL AND organization_id=?').run(status, val('notes', 3000), oralLevel, val('oral_notes', 1500), id, b.revision, organizationId);
      if (!r.changes) return out({ error: '申请已分组或不存在，不能更改状态。' }, 409);
    } else if (action === 'feedbackReview') {
      const status = val('status', 20);
      if (!['new', 'reviewed'].includes(status)) return out({ error: '无效建议状态。' }, 400);
      if (!(await db.prepare('UPDATE suggestions SET status=? WHERE id=? AND organization_id=?').run(status, id,organizationId)).changes) return out({ error: '建议不存在。' }, 404);
    } else if (action === 'pairLink') {
      const url = val('url', 500);
      try { if (!url || new URL(url).protocol !== 'https:') throw new Error(); } catch { return out({ error: '请填写以 https:// 开头的会议链接。' }, 400); }
      const pair = await db.prepare('SELECT p.id,p.household FROM practice_pairs p JOIN households h ON h.id=p.household WHERE p.id=? AND (h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?))').get(id,organizationId,organizationId) as Row | undefined;
      if (!pair) return out({ error: '指定配对不存在。' }, 404);
      await pilotTransaction(async () => {
        await db.prepare('UPDATE practice_pairs SET url=? WHERE id=?').run(url, id);
        await db.prepare('UPDATE sessions SET meeting_url=? WHERE pair_id=? AND household_id=? AND starts_at>?').run(url, id, pair.household, new Date().toISOString());
      });
    } else if (action === 'task') {
      const title = val('title', 200); if (!title) return out({ error: '填写待办内容。' }, 400);
      const due = val('due', 10); if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return out({ error: '日期格式无效。' }, 400);
      await db.prepare('INSERT INTO team_tasks (id,title,assignee,due,done,created,organization_id) VALUES (?,?,?,?,0,?,?)').run(crypto.randomUUID(), title, val('assignee', 100), due, new Date().toISOString(),organizationId);
    } else if (action === 'complete') {
      if(!(await db.prepare('UPDATE team_tasks SET done=? WHERE id=? AND organization_id=?').run(b.done === true ? 1 : 0,id,organizationId)).changes)return out({error:'待办不存在。'},404);
    } else if (action === 'staff') {
      if (role !== 'admin') return out({ error: '只有管理员可以授权工作人员。' }, 403);
      const email = val('email', 254).toLowerCase(), name = val('name', 60);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return out({ error: '填写姓名与有效邮箱。' }, 400);
      try { await saveOrganizationMember(await workspaceRepository(), current, { email, name,role:b.role||'partner', password: typeof b.password === 'string' ? b.password : undefined }); } catch (e) { return errorResponse(e); }
    } else if (action === 'removeStaff') {
      if (role !== 'admin') return out({ error: '只有管理员可以移除授权。' }, 403);
      await removeOrganizationMember(await workspaceRepository(),current,val('email',254));
    } else if (action === 'match') {
      // Hosts do not apply: the team names the Host by login email. An existing account joins now;
      // otherwise a placement makes them join automatically on first sign-in (see claimPlacement).
      const name = val('name', 70), hostEmail = val('hostEmail', 200).toLowerCase(), hostName = val('hostName', 60);
      const ids = Array.isArray(b.ids) ? [...new Set((b.ids as unknown[]).filter((x): x is string => typeof x === 'string'))] : [];
      if (ids.length !== 4 || !name || !hostEmail || !hostName) return out({ error: '选择四位学员，填写 Host 的邮箱和名字，并为 Household 命名。' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail)) return out({ error: 'Host 邮箱格式不正确。' }, 400);
      const candidates = await db.prepare(`SELECT * FROM member_applications WHERE id IN (${ids.map(() => '?').join(',')}) AND role='learner' AND plan='native' AND language='English' AND status='shortlist' AND household IS NULL AND organization_id=?`).all(...ids,organizationId) as Row[];
      if (candidates.length !== 4) return out({ error: '所有学员必须在候选名单中，且尚未分组。' }, 409);
      if (candidates.some(x => String(x.email).toLowerCase() === hostEmail)) return out({ error: 'Host 不能同时是这组的学员。' }, 409);
      if (await db.prepare(`SELECT 1 FROM pilot_hosts WHERE email IN (${candidates.map(() => '?').join(',')})`).get(...candidates.map(x => String(x.email).toLowerCase()))) return out({ error: '候选学员中有已授权的 Host，请重新选择。' }, 409);
      const repo = await workspaceRepository();let hostUser = await userByEmail(repo, hostEmail);
      const accounts = candidates.map(x => String(x.user_id));
      if (await db.prepare(`SELECT user_id FROM memberships WHERE user_id IN (${accounts.map(() => '?').join(',')}) LIMIT 1`).get(...accounts)) return out({ error: '有成员或 Host 已在其他 Household，需先人工协调。' }, 409);
      if ((hostUser&&await db.prepare("SELECT 1 FROM memberships m JOIN households h ON h.id=m.household_id WHERE m.user_id=? AND (m.role='learner' OR h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?))").get(hostUser.id,organizationId,organizationId))||await db.prepare("SELECT 1 FROM placements p JOIN households h ON h.id=p.household WHERE p.email=? AND (p.role='learner' OR h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?))").get(hostEmail,organizationId,organizationId)) return out({ error: '这位 Host 已被安排到其他 Household，需先人工协调。' }, 409);
      const revisions = Array.isArray(b.revisions) ? b.revisions as { id: string; revision: number }[] : [];
      if (revisions.length !== 4 || new Set(revisions.map(x => x.id)).size !== 4 || candidates.some(x => !revisions.some(r => r.id === x.id && r.revision === Number(x.revision)))) return out({ error: '资料已有更新，请重新查看最新资料和口语确认后再分组。' }, 409);
      // 账号都来自邮箱登录，user_id 一定存在；仍以邮箱再核对一次，防止资料被改绑。
      for (const x of candidates) { const user = await userByEmail(repo, String(x.email)); if (!user || user.id !== x.user_id) return out({ error: `${x.name} 的账号与资料邮箱不一致，请人工核对。` }, 409); }
      // Invite-only email identity: no password or session is created here.
      if(!hostUser){const now=new Date().toISOString();hostUser={id:randomUUID(),name:hostName,email:hostEmail,timezone:'+08:00',avatar:'',version:1,createdAt:now,updatedAt:now};await repo.saveUser(hostUser)}
      const house = await createHousehold(name, hostUser?.id ?? u.userId, '', [
        ...candidates.map(x => ({ userId: String(x.user_id), role: 'learner' as const, name: String(x.name) })),
        ...(hostUser ? [{ userId: hostUser.id, role: 'host' as const, name: hostName }] : []),
      ],organizationId);
      await pilotTransaction(async () => {
        const place = 'INSERT INTO placements (email,household,role,name) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET household=excluded.household,role=excluded.role,name=excluded.name';
        for (const x of candidates) {
          await db.prepare(place).run(x.email, house, 'learner', x.name);
          await db.prepare("UPDATE member_applications SET household=?,status='assigned' WHERE id=?").run(house, x.id);
        }
        await db.prepare('INSERT INTO pilot_hosts (email,name,created) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING').run(hostEmail, hostName, new Date().toISOString());
        await db.prepare('INSERT INTO organization_hosts VALUES (?,?,?,?) ON CONFLICT(organization_id,email) DO UPDATE SET name=excluded.name').run(organizationId,hostEmail,hostName,new Date().toISOString());
        // Host membership is already saved; legacy placements are only needed for old invitations.
        await db.prepare("UPDATE member_applications SET household=?,status='assigned' WHERE lower(email)=? AND role='host' AND household IS NULL AND organization_id=?").run(house, hostEmail,organizationId);
      });
      return out({ ok: true, household: house, hostJoined: !!hostUser });
    } else return out({ error: '无效操作。' }, 400);
    return out({ ok: true });
    },action==='staff'&&['admin','partner'].includes(String(b.role))?{role:b.role}:{});
  } catch (e) { if(e instanceof DomainError)return errorResponse(e);console.error(e); return out({ error: '未能保存。若成员刚被其他工作人员分组，请刷新后重试。' }, 409); }
}
