export type AvailabilitySlot={day:number;start:string;end:string};
export const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
export function validSlots(value:unknown):value is AvailabilitySlot[]{return Array.isArray(value)&&value.length>0&&value.length<=8&&value.every(s=>s&&Number.isInteger(s.day)&&s.day>=1&&s.day<=7&&typeof s.start==='string'&&typeof s.end==='string'&&/^([01]\d|2[0-3]):[03]0$/.test(s.start)&&/^([01]\d|2[0-3]):[03]0$/.test(s.end)&&s.end>s.start&&minutes(s.end)-minutes(s.start)>=120)}
function minutes(t:string){const [h,m]=t.split(':').map(Number);return h*60+m}
export function availabilityText(slots:AvailabilitySlot[],note=''){return slots.map(s=>`${weekdays[s.day-1]} ${s.start}–${s.end}`).join('；')+(note.trim()?`\n补充：${note.trim()}`:'')}
export const availabilityTimes=Array.from({length:48},(_,i)=>`${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
