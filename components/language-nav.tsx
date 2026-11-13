'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const LANGUAGES = [
  { code: 'zh-CN', key: 'zh', label: '简体中文', href: '/' },
  { code: 'en', key: 'en', label: 'English', href: '/en' },
] as const;

/** 点地球图标：导航链接带着模糊滑出，语言选项从另一侧滑入，原位替换。 */
export default function LanguageNav({ lang, children }: { lang: 'zh' | 'en'; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const choose = (key: string, href: string) => {
    if (key === lang) { setOpen(false); return; }
    window.location.href = href + window.location.hash;
  };

  return <div className="lang-nav" data-open={open} ref={root}>
    <div className="lang-stage" data-page={open ? 'lang' : 'nav'}>
      <div className="lang-page lang-page-nav" aria-hidden={open} inert={open}>{children}</div>
      <div id={id} className="lang-page lang-options" role="group" aria-label={lang === 'en' ? 'Choose language' : '选择语言'} aria-hidden={!open} inert={!open}>
        {LANGUAGES.map(l => <button key={l.key} type="button" lang={l.code} aria-pressed={l.key === lang} onClick={() => choose(l.key, l.href)}>{l.label}</button>)}
      </div>
    </div>
    <button className="lang-trigger" type="button" aria-label={lang === 'en' ? 'Choose language' : '选择语言'} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/></svg>
    </button>
  </div>;
}
