import { pilotHost } from '../../server/services/pilot-hosts';
import { workspaceRepository } from '../../server/container';
import {redirect} from 'next/navigation';
import {claimPlacement,member,ownApplication,requireUser,teamRole} from '../../server/pilot';
import ApplyForm from './form';
import '../app/portal.css';
import './style.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 IRIVA · 填写加入资料'};
export default async function Page({searchParams}:{searchParams:Promise<{plan?:string;language?:string}>}){const q=await searchParams;const plan=['native','everyday','professional'].includes(q.plan||'')?q.plan!:'native',role='learner',language=q.language==='Chinese'?'Chinese':'English';const query=new URLSearchParams({plan,language});const user=await requireUser(`/apply?${query}`);
 // 加入资料只面向学员：已在小组里的成员（含 Host）回到学习空间，运营直接进入工作台。
 await claimPlacement(user);if(await member(user.userId)||await pilotHost(await workspaceRepository(),user.email))redirect('/learn');if(await teamRole(user))redirect('/team');let initial:{application:Awaited<ReturnType<typeof ownApplication>>}|undefined;try{initial={application:await ownApplication(user.userId)}}catch(e){console.error(e)}
 return <ApplyForm initial={initial} email={user.email} account={user.userId} initialPlan={plan} initialRole={role} initialLanguage={language}/>}
