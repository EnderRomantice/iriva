import type { LucideIcon } from "lucide-react";
import type { View } from "./preferences";

// Separate solid silhouettes keep the selected icon legible, including its cutouts.
const silhouettes: Partial<Record<View, string>> = {
  channels: "M7 2h3L9 7h5l1-5h3l-1 5h5v3h-5l-1 4h5v3h-6l-1 5h-3l1-5H7l-1 5H3l1-5H0v-3h5l1-4H1V7h5Zm1 8-1 4h5l1-4Z",
  direct: "M4 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8l-7 5v-5H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 5v2h12V7Zm0 5v2h8v-2Z",
  overview: "M2 10.5 12 2l10 8.5V21a1 1 0 0 1-1 1h-6v-8H9v8H3a1 1 0 0 1-1-1Z",
  tasks: "M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 4v2h2V6Zm5 0v2h5V6ZM7 11v2h2v-2Zm5 0v2h5v-2ZM7 16v2h2v-2Zm5 0v2h5v-2Z",
  calendar: "M7 1h2v3h6V1h2v3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3Zm-2 9v9h14v-9Z",
  household: "M10 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM3 21v-3a7 7 0 0 1 14 0v3Zm16 0v-3a9 9 0 0 0-2-5.6 6 6 0 0 1 6 5.6v3Z",
  applications: "M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 12h10v-1a5 3 0 0 0-10 0Z",
};
export function RailIcon({ view, icon: Outline, selected }: { view: View; icon: LucideIcon; selected: boolean }) {
  return <span className="sp-rail-icon t-icon-swap" data-state={selected ? "b" : "a"} aria-hidden="true">
    <span className="t-icon" data-icon="a"><Outline /></span>
    <span className="t-icon" data-icon="b"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path fillRule="evenodd" d={silhouettes[view]} /></svg></span>
  </span>;
}
