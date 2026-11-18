import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {LocaleProvider} from '../../components/locale-provider';
import {normalizeLocale,LOCALE_COOKIE} from '../../lib/locale';
import {claimPlacement,currentWorkspace,requireUser} from '../../server/pilot';
import {DomainError} from '../../domain/commands';
import {isTeamRole} from '../../domain/workspace-access';
import Team from '../team/team';
import Portal from './portal';
import '../team/team.css';
import './portal.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 我的空间'};
const tabs=['Notifications','Home','Conversations','Schedule','Partner practice','My coach','Reviews','Household'];
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;org?:string}>}){
 const {tab,org}=await searchParams;
 const user=await requireUser('/app');await claimPlacement(user);
 let access;
 try{access=await currentWorkspace(user,org);}catch(e){if(!(e instanceof DomainError))throw e;return <main className="p-main"><p role="alert">{e.message}</p><a href="/app">返回我的空间</a></main>}
 if(!org&&access){const query=new URLSearchParams({org:access.organization.id});if(tab)query.set('tab',tab);redirect('/app?'+query)}
 const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
 return <LocaleProvider initialLocale={locale}>{access&&isTeamRole(access.organization.role)?<Team access={access}/>:<Portal access={access||undefined} initialTab={tab&&tabs.includes(tab)?tab:'Home'}/>}</LocaleProvider>;
}
