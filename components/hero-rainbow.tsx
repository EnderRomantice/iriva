'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * 首页首屏顶部的一道「大跨页」彩虹：只取一道巨大彩虹的上半段入镜，
 * 从左边缘进画、在偏左处到顶、再从右边缘出画，像镜头只框住了它的一部分。
 * 以像素按实际宽度计算圆弧，保证各道颜色等宽、不被拉伸。
 */
const RAINBOW = ['#ec6a3c', '#f2a33a', '#f1c84a', '#7cc49a', '#1fb2ad', '#5a6dd4', '#9b7fd1'];
const RADIUS = 1.6; // 外圈半径 = 宽度 × RADIUS，越大越平
const APEX = 0.42; // 顶点所在的横向位置（占宽度比例），偏左一点更有镜头感
const TOP = 6; // 外圈顶点离 svg 顶部的像素

export default function HeroRainbow() {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const band = Math.min(13, Math.max(7, w * 0.008));
  const R = w * RADIUS, cx = w * APEX, cy = TOP + R;
  const yAt = (r: number, x: number) => cy - Math.sqrt(r * r - (x - cx) ** 2);
  const x0 = -band * 2, x1 = w + band * 2;
  const paths = w > 0 ? RAINBOW.map((color, i) => {
    const r = R - band * (i + 0.5);
    return { color, d: `M${x0} ${yAt(r, x0).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1} ${yAt(r, x1).toFixed(1)}` };
  }) : [];
  const h = w > 0 ? Math.ceil(yAt(R - band * 7, x1)) + band : 0;

  return <svg ref={ref} className="hero-rainbow" height={h} viewBox={w > 0 ? `0 0 ${w} ${h}` : undefined} aria-hidden="true">
    {paths.map(({ color, d }, i) => <path key={color} d={d} stroke={color} strokeWidth={band + 0.5} fill="none"
      pathLength={1} style={{ animationDelay: `${i * 0.06}s` }} />)}
  </svg>;
}
