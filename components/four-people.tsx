'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import BounceCards from './bounce-cards';

/**
 * 首页主视觉：「世界很大，从四个人开始」下方四张歪歪扭扭散开的卡片。
 * 卡片用 React Bits 的 BounceCards；形象是四只姿态各异的扁平几何鸟（public/avatars/birds，由脚本生成），头顶气泡里的 emoji 代表各自在聊的话题；C 位是青鸟。
 * BounceCards 以像素布局，所以先量出舞台宽度，再按比例算卡片尺寸和间距。
 */
type Lang = 'zh' | 'en';
// 青鸟放在最后：最后渲染的卡片层级最高，配合 SCATTER 让它居中压在最上面。
const PEOPLE = [
  { src: '/avatars/birds/coral.svg', zh: '聊旅行的珊瑚色小鸟', en: 'A coral bird talking about travel' },
  { src: '/avatars/birds/sun.svg', zh: '聊家常菜的金黄色小鸟', en: 'A golden bird talking about home cooking' },
  { src: '/avatars/birds/indigo.svg', zh: '聊音乐的靛蓝色小鸟', en: 'An indigo bird talking about music' },
  { src: '/avatars/birds/qing.svg', zh: '聊世界的青鸟', en: 'A cyan bird talking about the world' },
];
const COPY = {
  zh: { title: '世界很大，', accent: '从四个人开始。', label: '四只姿态各异的几何小鸟，各自聊着旅行、家常菜、音乐和世界，青鸟在正中' },
  en: { title: 'The world is big.', accent: 'It starts with four people.', label: 'Four geometric birds in different poses, chatting about travel, home cooking, music and the world, with a cyan bird in the centre' },
};
const HEIGHT = 0.56; // 舞台高宽比
// 每张卡片的位置（以卡片边长为单位）和倾斜角：故意不对称，像随手摊在桌上。
// 青鸟（最后一张）在正中、略高、几乎不歪；其余三只围在两侧。
const SCATTER: [number, number, number][] = [[-1.12, 0.12, -10], [-0.62, -0.14, 6], [0.98, 0.08, 10], [0.04, -0.02, -3]];

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
