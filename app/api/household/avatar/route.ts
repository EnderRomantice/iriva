import {DomainError} from '../../../../domain/commands';
import { currentUser, currentMember, pilotDb, reply } from '../../../../server/pilot';
import { parseAvatar } from '../../../../domain/household-avatar';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The current member's Household avatar. URLs carry ?v=<updated> so the image can be cached privately. */
export async function GET(req:Request) {
 try{
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  const m = await currentMember(u.userId,new URL(req.url).searchParams.get('org')||undefined); if (!m) return reply({ error: '请先加入 Household。' }, 403);
  const row = await (await pilotDb()).prepare('SELECT data_url FROM household_avatars WHERE household_id=?').get(m.household) as { data_url?: string } | undefined;
  const image = parseAvatar(row?.data_url);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
 }catch(e){if(e instanceof DomainError)return reply({error:e.message},e.status);throw e}
}
