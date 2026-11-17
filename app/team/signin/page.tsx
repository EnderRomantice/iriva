import { redirect } from 'next/navigation';
import { currentUser, teamRole } from '../../../server/pilot';
import TeamSignInForm from './form';
import '../../apply/style.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: '青鸟 · 团队登录' };

export default async function Page() {
  if (await teamRole(await currentUser())) redirect('/team');
  return <TeamSignInForm />;
}
