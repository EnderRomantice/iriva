'use client';
import {useLocale} from '../locale-provider';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { emojiGroups, frequentEmoji, loadEmoji, rememberEmoji, type EmojiItem } from './emoji-data';

const COLUMNS = 9, WIDTH = 344, HEIGHT = 392, GAP = 8;
type Section = { id: string; label: string; items: { u: string; item?: EmojiItem }[] };

/**
 * Slack-style emoji picker: search (中文 / English / :shortcode:), category jump bar,
 * frequently used row, arrow-key navigation and a preview footer. Positioned against an anchor.
 */
export default function EmojiPicker({ anchor, align = 'start', label = '选择表情', onSelect, onClose }:
  { anchor: HTMLElement | null; align?: 'start' | 'end'; label?: string; onSelect: (emoji: string) => void; onClose: () => void }) {const {t:tr,locale}=useLocale();
  const [items, setItems] = useState<EmojiItem[] | null>(null), [failed, setFailed] = useState(false), [query, setQuery] = useState('');
  const [active, setActive] = useState(0), [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null), grid = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const frequent = useMemo(() => frequentEmoji(18), []);

  useEffect(() => { let live = true; loadEmoji().then(list => { if (live) setItems(list); }, () => { if (live) setFailed(true); }); return () => { live = false; }; }, []);
  // Focus search once placed (a visibility:hidden input cannot take focus).
  const placed = !!position;
  useEffect(() => { if (placed) input.current?.focus({ preventScroll: true }); }, [placed]);

  // Place above the anchor when there is room, otherwise below; keep inside the viewport.
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(WIDTH, vw - 16), height = Math.min(HEIGHT, vh - 16);
      const top = r.top - height - GAP >= 8 ? r.top - height - GAP : Math.min(r.bottom + GAP, vh - height - 8);
      const left = Math.max(8, Math.min(align === 'end' ? r.right - width : r.left, vw - width - 8));
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, align]);

  // Close on outside press or when the page scrolls under the picker.
  useEffect(() => {
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!root.current?.contains(t) && !anchor?.contains(t)) onClose(); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [anchor, onClose]);

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase().replace(/^:|:$/g, '');
    if (q) return [{ id: 'search', label: '搜索结果', items: (items ?? []).filter(e => e.search.includes(q)).slice(0, 270).map(item => ({ u: item.u, item })) }];
    const lookup = new Map((items ?? []).flatMap(e => [[e.u, e], [e.u.replace(/\uFE0F/g, ''), e]] as [string, EmojiItem][]));
    return [
      { id: 'frequent', label: '常用', items: frequent.map(u => ({ u, item: lookup.get(u) })) },
      ...emojiGroups.map(g => ({ id: String(g.id), label: g.label, items: (items ?? []).filter(e => e.group === g.id).map(item => ({ u: item.u, item })) })),
    ].filter(s => s.items.length);
  }, [items, query, frequent]);
  const flat = useMemo(() => sections.flatMap(s => s.items), [sections]);
  useEffect(() => { setActive(0); grid.current?.scrollTo({ top: 0 }); }, [query]);
  const current = flat[Math.min(active, flat.length - 1)];

  function choose(u: string) { rememberEmoji(u); onSelect(u); }
  function move(e: KeyboardEvent) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (current) choose(current.u); return; }
    if (!(e.key in step) || !flat.length) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target === input.current && query) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(flat.length - 1, active + step[e.key]));
    setActive(next);
    grid.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function jump(id: string) { setQuery(''); requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-section="${id}"]`)?.scrollIntoView({ block: 'start' })); }

  let index = -1;
  return <div ref={root} className="emoji-picker" role="dialog" aria-label={tr(label)} onKeyDown={move}
    style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}>
    <div className="emoji-picker-search"><Search size={15} aria-hidden="true"/>
      <input ref={input} value={query} onChange={e => setQuery(e.target.value)} placeholder={tr("搜索表情，如 笑、heart、:tada:")} aria-label={tr("搜索表情")}/>
    </div>
    {!query && <div className="emoji-picker-tabs" role="toolbar" aria-label={tr("表情分类")}>
      <button type="button" title={tr("常用")} onClick={() => jump('frequent')}>🕘</button>
      {emojiGroups.map(g => <button type="button" key={g.id} title={tr(g.label)} onClick={() => jump(String(g.id))}>{g.icon}</button>)}
    </div>}
    <div className="emoji-picker-grid" ref={grid}>
      {failed ? <p className="emoji-picker-empty">{tr("表情没能加载，请检查网络后重试。")}</p>
        : !items ? <div className="emoji-picker-loading" aria-label={tr("正在加载表情")}>{Array.from({ length: 36 }, (_, i) => <span key={i} className="sk"/>)}</div>
        : !flat.length ? <p className="emoji-picker-empty">{tr("没有找到「{query}」相关的表情",{query})}</p>
        : sections.map(s => <section key={s.id} data-section={s.id} aria-label={tr(s.label)}>
          <h4>{tr(s.label)}</h4>
          <div className="emoji-picker-cells">{s.items.map(({ u, item }) => { index++; const i = index; return <button type="button" key={`${s.id}-${u}`} data-index={i}
            className={i === active ? 'is-active' : ''} aria-label={(locale==='en'?item?.en:item?.zh)||u} onMouseEnter={() => setActive(i)} onClick={() => choose(u)}>{u}</button>; })}</div>
        </section>)}
    </div>
    <div className="emoji-picker-preview" aria-live="polite">
      {current ? <><span className="emoji-picker-big">{current.u}</span><span><b>{current.item?.codes[0] ? `:${current.item.codes[0]}:` : current.item?.en || current.u}</b><small>{locale==='en'?current.item?.en:current.item?.zh}</small></span></>
        : <span className="emoji-picker-hint">{tr("方向键选择 · Enter 确认 · Esc 关闭")}</span>}
    </div>
  </div>;
}
