import { cardCatalog } from "./message-cards";
import { cardKey, messageCardsSchema } from "../../domain/message-cards";
import { reactionEmojis } from "../../domain/reactions";
import { isProfileComplete } from "../../domain/account";
import { defaultOrganizationId } from "../../domain/workspace";
import { createHash, randomUUID } from "node:crypto";
import type { Actor, Entity, Snapshot, State } from "../../domain/models";
import { DomainError, type Command, applicationSchema } from "../../domain/commands";
import type { WorkspaceRepository } from "../repositories/workspace-repository";

function requireRule(condition: unknown, message = "你没有执行此操作的权限。", status = 403): asserts condition { if (!condition) throw new DomainError(status, message); }
const meta = (id: string, current?: Entity): Entity => ({ id, version: (current?.version ?? 0) + 1, createdAt: current?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() });

export class WorkspaceService {
  constructor(private repo: WorkspaceRepository) {}
  private organizationState(state: State, actor: Actor): State {
    const id = actor.organizationId || defaultOrganizationId;
    requireRule(state.organizationMemberships.some(m => m.organizationId === id && m.userId === actor.userId && m.role === actor.role), "你没有访问这个工作区的权限。", 403);
    const households = state.households.filter(h => (h.organizationId || defaultOrganizationId) === id);
    const householdIds = new Set(households.map(h => h.id));
    const assignments = state.assignments.filter(a => householdIds.has(a.householdId));
    const assignmentIds = new Set(assignments.map(a => a.id));
    const submissions = state.submissions.filter(s => assignmentIds.has(s.assignmentId));
    const submissionIds = new Set(submissions.map(s => s.id));
    const organizationMemberships = state.organizationMemberships.filter(m => m.organizationId === id);
    const applications = state.applications.filter(a => (a.organizationId || defaultOrganizationId) === id);
    const userIds = new Set([...organizationMemberships.map(m => m.userId), ...applications.map(a => a.userId)]);
    const channels = state.channels.filter(c => c.organizationId === id && (c.kind === "public" || c.kind === "private" && c.ownerId === actor.userId || c.kind === "direct" && state.channelParticipants.some(p => p.channelId === c.id && p.userId === actor.userId)));
    const channelIds = new Set(channels.map(c => c.id));
    const accessible = new Set(state.organizationMemberships.filter(m => m.userId === actor.userId && m.role === actor.role).map(m => m.organizationId));
    return { channels, channelParticipants: state.channelParticipants.filter(p => channelIds.has(p.channelId)), messages: state.messages.filter(m => channelIds.has(m.channelId)), organizations: state.organizations.filter(o => accessible.has(o.id)), organizationMemberships, households, assignments, submissions, applications,
      users: state.users.filter(u => userIds.has(u.id)), terms: state.terms.filter(t => households.some(h => h.termId === t.id)),
      memberships: state.memberships.filter(m => householdIds.has(m.householdId)), sessions: state.sessions.filter(s => householdIds.has(s.householdId)),
      feedback: state.feedback.filter(f => submissionIds.has(f.submissionId)), enrollments: state.enrollments.filter(e => householdIds.has(e.householdId)) };
  }
  private householdAccess(state: State, actor: Actor, householdId: string) {
    return actor.role === "ops" || (actor.role === "host" ? state.households.some(h => h.id === householdId && h.hostId === actor.userId) : state.memberships.some(m => m.householdId === householdId && m.userId === actor.userId && m.role === "learner"));
  }
  async snapshot(actor: Actor): Promise<Snapshot> {
    const state = this.organizationState(await this.repo.snapshot(), actor);
    requireRule(state.users.some(u => u.id === actor.userId), "身份不存在。", 401);
    const cards = cardCatalog(state, actor);
    if (actor.role === "ops") return { ...state, cardCatalog:cards, actor, serverTime: new Date().toISOString() };
    const households = state.households.filter(h => this.householdAccess(state, actor, h.id));
    const allowed = new Set(households.map(h => h.id));
    const memberships = state.memberships.filter(m => allowed.has(m.householdId));
    const assignments = state.assignments.filter(a => allowed.has(a.householdId));
    const assignmentIds = new Set(assignments.map(a => a.id));
    const submissions = state.submissions.filter(s => assignmentIds.has(s.assignmentId) && (actor.role === "learn" ? s.learnerId === actor.userId : s.status === "submitted"));
    const submissionIds = new Set(submissions.map(s => s.id));
    const userIds = new Set(state.organizationMemberships.map(m => m.userId));
    return {
      organizations: state.organizations, organizationMemberships: state.organizationMemberships.filter(m => m.userId === actor.userId),
      channels: state.channels, channelParticipants: state.channelParticipants, messages: state.messages,
      cardCatalog:cards, actor, serverTime: new Date().toISOString(), households, memberships, assignments, submissions,
      users: state.users.filter(u => userIds.has(u.id)).map(u => u.id === actor.userId ? u : { ...u, email: "", birthChart: "" }),
      terms: state.terms.filter(t => households.some(h => h.termId === t.id)),
      sessions: state.sessions.filter(s => allowed.has(s.householdId)),
      feedback: state.feedback.filter(f => submissionIds.has(f.submissionId) && (actor.role === "host" ? f.authorId === actor.userId : f.status === "published")),
      applications: [], enrollments: state.enrollments.filter(e => e.userId === actor.userId),
    };
  }
  execute(actor: Actor, command: Command): Promise<{ version: number; entityId?: string }> {
    if (command.kind === "conversation.open") {
      const pair = [actor.userId, command.payload.userId].sort().join(":");
      const hash = createHash("sha256").update(`${actor.organizationId || defaultOrganizationId}:${pair}`).digest("hex");
      command = { ...command, entityId: `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}` };
    }
    return this.repo.transaction(tx => {
      const raw = tx.read();
      const state = this.organizationState(raw, actor);
      const table = (command.kind === "message.send" || command.kind === "message.react") ? "messages" : (command.kind === "channel.create" || command.kind === "conversation.open") ? "channels" : command.kind === "submission.save" ? "submissions" : command.kind === "feedback.save" ? "feedback" : (command.kind === "session.reschedule" || command.kind === "session.create") ? "sessions" : command.kind === "assignment.create" ? "assignments" : command.kind === "household.create" ? "households" : "applications";
      requireRule(!raw[table].some(e => e.id === command.entityId) || state[table].some(e => e.id === command.entityId));
      const receipt = tx.receipt(actor.userId, command.id);
      if (receipt) return command.kind === "conversation.open" ? { ...receipt, entityId: command.entityId } : receipt;
      requireRule(state.users.some(u => u.id === actor.userId), "身份不存在。", 401);
      let version = 0;
      const checkVersion = (value?: Entity) => { requireRule((value?.version ?? 0) === command.baseVersion, "这条记录已在其他设备更新。你的输入已保留，请查看最新版本。", 409); version = (value?.version ?? 0) + 1; };
      switch (command.kind) {
        case "channel.create": {
          requireRule(command.payload.kind === "private" || actor.role === "host", "只有 Host 可以建立公开频道。", 403);
          requireRule(!state.channels.some(c => c.id === command.entityId), "频道已存在，请刷新后查看。", 409);
          requireRule(!state.channels.some(c => c.kind === command.payload.kind && c.name.toLowerCase() === command.payload.name.toLowerCase() && (c.kind === "public" || c.ownerId === actor.userId)), "已有同名频道。", 409);
          checkVersion();
          tx.saveChannel({ ...meta(command.entityId), ...command.payload, organizationId: actor.organizationId || defaultOrganizationId, ownerId: actor.userId, directKey: "" });
          break;
        }
        case "conversation.open": {
          const peer = command.payload.userId;
          requireRule(peer !== actor.userId && state.organizationMemberships.some(m => m.userId === peer), "请选择当前工作区的另一位成员。", 422);
          const existing = state.channels.find(c => c.id === command.entityId);
          if (existing) { requireRule(existing.kind === "direct"); version = existing.version; break; }
          checkVersion();
          tx.saveChannel({ ...meta(command.entityId), organizationId: actor.organizationId || defaultOrganizationId, ownerId: actor.userId, name: "", description: "", kind: "direct", directKey: [actor.userId, peer].sort().join(":") });
          for (const userId of [actor.userId, peer]) tx.saveChannelParticipant({ ...meta(randomUUID()), channelId: command.entityId, userId });
          break;
        }
        case "message.react": {
          const message = state.messages.find(m => m.id === command.entityId);
          requireRule(message && state.channels.some(c => c.id === message.channelId), "这条消息不存在，或你没有访问权限。", 403);
          requireRule(reactionEmojis.includes(command.payload.emoji), "请选择支持的表情。", 422);
          const previous = message.reactions || [];
          const exists = previous.some(r => r.userId === actor.userId && r.emoji === command.payload.emoji);
          version = message.version;
          if (exists === command.payload.active) break;
          // Set the caller's own reaction against the latest row inside the transaction.
          // Unlike a toggle, retries are idempotent and concurrent participants are preserved.
          const reactions = previous.filter(r => !(r.userId === actor.userId && r.emoji === command.payload.emoji));
          if (command.payload.active) reactions.push({ userId: actor.userId, emoji: command.payload.emoji });
          version++;
          tx.saveMessage({ ...message, reactions, version, updatedAt: new Date().toISOString() });
          break;
        }
        case "message.send": {
          requireRule(state.channels.some(c => c.id === command.payload.channelId), "你无法向这个频道发送消息。", 403);
          const parsed = messageCardsSchema.safeParse(command.payload.cards || []);
          requireRule(parsed.success, "卡片格式不正确，每条消息最多 5 张卡片。", 422);
          requireRule((command.payload.body.trim().length > 0 || parsed.data.length > 0) && command.payload.body.length <= 12000, "请填写消息或添加卡片，最多 12000 个字符。", 422);
          if (parsed.data.length) {
            const allowed = new Set(cardCatalog(state, actor).map(c => cardKey(c.reference)));
            requireRule(parsed.data.every(c => allowed.has(cardKey(c))), "卡片内容不存在，或你没有分享权限。", 403);
          }
          requireRule(!state.messages.some(m => m.id === command.entityId), "这条消息已经发送。", 409);
          checkVersion();
          tx.saveMessage({ ...meta(command.entityId), ...command.payload, body: command.payload.body.trim(), cards: parsed.data, authorId: actor.userId });
          break;
        }
        case "assignment.create": {
          const household = state.households.find(h => h.id === command.payload.householdId);
          requireRule(actor.role === "host" && household?.hostId === actor.userId);
          requireRule(!state.assignments.some(a => a.id === command.entityId), "任务已建立，请刷新后查看。", 409);
          requireRule(Date.parse(command.payload.dueAt) > Date.now(), "截止时间必须晚于当前时间。", 422);
          checkVersion();
          tx.saveAssignment({ ...meta(command.entityId), ...command.payload });
          break;
        }
        case "session.create": {
          const household = state.households.find(h => h.id === command.payload.householdId);
          requireRule(actor.role === "host" && household?.hostId === actor.userId);
          requireRule(!state.sessions.some(s => s.id === command.entityId), "iriva meeting 已建立，请刷新后查看。", 409);
          const { startsAt, endsAt } = command.payload;
          requireRule(Date.parse(endsAt) > Date.parse(startsAt) && Date.parse(startsAt) > Date.now(), "请选择未来的时间，结束时间必须晚于开始时间。", 422);
          const conflict = raw.sessions.some(s => s.status === "scheduled" && raw.households.some(h => h.id === s.householdId && h.hostId === actor.userId) && s.startsAt < endsAt && s.endsAt > startsAt);
          requireRule(!conflict, "该时间与 Host 的其他 iriva meeting 冲突。", 409);
          checkVersion();
          tx.saveSession({ ...meta(command.entityId), ...command.payload, status: "scheduled", meetingUrl: "" });
          break;
        }
        case "household.create": {
          requireRule(actor.role === "ops");
          requireRule(!state.households.some(h => h.id === command.entityId), "小组已建立，请刷新后查看。", 409);
          requireRule(state.terms.some(t => t.id === command.payload.termId), "请选择当前机构的学期。", 422);
          requireRule(state.organizationMemberships.some(m => m.userId === command.payload.hostId && m.role === "host"), "请选择当前机构的 Host。", 422);
          requireRule(!state.households.some(h => h.termId === command.payload.termId && h.name.toLowerCase() === command.payload.name.toLowerCase()), "这个学期已有同名小组。", 409);
          checkVersion();
          tx.saveHousehold({ ...meta(command.entityId), ...command.payload, organizationId: actor.organizationId || defaultOrganizationId, timezone: "Asia/Shanghai" });
          tx.saveMembership({ ...meta(randomUUID()), householdId: command.entityId, userId: command.payload.hostId, role: "host" });
          break;
        }
        case "submission.save": {
          const assignment = state.assignments.find(a => a.id === command.payload.assignmentId);
          requireRule(actor.role === "learn" && assignment && this.householdAccess(state, actor, assignment.householdId));
          const existing = state.submissions.find(s => s.id === command.entityId);
          requireRule(!existing || (existing.learnerId === actor.userId && existing.assignmentId === assignment.id));
          requireRule(!state.submissions.some(s => s.id !== command.entityId && s.assignmentId === assignment.id && s.learnerId === actor.userId), "此任务已有提交，请刷新后继续编辑。", 409);
          requireRule(command.payload.status !== "submitted" || command.payload.body.trim().length > 0, "请先写下你的练习内容。", 422);
          checkVersion(existing);
          tx.saveSubmission({ ...meta(command.entityId, existing), ...command.payload, learnerId: actor.userId });
          break;
        }
        case "feedback.save": {
          const submission = state.submissions.find(s => s.id === command.payload.submissionId);
          const assignment = state.assignments.find(a => a.id === submission?.assignmentId);
          requireRule(actor.role === "host" && submission?.status === "submitted" && assignment && this.householdAccess(state, actor, assignment.householdId));
          const existing = state.feedback.find(f => f.id === command.entityId);
          requireRule(!existing || (existing.authorId === actor.userId && existing.submissionId === submission.id));
          requireRule(!state.feedback.some(f => f.id !== command.entityId && f.authorId === actor.userId && f.submissionId === submission.id), "已有反馈，请刷新后编辑。", 409);
          requireRule(command.payload.status !== "published" || command.payload.body.trim().length > 0, "请先写下反馈。", 422);
          checkVersion(existing);
          tx.saveFeedback({ ...meta(command.entityId, existing), ...command.payload, authorId: actor.userId });
          break;
        }
        case "application.contact":
        case "application.enroll": {
          requireRule(actor.role === "ops");
          const application = state.applications.find(a => a.id === command.entityId);
          requireRule(application, "报名记录不存在。", 404);
          requireRule(application.status !== "enrolled", "该学员已经入组。", 409);
          checkVersion(application);
          if (command.kind === "application.enroll") {
            const household = state.households.find(h => h.id === command.payload.householdId);
            requireRule(household, "Household 不存在。", 404);
            requireRule(state.memberships.filter(m => m.householdId === household.id && m.role === "learner").length < household.capacity, "这个 Household 已满员，请选择其他小组。", 409);
            requireRule(!state.enrollments.some(e => e.userId === application.userId && e.termId === household.termId), "该学员已加入本学期。", 409);
            const admission = tx.admission(application.userId, actor.organizationId || defaultOrganizationId, household.hostId);
            if (admission.registered) {
              requireRule(admission.order, "该学员尚未完成套餐付款。", 422);
              requireRule(admission.accepted, "请先由该小组 Host 确定加入。", 422);
              const learner = state.users.find(u => u.id === application.userId);
              requireRule(isProfileComplete(learner), "请学员先完善必填个人资料。", 422);
            }
            tx.saveMembership({ ...meta(randomUUID()), householdId: household.id, userId: application.userId, role: "learner" });
            tx.saveEnrollment({ ...meta(randomUUID()), householdId: household.id, userId: application.userId, termId: household.termId, plan: admission.order?.plan || "母语档 · 每周 1 次", amountMinor: admission.order?.amountMinor || 318000, currency: "CNY", paymentStatus: admission.order ? "paid" : "pending" });
          }
          tx.saveApplication({ ...application, ...meta(application.id, application), status: command.kind === "application.enroll" ? "enrolled" : "contacted" });
          break;
        }
        case "session.reschedule": {
          const session = state.sessions.find(s => s.id === command.entityId);
          requireRule(session, "课程不存在。", 404);
          requireRule((actor.role === "host" || actor.role === "ops") && this.householdAccess(state, actor, session.householdId));
          requireRule(session.status === "scheduled", "只能调整待上课的课程。", 422);
          const { startsAt, endsAt } = command.payload;
          requireRule(Date.parse(endsAt) > Date.parse(startsAt) && Date.parse(startsAt) > Date.now(), "请选择未来的时间，结束时间必须晚于开始时间。", 422);
          const hostId = state.households.find(h => h.id === session.householdId)?.hostId;
          const conflict = state.sessions.some(s => s.id !== session.id && s.status === "scheduled" && (s.householdId === session.householdId || state.households.find(h => h.id === s.householdId)?.hostId === hostId) && s.startsAt < endsAt && s.endsAt > startsAt);
          requireRule(!conflict, "该时间与 Host 或 Household 的其他课程冲突。", 409);
          checkVersion(session);
          tx.saveSession({ ...session, ...meta(session.id, session), startsAt, endsAt });
          break;
        }
      }
      tx.acknowledge(actor.userId, command.id, version);
      tx.audit(actor.userId, command.kind, command.entityId);
      return command.kind === "conversation.open" ? { version, entityId: command.entityId } : { version };
    });
  }
  apply(input: unknown, organizationId = defaultOrganizationId) {
    const data = applicationSchema.parse(input);
    return this.repo.transaction(tx => {
      requireRule(tx.read().organizations.some(o => o.id === organizationId), "工作区不存在。", 404);
      const email = data.email.toLowerCase();
      requireRule(!tx.read().users.some(u => u.email === email), "这个邮箱已有报名记录，请联系运营确认。", 409);
      const user = { ...meta(randomUUID()), name: data.name, email, city: "", timezone: "Asia/Shanghai", avatar: "blue" };
      tx.saveUser(user);
      tx.saveOrganizationMembership({ ...meta(randomUUID()), organizationId, userId: user.id, role: "learn" });
      const application = { ...meta(randomUUID()), organizationId, userId: user.id, goal: data.goal, availability: data.availability, status: "new" as const };
      tx.saveApplication(application);
      return { id: application.id };
    });
  }
}
