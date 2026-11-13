import { redirect } from 'next/navigation';
import { currentUser, safeReturnTo } from '../../server/pilot';
import SignInForm from './form';
import '../apply/style.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: '青鸟 IRIVA · 登录' };

export default async function Page({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).return_to);
  if (await currentUser()) redirect(returnTo);
  return <SignInForm returnTo={returnTo} />;
}
