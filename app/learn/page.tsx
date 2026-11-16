import {redirect} from 'next/navigation';
import {claimPlacement,member,requireUser,teamRole} from '../../server/pilot';
import Portal from '../app/portal';
import '../app/portal.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 我的 Household'};
export default async function Page(){const u=await requireUser('/learn');const team=!!await teamRole(u);
 // 运营不走学员加入流程：没有所属小组时直接进入团队工作台。
 if(team){await claimPlacement(u);if(!await member(u.userId))redirect('/team')}
 return <Portal teamAccess={team}/>}
