import {cookies} from 'next/headers';
import {LocaleProvider} from '../../components/locale-provider';
import {normalizeLocale,LOCALE_COOKIE} from '../../lib/locale';
import {currentMember,currentWorkspace,ownApplication,pilotDb,requireUser,teamRole} from '../../server/pilot';
import AboutProfile from './profile';
import {householdAvatarUrl,memberAvatarUrl} from '../../domain/household-avatar';
import {pilotHost} from '../../server/services/pilot-hosts';
import {workspaceRepository} from '../../server/container';
import '../app/portal.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 个人信息'};
export default async function Page({searchParams}:{searchParams:Promise<{org?:string}>}){
  const user=await requireUser('/about');const {org}=await searchParams;const access=await currentWorkspace(user,org);
  const [application,m,team]=await Promise.all([ownApplication(user.userId),currentMember(user.userId,access?.organization.id),teamRole(user)]);
  let household:{name:string;timezone:string;avatar:string|null}|null=null;
  if(m){const d=await pilotDb();const row=await d.prepare('SELECT h.name,ms.timezone,av.updated_at AS avatar_updated FROM households h JOIN memberships ms ON ms.household_id=h.id LEFT JOIN household_avatars av ON av.household_id=h.id WHERE h.id=? AND ms.user_id=?').get(m.household,user.userId) as Record<string,unknown>|undefined;household={name:String(row?.name||''),timezone:String(row?.timezone||application?.timezone||''),avatar:householdAvatarUrl(row?.avatar_updated)?householdAvatarUrl(row?.avatar_updated)+'&org='+encodeURIComponent(access?.organization.id||''):null}}
  const own=await (await pilotDb()).prepare('SELECT updated_at FROM member_avatars WHERE user_id=?').get(user.userId) as {updated_at?:string}|undefined;
  const host=await pilotHost(await workspaceRepository(),user.email);
  const a=host?null:application;
  const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return <LocaleProvider initialLocale={locale}><AboutProfile access={access||undefined} avatar={memberAvatarUrl(user.userId,own?.updated_at)} email={user.email} teamAccess={!!team} role={host?'host':m?.role||(a?String(a.role):null)} household={household}
    profile={{name:m?.name||host?.name||(a?String(a.name):user.displayName),location:String(a?.location||''),age_band:String(a?.age_band||''),life_stage:String(a?.life_stage||''),mbti:String(a?.mbti||''),contact_preference:String(a?.contact_preference||'email'),contact:String(a?.contact||'')}}
    hasApplication={!!a} status={a?.status??null}/></LocaleProvider>;
}
