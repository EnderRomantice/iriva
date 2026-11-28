'use client';
import {useEffect,useRef} from 'react';
import {workspaceFetch} from '../../lib/workspace-fetch';
import {readNotificationEvents} from '../../lib/notification-subscription';
type Snapshot={revision:string;pending:number;unread:number};
export function useNotificationSubscription(organizationId:string|undefined,onSnapshot:(snapshot:Snapshot)=>void){
 const handler=useRef(onSnapshot),lastUpdate=useRef(0);handler.current=onSnapshot;
 useEffect(()=>{
  let failures=0,disposed=false,unauthorized=false,running=false,controller:AbortController|undefined,retry:ReturnType<typeof setTimeout>|undefined;
  async function connect(){
   if(disposed||unauthorized||running||document.visibilityState==='hidden')return;
   running=true;
   controller=new AbortController();
   try{
    const response=await workspaceFetch('/api/notifications/stream',{signal:controller.signal,cache:'no-store'});
    if([401,403].includes(response.status)){unauthorized=true;return;}
    if(!response.ok||!response.body)throw new Error('Subscription unavailable');
    await readNotificationEvents(response.body,(event,data)=>{
     if(disposed)return;
     if(event==='unauthorized'){unauthorized=true;controller?.abort();return;}
     if(event==='notifications'){const snapshot=JSON.parse(data) as Snapshot;if(typeof snapshot.revision==='string'&&Number.isFinite(snapshot.pending)&&Number.isFinite(snapshot.unread)){lastUpdate.current=Date.now();handler.current(snapshot);}}
    },()=>{lastUpdate.current=Date.now();failures=0;});
   }catch{failures++;/* The notification-only fallback supplies user-visible errors. */}
   finally{running=false;controller=undefined;if(!disposed&&!unauthorized&&document.visibilityState==='visible')retry=setTimeout(connect,Math.min(30000,2500*2**Math.min(failures,4)));}
  }
  function visibility(){clearTimeout(retry);if(document.visibilityState==='hidden')controller?.abort();else if(!controller||controller.signal.aborted)void connect();}
  void connect();document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;lastUpdate.current=0;clearTimeout(retry);controller?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[organizationId]);
 return lastUpdate;
}
