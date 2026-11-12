import type { User, Role, Organization } from '@/domain/models';
export interface Booking {id:string;learner_name:string;host_name:string;status:'pending'|'accepted'|'rejected';channel_id:string;learner_id:string;host_id:string}
export interface WorkspaceManagement {
 space?:Organization; platformId:string; canManageHosts:boolean; canAddMembers:boolean;
 grants:{email:string;user_id:string|null;created_at:string}[];
 requests:{id:string;name:string;reason:string;host_name:string;status:'pending'|'approved'|'rejected';review_note:string;workspace_id:string|null}[];
}
export interface Account { organizationId?:string; homeWorkspaceId?:string; /** Where to open after sign-in: a joined group when there is one, else the personal space. */ landingWorkspaceId?:string; management?:WorkspaceManagement; testPaymentsAvailable?:boolean; user:User; role:Role; authenticated:boolean; application?:{id:string};supportId?:string;hosts:User[];bookings:Booking[];orders:{id:string;plan:string;frequency:number;status:string;amount_minor:number}[] }
export class AccountError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function accountRequest(body?:object,params?:Record<string,string>,signal?:AbortSignal):Promise<any> {
  const role=location.pathname.split('/')[1];
  const response=await fetch('/api/account'+(params?'?'+new URLSearchParams(params):''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-workspace-id':new URLSearchParams(location.search).get('org')||'',...(process.env.NODE_ENV === 'development' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && ['host','ops'].includes(role)?{'x-demo-role':role}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal});
  const result=await response.json();if(!response.ok)throw new AccountError(result.error, response.status);if(body&&typeof window!=='undefined')window.dispatchEvent(new Event('iriva-account-changed'));return result;
}
export async function logout() { await accountRequest({action:'logout'}); forgetCachedAccounts(); sessionStorage.clear(); location.href='/apply'; }
/** Last known account per workspace, so a reload or workspace switch paints immediately and revalidates in the background. */
const accountCacheKey=(role:Role,org?:string)=>`iriva-account:${role}:${org||''}`;
export function readCachedAccount(role:Role,org?:string):Account|undefined {
  try { const value=JSON.parse(localStorage.getItem(accountCacheKey(role,org))||'null'); return value?.role===role&&value.user?.id?value:undefined; } catch { return undefined; }
}
export function cacheAccount(role:Role,org:string|undefined,account:Account) { try { localStorage.setItem(accountCacheKey(role,org),JSON.stringify(account)); } catch {} }
export function forgetCachedAccounts() { try { Object.keys(localStorage).filter(key=>key.startsWith('iriva-account:')).forEach(key=>localStorage.removeItem(key)); } catch {} }
