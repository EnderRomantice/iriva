import type { MessageCard } from "@/domain/message-cards";
import { defaultOrganizationId, type WorkspaceScope } from "@/domain/workspace";
import Dexie, { type EntityTable } from "dexie";
import type { Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";

export interface PendingOperation { seq?: number; id: string; role: WorkspaceScope; entityId: string; command: Command; status: "pending" | "conflict"; error?: string; queuedAt?: string }
export interface Draft { key: string; role: WorkspaceScope; body: string; cards?: MessageCard[]; savedAt: string }
export const localDb = new Dexie("iriva-workspace-v1") as Dexie & {
  snapshots: EntityTable<{ role: WorkspaceScope; data: Snapshot }, "role">;
  outbox: EntityTable<PendingOperation, "seq">;
  drafts: EntityTable<Draft, "key">;
};
localDb.version(1).stores({ snapshots: "role", outbox: "++seq,&id,role,entityId", drafts: "key,role" });

/** Overlay queued (outbox) and in-flight (optimistic) commands on the last server snapshot. */
export function projectSnapshot(snapshot: Snapshot, operations: Pick<PendingOperation, "command" | "queuedAt">[]): Snapshot {
  const data = structuredClone(snapshot);
  data.channels ??= []; data.channelParticipants ??= []; data.messages ??= [];
  const userId = data.actor.userId, organizationId = data.actor.organizationId || defaultOrganizationId;
  for (const { command, queuedAt } of operations) {
    const meta = { id: command.entityId, version: command.baseVersion + 1, createdAt: queuedAt || data.serverTime, updatedAt: queuedAt || data.serverTime };
    const related = (id: string) => ({ ...meta, id: `${command.id.slice(0, 24)}${id.slice(24)}` });
    const absent = <T extends { id: string }>(rows: T[]) => !rows.some(row => row.id === command.entityId);
    if (command.kind === "message.send") {
      const value = { ...meta, ...command.payload, authorId: data.actor.userId };
      data.messages = [...data.messages.filter(m => m.id !== value.id), value];
    } else if (command.kind === "submission.save") {
      const value = { ...meta, ...command.payload, learnerId: data.actor.userId };
      data.submissions = [...data.submissions.filter(s => s.id !== value.id), value];
    } else if (command.kind === "feedback.save") {
      const value = { ...meta, ...command.payload, authorId: data.actor.userId };
      data.feedback = [...data.feedback.filter(f => f.id !== value.id), value];
    } else if (command.kind === "message.react") {
      const { emoji, active } = command.payload;
      data.messages = data.messages.map(m => {
        if (m.id !== command.entityId) return m;
        const others = (m.reactions || []).filter(r => !(r.userId === userId && r.emoji === emoji));
        return { ...m, reactions: active ? [...others, { userId, emoji }] : others };
      });
    } else if (command.kind === "channel.create") {
      if (absent(data.channels)) data.channels = [...data.channels, { ...meta, ...command.payload, organizationId, ownerId: userId, directKey: "" }];
    } else if (command.kind === "conversation.open") {
      if (absent(data.channels)) {
        data.channels = [...data.channels, { ...meta, organizationId, ownerId: userId, name: "", description: "", kind: "direct", directKey: [userId, command.payload.userId].sort().join(":") }];
        data.channelParticipants = [...data.channelParticipants, ...[userId, command.payload.userId].map(participant => ({ ...related(participant), channelId: command.entityId, userId: participant }))];
      }
    } else if (command.kind === "assignment.create") {
      if (absent(data.assignments)) data.assignments = [...data.assignments, { ...meta, ...command.payload }];
    } else if (command.kind === "session.create") {
      if (absent(data.sessions)) data.sessions = [...data.sessions, { ...meta, ...command.payload, status: "scheduled", meetingUrl: "" }];
    } else if (command.kind === "session.reschedule") {
      data.sessions = data.sessions.map(s => s.id === command.entityId ? { ...s, ...command.payload, version: meta.version, updatedAt: meta.updatedAt } : s);
    } else if (command.kind === "household.create") {
      if (absent(data.households)) {
        data.households = [...data.households, { ...meta, ...command.payload, organizationId, timezone: "Asia/Shanghai" }];
        data.memberships = [...data.memberships, { ...related(command.payload.hostId), householdId: command.entityId, userId: command.payload.hostId, role: "host" }];
      }
    } else if (command.kind === "application.contact" || command.kind === "application.enroll") {
      const application = data.applications.find(a => a.id === command.entityId);
      if (!application) continue;
      data.applications = data.applications.map(a => a.id === application.id ? { ...a, status: command.kind === "application.enroll" ? "enrolled" : "contacted", version: meta.version, updatedAt: meta.updatedAt } : a);
      if (command.kind === "application.enroll" && !data.memberships.some(m => m.householdId === command.payload.householdId && m.userId === application.userId)) {
        data.memberships = [...data.memberships, { ...related(application.userId), householdId: command.payload.householdId, userId: application.userId, role: "learner" }];
      }
    }
  }
  return data;
}

export async function enqueue(role: WorkspaceScope, command: Command) {
  await localDb.transaction("rw", localDb.outbox, localDb.snapshots, async () => {
    const existing = await localDb.outbox.where("role").equals(role).toArray();
    const cached = await localDb.snapshots.get(role);
    // Resolve the logical record even if two fast clicks used a stale render.
    const logical = command.kind === "submission.save"
      ? cached?.data.submissions.find(item => item.assignmentId === command.payload.assignmentId)
      : command.kind === "feedback.save" ? cached?.data.feedback.find(item => item.submissionId === command.payload.submissionId) : undefined;
    const pendingLogical = existing.find(item => item.command.kind === command.kind && (
      command.kind === "submission.save" && item.command.kind === "submission.save" ? item.command.payload.assignmentId === command.payload.assignmentId
      : command.kind === "feedback.save" && item.command.kind === "feedback.save" ? item.command.payload.submissionId === command.payload.submissionId : false
    ));
    const entityId = logical?.id || pendingLogical?.entityId || command.entityId;
    const chain = existing.filter(item => item.entityId === entityId);
    if (chain.some(item => item.status === "conflict")) throw new Error("这条记录有同步冲突，请先在同步状态中处理。你的草稿已保留。");
    const version = logical && logical.id !== command.entityId ? logical.version : command.baseVersion;
    const baseVersion = chain.length ? chain.at(-1)!.command.baseVersion + 1 : version;
    await localDb.outbox.add({ id: command.id, role, entityId, command: { ...command, entityId, baseVersion }, status: "pending", queuedAt: new Date().toISOString() });
  });
}

export async function saveDraft(role: WorkspaceScope, entityId: string, body: string, cards?: MessageCard[]) {
  await localDb.drafts.put({ key: `${role}:${entityId}`, role, body, cards, savedAt: new Date().toISOString() });
}
