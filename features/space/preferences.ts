import { useEffect, useState } from "react";
export const viewLabels = { overview: "本周", tasks: "练习与反馈", calendar: "日程", household: "伙伴", applications: "报名与组班", journey: "六周旅程" };
export type View = keyof typeof viewLabels;
export interface Preferences { color: string; dark: boolean; compact: boolean; collapsed: boolean; hidden: View[]; order: View[] }
export const defaults: Preferences = { color: "#12658a", dark: false, compact: false, collapsed: false, hidden: ["journey"], order: ["overview", "tasks", "applications", "calendar", "household", "journey"] };
export const preferenceKey = "iriva-space-preferences-v1";
export function parsePreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw || "null"); if (!p || typeof p !== "object") return defaults;
    const order: View[] = Array.isArray(p.order) ? [...new Set<View>(p.order.filter((v: unknown): v is View => typeof v === "string" && Object.hasOwn(viewLabels, v)))] : defaults.order;
    return { color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : defaults.color, dark: p.dark === true, compact: p.compact === true, collapsed: p.collapsed === true, hidden: Array.isArray(p.hidden) ? p.hidden.filter((v: View) => v !== "overview" && Object.hasOwn(viewLabels, v)) : defaults.hidden, order: [...order, ...defaults.order.filter(v => !order.includes(v))] };
  } catch { return defaults; }
}
export function usePreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { try { setPreferences(parsePreferences(localStorage.getItem(preferenceKey))); } catch { setError("外观设置无法写入此浏览器，当前更改仅在本次打开期间生效。"); } setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch { setError("外观设置无法保存，当前更改仅在本次打开期间生效。"); } }, [preferences, ready]);
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
