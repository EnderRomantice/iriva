import {DomainError} from '../../../domain/commands';
import {auditedOperation,canManage} from '../../../server/services/organization-access';
import { workspaceRepository } from '../../../server/container';
import { randomUUID } from 'node:crypto';
import { isStandardTimezone } from '../../../lib/timezones';
import { householdAvatarUrl, memberAvatarUrl, parseAvatar } from '../../../domain/household-avatar';
import { canonicalEmoji, groupReactions, isReactionEmoji, maxReactionKinds } from '../../../domain/household-reactions';
import { currentUser, currentWorkspace, claimPlacement, currentMember, pilotDb, pilotTransaction, reply, sameOrigin, currentTeamContext, text, count, visibleSession, visibilityArgs, sessionColumns, reminderDue, sessionEnd, insertSession, insertNotification, insertMembership, membershipRow, createHousehold } from '../../../server/pilot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;
type Db = Awaited<ReturnType<typeof pilotDb>>;

/** Reactions for the given messages, grouped per message in first-use order. */
async function reactionsFor(d: Db, household: string, ids: string[]) {
  if (!ids.length) return new Map<string, { emoji: string; users: string[] }[]>();
  const rows = await d.prepare(`SELECT message_id AS message,emoji,user_id AS "user" FROM household_message_reactions WHERE household_id=? AND message_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`).all(household, ...ids) as { message: string; emoji: string; user: string }[];
  return groupReactions(rows);
}

export async function GET() {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  try {
    await claimPlacement(u);
    const d = await pilotDb(), m = await currentMember(u.userId);
    if (!m) {
      const access=await currentWorkspace(u);
      const host = access?.organization.role==='host'?await d.prepare('SELECT name FROM organization_hosts WHERE organization_id=? AND email=?').get(access.organization.id,u.email.toLowerCase())||{name:u.displayName}:null;
      if (host) return reply({ user: { name: host.name, role: 'host', id: u.userId }, household: null, application: null, people: [], messages: [], sessions: [] });
      const application = await d.prepare('SELECT name,status,household FROM member_applications WHERE user_id=?').get(u.userId);
      return reply({ user: { name: (application as Row | undefined)?.name || u.displayName }, household: null, application: application || null });
    }
    const h = await d.prepare('SELECT h.id,h.name,h.theme AS topic,h.week,h.duration,h.code,a.updated_at AS avatar_updated FROM households h LEFT JOIN household_avatars a ON a.household_id=h.id WHERE h.id=?').get(m.household) as Row | undefined;
    if (!h) return reply({ error: '暂时找不到你的 Household。' }, 404);
    const [people, msgs, events] = await Promise.all([
      d.prepare("SELECT COALESCE(NULLIF(m.display_name,''),u.name) AS name,m.role,m.user_id AS \"user\",COALESCE(NULLIF(m.timezone,''),NULLIF(a.timezone,''),CASE WHEN m.role='learner' THEN '+08:00' ELSE '' END) AS timezone,av.updated_at AS avatar_updated FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN member_applications a ON a.user_id=m.user_id LEFT JOIN member_avatars av ON av.user_id=m.user_id WHERE m.household_id=? ORDER BY m.role DESC, m.created_at ASC").all(h.id),
      d.prepare('SELECT id,author_id AS author,name,body,created_at AS created FROM household_messages WHERE household_id=? ORDER BY created_at DESC LIMIT 100').all(h.id),
      d.prepare(`SELECT ${sessionColumns()} FROM sessions s WHERE ${visibleSession()} ORDER BY s.starts_at ASC LIMIT 100`).all(...visibilityArgs(m.household, m.role, u.userId)),
    ]);
    const { code, avatar_updated, ...household } = h;
    const recent = (msgs as Row[]).reverse(), reactions = await reactionsFor(d, String(h.id), recent.map(x => String(x.id)));
    const messages = recent.map(x => ({ ...x, reactions: reactions.get(String(x.id)) ?? [] }));
    const members: Row[] = (people as Row[]).map(({ avatar_updated: updated, ...p }) => ({ ...p, avatar: memberAvatarUrl(p.user, updated) }));
    return reply({ user: { name: m.name, role: m.role, id: u.userId, avatar: members.find(p => p.user === u.userId)?.avatar ?? null }, household: { ...household, avatar: householdAvatarUrl(avatar_updated)?householdAvatarUrl(avatar_updated)+'&org='+encodeURIComponent((await currentWorkspace(u))!.organization.id):null, week: Number(h.week), duration: Number(h.duration), ...(m.role === 'host' ? { code } : {}) }, people: members, messages, sessions: events });
  } catch (e) { if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});console.error(e); return reply({ error: '暂时无法读取你的 Household，请稍后重试。' }, 503); }
}

