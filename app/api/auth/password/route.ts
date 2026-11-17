import { passwordSignIn } from '../../../../server/team-auth';
import { errorResponse } from '../../../../server/http';
import { sameOrigin } from '../../../../server/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 团队账号密码登录：{email,password}。 */
export async function POST(request: Request) {
  try { sameOrigin(request); return await passwordSignIn(await request.json()); }
  catch (e) { return errorResponse(e); }
}
