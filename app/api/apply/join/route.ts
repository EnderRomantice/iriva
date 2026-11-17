import { currentUser, joinByCode, member, pilotDb, pilotTransaction, reply, sameOrigin } from '../../../../server/pilot';
import { pilotHost } from '../../../../server/services/pilot-hosts';
import { workspaceRepository } from '../../../../server/container';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(request)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 1000) return reply({ error: '邀请码过长。' }, 400);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: '请填写有效的邀请码。' }, 400); }
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code.trim() : '';
    if (!code || code.length > 100) return reply({ error: '请填写有效的邀请码。' }, 400);
    const db = await pilotDb();
    const result = await pilotTransaction(async () => {
      // Serialize joins by this account and profile edits before checking saved application state.
      await db.prepare('UPDATE users SET id=id WHERE id=?').run(user.userId);
      await db.prepare('UPDATE member_applications SET id=id WHERE user_id=?').run(user.userId);
      const application = await db.prepare('SELECT name,role FROM member_applications WHERE user_id=?').get(user.userId) as { name: string; role: string } | undefined;
      if (!application) return { error: '请先完成并提交加入资料，再输入邀请码。', status: 409 };
      if (application.role !== 'learner' || await pilotHost(await workspaceRepository(), user.email)) return { error: '此邀请码仅用于学员入组，Host 由团队安排。', status: 403 };
      const existing = await member(user.userId);
      if (existing) return { household: existing.household };
      const joined = await joinByCode(code, user.userId, application.name);
      if ('error' in joined) return joined;
      await db.prepare("UPDATE member_applications SET household=?,status='assigned',revision=revision+1,updated=? WHERE user_id=?").run(joined.household, new Date().toISOString(), user.userId);
      return joined;
    });
    if ('error' in result) return reply({ error: result.error }, result.status);
    return reply({ ok: true, household: result.household });
  } catch (error) {
    console.error(error);
    return reply({ error: '暂时无法加入小组，请稍后重试。你的资料已保存。' }, 503);
  }
}
