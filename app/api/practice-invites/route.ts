import { randomUUID } from 'node:crypto';
import { currentUser, member, pilotDb, pilotTransaction, reply as out, sameOrigin, text, reminderDue, sessionEnd, insertSession, insertNotification } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;
const memberName = (alias: string, user: string) => `COALESCE(NULLIF(${alias}.display_name,''),(SELECT name FROM users WHERE id=${user}))`;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  try {
    const db = await pilotDb(), m = await member(u.userId);
    if (!m) return out({ items: [], pending: 0 });
    const host = m.role === 'host';
    const list = await db.prepare(`SELECT i.*,${memberName('a', 'i.sender')} AS "senderName",${memberName('b', 'i.recipient')} AS "recipientName" FROM practice_invites i JOIN practice_pairs p ON p.id=i.pair AND p.household=i.household JOIN memberships a ON a.user_id=i.sender AND a.household_id=i.household JOIN memberships b ON b.user_id=i.recipient AND b.household_id=i.household WHERE i.household=? AND ${host ? '1=1' : '(i.sender=? OR i.recipient=?)'} ORDER BY i.updated DESC LIMIT 100`).all(...(host ? [m.household] : [m.household, u.userId, u.userId])) as Row[];
    const items = list.map(i => ({ ...i, version: Number(i.version) }) as Row);
    return out({ items, pending: items.filter(i => i.status === 'pending' && i.recipient === u.userId && Date.parse(String(i.at)) > Date.now()).length });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取练习邀约。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 6000) return out({ error: '内容过长。' }, 413);
    const b = JSON.parse(raw) as Row, val = (k: string, n: number) => text(b, k, n), db = await pilotDb(), action = val('action', 20);
    const m = await member(u.userId);
    if (!m || m.role !== 'learner') return out({ error: '只有配对中的学习者可以发起或回应邀约。' }, 403);
    const now = new Date(), iso = now.toISOString();
    if (action === 'propose') {
      const p = await db.prepare('SELECT * FROM practice_pairs WHERE household=? AND (first=? OR second=?)').get(m.household, u.userId, u.userId) as Row | undefined;
      if (!p) return out({ error: '请先由 Host 指定练习对象。' }, 400);
      if (!p.url) return out({ error: '请先由 Host 或工作人员设置固定会议链接。' }, 400);
      const topic = val('topic', 120), at = val('at', 40);
      if (!topic || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= now.getTime()) return out({ error: '请填写话题和未来的时间。' }, 400);
      if (await db.prepare("SELECT id FROM practice_invites WHERE pair=? AND status='pending' AND at>?").get(p.id, iso)) return out({ error: '你们已有一份待回应的邀约，请先回应或撤回，再发起新的时间。' }, 409);
      const recipient = p.first === u.userId ? p.second : p.first;
      await pilotTransaction(async () => {
        await db.prepare("UPDATE practice_invites SET status='expired',version=version+1,updated=? WHERE pair=? AND status='pending' AND at<=?").run(iso, p.id, iso);
        await db.prepare("INSERT INTO practice_invites (id,household,pair,sender,recipient,topic,at,status,version,created,updated) VALUES (?,?,?,?,?,?,?,'pending',0,?,?)").run(randomUUID(), m.household, p.id, u.userId, recipient, topic, new Date(at).toISOString(), iso, iso);
      });
      return out({ ok: true });
    }
    const id = val('id', 100), version = Number(b.version);
    if (!id || !Number.isInteger(version) || version < 0) return out({ error: '邀约版本无效，请刷新。' }, 400);
    const i = await db.prepare('SELECT i.*,p.url FROM practice_invites i JOIN practice_pairs p ON p.id=i.pair AND p.household=i.household WHERE i.id=? AND i.household=? AND (i.sender=? OR i.recipient=?) AND (p.first=? OR p.second=?)').get(id, m.household, u.userId, u.userId, u.userId, u.userId) as Row | undefined;
    if (!i) return out({ error: '找不到这份邀约。' }, 404);
    if (i.status !== 'pending' || Number(i.version) !== version) return out({ error: '邀约已更新，请刷新后查看。' }, 409);
    if (Date.parse(String(i.at)) <= now.getTime() && action !== 'withdraw') return out({ error: '这个时间已经过去，请发起新的邀约。' }, 400);
    if (action === 'counter') {
      if (i.recipient !== u.userId) return out({ error: '请等待伙伴回应，或撤回后重新发起。' }, 403);
      const at = val('at', 40), topic = val('topic', 120) || String(i.topic);
      if (!Number.isFinite(Date.parse(at)) || Date.parse(at) <= now.getTime()) return out({ error: '请选择未来的时间。' }, 400);
      const r = await db.prepare("UPDATE practice_invites SET sender=?,recipient=?,at=?,topic=?,version=version+1,updated=? WHERE id=? AND recipient=? AND status='pending' AND version=?").run(u.userId, i.sender, new Date(at).toISOString(), topic, iso, id, u.userId, version);
      if (!r.changes) return out({ error: '邀约已更新，请刷新。' }, 409);
    } else if (action === 'decline' || action === 'withdraw') {
      const actor = action === 'withdraw' ? 'sender' : 'recipient';
      if (i[actor] !== u.userId) return out({ error: '不能代替伙伴回应。' }, 403);
      const r = await db.prepare(`UPDATE practice_invites SET status=?,version=version+1,updated=? WHERE id=? AND ${actor}=? AND status='pending' AND version=?`).run(action === 'withdraw' ? 'withdrawn' : 'declined', iso, id, u.userId, version);
      if (!r.changes) return out({ error: '邀约已更新，请刷新。' }, 409);
    } else if (action === 'accept') {
      if (i.recipient !== u.userId) return out({ error: '请由收到邀约的伙伴确认。' }, 403);
      if (!i.url) return out({ error: '固定会议链接尚未设置。' }, 400);
      const session = `practice-${id}`, at = String(i.at);
      const names = await db.prepare("SELECT COALESCE(NULLIF(m.display_name,''),u.name) AS name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.household_id=? AND m.user_id IN (?,?)").all(m.household, i.sender, i.recipient) as Row[];
      const title = `${names.map(n => n.name).join(' & ')} · ${i.topic}`.slice(0, 120);
      const recipients = await db.prepare("SELECT user_id FROM memberships WHERE household_id=? AND (role='host' OR user_id IN (?,?))").all(m.household, i.sender, i.recipient) as Row[];
      const accepted = await pilotTransaction(async () => {
        const r = await db.prepare("UPDATE practice_invites SET status='accepted',session=?,version=version+1,updated=? WHERE id=? AND recipient=? AND status='pending' AND version=? AND at>?").run(session, iso, id, u.userId, version, iso);
        if (!r.changes) return false;
        await db.prepare(insertSession + ' ON CONFLICT DO NOTHING').run(session, m.household, title, at, sessionEnd(at, 'practice'), i.url, iso, iso, 'practice', u.userId, i.pair, null);
        for (const person of recipients) for (const r2 of [{ kind: 'published', due: iso }, ...reminderDue(at, now)]) await db.prepare(insertNotification).run(randomUUID(), person.user_id, session, r2.kind, r2.due);
        return true;
      });
      if (!accepted) return out({ error: '邀约已变化，尚未确认，请刷新。' }, 409);
      return out({ ok: true, session });
    } else return out({ error: '无效操作。' }, 400);
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: '操作未完成，请刷新后重试。' }, 503); }
}
