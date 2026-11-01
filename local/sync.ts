import { scopeIdentity, type WorkspaceScope } from "@/domain/workspace";
import type { Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { localDb } from "./database";

export type NetworkMode = "online" | "offline" | "slow";
export function networkMode(): NetworkMode { return (localStorage.getItem("iriva-network") as NetworkMode) || "online"; }
export function setNetworkMode(value: NetworkMode) { localStorage.setItem("iriva-network", value); window.dispatchEvent(new Event("iriva-network")); }
export async function request(role: WorkspaceScope, path: string, command?: Command): Promise<Response> {
  if (networkMode() === "offline" || !navigator.onLine) throw new Error("当前离线，内容已保存在本机。");
  if (networkMode() === "slow") await new Promise(resolve => setTimeout(resolve, 1800));
  return fetch(path, { method: command ? "POST" : "GET", headers: { "x-demo-role": scopeIdentity(role).role, "x-account-id": role.split(":")[2] || "", "x-workspace-id": scopeIdentity(role).organizationId, ...(command ? { "Content-Type": "application/json" } : {}) }, body: command ? JSON.stringify(command) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
}
export async function fetchSnapshot(role: WorkspaceScope): Promise<Snapshot> {
  const response = await request(role, "/api/workspace");
  if (!response.ok) throw new Error((await response.json()).error);
  return response.json();
}
const running = new Map<WorkspaceScope, Promise<void>>();
export function synchronize(role: WorkspaceScope): Promise<void> {
  const active = running.get(role);
  if (active) return active;
  const work = async () => {
    const operations = await localDb.outbox.where("role").equals(role).sortBy("seq");
    const blocked = new Set(operations.filter(o => o.status === "conflict").map(o => o.entityId));
    for (const operation of operations) {
      if (blocked.has(operation.entityId)) continue;
      const response = await request(role, "/api/mutations", operation.command);
      if (!response.ok) {
        const error = (await response.json()).error || "同步失败";
        if (response.status >= 400 && response.status < 500) {
          await localDb.outbox.update(operation.seq!, { status: "conflict", error });
          blocked.add(operation.entityId);
          continue;
        }
        throw new Error(error);
      }
      // Keep the command until both acknowledgement and fresh server data arrive.
      // A lost response is safe: retrying the same command ID is idempotent.
      const fresh = await fetchSnapshot(role);
      await localDb.transaction("rw", localDb.snapshots, localDb.outbox, async () => {
        await localDb.snapshots.put({ role, data: fresh });
        await localDb.outbox.delete(operation.seq!);
      });
    }
    const fresh = await fetchSnapshot(role);
    await localDb.snapshots.put({ role, data: fresh });
  };
  const task = (async () => { if (navigator.locks) await navigator.locks.request(`iriva-sync-${role}`, work); else await work(); })().finally(() => running.delete(role));
  running.set(role, task);
  return task;
}

/** Rebase only after an explicit user choice; never silently overwrite another device. */
export async function resolveConflict(role: WorkspaceScope, entityId: string, choice: "local" | "server") {
  const fresh = await fetchSnapshot(role);
  await localDb.transaction("rw", localDb.snapshots, localDb.outbox, localDb.drafts, async () => {
    const entries = (await localDb.outbox.where("role").equals(role).sortBy("seq")).filter(o => o.entityId === entityId);
    const latest = entries.at(-1);
    await localDb.snapshots.put({ role, data: fresh });
    for (const entry of entries) await localDb.outbox.delete(entry.seq!);
    if (choice === "local" && latest) {
      const records = latest.command.kind === "message.send" ? fresh.messages : latest.command.kind === "submission.save" ? fresh.submissions : fresh.feedback;
      const baseVersion = records.find(item => item.id === entityId)?.version ?? 0;
      const id = crypto.randomUUID();
      await localDb.outbox.add({ ...latest, seq: undefined, id, status: "pending", error: undefined, command: { ...latest.command, id, baseVersion } });
    } else if (latest) {
      const key = latest.command.kind === "submission.save" ? `assignment-${latest.command.payload.assignmentId}` : latest.command.kind === "feedback.save" ? `feedback-${latest.command.payload.submissionId}` : entityId;
      await localDb.drafts.delete(`${role}:${key}`);
    }
  });
}
