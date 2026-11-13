'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Hash, Users } from 'lucide-react';

/**
 * 「有想说话的人」区块：一个长方形群聊界面，左栏是频道和成员，右侧是对话。
 * 三段对话自动轮换：旧的一段缓慢淡出，新的一段再逐条浮现，没有手动控件。
 * 区块滚到吸附位置时，背景向两侧铺满。人物为示意，头像来自 Pexels 免费图库（3936894 / 17265050 / 20782648 / 654696）。
 */
type Who = 'emma' | 'mia' | 'lin' | 'wen' | 'me';
type Msg = { who: Who; text: string; time: string };
type Lang = 'zh' | 'en';

const PEOPLE: Record<Who, { zh: string; en: string; src?: string; host?: boolean }> = {
  emma: { zh: 'Emma', en: 'Emma', src: '/avatars/emma.webp', host: true },
  mia: { zh: 'Mia', en: 'Mia', src: '/avatars/mia.webp' },
  lin: { zh: '小林', en: 'Lin', src: '/avatars/lin.webp' },
  wen: { zh: '晓雯', en: 'Xiaowen', src: '/avatars/xiaowen.webp' },
  me: { zh: '你', en: 'You' },
};

const CHANNELS = { zh: ['大家好', '本周话题', '周四相见', '伙伴练习'], en: ['say-hello', 'this-week', 'thursday', 'partner-practice'] };
const TOPICS = { zh: ['第一次见面，慢慢说', '上次聊到的近况', '下一次相见'], en: ['First meeting, take your time', 'Picking up where we left off', 'Our next conversation'] };

const SCENES: { channel: number; msgs: Msg[] }[] = [
  { channel: 0, msgs: [
    { who: 'emma', text: 'Take your time. I’d love to hear your story.', time: '20:02' },
    { who: 'me', text: 'I moved to Shanghai last year… for work.', time: '20:03' },
    { who: 'lin', text: 'Me too! Which part of the city?', time: '20:03' },
    { who: 'wen', text: 'Welcome! We were all a bit nervous at the start.', time: '20:04' },
  ] },
  { channel: 1, msgs: [
    { who: 'mia', text: 'How did your presentation go? We were thinking of you!', time: '19:58' },
    { who: 'emma', text: 'You said the Q&A part made you nervous.', time: '19:59' },
    { who: 'me', text: 'It went well! There’s something I want to tell you.', time: '20:01' },
    { who: 'wen', text: 'Save it for Thursday. I want to hear everything.', time: '20:02' },
  ] },
  { channel: 2, msgs: [
    { who: 'me', text: 'I saved this story for our next conversation.', time: '21:40' },
    { who: 'mia', text: 'Now I’m curious!', time: '21:41' },
    { who: 'emma', text: 'See you Thursday at 8. Bring it with you.', time: '21:42' },
    { who: 'lin', text: 'Counting the days.', time: '21:42' },
  ] },
];

const COPY = {
  zh: { workspace: '青鸟 · 周四小组', channels: '频道', members: '成员', host: 'Host', composer: (c: string) => `示例对话 · 给 #${c} 发消息`, label: '青鸟小组群聊示例' },
  en: { workspace: 'IRIVA · Thursday Household', channels: 'Channels', members: 'Members', host: 'Host', composer: (c: string) => `Sample conversation · Message #${c}`, label: 'Sample IRIVA Household chat' },
};
const INTERVAL = 7500;

function Avatar({ who, lang, size }: { who: Who; lang: Lang; size: number }) {
  const p = PEOPLE[who];
  return p.src
    ? <img className="chat-avatar" src={p.src} alt="" width={size} height={size} loading="lazy" decoding="async"/>
    : <span className="chat-avatar chat-avatar-you" style={{ width: size, height: size }} aria-hidden="true">{p[lang].slice(0, 1)}</span>;
}

export default function ChatShowcase({ lang }: { lang: Lang }) {
  const t = COPY[lang], channels = CHANNELS[lang];
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [auto, setAuto] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAuto(false); }, []);
  useEffect(() => {
    if (!auto || held) return;
    const id = window.setInterval(() => setActive(a => (a + 1) % SCENES.length), INTERVAL);
    return () => window.clearInterval(id);
  }, [auto, held]);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setExpanded(e.intersectionRatio >= .55), { threshold: [0, .3, .55, .8, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const current = SCENES[active].channel;
  return <div className="showcase" ref={stage} data-expanded={expanded || undefined}>
    <div className="chat" role="img" aria-label={t.label} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
      <aside className="chat-side" aria-hidden="true">
        <div className="chat-workspace">{t.workspace}</div>
        <p className="chat-section">{t.channels}</p>
        <ul>{channels.map((c, i) => <li key={c} className={i === current ? 'is-active' : undefined}><Hash size={14}/>{c}</li>)}</ul>
        <p className="chat-section">{t.members}</p>
        <ul className="chat-members">{(['emma', 'mia', 'lin', 'wen', 'me'] as Who[]).map(w => <li key={w}><Avatar who={w} lang={lang} size={22}/>{PEOPLE[w][lang]}{PEOPLE[w].host && <span className="chat-host">{t.host}</span>}</li>)}</ul>
      </aside>
      <section className="chat-main" aria-hidden="true">
        <div className="chat-head">
          <div><b><Hash size={16}/>{channels[current]}</b><small>{TOPICS[lang][active]}</small></div>
          <span className="chat-count"><Users size={14}/>5</span>
        </div>
        <div className="chat-panes">
          {SCENES.map((s, i) => <ol key={i} className="chat-pane" data-active={i === active || undefined}>
            {s.msgs.map((m, j) => <li key={j} className={`chat-msg${m.who === 'me' ? ' is-me' : ''}`} style={{ '--i': j } as CSSProperties}>
              <Avatar who={m.who} lang={lang} size={36}/>
              <div><span className="chat-name">{PEOPLE[m.who][lang]}{PEOPLE[m.who].host && <span className="chat-host">{t.host}</span>}<time>{m.time}</time></span><p>{m.text}</p></div>
            </li>)}
          </ol>)}
        </div>
        <div className="chat-composer">{t.composer(channels[current])}</div>
      </section>
    </div>
  </div>;
}
