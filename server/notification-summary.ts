import {createHash} from 'node:crypto';
/** Deliberately whitelist the tiny wire payload; notification text stays off the stream. */
export function notificationSummary(snapshot:{items:unknown[];unread:number;pending:number}){
 return {unread:snapshot.unread,pending:snapshot.pending,revision:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
