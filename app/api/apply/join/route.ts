import { currentUser, reply, sameOrigin } from '../../../../server/pilot';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!await currentUser()) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(request)) return reply({ error: '请求来源不正确。' }, 403);
  return reply({ error: '暂不支持邀请码加入，请等待团队分配 Host 和小组。' }, 403);
}
