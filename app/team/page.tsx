import {redirect} from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;org?:string}>}){const {tab,org}=await searchParams;const query=new URLSearchParams();if(tab)query.set('tab',tab);if(org)query.set('org',org);redirect('/app'+(query.size?'?'+query:''));}
