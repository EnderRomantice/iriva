import { currentUser, reply, sameOrigin } from '../../../../server/pilot';
import { workspaceRepository } from '../../../../server/container';
import { startApplicationPayment } from '../../../../server/services/application-payments';
import { pilotHost } from '../../../../server/services/pilot-hosts';
import { errorResponse } from '../../../../server/http';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 1000) return reply({ error: '请求内容过长。' }, 413);
    let body; try { body = JSON.parse(raw); } catch { return reply({ error: '请选择套餐。' }, 400); }
    const repo = await workspaceRepository();
    if (await pilotHost(repo,user.email)) return reply({ error: 'Host 无需提交学员付款。' }, 409);
    return reply(await startApplicationPayment(repo,user.userId,body?.plan));
  } catch (e) { return errorResponse(e); }
}
