import {EventEmitter} from 'node:events';

// Shared by route bundles in one process. Cross-instance delivery is reconciled by
// the stream's periodic authorized snapshot; never depend on process-local events alone.
const shared=globalThis as typeof globalThis & {irivaNotificationEvents?:EventEmitter};
const events=shared.irivaNotificationEvents??=new EventEmitter();
events.setMaxListeners(0);
export function subscribeNotificationChanges(userId:string,listener:()=>void){
 events.on(userId,listener);return()=>{events.off(userId,listener);};
}
export function publishNotificationChanges(userIds:string[]){
 for(const id of new Set(userIds))events.emit(id);
}
