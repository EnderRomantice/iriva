import {requireUser,teamRole} from '../../server/pilot';
import Portal from '../app/portal';
import '../app/portal.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 · 我的 Household'};
export default async function Page(){const u=await requireUser('/learn');return <Portal teamAccess={!!await teamRole(u)}/>}
