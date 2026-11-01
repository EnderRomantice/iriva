import { canManageSubscription } from '@/domain/workspace-access';
import { beginEmailSignIn, verifyEmailSignIn } from '@/server/email-auth';
import { canContactHost } from '@/domain/hosts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { workspaceRepository, workspaceService } from '@/server/container';
import { actorFromRequest, errorResponse, requireLocalDemo } from '@/server/http';
import { digest, sameOrigin, sessionActor, sessionCookie, sessionToken, renewSession } from '@/server/auth';
import { DomainError } from '@/domain/commands';
import { plans, profileSchema, missingProfileFields } from '@/domain/account';
import { defaultOrganizationId } from '@/domain/workspace';
export const runtime='nodejs';
const meta=()=>({id:randomUUID(),version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});

export async function GET(request:Request) {
  try {
    const actor=actorFromRequest(request), repo=workspaceRepository(), state=repo.read();
    const org=actor.organizationId||defaultOrganizationId;
    let testPaymentsAvailable=false;
    try { requireLocalDemo(request); testPaymentsAvailable=true; } catch {}
    const hosts=state.organizationMemberships.filter(m=>m.organizationId===org&&m.role==='host').map(m=>state.users.find(u=>u.id===m.userId)!).map(({email,birthChart,...user})=>user);
    const bookings=repo.db.prepare(`SELECT b.*,u.name learner_name,h.name host_name FROM bookings b JOIN users u ON u.id=b.learner_id JOIN users h ON h.id=b.host_id WHERE organization_id=? AND ${actor.role==='ops'?'1=1':actor.role==='host'?'host_id=?':'learner_id=?'} ORDER BY b.created_at DESC`).all(...(actor.role==='ops'?[org]:[org,actor.userId]));
    const support=state.channels.find(c=>c.organizationId===org&&c.kind==='direct'&&c.description==='support'&&state.channelParticipants.some(p=>p.channelId===c.id&&p.userId===actor.userId));
    return Response.json({testPaymentsAvailable,user:state.users.find(u=>u.id===actor.userId),role:actor.role,authenticated:!!sessionToken(request),application:state.applications.find(a=>a.userId===actor.userId&&a.organizationId===org),supportId:support?.id,hosts,bookings,orders:repo.db.prepare('SELECT * FROM plan_orders WHERE user_id=? ORDER BY created_at DESC').all(actor.userId)}, {headers:{'Cache-Control':'no-store',...renewSession(request)}});
  } catch(e){return errorResponse(e);}
}
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    const body=await request.json(), repo=workspaceRepository(), org=request.headers.get('x-workspace-id')||defaultOrganizationId;
    if(body.action==='logout') { const token=sessionToken(request); if(token) repo.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token)); return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie('')}}); }
    if(body.action==='google') throw new DomainError(503,'Gmail 登录暂未开通，请先使用邮箱登录。');
    if(body.action==='wechat') throw new DomainError(503,'微信登录暂未开通，请先使用邮箱登录。');
    if(body.action==='email.begin') return await beginEmailSignIn(body, org, request);
    if(body.action==='email.verify') return verifyEmailSignIn(body, org, request);
    const actor=actorFromRequest(request), state=repo.read(), user=state.users.find(u=>u.id===actor.userId)!;
    const organizationId=actor.organizationId||defaultOrganizationId;
    if(body.action==='apply') {
      if(!sessionActor(request)) throw new DomainError(401,'请先登录。');
      const input=z.object({goal:z.string().trim().min(4).max(2000),availability:z.string().trim().min(2).max(1000)}).parse(body);
      const result=repo.atomic(()=>{
        if(!state.applications.some(a=>a.userId===user.id&&a.organizationId===organizationId)) repo.saveApplication({...meta(),...input,userId:user.id,organizationId,status:'new'});
        const operator=state.organizationMemberships.find(m=>m.organizationId===organizationId&&m.role==='ops');
        if(!operator) throw new DomainError(503,'客服暂未就绪，请稍后再试。');
        const directKey=[user.id,operator.userId].sort().join(':');
        const existing=state.channels.find(c=>c.organizationId===organizationId&&c.directKey===directKey);
        if(existing) return existing.id;
        const channel={...meta(),organizationId,ownerId:operator.userId,name:'客服支持',description:'support',kind:'direct' as const,directKey};repo.saveChannel(channel);
        for(const userId of [user.id,operator.userId]) repo.saveChannelParticipant({...meta(),channelId:channel.id,userId});
        repo.saveMessage({...meta(),channelId:channel.id,authorId:operator.userId,body:'欢迎来到 IRIVA！我是你的运营客服。你可以先选择适合自己的套餐，付款完成后就能认识 Host。关于报名、时间和入组的问题，都可以在这里告诉我。'});
        return channel.id;
      });
      return Response.json({supportId:result});
    }
    if(body.action==='profile') { const input=profileSchema.parse(body.profile);repo.saveUser({...user,...input,version:user.version+1,updatedAt:new Date().toISOString()});return Response.json({ok:true}); }
    if(body.action==='checkout') {
      if(!canManageSubscription(actor.role)) throw new DomainError(403,'只有学员可以购买套餐。');
      const input=z.object({plan:z.enum(['lite','pro','max']),frequency:z.union([z.literal(1),z.literal(2)])}).parse(body);
      if(!state.applications.some(a=>a.userId===user.id)) throw new DomainError(422,'请先填写报名表单。');
      const plan=plans.find(p=>p.id===input.plan)!;
      const existing=repo.db.prepare("SELECT id FROM plan_orders WHERE user_id=? AND plan=? AND frequency=? AND status='pending'").get(user.id,input.plan,input.frequency) as {id:string}|undefined;
      const id=existing?.id||randomUUID();
      if(!existing) repo.db.prepare('INSERT INTO plan_orders VALUES (?,?,?,?,?,?,?)').run(id,user.id,input.plan,input.frequency,plan.prices[input.frequency-1],'pending',new Date().toISOString());
      return Response.json({id,status:'pending',message:'订单已保存。在线支付暂未开通，你可以联系运营了解付款安排。支付确认后将开放 Host 选择。'});
    }
    if(body.action==='checkout.pay-test') {
      requireLocalDemo(request);
      if(!canManageSubscription(actor.role)) throw new DomainError(403,'只有学员可以支付自己的订单。');
      const {orderId}=z.object({orderId:z.uuid()}).parse(body);
      repo.atomic(()=>{
        const order=repo.db.prepare('SELECT * FROM plan_orders WHERE id=? AND user_id=?').get(orderId,user.id) as {id:string;plan:'lite'|'pro'|'max';status:string}|undefined;
        if(!order) throw new DomainError(404,'订单不存在。');
        if(order.status==='paid') return;
        if(order.status!=='pending') throw new DomainError(409,'当前订单无法支付。');
        const current=repo.read().users.find(u=>u.id===user.id)!;
        repo.db.prepare("UPDATE plan_orders SET status='paid' WHERE id=?").run(orderId);
        repo.saveUser({...current,plan:order.plan,version:current.version+1,updatedAt:new Date().toISOString()});
        repo.audit(user.id,'checkout.test_paid',orderId);
      });
      return Response.json({ok:true,status:'paid',test:true});
    }
    if(body.action==='contact') {
      if(actor.role!=='learn'||!user.plan||user.plan==='free') throw new DomainError(403,'请先完成套餐付款，再联系 Host。');
      const hostId=z.uuid().parse(body.hostId);
      if(!state.organizationMemberships.some(m=>m.organizationId===organizationId&&m.userId===hostId&&m.role==='host')) throw new DomainError(404,'Host 不存在。');
      const host=state.users.find(u=>u.id===hostId);
      if(!canContactHost(user.plan, !!host?.hostFeatured)) throw new DomainError(403,'明星 Host 需要 Pro 或 Max 套餐。');
      const missing = missingProfileFields(user);
      if(missing.length) throw new DomainError(422, `请先完善个人资料：${missing.join('、')}。`);
      const conversation=await workspaceService().execute(actor,{kind:'conversation.open',id:randomUUID(),entityId:randomUUID(),baseVersion:0,payload:{userId:hostId}});
      repo.atomic(()=>{const existing=repo.db.prepare('SELECT id FROM bookings WHERE organization_id=? AND learner_id=? AND host_id=?').get(organizationId,user.id,hostId);if(!existing){repo.db.prepare('INSERT INTO bookings VALUES (?,?,?,?,?,?,?)').run(randomUUID(),organizationId,user.id,hostId,conversation.entityId,'pending',new Date().toISOString());repo.saveMessage({...meta(),channelId:conversation.entityId!,authorId:user.id,body:'你好！我想和你约一次见面，聊聊学习目标和加入小组的可能。'});}});
      return Response.json({channelId:conversation.entityId});
    }
    if(body.action==='booking') {
      const input=z.object({id:z.uuid(),status:z.enum(['accepted','rejected'])}).parse(body);
      const result=repo.db.prepare('UPDATE bookings SET status=? WHERE id=? AND host_id=? AND organization_id=?').run(input.status,input.id,actor.role==='host'?user.id:'',organizationId);
      if(!result.changes) throw new DomainError(403,'只能处理自己收到的约谈。');
      repo.audit(user.id,`booking.${input.status}`,input.id);return Response.json({ok:true});
    }
    throw new DomainError(400,'未知操作。');
  } catch(e){return errorResponse(e);}
}
