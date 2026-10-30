"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
export function Popover({ anchor, label, onClose, children, className = "", placement = "below" }: { anchor: RefObject<HTMLElement | null>; label: string; onClose: () => void; children: ReactNode; className?: string; placement?: "below" | "side" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 76, top: 50 });
  const [phase, setPhase] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  function close(restoreFocus = false) {
    if (closing.current) return;
    closing.current = true; setPhase("is-closing");
    const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dropdown-close-dur")) || 150;
    closeTimer.current = setTimeout(() => { closeRef.current(); if (restoreFocus) anchor.current?.focus(); }, duration);
  }
  useEffect(() => {
    const align = () => {
      const trigger = anchor.current?.getBoundingClientRect();
      const width = ref.current?.offsetWidth || 320;
      const height = ref.current?.offsetHeight || 300;
      if (trigger) setPosition({ left: Math.max(8, Math.min(placement === "side" ? trigger.right + 8 : trigger.left, innerWidth - width - 8)), top: Math.max(8, Math.min(placement === "side" ? trigger.bottom - height : trigger.bottom + 7, innerHeight - height - 8)) });
    };
    align(); const frame = requestAnimationFrame(() => { setPhase("is-open"); ref.current?.querySelector<HTMLElement>("button:not(:disabled),input,select,a")?.focus(); });
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close(true); }
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input,select,a") || []); if (!items.length) return;
        event.preventDefault(); const index = items.indexOf(document.activeElement as HTMLElement);
        items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key); window.addEventListener("resize", align);
    return () => { cancelAnimationFrame(frame); clearTimeout(closeTimer.current); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("resize", align); };
    // Anchor and callbacks are stable for the lifetime of an open popover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} role="dialog" aria-label={label} className={`sp-popover t-dropdown ${phase} ${className}`} data-origin={placement === "side" ? "bottom-left" : "top-left"} style={position} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !anchor.current?.contains(event.relatedTarget as Node)) close(); }}>{children}</div>;
}
