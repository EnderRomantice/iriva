import { randomUUID } from 'node:crypto';
import { isStandardTimezone } from '../../../lib/timezones';
import { validSlots, availabilityText } from '../../../lib/availability';
import { currentUser, ownApplication, pilotDb, reply as out, sameOrigin, text } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;

export async function GET() {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  try {
    return out({ application: await ownApplication(u.userId), email: u.email });
  } catch (e) { console.error(e); return out({ error: '暂时无法读取资料，请稍后重试。' }, 503); }
}

async function save(req: Request, editing: boolean) {
  const u = await currentUser(); if (!u) return out({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return out({ error: '请求来源不正确。' }, 403);
  try {
    const raw = await req.text(); if (raw.length > 22000) return out({ error: '内容过长。' }, 413);
    let b: Row; try { b = JSON.parse(raw); } catch { return out({ error: '资料格式不正确。' }, 400); }
    if (!b || typeof b !== 'object') return out({ error: '资料格式不正确。' }, 400);
    const val = (k: string, n: number) => text(b, k, n);
    const plan = val('plan', 20) || 'native', name = val('name', 60), role = val('role', 20), language = val('language', 20), level = val('level', 20), timezone = val('timezone', 80), goal = val('goal', 1500), ageBand = val('age_band', 20), lifeStage = val('life_stage', 40), location = val('location', 80), mbti = val('mbti', 20).toUpperCase(), contactPreference = val('contact_preference', 20) || 'email';
    if (!['native', 'everyday', 'professional'].includes(plan) || !['learner', 'host'].includes(role) || !['English', 'Chinese'].includes(language) || !['beginner', 'intermediate', 'advanced'].includes(level) || !name || !goal || b.consent !== true) return out({ error: '请完整填写必填项并同意资料用途。' }, 400);
    if (!isStandardTimezone(timezone)) return out({ error: '请选择有效的 UTC 时区。' }, 400);
    if (!validSlots(b.availability_slots)) return out({ error: '请至少选择一个可稳定参加的时段，每段不少于两小时，最多八个。' }, 400);
    if (!['under18', '18-24', '25-34', '35-44', '45-54', '55plus', 'private'].includes(ageBand) || !['school', 'university', 'working', 'entrepreneur', 'other', 'private'].includes(lifeStage) || !location || !val('interests', 1000)) return out({ error: '请填写年龄段、学习或工作阶段、所在地区和感兴趣的话题。' }, 400);
    if (mbti && !/^[EI][NS][TF][JP]$/.test(mbti)) return out({ error: '请选择有效的 MBTI，或留空。' }, 400);
    if (ageBand === 'under18' && b.guardian_consent !== true) return out({ error: '未成年资料需由监护人填写并确认。' }, 400);
    if (!['email', 'wechat', 'other'].includes(contactPreference) || (contactPreference !== 'email' && !val('contact', 200))) return out({ error: '请填写首选联系方式。' }, 400);
    const slots = JSON.stringify(b.availability_slots), availability = availabilityText(b.availability_slots, val('availability_note', 600)), now = new Date().toISOString(), status = plan === 'native' && language === 'English' ? 'new' : 'interest', db = await pilotDb();
    const existing = await db.prepare('SELECT id,household,revision,plan,role,language FROM member_applications WHERE user_id=?').get(u.userId) as Row | undefined;
    if (editing) {
      if (!existing) return out({ error: '还没有提交过资料。' }, 404);
      if (existing.household) return out({ error: '你已加入小组，资料变更请通过“给青鸟的建议”联系团队确认。' }, 409);
      if (existing.plan !== plan || existing.role !== role || existing.language !== language) return out({ error: '更改方案或身份请联系团队；本页可补充当前资料。' }, 400);
      const revision = Number(b.revision);
      if (!Number.isInteger(revision) || revision !== Number(existing.revision)) return out({ error: '资料已更新，请重新打开页面再修改。' }, 409);
      const r = await db.prepare("UPDATE member_applications SET name=?,goal=?,level=?,timezone=?,availability=?,interests=?,contact=?,age_band=?,life_stage=?,location=?,mbti=?,partner_preferences=?,suggestion=?,availability_slots=?,contact_preference=?,updated=?,revision=revision+1,status=?,oral_level='' WHERE user_id=? AND revision=? AND household IS NULL").run(name, goal, level, timezone, availability, val('interests', 1000), val('contact', 200), ageBand, lifeStage, location, mbti, val('partner_preferences', 800), val('suggestion', 1000), slots, contactPreference, now, status, u.userId, revision);
      if (!r.changes) return out({ error: '资料或分组已变化，请刷新后查看。' }, 409);
      return out({ ok: true, revision: revision + 1, status });
    }
    if (existing) return out({ error: '你已提交过资料，请刷新后查看或补充。' }, 409);
    await db.prepare('INSERT INTO member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,plan,status,notes,created,age_band,life_stage,location,mbti,partner_preferences,suggestion,availability_slots,contact_preference,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), u.userId, u.email.toLowerCase(), name, role, language, goal, level, timezone, availability, val('interests', 1000), val('contact', 200), plan, status, '', now, ageBand, lifeStage, location, mbti, val('partner_preferences', 800), val('suggestion', 1000), slots, contactPreference, now);
    return out({ ok: true, revision: 0, status });
  } catch (e) { console.error(e); return out({ error: '资料未能保存，请稍后重试。' }, 503); }
}
export async function POST(req: Request) { return save(req, false); }
export async function PATCH(req: Request) { return save(req, true); }
