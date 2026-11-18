'use client';
import {workspaceFetch as fetch} from '../../lib/workspace-fetch';
import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import Avatar from './avatar';

const SIZE = 256, MAX_BYTES = 200_000;

/** Centre-crop to a square and downscale in the browser, so uploads stay small. */
async function toSquare(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height), canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('无法处理这张图片。');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  for (const [type, quality] of [['image/webp', .86], ['image/jpeg', .85], ['image/jpeg', .7]] as const) {
    const url = canvas.toDataURL(type, quality);
    if (url.startsWith(`data:${type}`) && url.length * 3 / 4 < MAX_BYTES) return url;
  }
  throw new Error('图片太大，请换一张。');
}

/**
 * Preview + 上传 / 更换 / 移除. `save` posts the cropped data URL (or null to remove) and throws on failure.
 */
export default function AvatarUpload({ name, avatar, save, onSaved, previewClass = 'avatar-upload-preview', removeLabel = '移除头像' }:
  { name: string; avatar: string | null; save: (image: string | null) => Promise<void>; onSaved?: () => void; previewClass?: string; removeLabel?: string }) {
  const file = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState<string | null | undefined>(undefined);
  async function run(image: string | null) {
    setBusy(true); setError('');
    try { await save(image); onSaved?.(); } catch (e) { setPreview(undefined); setError((e as Error).message || '没能保存头像，请稍后重试。'); } finally { setBusy(false); }
  }
  async function choose(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif|heic|heif|avif)$/.test(f.type)) { setError('请选择一张图片。'); return; }
    try { const url = await toSquare(f); setPreview(url); await run(url); } catch (e) { setError((e as Error).message || '无法读取这张图片。'); }
    finally { if (file.current) file.current.value = ''; }
  }
  const shown = preview === undefined ? avatar : preview;
  return <div className="avatar-upload">
    <Avatar name={name} src={shown} className={`workspace-mark ${previewClass}`} size={56}/>
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/avif" hidden onChange={e => void choose(e.target.files?.[0])}/>
    <div className="avatar-upload-actions">
      <button type="button" className="p-outline" disabled={busy} onClick={() => file.current?.click()}><ImageUp size={14}/> {busy ? '正在保存…' : shown ? '更换图片' : '上传图片'}</button>
      {shown && <button type="button" className="p-outline" disabled={busy} onClick={() => { setPreview(null); void run(null); }} aria-label={removeLabel}><Trash2 size={14}/> 移除</button>}
    </div>
    {error && <p className="avatar-upload-error" role="alert">{error}</p>}
  </div>;
}

/** POST helper shared by the avatar endpoints. */
export async function postAvatar(url: string, body: Record<string, unknown>) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || '没能保存头像，请稍后重试。');
}
