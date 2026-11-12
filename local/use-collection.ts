'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { Snapshot,State } from '@/domain/models';
import { draftScope,workspaceScope } from '@/domain/workspace';
import { mergeData } from '../domain/pagination';
import { localDb } from './database';
import { request } from './sync';
type Result<K extends keyof State>={items:State[K];nextCursor:string|null;related:State;cardCatalog:Snapshot['cardCatalog']};
/** Scoped full-history search. Cancellation plus a generation check rejects late replies. */
export function useCollection<K extends keyof State>(data:Snapshot,table:K,options:Record<string,string|undefined>={},enabled=true) {
 const scope=data.authenticated?draftScope(data.actor):workspaceScope(data.actor.role,data.actor.organizationId),key=JSON.stringify(options),generation=useRef(0),controller=useRef<AbortController|undefined>(undefined);
 const [result,setResult]=useState<Result<K>>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fetchPage=useCallback(async(after?:string)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  const current=++generation.current;setBusy(true);setError('');
  const search=new URLSearchParams({table});for(const [name,value] of Object.entries(JSON.parse(key)))if(value)search.set(name,String(value));if(after)search.set('after',after);
  try{
   const response=await request(scope,`/api/workspace/items?${search}`,undefined,{signal:abort.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error);
   if(current!==generation.current)return;
   await localDb.transaction('rw',localDb.snapshots,async()=>{
    const cached=await localDb.snapshots.get(scope);
    if(cached&&cached.data.revision===data.revision&&current===generation.current)await localDb.snapshots.put({role:scope,data:mergeData(cached.data,body.related,body.cardCatalog)});
   });
   if(current!==generation.current)return;
   setResult(old=>after&&old?{...body,items:Array.from(new Map([...old.items,...body.items].map(r=>[r.id,r])).values()),related:mergeData({...data,...old.related},body.related,body.cardCatalog),cardCatalog:[...(old.cardCatalog||[]),...(body.cardCatalog||[])]}:body);
  }catch(e){if(!abort.signal.aborted&&current===generation.current)setError(e instanceof Error?e.message:'读取失败');}
  finally{if(current===generation.current)setBusy(false);}
 },[scope,table,key,data]);
 // Keep the callback current without restarting on optimistic/local metadata updates.
 const fetchRef=useRef(fetchPage);fetchRef.current=fetchPage;
 useEffect(()=>{
  if(!enabled)return;
  setResult(undefined);setError('');++generation.current;controller.current?.abort();
  const timer=setTimeout(()=>void fetchRef.current(),JSON.parse(key).query?300:0);
  return()=>{clearTimeout(timer);++generation.current;controller.current?.abort();};
 },[scope,table,key,data.revision,enabled]);
 const enriched=result?mergeData(data,result.related,result.cardCatalog):data;
 return {items:result?.items??data[table],data:enriched,busy,error,hasMore:!!result?.nextCursor,loadMore:()=>fetchPage(result?.nextCursor||undefined),retry:()=>fetchPage(),ready:!!result};
}
