import {cookies} from 'next/headers';
import {LocaleProvider} from '../../components/locale-provider';
import {normalizeLocale,LOCALE_COOKIE} from '../../lib/locale';
import { redirect } from 'next/navigation';
import { currentUser, safeReturnTo } from '../../server/pilot';
import {teamIdentity} from '../../server/services/organization-access';
import {workspaceRepository} from '../../server/container';
import SignInForm from './form';
import '../apply/style.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: '青鸟 IRIVA · 登录' };

export default async function Page({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).return_to);
  const user=await currentUser();
  if(user){const team=await teamIdentity(await workspaceRepository(),user.email);if(!team||user.authMethod==='password')redirect(returnTo);}
  return <LocaleProvider initialLocale={normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value)}><SignInForm returnTo={returnTo} /></LocaleProvider>;
}
