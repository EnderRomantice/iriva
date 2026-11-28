import {DomainError} from '../../../domain/commands';
import { isStandardTimezone } from '../../../lib/timezones';
import { pilotHost } from '../../../server/services/pilot-hosts';
import { workspaceRepository } from '../../../server/container';
import { currentUser, currentMember, pilotDb, pilotTransaction, reply, sameOrigin, text } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

/**
 * 「个人信息」页只改这些：称呼、所在地区、年龄段、阶段、联系方式、MBTI，以及组内时区。
 * 不改方案 / 身份 / 学习需要 / 可用时间，也不重置团队跟进状态；这些仍在 /apply 里修改。
 */
export async function PATCH(req: Request) {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 6000) return reply({ error: '内容过长。' }, 413);
    let b: Row; try { b = JSON.parse(raw); } catch { return reply({ error: '资料格式不正确。' }, 400); }
    if (!b || typeof b !== 'object') return reply({ error: '资料格式不正确。' }, 400);
    const name = text(b, 'name', 50); if (!name) return reply({ error: '请填写你希望伙伴怎么称呼你。' }, 400);
    const d = await pilotDb(), m = await currentMember(u.userId);
    const host = await pilotHost(await workspaceRepository(), u.email);
    const app = host ? undefined : await d.prepare('SELECT id FROM member_applications WHERE user_id=?').get(u.userId) as Row | undefined;
    const timezone = text(b, 'timezone', 20);
    if (m && timezone && !isStandardTimezone(timezone)) return reply({ error: '请选择有效的 UTC 时区。' }, 400);
    let fields: string[] = [];
    if (app) {
      const location = text(b, 'location', 80), ageBand = text(b, 'age_band', 20), lifeStage = text(b, 'life_stage', 40), mbti = text(b, 'mbti', 20).toUpperCase(), pref = text(b, 'contact_preference', 20) || 'email', contact = text(b, 'contact', 200);
      if (!location) return reply({ error: '请填写所在国家或地区。' }, 400);
      if (!['under18', '18-24', '25-34', '35-44', '45-54', '55plus', 'private'].includes(ageBand) || !['school', 'university', 'working', 'entrepreneur', 'other', 'private'].includes(lifeStage)) return reply({ error: '请选择年龄段与学习或工作阶段。' }, 400);
      if (mbti && !/^[EI][NS][TF][JP]$/.test(mbti)) return reply({ error: '请选择有效的 MBTI，或留空。' }, 400);
      if (pref !== 'wechat' || !contact) return reply({ error: '请填写微信号，方便客服人员添加，确保服务质量。' }, 400);
      fields = [location, ageBand, lifeStage, mbti, pref, contact];
    }
    await pilotTransaction(async () => {
      if (host) await d.prepare('UPDATE pilot_hosts SET name=? WHERE email=?').run(name,u.email.toLowerCase());
      if (app) await d.prepare('UPDATE member_applications SET name=?,location=?,age_band=?,life_stage=?,mbti=?,contact_preference=?,contact=?,updated=?,revision=revision+1 WHERE user_id=?').run(name, ...fields, new Date().toISOString(), u.userId);
      if (m) await d.prepare('UPDATE memberships SET display_name=?,updated_at=? WHERE user_id=? AND household_id=?').run(name, new Date().toISOString(), u.userId, m.household);
      if (m && timezone) await d.prepare('UPDATE memberships SET timezone=? WHERE user_id=? AND household_id=?').run(timezone, u.userId, m.household);
      if (!app && !m) await d.prepare('UPDATE users SET name=? WHERE id=?').run(name, u.userId);
    });
    return reply({ ok: true });
  } catch (e) { if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});console.error(e); return reply({ error: '没能保存，请稍后重试。' }, 503); }
}
