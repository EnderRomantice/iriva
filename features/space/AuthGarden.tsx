"use client";
import { useEffect, useState, type CSSProperties } from 'react';

// Fixed first frame keeps server and client markup identical. Randomness starts after mount.
const arrangements = [
  [0, 1, 4, 2, 3, 0, 4, 0, 2],
  [3, 0, 2, 1, 4, 0, 0, 2, 1],
  [1, 4, 0, 0, 2, 3, 2, 0, 4],
  [4, 2, 0, 3, 0, 1, 0, 4, 2],
  [0, 3, 1, 4, 2, 0, 2, 1, 0],
  [2, 0, 4, 0, 1, 3, 4, 2, 0],
];
const initial = arrangements.map((tiles, i) => ({
  x: 0, y: 0, angle: i % 2 ? 6 : -6, scale: 1, duration: 1000,
  tiles: tiles.map((_, j) => .13 + ((i + j) % 4) * .045),
}));
const between = (min: number, max: number) => min + Math.random() * (max - min);

function Motif({ kind }: { kind: number }) {
  switch (kind) {
    case 0: return <path d="M24 24C-8 24 0-8 24 24C24-8 56 0 24 24C56 24 48 56 24 24C24 56-8 48 24 24Z" />;
    case 1: return <path d="M0 0H48V48A48 48 0 0 1 0 0Z" />;
    case 2: return <><path d="M0 0H24V24H0ZM24 24H48V48H24Z" /><path d="M24 0H48V24H24ZM0 24H24V48H0Z" opacity=".22" /></>;
    case 3: return <><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1" /><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="1" /><circle cx="24" cy="24" r="6" /></>;
    default: return <path d="M24 0C24 15 33 24 48 24C33 24 24 33 24 48C24 33 15 24 0 24C15 24 24 15 24 0Z" />;
  }
}

export function AuthGarden() {
  const [patterns, setPatterns] = useState(initial);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let elapsed = 0;
    // Random phases and speeds form continuous paths; sample every second instead
    // of repeatedly starting a long ease-in/ease-out toward unrelated targets.
    const paths = arrangements.map(tiles => ({
      phase: between(0, Math.PI * 2), speed: between(.035, .065),
      tilePhases: tiles.map(() => between(0, Math.PI * 2)),
    }));
    const wave = (phase: number, speed: number) => Math.sin(phase + elapsed * speed) - Math.sin(phase);
    function schedule() {
      clearTimeout(timer);
      if (reduced.matches || document.hidden) return;
      timer = setTimeout(() => {
        elapsed += 1;
        setPatterns(paths.map((path, i) => ({
          x: 12 * wave(path.phase, path.speed),
          y: 16 * wave(path.phase + 1.3, path.speed * .8),
          angle: initial[i].angle + 3 * wave(path.phase + 2.1, path.speed * .7),
          scale: 1 + .02 * wave(path.phase + .6, path.speed * .6),
          duration: 1000,
          tiles: path.tilePhases.map((phase, j) => initial[i].tiles[j] + .025 * wave(phase, path.speed)),
        })));
        schedule();
      }, 1000);
    }
    schedule();
    reduced.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      reduced.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);
  return <div className="sp-auth-garden" aria-hidden="true">
    {arrangements.map((tiles, i) => {
      const pattern = patterns[i];
      return <div className={`sp-garden-patch sp-garden-patch-${i}`} key={i} style={{
        '--garden-duration': `${pattern.duration}ms`,
        transform: `translate(${pattern.x}px, ${pattern.y}px) rotate(${pattern.angle}deg) scale(${pattern.scale})`,
      } as CSSProperties}>
        {tiles.map((kind, j) => <svg className="sp-garden-tile" key={j} viewBox="0 0 48 48" style={{ opacity: pattern.tiles[j] }}><Motif kind={kind} /></svg>)}
      </div>;
    })}
  </div>;
}
