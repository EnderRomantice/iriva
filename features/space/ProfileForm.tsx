"use client";
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { missingProfileFields, profileSchema } from '@/domain/account';
import { accountRequest, type Account } from './account-client';
import { Avatar, MemberName } from './primitives';

export function ProfileForm({ account, onSaved, onLogout }: { account: Account; onSaved: () => Promise<void>; onLogout: () => void }) {
  const user = account.user;
  const [avatar, setAvatar] = useState(user.avatar.startsWith('data:image/') ? user.avatar : '');
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const missing = missingProfileFields(user);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reading) return;
    const values = { ...Object.fromEntries(new FormData(event.currentTarget)), avatar };
    const result = profileSchema.safeParse(values);
    if (!result.success) { setMessage(avatar ? '请检查并填写所有必填内容。' : '请先上传头像。'); return; }
    setBusy(true); setMessage('');
    try { await accountRequest({ action: 'profile', profile: result.data }); await onSaved(); }
    catch (e) { setMessage(e instanceof Error ? e.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  }
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 500000) { setMessage('请选择小于 500 KB 的图片。'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('请选择 PNG、JPEG 或 WebP 图片。'); return; }
    setReading(true); setMessage('');
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setReading(false); };
    reader.onerror = () => { setMessage('图片读取失败，请重新选择。'); setReading(false); };
    reader.readAsDataURL(file);
  }
  return <>
    <p className="sp-profile-intro">{missing.length ? '完善以下资料后，就可以选择 Host 约谈。' : '管理你的个人资料。'}带 * 的内容必填。</p>
    {missing.length > 0 && <p className="sp-profile-missing">待完善：{missing.join('、')}</p>}
    {message && <p className="sp-error" role="alert">{message}</p>}
    <form className="sp-profile-form" onSubmit={event => void save(event)}>
      <div className="sp-profile-avatar-field"><span className="sp-profile-field-label">头像 *</span><div className="sp-profile-avatar-row">
        <div className="sp-profile-preview"><Avatar user={{ ...user, avatar: avatar || user.avatar }}/></div>
        <div className="sp-profile-avatar-actions"><strong><MemberName user={user}/></strong><button type="button" disabled={busy || reading} onClick={() => fileInput.current?.click()}>{reading ? '读取中…' : avatar ? '更换头像' : '上传头像'}</button><small>PNG、JPEG 或 WebP，最大 500 KB</small></div>
        <input ref={fileInput} className="sp-profile-file" type="file" aria-label="上传头像" accept="image/png,image/jpeg,image/webp" tabIndex={-1} hidden onChange={upload}/>
      </div></div>
      <div className="sp-profile-fields">
        <label>昵称 *<input name="name" required maxLength={80} defaultValue={user.name}/></label>
        <label>个人签名 *<input name="signature" required maxLength={180} defaultValue={user.signature}/></label>
        <label>MBTI *<select name="mbti" required defaultValue={user.mbti || ''}><option value="" disabled>选择你的 MBTI</option>{profileSchema.shape.mbti.options.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>时区 *<select name="timezone" required defaultValue={user.timezone}>{Array.from(new Set([user.timezone, ...Intl.supportedValuesOf('timeZone')])).map(value => <option key={value}>{value}</option>)}</select></label>
        <label>城市 / 地址 *<input name="city" required maxLength={100} defaultValue={user.city} placeholder="例如：上海"/></label>
        <label>星座<input name="zodiac" maxLength={40} defaultValue={user.zodiac}/></label>
        <label>八字<input name="birthChart" maxLength={100} defaultValue={user.birthChart}/></label>
        <label>身份 / 专业<input name="occupation" maxLength={100} defaultValue={user.occupation}/></label>
      </div>
      <button className="sp-primary" disabled={busy || reading}>{busy ? '保存中…' : '保存个人资料'}</button>
    </form>
    <button className="sp-logout" disabled={busy || reading} onClick={onLogout}>退出登录</button>
  </>;
}
