import { writeFileSync, mkdirSync } from 'node:fs';
// 生成首页四只几何鸟：node scripts/generate-birds.mjs public/avatars/birds
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const INK = '#1d3b31';
const EMOJI_FONT = "Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif";
// 圆角对话气泡，尾巴从底边 (b1..b2) 伸向 (tx,ty)
const bubble = ({ x, y, w, h, b1, b2, tx, ty, emoji }) => {
  const r = 14;
  const d = `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${b2}L${tx} ${ty}L${b1} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return `<path d="${d}" fill="#fffdf8" stroke="${INK}" stroke-opacity=".16" stroke-width="2" stroke-linejoin="round"/>
<text x="${x + w / 2}" y="${y + h / 2 + 12}" font-size="34" text-anchor="middle" font-family="${EMOJI_FONT}">${emoji}</text>`;
};
const leg = (x, y1, y2) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 2}" r="1.8" fill="#fff"/>`;
const svg = (bg, ground, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${bg}"/>
<rect y="178" width="200" height="22" fill="${ground}" opacity=".14"/>
${body}
</svg>
`;

const birds = {
  // 珊瑚：振翅飞起，聊旅行
  coral: (() => { const c = { body: '#ec6a3c', dark: '#b9431f', belly: '#f4a383', beak: '#f2b632' };
    return svg('#fbece4', c.dark, `<ellipse cx="100" cy="184" rx="30" ry="4" fill="${c.dark}" opacity=".18"/>
<g transform="translate(200 0) scale(-1 1) rotate(-12 100 120)">
<polygon points="80,112 58,58 108,104" fill="${c.belly}"/>
<polygon points="50,128 16,112 24,146" fill="${c.dark}"/>
<ellipse cx="92" cy="124" rx="46" ry="34" fill="${c.body}"/>
<path d="M46 124A46 34 0 0 0 138 124Z" fill="${c.belly}"/>
<polygon points="88,116 96,50 124,110" fill="${c.dark}"/>
<circle cx="136" cy="102" r="22" fill="${c.body}"/>
<polygon points="155,96 176,102 155,108" fill="${c.beak}"/>
${eye(143, 96)}
<circle cx="136" cy="110" r="4.5" fill="${c.beak}" opacity=".4"/>
</g>
${bubble({ x: 14, y: 12, w: 76, h: 54, b1: 44, b2: 58, tx: 60, ty: 80, emoji: '✈️' })}`); })(),

  // 金黄：圆滚滚，低头啄食，聊家常菜
  sun: (() => { const c = { body: '#f1b52e', dark: '#c98a0c', belly: '#f8d77f', beak: '#ef7a50' };
    return svg('#fbf2dc', c.dark, `<g transform="translate(200 0) scale(-1 1)">
<polygon points="54,120 32,80 48,128" fill="${c.dark}"/>
${leg(80, 166, 180)}${leg(98, 166, 180)}
<circle cx="90" cy="130" r="44" fill="${c.body}"/>
<path d="M46 130A44 44 0 0 0 134 130Z" fill="${c.belly}"/>
<path d="M64 116A34 34 0 0 0 98 150L98 116Z" fill="${c.dark}"/>
<circle cx="130" cy="142" r="22" fill="${c.body}"/>
<polygon points="140,156 156,174 148,152" fill="${c.beak}"/>
${eye(136, 136)}
<circle cx="124" cy="150" r="4.5" fill="${c.beak}" opacity=".4"/>
<circle cx="166" cy="180" r="3" fill="${c.dark}"/><circle cx="176" cy="177" r="2.5" fill="${c.dark}"/>
</g>
${bubble({ x: 14, y: 16, w: 76, h: 54, b1: 42, b2: 56, tx: 56, ty: 94, emoji: '🍜' })}`); })(),

  // 靛蓝：细高个，仰头唱歌，聊音乐
  indigo: (() => { const c = { body: '#5a6dd4', dark: '#3a4bab', belly: '#a3afec', beak: '#f2b632' };
    return svg('#e7eaf9', c.dark, `<polygon points="80,146 44,180 62,182" fill="${c.dark}"/>
${leg(90, 156, 180)}${leg(104, 156, 180)}
<ellipse cx="96" cy="120" rx="30" ry="42" fill="${c.body}"/>
<path d="M66 120A30 42 0 0 0 126 120Z" fill="${c.belly}"/>
<polygon points="76,104 110,118 84,158" fill="${c.dark}"/>
<circle cx="112" cy="74" r="22" fill="${c.body}"/>
<polygon points="126,60 146,42 132,68" fill="${c.beak}"/>
<polygon points="132,72 152,66 132,78" fill="${c.beak}"/>
${eye(118, 66)}
<circle cx="110" cy="84" r="4.5" fill="${c.beak}" opacity=".45"/>
${bubble({ x: 12, y: 10, w: 76, h: 54, b1: 60, b2: 74, tx: 92, ty: 64, emoji: '🎵' })}`); })(),

  // C 位青鸟：冠羽、长尾，举翅膀打招呼，张嘴说话，聊世界
  qing: (() => { const c = { body: '#1fb2ad', dark: '#0d7f7b', belly: '#7fd6d1', beak: '#f2b632' };
    return svg('#dcf3f1', c.dark, `<polygon points="60,132 14,112 22,128" fill="${c.dark}"/>
<polygon points="58,140 10,140 20,154" fill="${c.body}"/>
<polygon points="62,148 22,176 38,178" fill="${c.dark}"/>
${leg(84, 162, 180)}${leg(102, 162, 180)}
<circle cx="92" cy="132" r="38" fill="${c.body}"/>
<path d="M54 132A38 38 0 0 0 130 132Z" fill="${c.belly}"/>
<polygon points="110,82 106,52 122,78" fill="${c.dark}"/>
<polygon points="120,76 126,46 132,76" fill="${c.body}"/>
<polygon points="130,78 146,54 140,82" fill="${c.dark}"/>
<circle cx="124" cy="98" r="24" fill="${c.body}"/>
<polygon points="82,128 58,84 104,114" fill="${c.dark}"/>
<polygon points="146,90 168,94 146,98" fill="${c.beak}"/>
<polygon points="146,102 162,108 146,106" fill="${c.beak}"/>
${eye(132, 92)}
<circle cx="124" cy="108" r="4.5" fill="${c.beak}" opacity=".4"/>
${bubble({ x: 12, y: 8, w: 76, h: 54, b1: 60, b2: 74, tx: 94, ty: 68, emoji: '🌏' })}`); })(),
};
for (const [k, s] of Object.entries(birds)) writeFileSync(`${out}/${k}.svg`, s);
