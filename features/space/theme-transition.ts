"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import type { Preferences } from "./preferences";

const directions = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

/** Capture the old theme before committing React's next frame. */
export function useThemeTransition(preferences: Preferences, commit: Dispatch<SetStateAction<Preferences>>): Dispatch<SetStateAction<Preferences>> {
  const latest = useRef(preferences);
  latest.current = preferences;
  const active = useRef<ViewTransition | undefined>(undefined);
  const revision = useRef(0);
  const stop = () => {
    active.current?.skipTransition();
    active.current = undefined;
    delete document.documentElement.dataset.themeReveal;
  };
  useEffect(() => () => { revision.current++; stop(); }, []);

  return action => {
    const previous = latest.current;
    const next = typeof action === "function" ? action(previous) : action;
    latest.current = next;
    const current = ++revision.current;
    stop();
    const apply = () => { if (revision.current === current) flushSync(() => commit(next)); };
    if (previous.dark === next.dark || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState !== "visible") {
      apply(); return;
    }
    document.documentElement.dataset.themeReveal = directions[Math.floor(Math.random() * directions.length)];
    try {
      const transition = document.startViewTransition(apply);
      active.current = transition;
      void transition.ready.catch(() => {});
      void transition.finished.catch(() => {}).finally(() => { if (active.current === transition) stop(); });
    } catch {
      stop(); apply();
    }
  };
}
