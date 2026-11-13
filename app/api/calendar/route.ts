import { calendarEvent } from '../../../lib/calendar';
import { currentUser, member, pilotDb, visibleSession, visibilityArgs, sessionColumns } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const u = await currentUser(); if (!u) return Response.json({ error: '请先登录。' }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return Response.json({ error: '请选择日程。' }, { status: 400 });
    const m = await member(u.userId); if (!m) return new Response('Forbidden', { status: 403 });
    const s = await (await pilotDb()).prepare(`SELECT ${sessionColumns()} FROM sessions s WHERE s.id=? AND ${visibleSession()}`).get(id, ...visibilityArgs(m.household, m.role, u.userId));
    if (!s) return new Response('Not found', { status: 404 });
    return new Response(calendarEvent(s as { id: string; title: string; kind: string; at: string; url: string }), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="iriva-session.ics"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { console.error(e); return Response.json({ error: '暂时无法导出日程。' }, { status: 503 }); }
}
