'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import BounceCards from './bounce-cards';

/**
 * 首页主视觉：「世界很大，从四个人开始」下方四张歪歪扭扭散开的卡片。
 * 卡片用 React Bits 的 BounceCards；形象为 DiceBear「Notionists」（Zoish，CC0 1.0）生成的插画。
 * BounceCards 以像素布局，所以先量出舞台宽度，再按比例算卡片尺寸和间距。
 */
type Lang = 'zh' | 'en';
const PEOPLE = [
  { src: '/avatars/characters/mia.svg', zh: 'Mia', en: 'Mia' },
  { src: '/avatars/characters/lin.svg', zh: '小林', en: 'Lin' },
  { src: '/avatars/characters/xiaowen.svg', zh: '晓雯', en: 'Xiaowen' },
  { src: '/avatars/characters/emma.svg', zh: 'Emma', en: 'Emma' },
];
const COPY = {
  zh: { title: '世界很大，', accent: '从四个人开始。', label: '四位伙伴：Mia、小林、晓雯和 Emma' },
  en: { title: 'The world is big.', accent: 'It starts with four people.', label: 'Four partners: Mia, Lin, Xiaowen and Emma' },
};
const HEIGHT = 0.56; // 舞台高宽比
// 每张卡片的位置（以卡片边长为单位）和倾斜角：故意不对称，像随手摊在桌上。
const SCATTER: [number, number, number][] = [[-1.08, 0.1, -10], [-0.36, -0.08, 6], [0.38, 0.12, -4], [1.1, -0.05, 11]];

export default function FourPeople({ lang = 'zh' }: { lang?: Lang }) {
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const t = COPY[lang];

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const card = Math.min(180, width * 0.29);
  return <figure className="four-people">
    <figcaption className="four-people-title">{t.title}<br/><span>{t.accent}</span></figcaption>
    <div ref={stage} className="four-people-stage" role="img" aria-label={t.label}>
      {width > 0 && <BounceCards
        images={PEOPLE.map(p => ({ src: p.src, alt: p[lang] }))}
        containerWidth={width}
        containerHeight={Math.round(width * HEIGHT)}
        cardSize={card}
        spread={card * 0.74}
        transformStyles={SCATTER.map(([x, y, r]) => `rotate(${r}deg) translate(${Math.round(x * card)}px, ${Math.round(y * card)}px)`)}
        animationDelay={0.3}
        animationStagger={0.08}
        pushDistance={card * 0.45}
        borderWidth={Math.max(4, Math.round(card * 0.04))}
        borderColor="#fffdf8"
        radius={Math.round(card * 0.1)}
        style={{
          '--bounce-cards-shadow': '0 1px 2px #1d3b311f, 0 12px 28px -8px #1d3b3140',
          '--bounce-cards-shadow-active': '0 2px 4px #1d3b3124, 0 22px 44px -12px #1d3b3159',
        } as CSSProperties}
      />}
    </div>
  </figure>;
}
