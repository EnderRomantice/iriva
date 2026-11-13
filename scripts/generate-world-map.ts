/**
 * 生成首页社区地图的底图 public/world-map.svg。
 * 数据：Natural Earth 1:110m（公有领域），经 world-atlas 转为 TopoJSON；去掉南极洲。
 * 投影参数写在 lib/community-map.ts，组件用同一个投影放置标记点。改投影后需重新运行：
 *   npx tsx scripts/generate-world-map.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { MAP_WIDTH, MAP_HEIGHT, mapProjection } from '../lib/community-map';

const topo = JSON.parse(readFileSync(path.join(process.cwd(), 'node_modules/world-atlas/countries-110m.json'), 'utf8')) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
topo.objects.countries.geometries = topo.objects.countries.geometries.filter(g => (g.properties as { name?: string } | undefined)?.name !== 'Antarctica');
const draw = geoPath(mapProjection()).digits(0);
const land = draw(feature(topo, topo.objects.countries)) ?? '';
const coast = draw(mesh(topo, topo.objects.countries, (a, b) => a === b)) ?? '';
const borders = draw(mesh(topo, topo.objects.countries, (a, b) => a !== b)) ?? '';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="${land}" fill="#ffffff"/>
<path d="${borders}" stroke="#dfe4e2" stroke-width="0.6"/>
<path d="${coast}" stroke="#b9c4c0" stroke-width="0.9"/>
</svg>
`;
writeFileSync(path.join(process.cwd(), 'public/world-map.svg'), svg);
console.log(`world-map.svg ${(svg.length / 1024).toFixed(0)} KB`);
