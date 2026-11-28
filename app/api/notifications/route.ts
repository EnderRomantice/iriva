import {publishNotificationChanges} from '../../../server/notification-events';
import {DomainError} from '../../../domain/commands';
import { randomUUID } from 'node:crypto';
import { currentUser, currentMember, pilotDb, reply as out, sameOrigin, visibleSession, visibilityArgs, reminderDue, insertNotification } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  try {
    const db = await pilotDb(), m = await currentMember(u.userId);
    if (!m) return out({ items: [], unread: 0, pending:0 });
    const now = new Date().toISOString(), args = visibilityArgs(m.household, m.role, u.userId);
    // 补齐提前一天和提前 15 分钟的提醒（每个会话每种只写一次）。
    const events = await db.prepare(`SELECT s.id,s.starts_at AS at FROM sessions s WHERE ${visibleSession()} AND s.starts_at>? AND (SELECT COUNT(*) FROM notifications existing WHERE existing.user_id=? AND existing.session=s.id AND existing.kind IN ('day','soon'))<2 ORDER BY s.starts_at LIMIT 100`).all(...args, now, u.userId) as Row[];
    for (const s of events) for (const r of reminderDue(String(s.at))) await db.prepare(insertNotification).run(randomUUID(), u.userId, s.id, r.kind, r.due);
    const items = await db.prepare(`SELECT n.id,n.kind,n.read,s.id AS "sessionId",s.title,s.starts_at AS at,s.meeting_url AS url FROM notifications n JOIN sessions s ON s.id=n.session WHERE n.user_id=? AND n.due<=? AND (n.kind='review' OR s.starts_at>?) AND ${visibleSession()} ORDER BY n.read ASC,n.due DESC LIMIT 100`).all(u.userId, now, new Date(Date.now() - 2 * 3600000).toISOString(), ...args) as Row[];
    const list = items.map(x => ({ ...x, read: Number(x.read) }));
    // Only count invitations relevant to the bell; never load the invitation list here.
    const pending=await db.prepare(`SELECT COUNT(*) AS count FROM practice_invites i JOIN practice_pairs p ON p.id=i.pair AND p.household=i.household WHERE i.household=? AND i.recipient=? AND i.status='pending' AND i.at>? AND EXISTS(SELECT 1 FROM memberships a WHERE a.household_id=i.household AND a.user_id=i.sender) AND EXISTS(SELECT 1 FROM memberships b WHERE b.household_id=i.household AND b.user_id=i.recipient)`).get(m.household,u.userId,now) as {count:number|string};
    return out({ items: list, unread: list.filter(x => !x.read).length, pending:Number(pending.count) });
  } catch (e) { if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});console.error(e); return out({ error: '暂时无法读取通知。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const b = await req.json() as { id?: string; all?: boolean }, db = await pilotDb(), now = new Date().toISOString();
    const m=await currentMember(u.userId);if(!m)return out({error:'请先加入 Household。'},403);
    if (b.all === true) await db.prepare('UPDATE notifications SET read=1 WHERE user_id=? AND due<=? AND session IN (SELECT id FROM sessions WHERE household_id=?)').run(u.userId, now,m.household);
    else if (typeof b.id === 'string') await db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=? AND due<=? AND session IN (SELECT id FROM sessions WHERE household_id=?)').run(b.id, u.userId, now,m.household);
    else return out({ error: '请选择通知。' }, 400);
    publishNotificationChanges([u.userId]);
    return out({ ok: true });
  } catch (e) { if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});console.error(e); return out({ error: '未能标记已读，请重试。' }, 503); }
}
