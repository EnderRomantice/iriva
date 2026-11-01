import type { User, Role } from '@/domain/models';
export interface Booking {id:string;learner_name:string;host_name:string;status:'pending'|'accepted'|'rejected';channel_id:string;learner_id:string;host_id:string}
export interface Account { testPaymentsAvailable?:boolean; user:User; role:Role; authenticated:boolean; application?:{id:string};supportId?:string;hosts:User[];bookings:Booking[];orders:{id:string;plan:string;frequency:number;status:string;amount_minor:number}[] }
export class AccountError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function accountRequest(body?:object):Promise<any> {
  const role=location.pathname.split('/')[1];
  const response=await fetch('/api/account',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-workspace-id':new URLSearchParams(location.search).get('org')||'',...(['host','ops'].includes(role)?{'x-demo-role':role}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new AccountError(result.error, response.status);return result;
}
export async function logout() { await accountRequest({action:'logout'}); sessionStorage.clear(); location.href='/apply'; }
