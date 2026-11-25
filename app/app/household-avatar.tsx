'use client';
import {useLocale} from '../../components/locale-provider';
import AvatarUpload, { postAvatar } from '../../components/workspace/avatar-upload';

/** Host-only settings row: upload, replace or remove the space avatar. Default is the first letter. */
export default function HouseholdAvatarSetting({ name, avatar, onSaved }: { name: string; avatar: string | null; onSaved: () => void }) {const {t:tr}=useLocale();
  return <div className="p-setting">
    <div className="p-setting-label"><span>{tr("小组头像")}</span><small>{tr("显示在侧栏的小组名称旁。未设置时显示名称首字。")}</small></div>
    <div className="p-setting-control p-avatar-setting">
      <AvatarUpload name={name} avatar={avatar} removeLabel={tr("移除小组头像")} previewClass="p-avatar-preview" save={image => postAvatar('/api/household', { action: 'avatar', image })} onSaved={onSaved}/>
    </div>
  </div>;
}
