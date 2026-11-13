import {availabilityTimes,type AvailabilitySlot} from './availability';
export function applicationDraftKey(account:string,entry:{plan:string;role:string;language:string}){return `iriva:joining:v1:${account}:${entry.plan}:${entry.role}:${entry.language}`}
type Draft={fields:Record<string,string>;selected:string[];slots:AvailabilitySlot[];revision:number;savedAt:number};
export function parseApplicationDraft(raw:string,revision:number,now=Date.now()):Draft|null{
 try{const d=JSON.parse(raw);if(!d||d.revision!==revision||!Number.isFinite(d.savedAt)||d.savedAt<=now-7*86400000||d.savedAt>now+60000||!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields)||!Array.isArray(d.selected)||d.selected.length>3||d.selected.some((x:unknown)=>typeof x!=='string')||!Array.isArray(d.slots)||d.slots.length>8)return null;
 if(Object.values(d.fields).some(x=>typeof x!=='string'||x.length>1500))return null;
 if(d.slots.some((s:AvailabilitySlot)=>!s||!Number.isInteger(s.day)||s.day<0||s.day>7||typeof s.start!=='string'||typeof s.end!=='string'||(s.start!==''&&!availabilityTimes.includes(s.start))||(s.end!==''&&!availabilityTimes.includes(s.end))))return null;
 return d;
 }catch{return null}
}
