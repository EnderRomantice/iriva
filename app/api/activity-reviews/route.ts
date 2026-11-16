import { currentUser, teamRole, sameOrigin, reply } from '../../../server/pilot';
import { workspaceRepository } from '../../../server/container';
import { ActivityReviews, ReviewError } from '../../../server/services/activity-reviews';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function context(){const u=await currentUser();return u?{userId:u.userId,team:!!await teamRole(u)}:null;}
function failure(error:unknown){if(error instanceof ReviewError)return reply({error:error.message},error.status);console.error(error);return reply({error:'暂时无法处理复盘，请稍后重试。'},503);}
export async function GET(req:Request){
 try{const actor=await context();if(!actor)return reply({error:'请先登录。'},401);
 const p=new URL(req.url).searchParams,page=Number(p.get('page')||0),status=p.get('status')||'all',learner=p.get('learner')||undefined,session=p.get('session')||undefined;
 if(!Number.isInteger(page)||page<0||page>100000||!['all','pending','published'].includes(status)||(learner&&learner.length>100)||(session&&session.length>100))return reply({error:'无效筛选条件。'},400);
 return reply(await new ActivityReviews(await workspaceRepository()).list(actor,{page,status,learner,session}));
 }catch(e){return failure(e);}
}
export async function POST(req:Request){
 try{const actor=await context();if(!actor)return reply({error:'请先登录。'},401);if(!sameOrigin(req))return reply({error:'请求来源不正确。'},403);
 const raw=await req.text();if(raw.length>16000)return reply({error:'内容过长。'},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return reply({error:'无效表单。'},400);}
 return reply(await new ActivityReviews(await workspaceRepository()).write(actor,body));
 }catch(e){return failure(e);}
}
