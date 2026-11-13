/** Standard UTC offsets with representative cities for an easier selection. */
const offsets=[-720,-660,-600,-570,-540,-480,-420,-360,-300,-240,-210,-180,-150,-120,-60,0,60,120,180,210,240,270,300,330,345,360,390,420,480,525,540,570,600,630,660,720,765,780,825,840];
export function utcOffset(minutes:number){const n=Math.abs(minutes);return `${minutes<0?'-':'+'}${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
const representativeCities:[string,string][]=[
 ['北京','Asia/Shanghai'],['上海','Asia/Shanghai'],['新加坡','Asia/Singapore'],
 ['东京','Asia/Tokyo'],['首尔','Asia/Seoul'],['曼谷','Asia/Bangkok'],['雅加达','Asia/Jakarta'],
 ['孟买','Asia/Kolkata'],['新德里','Asia/Kolkata'],['加德满都','Asia/Kathmandu'],['达卡','Asia/Dhaka'],
 ['迪拜','Asia/Dubai'],['喀布尔','Asia/Kabul'],['德黑兰','Asia/Tehran'],['利雅得','Asia/Riyadh'],
 ['伦敦','Europe/London'],['里斯本','Europe/Lisbon'],['巴黎','Europe/Paris'],['柏林','Europe/Berlin'],
 ['开罗','Africa/Cairo'],['约翰内斯堡','Africa/Johannesburg'],['内罗毕','Africa/Nairobi'],
 ['纽约','America/New_York'],['多伦多','America/Toronto'],['芝加哥','America/Chicago'],['墨西哥城','America/Mexico_City'],
 ['丹佛','America/Denver'],['洛杉矶','America/Los_Angeles'],['温哥华','America/Vancouver'],
 ['安克雷奇','America/Anchorage'],['檀香山','Pacific/Honolulu'],['哈利法克斯','America/Halifax'],['圣约翰斯','America/St_Johns'],
 ['圣保罗','America/Sao_Paulo'],['布宜诺斯艾利斯','America/Argentina/Buenos_Aires'],['波哥大','America/Bogota'],
 ['悉尼','Australia/Sydney'],['墨尔本','Australia/Melbourne'],['布里斯班','Australia/Brisbane'],
 ['阿德莱德','Australia/Adelaide'],['达尔文','Australia/Darwin'],['珀斯','Australia/Perth'],['尤克拉','Australia/Eucla'],
 ['奥克兰','Pacific/Auckland'],['惠灵顿','Pacific/Auckland'],['查塔姆群岛','Pacific/Chatham']
];
export function timezoneOptions(date=new Date()){
 const cities=new Map<string,string[]>();
 for(const [city,timeZone] of representativeCities){
  const part=new Intl.DateTimeFormat('en',{timeZone,timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName')?.value;
  const offset=part==='GMT'||part==='UTC'?'+00:00':part?.replace('GMT','');
  if(!offset)continue;const names=cities.get(offset)||[];if(names.length<3)names.push(city);cities.set(offset,names);
 }
 return offsets.map(n=>{const value=utcOffset(n),names=cities.get(value);return{value,label:`UTC${value}${names?.length?' · '+names.join('／'):''}`}});
}
export const standardTimezones=timezoneOptions();
export function isStandardTimezone(value:string){return standardTimezones.some(z=>z.value===value)}
export function currentUtcOffset(){return utcOffset(-new Date().getTimezoneOffset())}
/** Legacy IANA values remain readable; only the presentation changes. */
export function timezoneLabel(value:string,date=new Date()){
 if(isStandardTimezone(value))return `UTC${value}`;
 try{const part=new Intl.DateTimeFormat('en',{timeZone:value,timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName')?.value||'';if(part==='GMT'||part==='UTC')return 'UTC+00:00';if(part.startsWith('GMT'))return part.replace('GMT','UTC');return '时区待确认'}catch{return '时区待确认'}
}

export const PILOT_TIMEZONE='Asia/Shanghai';
export const PILOT_TIME_LABEL='北京时间 · UTC+08:00';
export function beijingTime(at:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}){return new Intl.DateTimeFormat('zh-CN',{...options,timeZone:PILOT_TIMEZONE,hour12:false}).format(new Date(at))}
/** Interpret datetime-local as Beijing time, independent of the device timezone. */
export function beijingInputToUtc(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('请选择有效的北京时间。');
 const [year,month,day,hour,minute]=value.match(/\d+/g)!.map(Number);
 const check=new Date(Date.UTC(year,month-1,day,hour,minute));
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||hour>23||minute>59)throw new Error('请选择有效的北京时间。');
 return new Date(`${value}:00+08:00`).toISOString();
}
