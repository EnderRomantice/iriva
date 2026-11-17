/**
 * Full Unicode emoji set (emojibase), loaded on demand so the chat bundle stays small.
 * Search matches Chinese and English names/tags and Slack-style shortcodes (iamcal).
 */
export interface EmojiItem { u: string; group: number; zh: string; en: string; codes: string[]; search: string }
export const emojiGroups = [
  { id: 0, label: '笑脸与情感', icon: '😀' }, { id: 1, label: '人物与手势', icon: '👋' },
  { id: 3, label: '动物与自然', icon: '🐻' }, { id: 4, label: '食物与饮料', icon: '🍜' },
  { id: 5, label: '旅行与地点', icon: '✈\uFE0F' }, { id: 6, label: '活动', icon: '⚽' },
  { id: 7, label: '物品', icon: '💡' }, { id: 8, label: '符号', icon: '❤\uFE0F' }, { id: 9, label: '旗帜', icon: '🏳\uFE0F' },
] as const;
export const defaultFrequent = ['👍', '❤\uFE0F', '😂', '🎉', '🙌', '👀', '✅', '🙏', '😊', '🔥', '👏', '💯'];

type Compact = { unicode: string; hexcode: string; label: string; group?: number; order?: number; tags?: string[] };
let cache: Promise<EmojiItem[]> | null = null;

export function loadEmoji(): Promise<EmojiItem[]> {
  cache ??= Promise.all([
    import('emojibase-data/zh/compact.json'), import('emojibase-data/en/compact.json'), import('emojibase-data/en/shortcodes/iamcal.json'),
  ]).then(([zh, en, codes]) => {
    const english = new Map((en.default as Compact[]).map(e => [e.hexcode, e]));
    const shortcodes = codes.default as Record<string, string | string[]>;
    return (zh.default as Compact[])
      .filter(e => e.group !== undefined && e.group !== 2)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(e => {
        const eng = english.get(e.hexcode), raw = shortcodes[e.hexcode], list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
        return { u: e.unicode, group: e.group!, zh: e.label, en: eng?.label ?? '', codes: list,
          search: [e.label, ...(e.tags ?? []), eng?.label ?? '', ...(eng?.tags ?? []), ...list].join(' ').toLowerCase() };
      });
  }).then(items => { indexEmoji(items); return items; }).catch(error => { cache = null; throw error; });
  return cache;
}

/** Warm the cache when the browser is idle so the first picker open is instant. */
export function preloadEmoji() {
  const run = () => { void loadEmoji().catch(() => {}); };
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1500);
}

const recentKey = 'iriva:emoji-recent:v1';
export function recentEmoji(): string[] {
  try { const saved = JSON.parse(localStorage.getItem(recentKey) || '[]'); if (Array.isArray(saved)) return saved.filter(x => typeof x === 'string').slice(0, 24); } catch {}
  return [];
}
export function rememberEmoji(emoji: string) {
  try { localStorage.setItem(recentKey, JSON.stringify([emoji, ...recentEmoji().filter(x => x !== emoji)].slice(0, 24))); } catch {}
}
/** Recents first, topped up with sensible defaults. */
export function frequentEmoji(count: number) {
  const list = recentEmoji();
  for (const e of defaultFrequent) if (!list.includes(e)) list.push(e);
  return list.slice(0, count);
}

/** Synchronous lookup once the set has loaded (used for tooltips such as ":tada:"). */
const byEmoji = new Map<string, EmojiItem>();
export function emojiInfo(emoji: string) { return byEmoji.get(emoji) ?? byEmoji.get(emoji.replace(/\uFE0F/g, '')); }
export function indexEmoji(items: EmojiItem[]) { if (byEmoji.size) return; for (const e of items) { byEmoji.set(e.u, e); byEmoji.set(e.u.replace(/\uFE0F/g, ''), e); } }
