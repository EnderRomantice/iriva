import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Shared by the marketing site and the workspace so both read as one product.
const slackLato = localFont({
  src: [
    { path: "./fonts/slack-lato-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/slack-lato-bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/slack-lato-black.woff2", weight: "900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-slack-lato",
  fallback: ["Arial"],
});

export const metadata: Metadata = {
  title: "青鸟 IRIVA Household",
  description: "4 位学习者、1 位 Host，六周固定同行，自在地用英语开口。",
};

export const viewport: Viewport = {
  themeColor: "#12658a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${slackLato.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
