import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "青鸟 IRIVA · IRIVA Household",
  description: "4 位学习者、1 位 Host，六周固定同行，自在地用英语开口。",
};

export const viewport: Viewport = {
  themeColor: "#2f5b72",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
