import { currentUser, pilotDb, pilotTransaction, reply as out, sameOrigin, teamRole, text, createHousehold } from '../../../server/pilot';
import { userByEmail } from '../../../server/repositories/queries';
import { workspaceRepository } from '../../../server/container';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  const role = await teamRole(u); if (!role) return out({ error: '仅限获授权的青鸟团队。' }, 403);
  try {
    const db = await pilotDb();
    const [applications, households, tasks, staff, placements, pairs, feedback] = await Promise.all([
      db.prepare('SELECT * FROM member_applications ORDER BY created DESC LIMIT 500').all(),
      db.prepare('SELECT id,name,week,theme AS topic,duration FROM households ORDER BY name LIMIT 500').all(),
      db.prepare('SELECT * FROM team_tasks ORDER BY done ASC,created DESC LIMIT 200').all(),
      role === 'admin' ? db.prepare('SELECT * FROM team_members ORDER BY name LIMIT 200').all() : Promise.resolve([]),
      db.prepare('SELECT * FROM placements LIMIT 2000').all(),
      db.prepare("SELECT p.id,p.household,p.url,COALESCE(NULLIF(a.display_name,''),ua.name) AS \"firstName\",COALESCE(NULLIF(b.display_name,''),ub.name) AS \"secondName\" FROM practice_pairs p JOIN memberships a ON a.user_id=p.first AND a.household_id=p.household JOIN users ua ON ua.id=a.user_id JOIN memberships b ON b.user_id=p.second AND b.household_id=p.household JOIN users ub ON ub.id=b.user_id LIMIT 1000").all(),
      db.prepare('SELECT * FROM suggestions ORDER BY created DESC LIMIT 200').all(),
    ]);
    const num = (rows: unknown[]) => (rows as Row[]).map(r => ({ ...r, ...('revision' in r ? { revision: Number(r.revision) } : {}), ...('done' in r ? { done: Number(r.done) } : {}), ...('week' in r ? { week: Number(r.week), duration: Number(r.duration) } : {}) }));
    return out({ feedback, pairs, role, applications: num(applications), households: num(households), tasks: num(tasks), staff, placements });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取运营工作台。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  const role = await teamRole(u); if (!role || !sameOrigin(req)) return out({ error: '没有操作权限。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 20000) return out({ error: '内容过长。' }, 413);
    const b = JSON.parse(raw) as Row, db = await pilotDb(), val = (k: string, n: number) => text(b, k, n);
    const action = val('action', 30), id = val('id', 100);
    if (action === 'review') {
      const status = val('status', 20);
      if (!['new', 'contacted', 'shortlist', 'hold', 'declined', 'interest'].includes(status)) return out({ error: '无效状态。' }, 400);
      if (!Number.isInteger(b.revision) || (b.revision as number) < 0) return out({ error: '请刷新后读取最新资料。' }, 409);
      const oralLevel = val('oral_level', 20);
      if (oralLevel && !['beginner', 'intermediate', 'advanced'].includes(oralLevel)) return out({ error: '无效的口语确认结果。' }, 400);
      const r = await db.prepare('UPDATE member_applications SET status=?,notes=?,oral_level=?,oral_notes=? WHERE id=? AND revision=? AND household IS NULL').run(status, val('notes', 3000), oralLevel, val('oral_notes', 1500), id, b.revision);
      if (!r.changes) return out({ error: '申请已分组或不存在，不能更改状态。' }, 409);
    } else if (action === 'feedbackReview') {
      const status = val('status', 20);
      if (!['new', 'reviewed'].includes(status)) return out({ error: '无效建议状态。' }, 400);
      if (!(await db.prepare('UPDATE suggestions SET status=? WHERE id=?').run(status, id)).changes) return out({ error: '建议不存在。' }, 404);
    } else if (action === 'pairLink') {
      const url = val('url', 500);
      try { if (!url || new URL(url).protocol !== 'https:') throw new Error(); } catch { return out({ error: '请填写以 https:// 开头的会议链接。' }, 400); }
      const pair = await db.prepare('SELECT id,household FROM practice_pairs WHERE id=?').get(id) as Row | undefined;
      if (!pair) return out({ error: '指定配对不存在。' }, 404);
      await pilotTransaction(async () => {
        await db.prepare('UPDATE practice_pairs SET url=? WHERE id=?').run(url, id);
        await db.prepare('UPDATE sessions SET meeting_url=? WHERE pair_id=? AND household_id=? AND starts_at>?').run(url, id, pair.household, new Date().toISOString());
      });
    } else if (action === 'task') {
      const title = val('title', 200); if (!title) return out({ error: '填写待办内容。' }, 400);
      const due = val('due', 10); if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return out({ error: '日期格式无效。' }, 400);
      await db.prepare('INSERT INTO team_tasks (id,title,assignee,due,done,created) VALUES (?,?,?,?,0,?)').run(crypto.randomUUID(), title, val('assignee', 100), due, new Date().toISOString());
    } else if (action === 'complete') {
      await db.prepare('UPDATE team_tasks SET done=? WHERE id=?').run(b.done === true ? 1 : 0, id);
    } else if (action === 'staff') {
      if (role !== 'admin') return out({ error: '只有管理员可以授权工作人员。' }, 403);
      const email = val('email', 254).toLowerCase(), name = val('name', 60);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return out({ error: '填写姓名与有效邮箱。' }, 400);
      await db.prepare('INSERT INTO team_members (email,name) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name').run(email, name);
    } else if (action === 'removeStaff') {
      if (role !== 'admin') return out({ error: '只有管理员可以移除授权。' }, 403);
      await db.prepare('DELETE FROM team_members WHERE email=?').run(val('email', 254).toLowerCase());
    } else if (action === 'match') {
      const name = val('name', 70), hostId = val('hostId', 100);
      const ids = Array.isArray(b.ids) ? [...new Set((b.ids as unknown[]).filter((x): x is string => typeof x === 'string'))] : [];
      if (ids.length !== 4 || !hostId || !name) return out({ error: '选择四位学员、一位 Host，并为 Household 命名。' }, 400);
      const candidates = await db.prepare(`SELECT * FROM member_applications WHERE id IN (${ids.map(() => '?').join(',')}) AND role='learner' AND plan='native' AND language='English' AND status='shortlist' AND household IS NULL`).all(...ids) as Row[];
      const host = await db.prepare("SELECT * FROM member_applications WHERE id=? AND role='host' AND plan='native' AND language='English' AND status='shortlist' AND household IS NULL").get(hostId) as Row | undefined;
      if (candidates.length !== 4 || !host) return out({ error: '所有成员必须在候选名单中，且尚未分组。' }, 409);
      const all = [...candidates, host];
      if (await db.prepare(`SELECT user_id FROM memberships WHERE user_id IN (${all.map(() => '?').join(',')}) LIMIT 1`).get(...all.map(x => x.user_id))) return out({ error: '有成员已在其他 Household，需先人工协调。' }, 409);
      const revisions = Array.isArray(b.revisions) ? b.revisions as { id: string; revision: number }[] : [];
      if (revisions.length !== 5 || new Set(revisions.map(x => x.id)).size !== 5 || all.some(x => !revisions.some(r => r.id === x.id && r.revision === Number(x.revision)))) return out({ error: '资料已有更新，请重新查看最新资料和口语确认结果，再安排分组。' }, 409);
      const repo = await workspaceRepository();
      // 账号都来自邮箱登录，user_id 一定存在；仍以邮箱再核对一次，防止资料被改绑。
      for (const x of all) { const user = await userByEmail(repo, String(x.email)); if (!user || user.id !== x.user_id) return out({ error: `${x.name} 的账号与资料邮箱不一致，请人工核对。` }, 409); }
      const house = await createHousehold(name, String(host.user_id), 'A story behind my name', all.map(x => ({ userId: String(x.user_id), role: x.role === 'host' ? 'host' as const : 'learner' as const, name: String(x.name) })));
      await pilotTransaction(async () => {
        for (const x of all) {
          await db.prepare('INSERT INTO placements (email,household,role,name) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET household=excluded.household,role=excluded.role,name=excluded.name').run(x.email, house, x.role, x.name);
          await db.prepare("UPDATE member_applications SET household=?,status='assigned' WHERE id=?").run(house, x.id);
        }
      });
      return out({ ok: true, household: house });
    } else return out({ error: '无效操作。' }, 400);
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: '未能保存。若成员刚被其他工作人员分组，请刷新后重试。' }, 409); }
}
