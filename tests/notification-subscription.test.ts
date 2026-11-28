import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishNotificationChanges,subscribeNotificationChanges} from '../server/notification-events';
import {notificationStream,NotificationStreamError} from '../server/notification-stream';
import {readNotificationEvents} from '../lib/notification-subscription';

test('SSE reader handles chunk boundaries inside multibyte text and ignores heartbeats',async()=>{
 const bytes=new TextEncoder().encode(': heartbeat\n\nevent: notifications\ndata: {"title":"相见"}\n\n');
 const stream=new ReadableStream<Uint8Array>({start(controller){for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));controller.close();}});
 const events:string[][]=[];await readNotificationEvents(stream,(...event)=>events.push(event));
 assert.deepEqual(events,[['notifications','{"title":"相见"}']]);
});

test('event subscription is scoped to user and can be unsubscribed',()=>{
 let a=0,b=0;const offA=subscribeNotificationChanges('a',()=>a++),offB=subscribeNotificationChanges('b',()=>b++);
 publishNotificationChanges(['a','a']);assert.equal(a,1);assert.equal(b,0);
 offA();publishNotificationChanges(['a','b']);assert.equal(a,1);assert.equal(b,1);offB();
});

test('stream emits changed snapshots, coalesces duplicate invalidations and cleans up on abort',async()=>{
 const abort=new AbortController();let value=1,refresh=()=>{},unsubscribed=false;
 const stream=notificationStream({signal:abort.signal,read:async()=>({unread:value}),subscribe:fn=>{refresh=fn;return()=>{unsubscribed=true;};},intervalMs:10000,lifetimeMs:10000});
 const reader=stream.getReader(),decode=(value:Uint8Array|undefined)=>new TextDecoder().decode(value);
 assert.match(decode((await reader.read()).value),/retry:/);
 assert.match(decode((await reader.read()).value),/"unread":1/);
 refresh();assert.equal(decode((await reader.read()).value),': heartbeat\n\n');
 value=2;refresh();assert.match(decode((await reader.read()).value),/"unread":2/);
 abort.abort();assert.equal((await reader.read()).done,true);assert.equal(unsubscribed,true);
});

test('stream cancels safely and revocation closes without sending private data',async()=>{
 let disposed=false;
 const stream=notificationStream({signal:new AbortController().signal,read:async()=>({unread:0}),subscribe:()=>()=>{disposed=true;}});
 await stream.cancel();assert.equal(disposed,true);
 const rejected=notificationStream({signal:new AbortController().signal,read:async()=>{throw new NotificationStreamError(403);},subscribe:()=>()=>{}});
 const events:string[]=[];await readNotificationEvents(rejected,event=>events.push(event));assert.deepEqual(events,['unauthorized']);
});

test('notification stream payload stays small and excludes message content even for a full inbox',async()=>{
 const {notificationSummary}=await import('../server/notification-summary');
 const snapshot={unread:100,pending:2,items:Array.from({length:100},(_,i)=>({id:String(i),title:'private content '.repeat(100)}))};
 const summary=notificationSummary(snapshot),wire=JSON.stringify(summary);
 assert.deepEqual(Object.keys(summary),['unread','pending','revision']);
 assert.ok(Buffer.byteLength(wire)<128);
 assert.equal(wire.includes('private'),false);
 assert.deepEqual(notificationSummary(snapshot),summary);
 const changed=notificationSummary({...snapshot,items:[...snapshot.items.slice(1),{id:'next',title:'changed'}]});
 assert.notEqual(changed.revision,summary.revision);
});
