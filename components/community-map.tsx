'use client';
import { useEffect, useRef, useState } from 'react';
import { COMMUNITY_PLACES, MAP_HEIGHT, MAP_WIDTH, mapProjection } from '../lib/community-map';

/**
 * 首页「全球性的语言和文化社区」：白色柔和线条的世界地图，标出每个国家的 Host 人数和支持的语言。
 * 悬停、聚焦或轻点标记点会显示详情；地图下方的列表给读屏和小屏幕用。
 */
type Lang = 'zh' | 'en';
const COPY = {
  zh: {
    title: '全球性的语言和文化社区',
    intro: '来自不同国家的 Host，带着各自的语言和生活，和你在同一张桌子边聊天。',
    hosts: (n: number) => `${n} 位 Host`,
    languages: (n: number) => `${n} 种语言`,
    sep: '、',
    stats: [['位 Host', 'hosts'], ['个国家和地区', 'places'], ['种语言', 'languages']] as const,
  },
  en: {
    title: 'A global community of languages and cultures',
    intro: 'Hosts from different countries bring their languages and their lives to the same table as you.',
    hosts: (n: number) => `${n} ${n === 1 ? 'Host' : 'Hosts'}`,
    languages: (n: number) => `${n} ${n === 1 ? 'language' : 'languages'}`,
    sep: ', ',
    stats: [['Hosts', 'hosts'], ['countries and regions', 'places'], ['languages', 'languages']] as const,
  },
};

const projection = mapProjection();
const places = COMMUNITY_PLACES.map(p => {
  const [x, y] = projection(p.at) ?? [0, 0];
  return { ...p, left: (x / MAP_WIDTH) * 100, top: (y / MAP_HEIGHT) * 100 };
});
// 出现顺序：自西向东，像沿着地图依次亮起。
const order = [...places].sort((a, b) => a.left - b.left).map(p => p.id);
const totalHosts = places.reduce((n, p) => n + p.hosts, 0);
const totalLanguages = new Set(places.flatMap(p => p.languages.map(l => l.en))).size;

export default function CommunityMap({ lang = 'zh' }: { lang?: Lang }) {
  const t = COPY[lang];
  const [active, setActive] = useState<string | null>(null);
  const map = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  // 滑到地图时，各地的点依次弹出；之后保持显示。
  useEffect(() => {
    const el = map.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <section className="community" id="community" aria-labelledby="community-title">
    <div className="wrap">
      <div className="community-head">
        <h2 id="community-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div ref={map} className={`community-map${shown ? ' is-shown' : ''}`} onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}>
        <img src="/world-map.svg" alt="" width={MAP_WIDTH} height={MAP_HEIGHT} loading="lazy" decoding="async"/>
        {places.map(p => {
          const open = active === p.id;
          return <button
            key={p.id}
            type="button"
            className={`community-pin${open ? ' is-open' : ''}${p.side === 'left' ? ' label-left' : ''}`}
            style={{ left: `${p.left}%`, top: `${p.top}%`, '--pin': `${8 + p.hosts * 2}px`, '--i': order.indexOf(p.id) } as React.CSSProperties}
            aria-expanded={open}
            aria-label={`${p[lang]}：${t.hosts(p.hosts)}，${t.languages(p.languages.length)}`}
            onPointerEnter={e => { if (e.pointerType === 'mouse') setActive(p.id); }}
            onFocus={() => setActive(p.id)}
            onBlur={() => setActive(a => (a === p.id ? null : a))}
            onClick={() => setActive(a => (a === p.id ? null : p.id))}
          >
            <span className="community-dot" aria-hidden="true"><i>{p.hosts}</i></span>
            <span className="community-label" aria-hidden="true">{t.hosts(p.hosts)}</span>
            <span className="community-card" aria-hidden="true">
              <b>{p[lang]}</b>
              <span>{t.hosts(p.hosts)} · {t.languages(p.languages.length)}</span>
              <small>{p.languages.map(l => l[lang]).join(t.sep)}</small>
            </span>
          </button>;
        })}
      </div>
      <div className="community-stats">
        {t.stats.map(([label, n]) => <p key={label}><b>{n === 'hosts' ? totalHosts : n === 'places' ? places.length : totalLanguages}</b><span>{label}</span></p>)}
      </div>
      <ul className="community-list">
        {places.map(p => <li key={p.id}><b>{p[lang]}</b><span>{t.hosts(p.hosts)}</span><span>{p.languages.map(l => l[lang]).join(t.sep)}</span></li>)}
      </ul>
    </div>
  </section>;
}
