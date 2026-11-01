import type { Metadata } from "next";
import "./space.css";
import "./popover-motion.css";
import "./theme-motion.css";

// Slack-Lato is loaded once in the root layout and exposed as --font-slack-lato.
export const metadata: Metadata = { title: "IRIVA · Household", robots: { index: false, follow: false } };
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
