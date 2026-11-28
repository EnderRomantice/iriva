import {canManage} from '../../../../server/services/organization-access';
import { currentUser, pilotDb, reply, sameOrigin, currentTeamContext } from '../../../../server/pilot';
import { memberAvatarUrl, parseAvatar } from '../../../../domain/household-avatar';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * A member's personal avatar. Readable by the member, anyone who shares a Household with them,
 * and the team. URLs carry ?v=<updated> so the image can be cached privately.
 */
export async function GET(req: Request) {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  const id = new URL(req.url).searchParams.get('u') || u.userId, d = await pilotDb();
  let teamAccess=false;
  if(id!==u.userId&&u.authMethod==='password'){const ctx=await currentTeamContext();if(ctx&&canManage(ctx.organization.role))teamAccess=!!await d.prepare('SELECT 1 FROM memberships m JOIN households h ON h.id=m.household_id WHERE m.user_id=? AND (h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?))').get(id,ctx.organization.id,ctx.organization.id);}
  if (id !== u.userId && !teamAccess) {
    const shared = await d.prepare('SELECT 1 FROM memberships a JOIN memberships b ON a.household_id=b.household_id WHERE a.user_id=? AND b.user_id=? LIMIT 1').get(u.userId, id);
    if (!shared) return new Response(null, { status: 404 });
  }
  const row = await d.prepare('SELECT data_url FROM member_avatars WHERE user_id=?').get(id) as { data_url?: string } | undefined;
  const image = parseAvatar(row?.data_url);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}

/** Set ({ image: dataUrl }) or remove ({ image: null }) your own avatar. */
export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 300_000) return reply({ error: '图片太大，请换一张。' }, 413);
    const b = JSON.parse(raw) as { image?: unknown }, d = await pilotDb();
    if (b.image === null) { await d.prepare('DELETE FROM member_avatars WHERE user_id=?').run(u.userId); return reply({ ok: true, avatar: null }); }
    if (!parseAvatar(b.image)) return reply({ error: '请上传 200KB 以内的 PNG、JPEG 或 WebP 图片。' }, 400);
    const now = new Date().toISOString();
    await d.prepare('INSERT INTO member_avatars (user_id,data_url,updated_at) VALUES (?,?,?) ON CONFLICT (user_id) DO UPDATE SET data_url=excluded.data_url,updated_at=excluded.updated_at').run(u.userId, b.image, now);
    return reply({ ok: true, avatar: memberAvatarUrl(u.userId, now) });
  } catch (e) { console.error(e); return reply({ error: '没能保存头像，请稍后重试。' }, 400); }
}
