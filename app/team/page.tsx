import {cookies} from 'next/headers';
import {LocaleProvider} from '../../components/locale-provider';
import {normalizeLocale,translate,LOCALE_COOKIE} from '../../lib/locale';
import {redirect} from 'next/navigation';
import {currentUser,teamRole} from '../../server/pilot';
import Team from './team';
import './team.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 运营工作台'};
export default async function Page(){const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);const t=(text:string)=>translate(locale,text);const u=await currentUser();if(!u)redirect('/team/signin');const r=await teamRole(u);if(!r)return <main style={{padding:60,maxWidth:700,margin:'auto'}}><h1>{t('这里是青鸟团队的工作空间。')}</h1><p>{t('当前账号没有访问申请资料的权限。请使用团队账号和密码登录。')}</p><a href="/signout?return_to=%2Fteam%2Fsignin">{t('切换到团队账号')}</a> · <a href="/learn">{t('进入我的学习空间')}</a></main>;return <LocaleProvider initialLocale={locale}><Team/></LocaleProvider>}
