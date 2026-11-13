'use client';
import { useEffect } from 'react';

/** 页面离开顶部时给 <html> 打上 data-scrolled，顶栏据此只保留标志、语言和加入；回到顶部复原。 */
export default function ScrollState() {
  useEffect(() => {
    const html = document.documentElement;
    const update = () => { const on = window.scrollY > 8; if (on !== ('scrolled' in html.dataset)) { if (on) html.dataset.scrolled = ''; else delete html.dataset.scrolled; } };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => { window.removeEventListener('scroll', update); delete html.dataset.scrolled; };
  }, []);
  return null;
}
