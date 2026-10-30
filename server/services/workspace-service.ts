import { randomUUID } from "node:crypto";
import type { Actor, Entity, Snapshot, State } from "../../domain/models";
import { DomainError, type Command, applicationSchema } from "../../domain/commands";
import type { WorkspaceRepository } from "../repositories/workspace-repository";

function requireRule(condition: unknown, message = "你没有执行此操作的权限。", status = 403): asserts condition { if (!condition) throw new DomainError(status, message); }
const meta = (id: string, current?: Entity): Entity => ({ id, version: (current?.version ?? 0) + 1, createdAt: current?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() });

export class WorkspaceService {
  constructor(private repo: WorkspaceRepository) {}
  private householdAccess(state: State, actor: Actor, householdId: string) {
    return actor.role === "ops" || (actor.role === "host" ? state.households.some(h => h.id === householdId && h.hostId === actor.userId) : state.memberships.some(m => m.householdId === householdId && m.userId === actor.userId && m.role === "learner"));
  }
  async snapshot(actor: Actor): Promise<Snapshot> {
    const state = await this.repo.snapshot();
    requireRule(state.users.some(u => u.id === actor.userId), "身份不存在。", 401);
    if (actor.role === "ops") return { ...state, actor, serverTime: new Date().toISOString() };
    const households = state.households.filter(h => this.householdAccess(state, actor, h.id));
    const allowed = new Set(households.map(h => h.id));
    const memberships = state.memberships.filter(m => allowed.has(m.householdId));
    const assignments = state.assignments.filter(a => allowed.has(a.householdId));
    const assignmentIds = new Set(assignments.map(a => a.id));
    const submissions = state.submissions.filter(s => assignmentIds.has(s.assignmentId) && (actor.role === "learn" ? s.learnerId === actor.userId : s.status === "submitted"));
    const submissionIds = new Set(submissions.map(s => s.id));
    const userIds = new Set([...memberships.map(m => m.userId), actor.userId, ...households.map(h => h.hostId)]);
    return {
      actor, serverTime: new Date().toISOString(), households, memberships, assignments, submissions,
      users: state.users.filter(u => userIds.has(u.id)).map(u => u.id === actor.userId ? u : { ...u, email: "" }),
      terms: state.terms.filter(t => households.some(h => h.termId === t.id)),
      sessions: state.sessions.filter(s => allowed.has(s.householdId)),
      feedback: state.feedback.filter(f => submissionIds.has(f.submissionId) && (actor.role === "host" ? f.authorId === actor.userId : f.status === "published")),
      applications: [], enrollments: state.enrollments.filter(e => e.userId === actor.userId),
    };
  }
  execute(actor: Actor, command: Command): Promise<{ version: number }> {
    return this.repo.transaction(tx => {
      const receipt = tx.receipt(actor.userId, command.id);
      if (receipt) return receipt;
      const state = tx.read();
      requireRule(state.users.some(u => u.id === actor.userId), "身份不存在。", 401);
      let version = 0;
      const checkVersion = (value?: Entity) => { requireRule((value?.version ?? 0) === command.baseVersion, "这条记录已在其他设备更新。你的输入已保留，请查看最新版本。", 409); version = (value?.version ?? 0) + 1; };
      switch (command.kind) {
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
            tx.saveMembership({ ...meta(randomUUID()), householdId: household.id, userId: application.userId, role: "learner" });
            tx.saveEnrollment({ ...meta(randomUUID()), householdId: household.id, userId: application.userId, termId: household.termId, plan: "母语档 · 每周 1 次", amountMinor: 318000, currency: "CNY", paymentStatus: "pending" });
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
      return { version };
    });
  }
  apply(input: unknown) {
    const data = applicationSchema.parse(input);
    return this.repo.transaction(tx => {
      const email = data.email.toLowerCase();
      requireRule(!tx.read().users.some(u => u.email === email), "这个邮箱已有报名记录，请联系运营确认。", 409);
      const user = { ...meta(randomUUID()), name: data.name, email, city: "", timezone: "Asia/Shanghai", avatar: "blue" };
      tx.saveUser(user);
      const application = { ...meta(randomUUID()), userId: user.id, goal: data.goal, availability: data.availability, status: "new" as const };
      tx.saveApplication(application);
      return { id: application.id };
    });
  }
}
