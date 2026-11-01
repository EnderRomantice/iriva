import type { WorkspaceView } from "@/domain/workspace-access";
import { defaultOrganizationId, demoOrganizationId } from "@/domain/workspace";
import { useThemeTransition } from "./theme-transition";
import { useEffect, useState } from "react";
export const viewLabels = { profile: "个人资料", hosts: "寻找 Host", overview: "本周", channels: "频道", direct: "私聊", tasks: "练习与反馈", calendar: "日程", household: "伙伴", applications: "报名", journey: "六周旅程", manage: "管理" } satisfies Record<WorkspaceView,string>;
export type View = keyof typeof viewLabels;
export interface Preferences { color: string; dark: boolean; compact: boolean; collapsed: boolean; hidden: View[]; order: View[] }
export const defaults: Preferences = { color: "#12658a", dark: false, compact: false, collapsed: false, hidden: ["journey"], order: ["overview", "channels", "direct", "hosts", "tasks", "applications", "manage", "calendar", "household", "journey"] };
export const preferenceKey = "iriva-space-preferences-v1";
export function parsePreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw || "null"); if (!p || typeof p !== "object") return defaults;
    const order: View[] = Array.isArray(p.order) ? [...new Set<View>(p.order.filter((v: unknown): v is View => typeof v === "string" && Object.hasOwn(viewLabels, v)))] : defaults.order;
    return { color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : defaults.color, dark: p.dark === true, compact: p.compact === true, collapsed: p.collapsed === true, hidden: Array.isArray(p.hidden) ? p.hidden.filter((v: View) => v !== "overview" && Object.hasOwn(viewLabels, v)) : defaults.hidden, order: withNewViews(order) };
  } catch { return defaults; }
}
/** Views added after a person saved their order go next to their default neighbour, not to the end. */
function withNewViews(order: View[]) {
  const result = [...order];
  defaults.order.forEach((view, index) => {
    if (result.includes(view)) return;
    const before = defaults.order.slice(0, index).reverse().find(v => result.includes(v));
    if (before) result.splice(result.indexOf(before) + 1, 0, view); else result.push(view);
  });
  return result;
}
export function usePreferences(organizationId = defaultOrganizationId) {
  const key = organizationId === defaultOrganizationId ? preferenceKey : `${preferenceKey}:${organizationId}`;
  const initial = organizationId === demoOrganizationId ? { ...defaults, color: "#5d3c63" } : defaults;
  const [preferences, commitPreferences] = useState(initial);
  const setPreferences = useThemeTransition(preferences, commitPreferences);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { try { const saved = localStorage.getItem(key); commitPreferences(saved ? parsePreferences(saved) : initial); } catch { setError("外观设置无法写入此浏览器，当前更改仅在本次打开期间生效。"); } setReady(true); }, [key]);
  useEffect(() => { if (ready) try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { setError("外观设置无法保存，当前更改仅在本次打开期间生效。"); } }, [preferences, ready, key]);
  return { preferences, setPreferences, preferenceError: error };
}
export function onColor(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#17191c" : "#ffffff";
}

export function accentInk(hex: string) {
  const dark = [21, 23, 26];
  const mixed = [1, 3, 5].map((offset, index) => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * .75 + dark[index] * .25).toString(16).padStart(2, "0")).join("");
  return onColor(`#${mixed}`);
}
