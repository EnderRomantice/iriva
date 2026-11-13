import { workspaceRepository } from '../../server/container';
import { digest, sessionCookie, sessionToken } from '../../server/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = sessionToken(request);
  if (token) await (await workspaceRepository()).db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token));
  const to = new URL(request.url).searchParams.get('return_to') || '/';
  const target = to.startsWith('/') && !to.startsWith('//') ? to : '/';
  return new Response(null, { status: 303, headers: { Location: target, 'Set-Cookie': sessionCookie(''), 'Cache-Control': 'no-store' } });
}
