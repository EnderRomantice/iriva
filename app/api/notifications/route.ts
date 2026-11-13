import { randomUUID } from 'node:crypto';
import { currentUser, member, pilotDb, reply as out, sameOrigin, visibleSession, visibilityArgs, reminderDue, insertNotification } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  try {
    const db = await pilotDb(), m = await member(u.userId);
    if (!m) return out({ items: [], unread: 0 });
    const now = new Date().toISOString(), args = visibilityArgs(m.household, m.role, u.userId);
    // 补齐提前一天和提前 15 分钟的提醒（每个会话每种只写一次）。
    const events = await db.prepare(`SELECT s.id,s.starts_at AS at FROM sessions s WHERE ${visibleSession()} AND s.starts_at>? AND (SELECT COUNT(*) FROM notifications existing WHERE existing.user_id=? AND existing.session=s.id AND existing.kind IN ('day','soon'))<2 ORDER BY s.starts_at LIMIT 100`).all(...args, now, u.userId) as Row[];
    for (const s of events) for (const r of reminderDue(String(s.at))) await db.prepare(insertNotification).run(randomUUID(), u.userId, s.id, r.kind, r.due);
    const items = await db.prepare(`SELECT n.id,n.kind,n.read,s.id AS "sessionId",s.title,s.starts_at AS at,s.meeting_url AS url FROM notifications n JOIN sessions s ON s.id=n.session WHERE n.user_id=? AND n.due<=? AND s.starts_at>? AND ${visibleSession()} ORDER BY n.read ASC,n.due DESC LIMIT 100`).all(u.userId, now, new Date(Date.now() - 2 * 3600000).toISOString(), ...args) as Row[];
    const list = items.map(x => ({ ...x, read: Number(x.read) }));
    return out({ items: list, unread: list.filter(x => !x.read).length });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取通知。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const b = await req.json() as { id?: string; all?: boolean }, db = await pilotDb(), now = new Date().toISOString();
    if (b.all === true) await db.prepare('UPDATE notifications SET read=1 WHERE user_id=? AND due<=?').run(u.userId, now);
    else if (typeof b.id === 'string') await db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=? AND due<=?').run(b.id, u.userId, now);
    else return out({ error: '请选择通知。' }, 400);
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: '未能标记已读，请重试。' }, 503); }
}
