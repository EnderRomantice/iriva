/** 首页主视觉：一道线描 Iris 彩虹桥，两端各停一只青鸟，下方是「世界很大，从四个人开始。」 */
const BANDS: [string, string][] = [
  ['M15 175C75 -25 310 -25 385 175', '#B77B58'],
  ['M28 178C88 -10 301 -10 372 178', '#D4B06A'],
  ['M41 181C100 5 292 5 359 181', '#879F90'],
  ['M54 184C112 20 283 20 346 184', '#477C99'],
];
const COPY = {
  zh: { label: '连接两只青鸟的 Iris 彩虹桥', title: '世界很大，', line: '从四个人开始。' },
  en: { label: 'An Iris rainbow bridge linking two bluebirds', title: 'The world is big.', line: 'It starts with four people.' },
};

export default function HeroIris({ lang = 'zh' }: { lang?: 'zh' | 'en' }) {
  const t = COPY[lang];
  return <figure className="hero-iris">
    <div className="rainbow-scene" role="img" aria-label={t.label}>
      <svg className="iris-sketch" viewBox="0 0 400 200" fill="none" aria-hidden="true">
        {BANDS.map(([d, c]) => <path key={c} d={d} stroke={c}/>)}
      </svg>
      <img className="rainbow-bird rainbow-bird-left" src="/bluebird-transparent.png" alt=""/>
      <img className="rainbow-bird rainbow-bird-right" src="/bluebird-transparent.png" alt=""/>
    </div>
    <figcaption className="wordart"><span className="world-heading">{t.title}</span><span className="worldline">{t.line}</span></figcaption>
  </figure>;
}
