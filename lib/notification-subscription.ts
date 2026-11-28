/** Incremental SSE decoder: fetch preserves our per-tab organization header. */
export async function readNotificationEvents(body:ReadableStream<Uint8Array>,onEvent:(event:string,data:string)=>void,onActivity:()=>void=()=>{}){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;onActivity();buffer+=decoder.decode(value,{stream:true});
  let end:number;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);let event='message';const data:string[]=[];
   for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}
   if(data.length)onEvent(event,data.join('\n'));
  }
 }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
