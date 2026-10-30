import type { Metadata } from "next";
import localFont from "next/font/local";
import "./space.css";
import "./popover-motion.css";
const slackLato = localFont({
  src: [
    { path: "../fonts/slack-lato-regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/slack-lato-bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/slack-lato-black.woff2", weight: "900", style: "normal" },
  ],
  display: "swap", variable: "--font-slack-lato", fallback: ["Arial"],
});
export const metadata: Metadata = { title: "IRIVA · Household", robots: { index: false, follow: false } };
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <div className={slackLato.variable}>{children}</div>;
}
