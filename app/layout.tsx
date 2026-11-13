import type { Metadata, Viewport } from 'next';
import '@chinese-fonts/yozai/dist/Yozai-Regular/result.css';
import '@chinese-fonts/yozai/dist/Yozai-Medium/result.css';
import '@fontsource-variable/source-sans-3/index.css';
import '@fontsource-variable/source-serif-4/index.css';
import './globals.css';
import './theme-paper.css';


export const metadata: Metadata = {
  title: '青鸟 IRIVA · 从敢开口，到有话想说',
  description: '在被看见、被回应的关系里，自在开口。4位固定伙伴、1位温暖的Host，四周 Pilot 共同经历，找到想说话的人。',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { themeColor: '#f7f9f8' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN">
    <body>{children}</body>
  </html>;
}
