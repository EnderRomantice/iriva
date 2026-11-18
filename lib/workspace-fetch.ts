import {ORGANIZATION_HEADER} from '../domain/workspace-access';
/** Pin each tab's requests to its URL, even when another tab changes the organization cookie. */
export function workspaceFetch(input:RequestInfo|URL,init?:RequestInit){
 const organization=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('org');
 if(!organization)return globalThis.fetch(input,init);
 const url=new URL(input instanceof Request?input.url:String(input),window.location.origin);
 if(url.origin!==window.location.origin||!url.pathname.startsWith('/api/'))return globalThis.fetch(input,init);
 const headers=new Headers(input instanceof Request?input.headers:undefined);
 new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));headers.set(ORGANIZATION_HEADER,organization);
 return globalThis.fetch(input,{...init,headers});
}
