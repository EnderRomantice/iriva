import { avatarInitial } from '../../domain/initial';

/** Image avatar with a first-letter fallback. Size and shape come from the caller's class. */
export default function Avatar({ name, src, className = '', size = 36 }: { name: string; src?: string | null; className?: string; size?: number }) {
  return <span className={`${className}${src ? ' has-image' : ''}`} aria-hidden="true">
    {src ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async"/> : avatarInitial(name)}
  </span>;
}
