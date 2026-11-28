export class NotificationStreamError extends Error {
 constructor(public status:number){super('Notification snapshot unavailable');}
}
/** One bounded SSE connection. Only changed, authorized snapshots are emitted. */
export function notificationStream({read,subscribe,signal,intervalMs=15_000,lifetimeMs=50_000}:{read:()=>Promise<unknown>;subscribe:(refresh:()=>void)=>()=>void;signal:AbortSignal;intervalMs?:number;lifetimeMs?:number}){
 const encoder=new TextEncoder();let dispose=()=>{};
 return new ReadableStream<Uint8Array>({
  start(controller){
   let closed=false,busy=false,again=false,last='';
   let interval:ReturnType<typeof setInterval>|undefined,lifetime:ReturnType<typeof setTimeout>|undefined,unsubscribe=()=>{};
   function cleanup(closeController=true){if(closed)return;closed=true;clearInterval(interval);clearTimeout(lifetime);unsubscribe();signal.removeEventListener('abort',close);if(closeController)controller.close();}
   const close=()=>cleanup();
   dispose=()=>cleanup(false);
   function send(value:string){if(!closed)controller.enqueue(encoder.encode(value));}
   async function refresh(){
    if(closed)return;if(busy){again=true;return;}busy=true;
    try{
     const snapshot=JSON.stringify(await read());
     if(snapshot!==last){send(`event: notifications\ndata: ${snapshot}\n\n`);last=snapshot;}else send(': heartbeat\n\n');
    }catch(error){
     if(error instanceof NotificationStreamError&&[401,403].includes(error.status))send('event: unauthorized\ndata: {}\n\n');
     close();
    }finally{busy=false;if(again&&!closed){again=false;void refresh();}}
   }
   if(signal.aborted){close();return;}
   signal.addEventListener('abort',close,{once:true});
   unsubscribe=subscribe(()=>{void refresh();});
   interval=setInterval(()=>{void refresh();},intervalMs);
   lifetime=setTimeout(close,lifetimeMs);
   send('retry: 2000\n\n');void refresh();
  },
  cancel(){dispose();},
 });
}
