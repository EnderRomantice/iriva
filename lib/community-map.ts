import { geoNaturalEarth1 } from 'd3-geo';

/** 首页「全球性的语言和文化社区」地图。底图由 scripts/generate-world-map.ts 用同一个投影生成。 */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 436;
export const mapProjection = () => geoNaturalEarth1().scale(185).translate([500, 255]);

export type CommunityPlace = {
  id: string;
  zh: string;
  en: string;
  /** 标记点坐标（经度、纬度），取在国家中部，避免相邻国家的点重叠 */
  at: [number, number];
  hosts: number;
  /** 人数标签放在点的哪一侧，默认右侧；和邻近的点挤在一起时改到左侧。 */
  side?: 'left';
  languages: { zh: string; en: string }[];
};

const L = {
  english: { zh: '英语', en: 'English' },
  chinese: { zh: '中文', en: 'Chinese' },
  french: { zh: '法语', en: 'French' },
  spanish: { zh: '西班牙语', en: 'Spanish' },
};

// TODO: 示例数据，上线前请换成真实的 Host 分布。
export const COMMUNITY_PLACES: CommunityPlace[] = [
  { id: 'us', zh: '美国', en: 'United States', at: [-96, 39], hosts: 4, languages: [L.english, L.spanish] },
  { id: 'ca', zh: '加拿大', en: 'Canada', at: [-106, 56], hosts: 2, languages: [L.english, L.french] },
  { id: 'gb', zh: '英国', en: 'United Kingdom', at: [-1, 52.3], hosts: 3, languages: [L.english] },
  { id: 'ie', zh: '爱尔兰', en: 'Ireland', at: [-8.3, 53.2], hosts: 1, side: 'left', languages: [L.english] },
  { id: 'sg', zh: '新加坡', en: 'Singapore', at: [103.8, 1.35], hosts: 1, languages: [L.english, L.chinese] },
  { id: 'cn', zh: '中国', en: 'China', at: [110, 34], hosts: 2, languages: [L.chinese] },
  { id: 'au', zh: '澳大利亚', en: 'Australia', at: [140, -27], hosts: 2, languages: [L.english] },
  { id: 'nz', zh: '新西兰', en: 'New Zealand', at: [172.5, -41.5], hosts: 1, side: 'left', languages: [L.english] },
];
