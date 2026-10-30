"use client";
import { useEffect, useState } from "react";
import type { Role } from "@/domain/models";
import { defaultOrganizationId } from "@/domain/workspace";
import { viewLabels, type View } from "./preferences";
export interface SpaceRoute { organizationId: string; householdId: string; view: View }
export interface Visit { href: string; title: string; at: number }
interface NavigationState { entries: Visit[]; index: number }
export function routeHref(role: Role, route: SpaceRoute) {
  const query = new URLSearchParams();
  if (route.organizationId !== defaultOrganizationId) query.set("org", route.organizationId);
  if (route.householdId) query.set("household", route.householdId);
  if (route.view !== "overview") query.set("view", route.view);
  return `/${role}${query.size ? `?${query}` : ""}`;
}
export function readRoute(href: string, role: Role): SpaceRoute {
  const url = new URL(href, "http://localhost");
  const value = url.searchParams.get("view") || "overview";
  const valid = Object.hasOwn(viewLabels, value) && (role === "ops" ? value !== "tasks" : value !== "applications");
  return { organizationId: url.searchParams.get("org") || defaultOrganizationId, householdId: url.searchParams.get("household") || "", view: valid ? value as View : "overview" };
}
export function appendVisit(state: NavigationState, visit: Visit): NavigationState {
  if (state.entries[state.index]?.href === visit.href) return state;
  const entries = [...state.entries.slice(0, state.index + 1), visit];
  return { entries, index: entries.length - 1 };
}
export function rememberVisit(visits: Visit[], visit: Visit) {
  return [visit, ...visits.filter(item => item.href !== visit.href)].slice(0, 20);
}
export function useSpaceNavigation(role: Role) {
  const [route, setRoute] = useState<SpaceRoute>();
  const [state, setState] = useState<NavigationState>({ entries: [], index: 0 });
  const key = `iriva-navigation-${role}`;
  const [recent, setRecent] = useState<Visit[]>([]);
  function remember(visit: Visit) {
    setRecent(previous => { const next = rememberVisit(previous, visit); try { sessionStorage.setItem(`${key}-recent`, JSON.stringify(next)); } catch {} return next; });
  }
  useEffect(() => {
    const href = location.pathname + location.search;
    let restored: NavigationState | undefined;
    try {
      const candidate = JSON.parse(sessionStorage.getItem(key) || "null");
      if (candidate && Array.isArray(candidate.entries) && Number.isInteger(candidate.index) && candidate.entries[candidate.index]?.href === href && candidate.entries.every((entry: Visit) => typeof entry.href === "string" && entry.href.startsWith(`/${role}`) && typeof entry.title === "string")) restored = candidate;
    } catch {}
    const initial = restored || { entries: [{ href, title: viewLabels[readRoute(href, role).view], at: Date.now() }], index: 0 };
    setState(initial); setRoute(readRoute(href, role));
    let visits: Visit[] = [];
    try { const saved = JSON.parse(sessionStorage.getItem(`${key}-recent`) || "[]"); if (Array.isArray(saved)) visits = saved.filter(v => typeof v.href === "string" && v.href.startsWith(`/${role}`) && typeof v.title === "string"); } catch {}
    setRecent(rememberVisit(visits, initial.entries[initial.index]));
    history.replaceState({ ...history.state, irivaIndex: initial.index }, "", href);
    const pop = () => {
      const href = location.pathname + location.search;
      setRoute(readRoute(href, role));
      setState(previous => {
        const index = history.state?.irivaIndex;
        const next = Number.isInteger(index) && previous.entries[index]?.href === href ? { ...previous, index } : { entries: [{ href, title: viewLabels[readRoute(href, role).view], at: Date.now() }], index: 0 };
        try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
        return next;
      });
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [role, key]);
  function go(next: SpaceRoute, title: string) {
    const href = routeHref(role, next);
    const updated = appendVisit(state, { href, title, at: Date.now() });
    if (updated !== state) history.pushState({ ...history.state, irivaIndex: updated.index }, "", href);
    setState(updated); setRoute(next);
    remember({ href, title, at: Date.now() });
    try { sessionStorage.setItem(key, JSON.stringify(updated)); } catch {}
  }
  return { route, go, recent, back: () => history.back(), forward: () => history.forward(), canBack: state.index > 0, canForward: state.index < state.entries.length - 1 };
}
export type SpaceNavigation = ReturnType<typeof useSpaceNavigation>;
