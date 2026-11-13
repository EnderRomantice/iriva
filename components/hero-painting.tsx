/** 首页主视觉：萨夫拉索夫《有彩虹的风景》（1881），公有领域作品，来源 Wikimedia Commons。 */
export default function HeroPainting({ alt, credit }: { alt: string; credit: string }) {
  return <figure className="hero-painting">
    <img src="/paintings/savrasov-landscape-with-a-rainbow-1881.webp" width={1000} height={773} alt={alt} fetchPriority="high" decoding="async"/>
    <figcaption>{credit}</figcaption>
  </figure>;
}
