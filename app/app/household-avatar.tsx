'use client';
import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { avatarInitial } from '../../domain/initial';

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

/** Host-only settings row: upload, replace or remove the space avatar. Default is the first letter. */
export default function HouseholdAvatarSetting({ name, avatar, onSaved }: { name: string; avatar: string | null; onSaved: () => void }) {
  const file = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState('');
  async function save(image: string | null) {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'avatar', image }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || '没能保存头像，请稍后重试。');
      onSaved();
    } catch (e) { setPreview(''); setError((e as Error).message); } finally { setBusy(false); }
  }
  async function choose(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif|heic|heif|avif)$/.test(f.type)) { setError('请选择一张图片。'); return; }
    try { const url = await toSquare(f); setPreview(url); await save(url); } catch (e) { setError((e as Error).message || '无法读取这张图片。'); }
    finally { if (file.current) file.current.value = ''; }
  }
  const shown = preview || avatar;
  return <div className="p-setting">
    <div className="p-setting-label"><span>小组头像</span><small>显示在侧栏的小组名称旁。未设置时显示名称首字。</small>{error && <small className="p-setting-error" role="alert">{error}</small>}</div>
    <div className="p-setting-control p-avatar-setting">
      <span className={`workspace-mark p-avatar-preview${shown ? ' has-image' : ''}`} aria-hidden="true">{shown ? <img src={shown} alt="" width={40} height={40}/> : avatarInitial(name)}</span>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/avif" hidden onChange={e => void choose(e.target.files?.[0])}/>
      <button type="button" className="p-outline" disabled={busy} onClick={() => file.current?.click()}><ImageUp size={14}/> {busy ? '正在保存…' : avatar ? '更换图片' : '上传图片'}</button>
      {avatar && <button type="button" className="p-outline" disabled={busy} onClick={() => { setPreview(''); void save(null); }} aria-label="移除小组头像"><Trash2 size={14}/> 移除</button>}
    </div>
  </div>;
}
