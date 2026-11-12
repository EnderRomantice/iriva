import { scopeIdentity, type WorkspaceScope } from "@/domain/workspace";
import { mergeData } from "@/domain/pagination";
import type { Snapshot } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { localDb } from "./database";

export type NetworkMode = "online" | "offline" | "slow";
export function networkMode(): NetworkMode { return (localStorage.getItem("iriva-network") as NetworkMode) || "online"; }
export function setNetworkMode(value: NetworkMode) { localStorage.setItem("iriva-network", value); window.dispatchEvent(new Event("iriva-network")); }
export async function request(role: WorkspaceScope, path: string, command?: Command, options?: {headers?:Record<string,string>;signal?:AbortSignal}): Promise<Response> {
  if (networkMode() === "offline" || !navigator.onLine) throw new Error("当前离线，内容已保存在本机。");
  if (networkMode() === "slow") await new Promise(resolve => setTimeout(resolve, 1800));
  return fetch(path, { method: command ? "POST" : "GET", headers: { "x-demo-role": scopeIdentity(role).role, "x-account-id": role.split(":")[2] || "", "x-workspace-id": scopeIdentity(role).organizationId, ...(command ? { "Content-Type": "application/json" } : {}), ...options?.headers }, body: command ? JSON.stringify(command) : undefined, cache: "no-store", signal: options?.signal || AbortSignal.timeout(15000) });
}
export async function fetchSnapshot(role: WorkspaceScope): Promise<Snapshot> {
  const cached = await localDb.snapshots.get(role);
  const response = await request(role, "/api/workspace", undefined, {headers:cached?.data.revision?{"If-None-Match":cached.data.revision}:{}});
  if(response.status===304 && cached) return cached.data;
  if (!response.ok) { if(response.status===403||response.status===401)await localDb.snapshots.delete(role); throw new Error((await response.json()).error); }
  return response.json();
}

export async function commandDetails(role:WorkspaceScope,snapshot:Snapshot,command:Command,entityId=command.entityId):Promise<Snapshot> {
 const table=command.kind.startsWith('message.')?'messages':command.kind==='channel.create'||command.kind==='conversation.open'?'channels':command.kind==='submission.save'?'submissions':command.kind==='feedback.save'?'feedback':command.kind.startsWith('session.')?'sessions':command.kind==='assignment.create'?'assignments':command.kind==='household.create'?'households':'applications';
 if(snapshot[table].some(row=>row.id===entityId))return snapshot;
 const response=await request(role,`/api/workspace/items?table=${table}&ids=${encodeURIComponent(entityId)}`);
 if(!response.ok)throw new Error((await response.json()).error);
 const page=await response.json();
 if(!Array.isArray(page.items))throw new Error('记录读取失败，请重试。');
 return mergeData(snapshot,page.related,page.cardCatalog);
}

const running = new Map<WorkspaceScope, Promise<void>>();
const followUps = new Map<WorkspaceScope, Promise<void>>();
/**
 * Push the outbox, then pull one fresh snapshot.
 * `fresh` guarantees the returned promise covers a pass that *starts after* this call,
 * so a just-queued or just-acknowledged change is reflected (instead of piggybacking on
 * a poll that began earlier and would return stale data).
 */
export function synchronize(role: WorkspaceScope, { fresh = false } = {}): Promise<void> {
  const active = running.get(role);
  if (active) {
    if (!fresh) return active;
    let next = followUps.get(role);
    if (!next) {
      next = active.catch(() => {}).then(() => { followUps.delete(role); return synchronize(role); });
      followUps.set(role, next);
    }
    return next;
  }
  const requestedAt=Date.now();
  const work = async () => {
    const operations = await localDb.outbox.where("role").equals(role).sortBy("seq");
    const recent=await localDb.snapshots.get(role);
    if(!fresh && !operations.length && recent?.data.syncedAt && recent.data.syncedAt > requestedAt-2500) return;
    const blocked = new Set(operations.filter(o => o.status === "conflict").map(o => o.entityId));
    const acknowledged: number[] = [];
    // Keep commands until both acknowledgement and fresh server data arrive, then swap
    // them atomically so optimistic rows never flicker. A lost response is safe:
    // retrying the same command ID is idempotent.
    const commit = async () => {
      let snapshot = {...await fetchSnapshot(role),syncedAt:Date.now()};
      for(const op of operations.filter(o=>acknowledged.includes(o.seq!)))snapshot={...await commandDetails(role,snapshot,op.command),syncedAt:Date.now()};
      await localDb.transaction("rw", localDb.snapshots, localDb.outbox, async () => {
        await localDb.snapshots.put({ role, data: snapshot });
        if (acknowledged.length) await localDb.outbox.bulkDelete(acknowledged);
      });
    };
    try {
      for (const operation of operations) {
        if (blocked.has(operation.entityId)) continue;
        const response = await request(role, "/api/mutations", operation.command);
        if (!response.ok) {
          const error = (await response.json().catch(() => ({}))).error || "同步失败";
          // Expired sessions and transient throttling must not poison durable edits.
          if ([401, 408, 425, 429].includes(response.status)) throw new Error(error);
          if (response.status >= 400 && response.status < 500) {
            await localDb.outbox.update(operation.seq!, { status: "conflict", error });
            blocked.add(operation.entityId);
            continue;
          }
          throw new Error(error);
        }
        acknowledged.push(operation.seq!);
      }
    } catch (error) {
      if (acknowledged.length) await commit().catch(() => {});
      throw error;
    }
    await commit();
  };
  const task = (async () => { if (navigator.locks) await navigator.locks.request(`iriva-sync-${role}`, work); else await work(); })().finally(() => running.delete(role));
  running.set(role, task);
  return task;
}

/** Rebase only after an explicit user choice; never silently overwrite another device. */
export async function resolveConflict(role: WorkspaceScope, entityId: string, choice: "local" | "server") {
  const fresh = await fetchSnapshot(role);
  const entry=(await localDb.outbox.where('role').equals(role).sortBy('seq')).filter(o=>o.entityId===entityId).at(-1);
  if(entry){const table=entry.command.kind==='message.send'?'messages':entry.command.kind==='submission.save'?'submissions':'feedback';
   const response=await request(role,`/api/workspace/items?table=${table}&ids=${encodeURIComponent(entityId)}`);
   if(!response.ok)throw new Error((await response.json()).error);
   const page=await response.json();fresh[table]=[...fresh[table].filter(row=>row.id!==entityId),...page.items];
  }
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
