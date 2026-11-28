import {currentUser,currentWorkspace,pilotDb,reply} from '../../../../server/pilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await currentUser();if(!user)return reply({error:'请先登录。'},401);
 const db=await pilotDb(),id=new URL(req.url).searchParams.get('id');
 const application=await db.prepare(id?'SELECT id,user_id,organization_id FROM member_applications WHERE id=?':'SELECT id,user_id,organization_id FROM member_applications WHERE user_id=?').get(id||user.userId) as {id:string;user_id:string;organization_id:string}|undefined;
 if(!application)return new Response(null,{status:404});
 if(application.user_id!==user.userId){
  const ctx=user.authMethod==='password'?await currentWorkspace(user,new URL(req.url).searchParams.get('org')||undefined):null;
  if(!ctx||!['owner','admin'].includes(ctx.organization.role)||ctx.organization.id!==application.organization_id)return new Response(null,{status:404});
 }
 const row=await db.prepare('SELECT data_base64,mime_type FROM application_recordings WHERE application_id=?').get(application.id) as {data_base64:string;mime_type:string}|undefined;
 if(!row)return new Response(null,{status:404});
 const bytes=Buffer.from(row.data_base64,'base64'),headers={'Content-Type':row.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
 const range=req.headers.get('range');
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const start=match?.[1]?Number(match[1]):match?.[2]?Math.max(0,bytes.length-Number(match[2])):NaN;
  const end=match?.[1]&&match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=bytes.length||end<start)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});
  return new Response(bytes.subarray(start,end+1),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}});
 }
 return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)}});
}
