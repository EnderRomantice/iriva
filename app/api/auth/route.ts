import { beginEmailSignIn, verifyEmailSignIn } from '../../../server/email-auth';
import { errorResponse } from '../../../server/http';
import { sameOrigin } from '../../../server/auth';
import { defaultOrganizationId } from '../../../domain/workspace';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 邮箱验证码登录：{action:'begin',email} → {action:'verify',challengeId,code}。 */
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json() as { action?: string };
    if (body.action === 'begin') return await beginEmailSignIn(body, defaultOrganizationId, request);
    if (body.action === 'verify') return await verifyEmailSignIn(body, defaultOrganizationId, request);
    return Response.json({ error: '无效操作。' }, { status: 400 });
  } catch (e) { return errorResponse(e); }
}
