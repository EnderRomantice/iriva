"use client";
import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Role } from "@/domain/models";
import type { Command } from "@/domain/commands";
import { enqueue, localDb, projectSnapshot } from "./database";
import { networkMode, request, synchronize, type NetworkMode } from "./sync";

export function useWorkspace(role: Role) {
  const cache = useLiveQuery(() => localDb.snapshots.get(role), [role]);
  const operations = useLiveQuery(() => localDb.outbox.where("role").equals(role).sortBy("seq"), [role]) ?? [];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<NetworkMode>("online");
  const [connected, setConnected] = useState(true);
  const [shellStatus, setShellStatus] = useState("正在检查离线打开能力…");
  const refresh = useCallback(async () => {
    setBusy(true);
    try { await synchronize(role); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "暂时无法连接服务器"); }
    finally { setBusy(false); }
  }, [role]);
  useEffect(() => {
    const update = () => { setMode(networkMode()); setConnected(navigator.onLine); void refresh(); };
    update();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
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
  const mutate = async (command: Command) => { await enqueue(role, command); void refresh(); };
  const onlineMutation = async (command: Command) => {
    const response = await request(role, "/api/mutations", command);
    if (!response.ok) throw new Error((await response.json()).error);
    await refresh();
  };
  return { data: cache ? projectSnapshot(cache.data, operations) : undefined, operations, error, busy, offline: mode === "offline" || !connected, mode, shellStatus, refresh, mutate, onlineMutation };
}