export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return reply({ error: '请先登录。' }, 401);
  if (!sameOrigin(req)) return reply({ error: '请求来源不正确。' }, 403);
  try {
    const b = await req.json() as Row, action = text(b, 'action', 20), d = await pilotDb();
    const m = await currentMember(u.userId);
    // 学员由团队分配 Host 和小组，暂不支持邀请码。
    if (action === 'join') return reply({ error: '暂不支持邀请码加入，请等待团队分配 Host 和小组。' }, 403);
    if (action === 'create') {
      if (m) return reply({ error: '你已经在一个 Household 里了。' }, 409);
      const name = text(b, 'name', 50); if (!name) return reply({ error: '请填写你的显示名称。' }, 400);
      const ctx=await currentTeamContext();if(!ctx)return reply({error:'Household 由青鸟团队安排。'},403);
      const title = text(b, 'title', 70); if (!title) return reply({ error: '请为 Household 命名。' }, 400);
      return await auditedOperation(await workspaceRepository(),ctx,'household.create',title,async current=>{if(!canManage(current.organization.role))return reply({error:'只有管理员可以创建 Household。'},403);await createHousehold(title,u.userId,'A meal that tastes like home',[{userId:u.userId,role:'host',name}],current.organization.id);return reply({ok:true});});
    }
    if (!m) return reply({ error: '请先加入 Household。' }, 403);
    if (action === 'timezone') {
      const timezone = text(b, 'timezone', 20);
      if (!isStandardTimezone(timezone)) return reply({ error: '请选择有效的 UTC 时区。' }, 400);
      await d.prepare('UPDATE memberships SET timezone=? WHERE user_id=? AND household_id=?').run(timezone, u.userId, m.household);
    } else if (action === 'message') {
      const body = typeof b.body === 'string' ? b.body.trim() : '';
      if (!body || body.length > 2000) return reply({ error: '请输入 1–2000 字的消息。' }, 400);
      const id = b.id === undefined ? randomUUID() : b.id;
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply({ error: '消息标识无效，请重新编辑后发送。' }, 400);
      // A retry after a lost response reuses the message ID. Never overwrite a
      // message, or reveal a conflicting ID owned by another member/group.
      return await pilotTransaction(async () => {
        await d.prepare('INSERT INTO household_messages (id,household_id,author_id,name,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING').run(id,m.household,u.userId,m.name,body,new Date().toISOString());
        const saved = await d.prepare('SELECT id,household_id,author_id AS author,name,body,created_at AS created FROM household_messages WHERE id=?').get(id) as Row;
        if (saved.household_id !== m.household || saved.author !== u.userId || saved.body !== body) return reply({ error: '这条消息的标识已使用，请重新编辑后再发送。' }, 409);
        const { household_id, ...message } = saved;
        return reply({ ok: true, message: { ...message, reactions: [] } });
      });
    } else if (action === 'react') {
      // Idempotent: on=true adds this member's reaction, on=false removes it.
      const messageId = typeof b.message === 'string' ? b.message : '', on = b.on === true;
      if (!isReactionEmoji(b.emoji)) return reply({ error: '请选择一个表情。' }, 400);
      const emoji = canonicalEmoji(b.emoji);
      return await pilotTransaction(async () => {
        if (!await d.prepare('SELECT 1 FROM household_messages WHERE id=? AND household_id=?').get(messageId, m.household)) return reply({ error: '找不到这条消息。' }, 404);
        if (on) {
          const kinds = await d.prepare('SELECT DISTINCT emoji FROM household_message_reactions WHERE message_id=?').all(messageId) as Row[];
          if (kinds.length >= maxReactionKinds && !kinds.some(k => k.emoji === emoji)) return reply({ error: `一条消息最多 ${maxReactionKinds} 种表情回应。` }, 409);
          await d.prepare('INSERT INTO household_message_reactions (message_id,household_id,user_id,emoji,created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').run(messageId, m.household, u.userId, emoji, new Date().toISOString());
        } else await d.prepare('DELETE FROM household_message_reactions WHERE message_id=? AND user_id=? AND emoji=?').run(messageId, u.userId, emoji);
        return reply({ ok: true, message: messageId, reactions: (await reactionsFor(d, m.household, [messageId])).get(messageId) ?? [] });
      });
    } else if (action === 'avatar') {
      if (m.role !== 'host') return reply({ error: '只有 Host 可以设置小组头像。' }, 403);
      if (b.image === null) await d.prepare('DELETE FROM household_avatars WHERE household_id=?').run(m.household);
      else {
        if (!parseAvatar(b.image)) return reply({ error: '请上传 200KB 以内的 PNG、JPEG 或 WebP 图片。' }, 400);
        const now = new Date().toISOString();
        await d.prepare('INSERT INTO household_avatars (household_id,data_url,updated_at) VALUES (?,?,?) ON CONFLICT (household_id) DO UPDATE SET data_url=excluded.data_url,updated_at=excluded.updated_at').run(m.household, b.image, now);
      }
    } else if (action === 'topic') {
      if (m.role !== 'host') return reply({ error: '只有 Host 可以更新每周话题。' }, 403);
      const topic = text(b, 'topic', 500), week = Number(b.week);
      const duration = Number((await d.prepare('SELECT duration FROM households WHERE id=?').get(m.household) as Row | undefined)?.duration || 4);
      if (!topic || !Number.isInteger(week) || week < 1 || week > duration) return reply({ error: `请填写话题，并选择第 1–${duration} 周。` }, 400);
      await d.prepare('UPDATE households SET theme=?,week=?,updated_at=? WHERE id=?').run(topic, week, new Date().toISOString(), m.household);
    } else if (action === 'session') {
      const kind = text(b, 'kind', 20);
      if (!['roundtable', 'one-to-one', 'practice'].includes(kind)) return reply({ error: '无效的安排类型。' }, 400);
      if (kind === 'practice') return reply({ error: '伙伴练习需要对方确认，请到“伙伴练习”发起邀约。' }, 400);
      if (m.role !== 'host') return reply({ error: '只有 Host 可以安排 iriva meeting。' }, 403);
      const title = text(b, 'title', 120), at = text(b, 'at', 40), url = text(b, 'url', 500);
      let participant: string | null = null;
      if (kind === 'one-to-one') {
        participant = text(b, 'participant', 100);
        if (!await d.prepare("SELECT 1 FROM memberships WHERE household_id=? AND user_id=? AND role='learner'").get(m.household, participant)) return reply({ error: '请选择本组的一位学员。' }, 400);
      }
      if (!title || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= Date.now()) return reply({ error: '请填写标题和未来的时间。' }, 400);
      if (url) { try { if (new URL(url).protocol !== 'https:') throw new Error(); } catch { return reply({ error: '会议链接需要以 https:// 开头。' }, 400); } }
      const id = randomUUID(), when = new Date(at).toISOString(), now = new Date();
      const recipients = (participant
        ? await d.prepare("SELECT user_id FROM memberships WHERE household_id=? AND (role='host' OR user_id=?)").all(m.household, participant)
        : await d.prepare('SELECT user_id FROM memberships WHERE household_id=?').all(m.household)) as Row[];
      await pilotTransaction(async () => {
        await d.prepare(insertSession).run(id, m.household, title, when, sessionEnd(when, kind), url, now.toISOString(), now.toISOString(), kind, u.userId, null, participant);
        for (const person of recipients) for (const r of [...(person.user_id === u.userId ? [] : [{ kind: 'published', due: now.toISOString() }]), ...reminderDue(when, now)])
          await d.prepare(insertNotification).run(randomUUID(), person.user_id, id, r.kind, r.due);
      });
    } else return reply({ error: '无效操作。' }, 400);
    return reply({ ok: true });
  } catch (e) { if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});console.error(e); return reply({ error: '没能保存，请稍后重试。' }, 400); }
}

