import {z} from 'zod';
import {currentTeamContext,sameOrigin,reply} from '../../../../server/pilot';
import {workspaceRepository} from '../../../../server/container';
import {canManage,teamContext,auditOperation} from '../../../../server/services/organization-access';
import {assessmentRecording,assessAudio,oralModel} from '../../../../server/services/oral-assessment';
import {DomainError} from '../../../../domain/commands';
import {errorResponse} from '../../../../server/http';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return reply({error:'请求来源不正确。'},403);
  const ctx=await currentTeamContext();if(!ctx)return reply({error:'请使用密码登录。'},401);
  if(!canManage(ctx.organization.role))return reply({error:'只有管理员可以启动语音评估。'},403);
  const raw=await req.text();if(raw.length>2000)return reply({error:'请求过长。'},413);
  let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:'请求格式不正确。'},400)}
  const b=z.object({id:z.string().min(1).max(100),revision:z.number().int().nonnegative(),manual:z.literal(true)}).parse(input);
  const repo=await workspaceRepository(),recording=await assessmentRecording(repo,ctx.organization.id,b.id,b.revision);
  // Do not hold a database transaction or organization lock during network inference.
  await auditOperation(repo,ctx,'oralAssessment.start',b.id,200,{model:oralModel()});
  const result=await assessAudio(recording);
  const current=await teamContext(repo,ctx.user,ctx.organization.id);
  if(!canManage(current.organization.role))throw new DomainError(403,'管理权限已变化。');
  const latest=await assessmentRecording(repo,ctx.organization.id,b.id,b.revision);
  if(latest.updated!==recording.updated)throw new DomainError(409,'录音已替换，请重新评估。');
  await auditOperation(repo,current,'oralAssessment.complete',b.id,200,{model:oralModel()});
  return reply({...result,revision:b.revision,model:oralModel()});
 }catch(e){return errorResponse(e)}
}
