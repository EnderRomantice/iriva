"use client";
import { useEffect, useState } from "react";
import { canAccessWorkspaceView } from "@/domain/workspace-access";
import type { Role } from "@/domain/models";
import { defaultOrganizationId } from "@/domain/workspace";
import { viewLabels, type View } from "./preferences";
export interface SpaceRoute { organizationId: string; householdId: string; channelId?: string; profileReturn?: "hosts"; applicationTab?: "bookings"; view: View }
const globalViews:View[] = ["applications","hosts","profile","channels","direct"];
export function viewRoute(route: SpaceRoute, view: View, scope: "organization" | "household"): SpaceRoute {
  return { ...route, channelId: undefined, profileReturn: undefined, applicationTab: undefined, view, householdId: scope === "organization" || globalViews.includes(view) ? "" : route.householdId };
}
export interface Visit { href: string; title: string; at: number }
interface NavigationState { entries: Visit[]; index: number }
export function normalizeRoute(role:Role, route:SpaceRoute):SpaceRoute {
  const allowed = canAccessWorkspaceView(role,route.view);
  const view = allowed && (route.view !== 'journey' || route.householdId) ? route.view : 'overview';
  return {
    organizationId:route.organizationId,
    householdId:allowed && !globalViews.includes(view) ? route.householdId : '',
    view,
    ...((view === 'channels' || view === 'direct') && route.channelId ? {channelId:route.channelId} : {}),
    ...(view === 'profile' && role === 'learn' && route.profileReturn === 'hosts' ? {profileReturn:'hosts' as const} : {}),
    ...(view === 'applications' && route.applicationTab === 'bookings' ? {applicationTab:'bookings' as const} : {}),
  };
}
export function routeHref(role: Role, input: SpaceRoute) {
  const route = normalizeRoute(role,input);
  const query = new URLSearchParams();
  if (route.organizationId !== defaultOrganizationId) query.set("org", route.organizationId);
  if (route.channelId && (route.view === "channels" || route.view === "direct")) query.set("channel", route.channelId);
  if (route.view === "applications" && role !== "learn" && route.applicationTab) query.set("tab",route.applicationTab);
  if (route.householdId) query.set("household", route.householdId);
  if (route.view === "profile" && route.profileReturn) query.set("return", route.profileReturn);
  if (route.view !== "overview") query.set("view", route.view);
  return `/${role}${query.size ? `?${query}` : ""}`;
}
export function readRoute(href: string, role: Role): SpaceRoute {
  const url = new URL(href, "http://localhost");
  const value = url.searchParams.get("panel") === "profile" ? "profile" : url.searchParams.get("view") || "overview";
  const householdId = url.searchParams.get("household") || "";
  return normalizeRoute(role,{
    organizationId:url.searchParams.get("org") || defaultOrganizationId,
    householdId, view:value as View,
    channelId:url.searchParams.get('channel') || undefined,
    ...(url.searchParams.get('return') === 'hosts' ? {profileReturn:'hosts' as const} : {}),
    ...(url.searchParams.get('tab') === 'bookings' ? {applicationTab:'bookings' as const} : {}),
  });
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
    next = normalizeRoute(role,next);
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
