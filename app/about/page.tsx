import {member,ownApplication,pilotDb,requireUser,teamRole} from '../../server/pilot';
import AboutProfile from './profile';
import '../app/portal.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 关于我'};
export default async function Page(){
  const user=await requireUser('/about');
  const [application,m,team]=await Promise.all([ownApplication(user.userId),member(user.userId),teamRole(user)]);
  let household:{name:string;timezone:string;avatar:string|null}|null=null;
  if(m){const d=await pilotDb();const row=await d.prepare('SELECT h.name,ms.timezone,av.updated_at AS avatar_updated FROM households h JOIN memberships ms ON ms.household_id=h.id LEFT JOIN household_avatars av ON av.household_id=h.id WHERE h.id=? AND ms.user_id=?').get(m.household,user.userId) as Record<string,unknown>|undefined;household={name:String(row?.name||''),timezone:String(row?.timezone||application?.timezone||''),avatar:row?.avatar_updated?`/api/household/avatar?v=${Date.parse(String(row.avatar_updated))}`:null}}
  const a=application;
  return <AboutProfile email={user.email} teamAccess={!!team} role={m?.role||(a?String(a.role):null)} household={household}
    profile={{name:m?.name||(a?String(a.name):user.displayName),location:String(a?.location||''),age_band:String(a?.age_band||''),life_stage:String(a?.life_stage||''),mbti:String(a?.mbti||''),contact_preference:String(a?.contact_preference||'email'),contact:String(a?.contact||'')}}
    hasApplication={!!a} status={a?.status??null}/>;
}
