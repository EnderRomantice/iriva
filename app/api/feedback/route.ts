import { randomUUID } from 'node:crypto';
import { currentUser, pilotDb, reply as out, sameOrigin, count } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** “给青鸟的建议”，写入 suggestions（现有 feedback 表是 Host 对练习的反馈）。 */
export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录后提交。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 6000) return out({ error: '建议内容过长。' }, 413);
    const b = JSON.parse(raw);
    if (typeof b.body !== 'string' || !b.body.trim() || b.body.trim().length > 2000 || !['learning', 'matching', 'tools', 'other'].includes(b.category) || b.consent !== true) return out({ error: '请填写建议、选择类别，并确认资料用途。' }, 400);
    const db = await pilotDb(), since = new Date(Date.now() - 86400000).toISOString();
    if (count(await db.prepare('SELECT COUNT(*) AS n FROM suggestions WHERE user_id=? AND created>?').get(u.userId, since)) >= 10) return out({ error: '今天提交较多，请明天再来补充。' }, 429);
    await db.prepare("INSERT INTO suggestions (id,user_id,email,category,body,status,created) VALUES (?,?,?,?,?,'new',?)").run(randomUUID(), u.userId, u.email.toLowerCase(), b.category, b.body.trim(), new Date().toISOString());
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: '暂时未能保存，请稍后重试。' }, 503); }
}
