import { randomUUID } from 'node:crypto';
import { currentUser, member, pilotDb, pilotTransaction, reply as out, sameOrigin } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;
type Pair = { first: string; second: string; url: string };

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  try {
    const db = await pilotDb(), m = await member(u.userId);
    if (!m) return out({ error: '请先加入 Household。' }, 403);
    const pairs = m.role === 'host'
      ? await db.prepare('SELECT * FROM practice_pairs WHERE household=? ORDER BY slot').all(m.household)
      : await db.prepare('SELECT * FROM practice_pairs WHERE household=? AND (first=? OR second=?) ORDER BY slot').all(m.household, u.userId, u.userId);
    return out({ pairs: (pairs as Row[]).map(p => ({ ...p, slot: Number(p.slot) })) });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取指定伙伴。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const db = await pilotDb(), m = await member(u.userId);
    if (m?.role !== 'host') return out({ error: '仅本 Household 的 Host 可以指定练习对象。' }, 403);
    const raw = await req.text(); if (raw.length > 8000) return out({ error: '资料过长。' }, 413);
    const b = JSON.parse(raw) as { pairs?: Pair[] };
    if (!Array.isArray(b.pairs) || b.pairs.length !== 2) return out({ error: '请为四位学员指定两对练习伙伴。' }, 400);
    const p = b.pairs;
    if (p.some(x => !x || typeof x.first !== 'string' || typeof x.second !== 'string' || typeof x.url !== 'string')) return out({ error: '配对资料无效。' }, 400);
    const ids = p.flatMap(x => [x.first, x.second]);
    if (new Set(ids).size !== 4) return out({ error: '每位学员必须且只能有一位指定伙伴。' }, 400);
    const people = await db.prepare("SELECT user_id FROM memberships WHERE household_id=? AND role='learner'").all(m.household) as Row[];
    if (people.length !== 4 || ids.some(id => !people.some(x => x.user_id === id))) return out({ error: '只能为本 Household 的四位学习者指定伙伴。' }, 400);
    for (const x of p) {
      if (x.url.length > 500) return out({ error: '链接过长。' }, 400);
      if (x.url.trim()) { try { if (new URL(x.url.trim()).protocol !== 'https:') throw new Error(); } catch { return out({ error: '会议链接需要以 https:// 开头。' }, 400); } }
    }
    const old = await db.prepare('SELECT * FROM practice_pairs WHERE household=?').all(m.household) as Row[];
    const same = (x: Pair, o: Row) => [o.first, o.second].includes(x.first) && [o.first, o.second].includes(x.second);
    const changing = old.some(o => !p.some(x => same(x, o))) || old.length !== p.length;
    const now = new Date().toISOString();
    if (changing && old.length) {
      if (await db.prepare("SELECT id FROM practice_invites WHERE household=? AND status='pending' AND at>? LIMIT 1").get(m.household, now)) return out({ error: '有待回应的练习邀约，请先让双方处理完，再更换对象。' }, 409);
      if (await db.prepare('SELECT id FROM sessions WHERE household_id=? AND pair_id IS NOT NULL AND starts_at>? LIMIT 1').get(m.household, now)) return out({ error: '已有未来的伙伴练习安排，请先完成这些练习，再更换对象。固定链接仍可更新。' }, 409);
    }
    await pilotTransaction(async () => {
      if (changing) await db.prepare('DELETE FROM practice_pairs WHERE household=?').run(m.household);
      for (const [index, x] of p.entries()) {
        const existing = old.find(o => same(x, o));
        if (existing && !changing) {
          await db.prepare('UPDATE practice_pairs SET url=? WHERE id=? AND household=?').run(x.url.trim(), existing.id, m.household);
          await db.prepare('UPDATE sessions SET meeting_url=? WHERE pair_id=? AND household_id=? AND starts_at>?').run(x.url.trim(), existing.id, m.household, now);
        } else await db.prepare('INSERT INTO practice_pairs (id,household,first,second,url,slot) VALUES (?,?,?,?,?,?)').run(randomUUID(), m.household, x.first, x.second, x.url.trim(), index + 1);
      }
    });
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: '配对未能保存，请重试。' }, 503); }
}
