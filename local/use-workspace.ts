"use client";
import type { WorkspaceScope } from "@/domain/workspace";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Command } from "@/domain/commands";
import { enqueue, localDb, projectSnapshot, type PendingOperation } from "./database";
import { networkMode, request, synchronize,commandDetails, type NetworkMode } from "./sync";

export function useWorkspace(role: WorkspaceScope) {
  const cache = useLiveQuery(() => localDb.snapshots.get(role), [role]);
  const operations = useLiveQuery(() => localDb.outbox.where("role").equals(role).sortBy("seq"), [role]) ?? [];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<NetworkMode>("online");
  const [connected, setConnected] = useState(true);
  const [shellStatus, setShellStatus] = useState("正在检查离线打开能力…");
  // Online-only commands live here while in flight, so the UI shows them immediately.
  const [optimistic, setOptimistic] = useState<PendingOperation[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(async (fresh = true) => {
    setBusy(true);
    // Let in-flight online commands land first, so queued messages never reach the
    // server ahead of e.g. the channel they belong to.
    try { await queue.current.catch(() => {}); await synchronize(role, { fresh }); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "暂时无法连接服务器"); }
    finally { setBusy(false); }
  }, [role]);
  useEffect(() => {
    const update = () => { setMode(networkMode()); setConnected(navigator.onLine); void refresh(false); };
    update();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(false); }, 3000);
    window.addEventListener("online", update); window.addEventListener("offline", update); window.addEventListener("iriva-network", update); window.addEventListener("focus", update);
    let stopped = false;
    const warm = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "CACHE_SHELL", urls: [location.pathname, ...performance.getEntriesByType("resource").map(resource => resource.name).filter(name => name.includes("/_next/static/"))] });
    };
    const workerMessage = (event: MessageEvent) => { if (event.data?.type === "CACHE_SHELL_READY" && !stopped) setShellStatus(event.data.ok ? process.env.NODE_ENV === "development" ? "草稿与操作支持离线保存。开发预览重新打开时仍需本地服务运行。" : "离线页面已准备好，可重新打开已访问的工作区。" : "离线页面尚未准备完成，请联网后重新打开。" ); };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", workerMessage);
      navigator.serviceWorker.addEventListener("controllerchange", warm);
      void navigator.serviceWorker.register("/sw.js").then(async () => {
        await navigator.serviceWorker.ready;
        if (stopped) return;
        setShellStatus("正在准备离线页面…");
        warm();
      }).catch(() => { if (!stopped) setShellStatus("此浏览器未能启用离线打开。草稿仍会保存在本机。"); });
      window.addEventListener("load", warm, { once: true });
    } else setShellStatus("此浏览器不支持离线重新打开。已打开页面的草稿仍会保存在本机。");
    return () => { stopped = true; window.removeEventListener("load", warm); if ("serviceWorker" in navigator) { navigator.serviceWorker.removeEventListener("message", workerMessage); navigator.serviceWorker.removeEventListener("controllerchange", warm); } clearInterval(interval); window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("iriva-network", update); window.removeEventListener("focus", update); };
  }, [refresh]);
  const mutate = useCallback(async (command: Command) => { await enqueue(role, command); void refresh(); }, [role, refresh]);
  /**
   * Applies the command to the UI right away and sends it in the background.
   * Commands are sent in order; the optimistic row is dropped only after a fresh
   * snapshot containing the server's version has landed (or immediately on failure).
   * Callers should not await this for UI transitions — only to learn about errors.
   */
  const onlineMutation = useCallback((command: Command) => {
    const entry: PendingOperation = { id: command.id, role, entityId: command.entityId, command, status: "pending", queuedAt: new Date().toISOString() };
    setOptimistic(list => [...list, entry]);
    const drop = () => setOptimistic(list => list.filter(item => item.id !== command.id));
    const sent = queue.current.catch(() => {}).then(async () => {
      const response = await request(role, "/api/mutations", command);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "暂时无法保存，请稍后重试。");
      return body as { version: number; entityId?: string };
    });
    queue.current = sent;
    sent.then(async result=>{
      try {await refresh();const cached=await localDb.snapshots.get(role);if(cached){const updated=await commandDetails(role,cached.data,command,result.entityId||command.entityId);await localDb.snapshots.put({role,data:updated});}}
      catch(e){setError(e instanceof Error?e.message:'读取失败');}
      finally{drop();}
    },drop);
    return sent;
  }, [role, refresh]);
  const data = useMemo(() => cache ? projectSnapshot(cache.data, [...operations, ...optimistic]) : undefined, [cache, operations, optimistic]);
  return { data, operations, error, busy, offline: mode === "offline" || !connected, mode, shellStatus, refresh, mutate, onlineMutation };
}
