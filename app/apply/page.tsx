import {ownApplication,requireUser} from '../../server/pilot';
import ApplyForm from './form';
import './style.css';
export const dynamic='force-dynamic';
export const metadata={title:'青鸟 IRIVA · 填写加入资料'};
export default async function Page({searchParams}:{searchParams:Promise<{plan?:string;role?:string;language?:string}>}){const q=await searchParams;const plan=['native','everyday','professional'].includes(q.plan||'')?q.plan!:'native',role=q.role==='host'?'host':'learner',language=q.language==='Chinese'?'Chinese':'English';const query=new URLSearchParams({plan,role,language});const user=await requireUser(`/apply?${query}`);let initial:{application:Awaited<ReturnType<typeof ownApplication>>}|undefined;try{initial={application:await ownApplication(user.userId)}}catch(e){console.error(e)}
 return <ApplyForm initial={initial} email={user.email} account={user.userId} initialPlan={plan} initialRole={role} initialLanguage={language}/>}
