'use client';
import { useEffect,useRef,useState } from 'react';
import { accountRequest } from '@/features/space/account-client';
export function useAccountCollection<T>(collection:string,initial:T[],options:Record<string,string>={}) {
 const [items,setItems]=useState(initial),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=JSON.stringify(options),generation=useRef(0),controller=useRef<AbortController|undefined>(undefined);
 const load=async(after?:string)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setBusy(true);setError('');
  try{const page=await accountRequest(undefined,{collection,...JSON.parse(key),...(after?{after}:{})},abort.signal);if(current===generation.current){setItems(previous=>after?[...previous,...page.items]:page.items);setCursor(page.nextCursor);}}
  catch(e){if(!abort.signal.aborted&&current===generation.current)setError(e instanceof Error?e.message:'读取失败');}
  finally{if(current===generation.current)setBusy(false);}
 };
 const loader=useRef(load);loader.current=load;
 const initialKey=JSON.stringify(initial);
 useEffect(()=>{
  ++generation.current;controller.current?.abort();setItems(JSON.parse(initialKey));setCursor(null);
  const timer=setTimeout(()=>void loader.current(),JSON.parse(key).query?300:0);
  return()=>{clearTimeout(timer);++generation.current;controller.current?.abort();};
 },[collection,key,initialKey]);
 return {items,patchItems:(update:(items:T[])=>T[])=>{++generation.current;controller.current?.abort();setItems(update);},busy,error,hasMore:!!cursor,loadMore:()=>load(cursor||undefined),retry:()=>load()};
}
