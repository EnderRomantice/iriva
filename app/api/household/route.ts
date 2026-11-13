import { randomUUID } from 'node:crypto';
import { isStandardTimezone } from '../../../lib/timezones';
import { currentUser, claimPlacement, member, pilotDb, pilotTransaction, reply, sameOrigin, teamRole, text, count, visibleSession, visibilityArgs, sessionColumns, reminderDue, sessionEnd, insertSession, insertNotification, insertMembership, membershipRow, createHousehold } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  try {
    await claimPlacement(u);
    const d = await pilotDb(), m = await member(u.userId);
    if (!m) {
      const application = await d.prepare('SELECT name,status,household FROM member_applications WHERE user_id=?').get(u.userId);
      return reply({ user: { name: (application as Row | undefined)?.name || u.displayName }, household: null, application: application || null });
    }
    const h = await d.prepare('SELECT id,name,theme AS topic,week,duration,code FROM households WHERE id=?').get(m.household) as Row | undefined;
    if (!h) return reply({ error: '暂时找不到你的 Household。' }, 404);
    const [people, msgs, events] = await Promise.all([
      d.prepare("SELECT COALESCE(NULLIF(m.display_name,''),u.name) AS name,m.role,m.user_id AS \"user\",COALESCE(NULLIF(m.timezone,''),NULLIF(a.timezone,''),CASE WHEN m.role='learner' THEN '+08:00' ELSE '' END) AS timezone FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN member_applications a ON a.user_id=m.user_id WHERE m.household_id=? ORDER BY m.role DESC, m.created_at ASC").all(h.id),
      d.prepare('SELECT id,name,body,created_at AS created FROM household_messages WHERE household_id=? ORDER BY created_at DESC LIMIT 100').all(h.id),
      d.prepare(`SELECT ${sessionColumns()} FROM sessions s WHERE ${visibleSession()} ORDER BY s.starts_at ASC LIMIT 100`).all(...visibilityArgs(m.household, m.role, u.userId)),
    ]);
    const { code, ...household } = h;
    return reply({ user: { name: m.name, role: m.role, id: u.userId }, household: { ...household, week: Number(h.week), duration: Number(h.duration), ...(m.role === 'host' ? { code } : {}) }, people, messages: (msgs as Row[]).reverse(), sessions: events });
  } catch (e) { console.error(e); return reply({ error: '暂时无法读取你的 Household，请稍后重试。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const b = await req.json() as Row, action = text(b, 'action', 20), d = await pilotDb();
    const m = await member(u.userId);
    if (action === 'create' || action === 'join') {
      if (m) return reply({ error: '你已经在一个 Household 里了。' }, 409);
      const name = text(b, 'name', 50); if (!name) return reply({ error: '请填写你的显示名称。' }, 400);
      if (action === 'create') {
        if (!await teamRole(u)) return reply({ error: 'Household 由青鸟团队安排，请先提交加入资料。' }, 403);
        const title = text(b, 'title', 70); if (!title) return reply({ error: '请为 Household 命名。' }, 400);
        await createHousehold(title, u.userId, 'A meal that tastes like home', [{ userId: u.userId, role: 'host', name }]);
      } else {
        const h = await d.prepare('SELECT id FROM households WHERE code=?').get(text(b, 'code', 100)) as Row | undefined;
        if (!h) return reply({ error: '没有找到这个邀请码。' }, 400);
        const joined = await pilotTransaction(async () => {
          if (count(await d.prepare("SELECT COUNT(*) AS n FROM memberships WHERE household_id=? AND role='learner'").get(h.id)) >= 4) return false;
          await d.prepare(insertMembership).run(...membershipRow(String(h.id), u.userId, 'learner', name));
          return true;
        });
        if (!joined) return reply({ error: '这个 Household 已经有四位学员了。' }, 409);
      }
      return reply({ ok: true });
    }
    if (!m) return reply({ error: '请先加入 Household。' }, 403);
    if (action === 'timezone') {
      const timezone = text(b, 'timezone', 20);
      if (!isStandardTimezone(timezone)) return reply({ error: '请选择有效的 UTC 时区。' }, 400);
      await d.prepare('UPDATE memberships SET timezone=? WHERE user_id=? AND household_id=?').run(timezone, u.userId, m.household);
    } else if (action === 'message') {
      const body = text(b, 'body', 2000); if (!body) return reply({ error: '先写点什么吧。' }, 400);
      await d.prepare('INSERT INTO household_messages (id,household_id,author_id,name,body,created_at) VALUES (?,?,?,?,?,?)').run(randomUUID(), m.household, u.userId, m.name, body, new Date().toISOString());
    } else if (action === 'topic') {
      if (m.role !== 'host') return reply({ error: '只有 Host 可以更新每周话题。' }, 403);
      const topic = text(b, 'topic', 500), week = Number(b.week);
      const duration = Number((await d.prepare('SELECT duration FROM households WHERE id=?').get(m.household) as Row | undefined)?.duration || 4);
      if (!topic || !Number.isInteger(week) || week < 1 || week > duration) return reply({ error: `请填写话题，并选择第 1–${duration} 周。` }, 400);
      await d.prepare('UPDATE households SET theme=?,week=?,updated_at=? WHERE id=?').run(topic, week, new Date().toISOString(), m.household);
    } else if (action === 'session') {
      const kind = text(b, 'kind', 20);
      if (!['roundtable', 'one-to-one', 'practice'].includes(kind)) return reply({ error: '无效的安排类型。' }, 400);
      if (kind === 'practice') return reply({ error: '伙伴练习需要对方确认，请到“伙伴练习”发起邀约。' }, 400);
      if (m.role !== 'host') return reply({ error: '只有 Host 可以安排 iriva meeting。' }, 403);
      const title = text(b, 'title', 120), at = text(b, 'at', 40), url = text(b, 'url', 500);
      let participant: string | null = null;
      if (kind === 'one-to-one') {
        participant = text(b, 'participant', 100);
        if (!await d.prepare("SELECT 1 FROM memberships WHERE household_id=? AND user_id=? AND role='learner'").get(m.household, participant)) return reply({ error: '请选择本组的一位学员。' }, 400);
      }
      if (!title || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= Date.now()) return reply({ error: '请填写标题和未来的时间。' }, 400);
      if (url) { try { if (new URL(url).protocol !== 'https:') throw new Error(); } catch { return reply({ error: '会议链接需要以 https:// 开头。' }, 400); } }
      const id = randomUUID(), when = new Date(at).toISOString(), now = new Date();
      const recipients = (participant
        ? await d.prepare("SELECT user_id FROM memberships WHERE household_id=? AND (role='host' OR user_id=?)").all(m.household, participant)
        : await d.prepare('SELECT user_id FROM memberships WHERE household_id=?').all(m.household)) as Row[];
      await pilotTransaction(async () => {
        await d.prepare(insertSession).run(id, m.household, title, when, sessionEnd(when, kind), url, now.toISOString(), now.toISOString(), kind, u.userId, null, participant);
        for (const person of recipients) for (const r of [...(person.user_id === u.userId ? [] : [{ kind: 'published', due: now.toISOString() }]), ...reminderDue(when, now)])
          await d.prepare(insertNotification).run(randomUUID(), person.user_id, id, r.kind, r.due);
      });
    } else return reply({ error: '无效操作。' }, 400);
    return reply({ ok: true });
  } catch (e) { console.error(e); return reply({ error: '没能保存，请稍后重试。' }, 400); }
}

