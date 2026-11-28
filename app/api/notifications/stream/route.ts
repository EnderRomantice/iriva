import {AsyncLocalStorage} from 'node:async_hooks';
import {currentUser} from '../../../../server/pilot';
import {GET as notifications} from '../route';
import {notificationSummary} from '../../../../server/notification-summary';
import {subscribeNotificationChanges} from '../../../../server/notification-events';
import {notificationStream,NotificationStreamError} from '../../../../server/notification-stream';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 try{
  const user=await currentUser();if(!user)return Response.json({error:'请先登录。'},{status:401});
  // Keep this request's cookies and organization header, even when a mutation in
  // another request wakes the subscriber. Every snapshot rechecks access.
  const inRequest=AsyncLocalStorage.snapshot();
  const read=()=>inRequest(async()=>{
   const response=await notifications();
   if(!response.ok)throw new NotificationStreamError(response.status);
   const snapshot=await response.json();
   // Push just counts and a revision. Fetch notification text only when its window is open.
   return notificationSummary(snapshot);
  });
  return new Response(notificationStream({read,subscribe:refresh=>subscribeNotificationChanges(user.userId,refresh),signal:request.signal}),{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private, no-cache, no-store, no-transform','X-Accel-Buffering':'no'}});
 }catch{return Response.json({error:'暂时无法订阅通知。'},{status:503});}
}
