import { randomUUID } from 'node:crypto';
import type { DatabaseRepository } from '../repositories/database-repository';
import { reviewCommand, type ReviewPayload, type ReviewRecord, type Reflection, type Observation, type ReviewCard } from '../../domain/activity-reviews';
export class ReviewError extends Error { constructor(message:string, public status=400){super(message);} }
type Actor={userId:string;team:boolean;organizationId?:string};
// Current membership and session participants both constrain access. A later join
// never grants access to earlier activities. No private coach draft is queried.
const eligible = `FROM sessions s JOIN households h ON h.id=s.household_id
 JOIN memberships m ON m.household_id=h.id AND m.role='learner' AND m.created_at<=s.starts_at
 JOIN users u ON u.id=m.user_id
 WHERE s.status<>'cancelled' AND s.ends_at<=?
 AND (s.participant_id IS NULL OR s.participant_id=m.user_id)
 AND (s.pair_id IS NULL OR EXISTS(SELECT 1 FROM practice_pairs p WHERE p.id=s.pair_id AND p.household=h.id AND (p.first=m.user_id OR p.second=m.user_id)))`;
const fields=`s.id AS session_id,m.user_id AS learner_id,s.title,s.starts_at AS at,h.id AS household,h.name AS household_name,COALESCE(NULLIF(m.display_name,''),u.name) AS learner_name`;
export class ActivityReviews {
 constructor(private repo:DatabaseRepository){}
 private async role(actor:Actor):Promise<ReviewPayload['role']>{
  if(actor.team)return 'team';
  return await this.repo.db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND role='host'").get(actor.userId)?'host':'learner';
 }
 private scope(actor:Actor,role:ReviewPayload['role']){
  return role==='team'?{sql:actor.organizationId?' AND (h.organization_id=? OR h.organization_id IN (SELECT id FROM organizations WHERE parent_id=?))':'',args:actor.organizationId?[actor.organizationId,actor.organizationId]:[] as string[]}:role==='host'?{sql:" AND h.host_id=? AND EXISTS(SELECT 1 FROM memberships hm WHERE hm.household_id=h.id AND hm.user_id=? AND hm.role='host')",args:[actor.userId,actor.userId]}:{sql:' AND m.user_id=?',args:[actor.userId]};
 }
 async list(actor:Actor,options:{page?:number;status?:string;learner?:string;session?:string}={}):Promise<ReviewPayload>{
  const role=await this.role(actor),scope=this.scope(actor,role),now=new Date().toISOString(),page=options.page||0;
  let where=eligible+scope.sql;const args:unknown[]=[now,...scope.args];
  if(options.learner){where+=' AND m.user_id=?';args.push(options.learner);}
  const base=where,baseArgs=[...args];
  if(options.session){where+=' AND s.id=?';args.push(options.session);}
  if(options.status==='pending')where+=" AND NOT EXISTS(SELECT 1 FROM activity_cards c WHERE c.session_id=s.id AND c.learner_id=m.user_id AND c.status='published')";
  if(options.status==='published')where+=" AND EXISTS(SELECT 1 FROM activity_cards c WHERE c.session_id=s.id AND c.learner_id=m.user_id AND c.status='published')";
  const db=this.repo.db;
  const [items,totalRow,statsRow,latestGoal]=await Promise.all([
   db.prepare(`SELECT ${fields} ${where} ORDER BY s.starts_at DESC,s.id,m.user_id LIMIT 30 OFFSET ?`).all(...args,page*30),
   db.prepare(`SELECT COUNT(*) AS n ${where}`).get(...args),
   db.prepare(`SELECT COUNT(*) AS eligible,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM activity_reflections r WHERE r.session_id=s.id AND r.learner_id=m.user_id) THEN 1 ELSE 0 END),0) AS reflections,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM activity_observations o WHERE o.session_id=s.id AND o.learner_id=m.user_id AND o.status='submitted' AND o.attendance='present') THEN 1 ELSE 0 END),0) AS present,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM activity_cards c WHERE c.session_id=s.id AND c.learner_id=m.user_id AND c.status='published') THEN 1 ELSE 0 END),0) AS published,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM activity_cards c WHERE c.session_id=s.id AND c.learner_id=m.user_id AND c.usefulness='yes') THEN 1 ELSE 0 END),0) AS helpful,
    COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM activity_cards c WHERE c.session_id=s.id AND c.learner_id=m.user_id AND c.usefulness IS NOT NULL) THEN 1 ELSE 0 END),0) AS responses ${base}`).get(...baseArgs),
   role==='learner'?db.prepare(`SELECT r.goal,c.next_step,s.title FROM activity_reflections r JOIN sessions s ON s.id=r.session_id JOIN memberships m ON m.household_id=s.household_id AND m.user_id=r.learner_id LEFT JOIN activity_cards c ON c.session_id=r.session_id AND c.learner_id=r.learner_id AND c.status='published' WHERE r.learner_id=? AND s.status<>'cancelled' ORDER BY s.starts_at DESC LIMIT 1`).get(actor.userId):null,
  ]);
  const records:ReviewRecord[]=await Promise.all(items.map(async row=>{
   const pair=[row.session_id,row.learner_id];
   const [r,o,c]=await Promise.all([
    role!=='host'?db.prepare('SELECT moment,support,comfort,goal,expression,submitted_at FROM activity_reflections WHERE session_id=? AND learner_id=?').get(...pair):null,
    role!=='learner'?db.prepare(`SELECT attendance,moment,invitation,status,version FROM activity_observations WHERE session_id=? AND learner_id=? ${role==='team'?"AND status='submitted'":'AND host_id=?'}`).get(...pair,...(role==='host'?[actor.userId]:[])):null,
    role!=='host'?db.prepare(`SELECT noticed,expression,next_step,status,version,published_at,usefulness,return_intent FROM activity_cards WHERE session_id=? AND learner_id=? ${role==='learner'?"AND status='published'":''}`).get(...pair):null,
   ]);
   return {...row,reflection:r?{...r,comfort:Number(r.comfort)} as Reflection:null,observation:o?{...o,version:Number(o.version)} as Observation:null,card:c?{...c,version:Number(c.version)} as ReviewCard:null} as ReviewRecord;
  }));
  return {role,records,page,total:Number(totalRow.n),stats:Object.fromEntries(Object.entries(statsRow).map(([k,v])=>[k,Number(v)])) as ReviewPayload['stats'],latestGoal:latestGoal||null};
 }
 async write(actor:Actor,input:unknown){
  const parsed=reviewCommand.safeParse(input);if(!parsed.success)throw new ReviewError('请完整填写表单，并检查文字长度和选项。');
  const b=parsed.data;
  return this.repo.transaction(async()=>{
   const role=await this.role(actor),scope=this.scope(actor,role),db=this.repo.db,now=new Date().toISOString();
   if(!await db.prepare(`SELECT s.id ${eligible+scope.sql} AND s.id=? AND m.user_id=?`).get(now,...scope.args,b.session,b.learner))throw new ReviewError('活动尚未结束，或你没有访问这位参与者的权限。',403);
   const pair=[b.session,b.learner];
   if(b.action==='reflect'){
    if(actor.userId!==b.learner||role!=='learner')throw new ReviewError('只能提交自己的活动复盘。',403);
    const result=await db.prepare('INSERT INTO activity_reflections (session_id,learner_id,moment,support,comfort,goal,expression,submitted_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').run(...pair,b.moment,b.support,b.comfort,b.goal,b.expression,now);
    if(!result.changes)throw new ReviewError('这场活动已经提交过复盘，请刷新查看。',409);
   }else if(b.action==='observe'){
    if(role!=='host')throw new ReviewError('只有带领本组的 Host 可以提交观察。',403);
    if(b.status==='submitted'&&(b.attendance==='unknown'||!b.moment||!b.invitation))throw new ReviewError('提交前请确认出席，并填写具体观察与下次邀请。缺席时可如实记录缺席。');
    const current=await db.prepare('SELECT version,status FROM activity_observations WHERE session_id=? AND learner_id=?').get(...pair);
    if(current?.status==='submitted')throw new ReviewError('观察已提交，请由团队跟进更正。',409);
    if(Number(current?.version||0)!==b.version)throw new ReviewError('观察已有更新，请刷新后重试。',409);
    if(current){
     const result=await db.prepare('UPDATE activity_observations SET attendance=?,moment=?,invitation=?,status=?,version=version+1,updated_at=? WHERE session_id=? AND learner_id=? AND version=?').run(b.attendance,b.moment,b.invitation,b.status,now,...pair,b.version);
     if(!result.changes)throw new ReviewError('观察已有更新，请刷新后重试。',409);
    }else await db.prepare('INSERT INTO activity_observations (session_id,learner_id,host_id,attendance,moment,invitation,status,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(...pair,actor.userId,b.attendance,b.moment,b.invitation,b.status,now);
   }else if(b.action==='card'){
    if(!actor.team)throw new ReviewError('只有运营团队可以审核发布回顾卡。',403);
    const current=await db.prepare('SELECT version,status FROM activity_cards WHERE session_id=? AND learner_id=?').get(...pair);
    if(current?.status==='published')throw new ReviewError('这张回顾卡已经发布。',409);
    if(Number(current?.version||0)!==b.version)throw new ReviewError('回顾卡已被其他工作人员更新，请刷新后重试。',409);
    if(b.status==='published'){
     if(!b.noticed||!b.next_step)throw new ReviewError('请填写具体回顾和下一步；没有记录到表达时可以留空。');
     const reflection=await db.prepare('SELECT 1 FROM activity_reflections WHERE session_id=? AND learner_id=?').get(...pair);
     const observation=await db.prepare("SELECT 1 FROM activity_observations WHERE session_id=? AND learner_id=? AND status='submitted'").get(...pair);
     if(!reflection||!observation)throw new ReviewError('请等待学员复盘和 Host 观察都提交后，再审核发布。',409);
    }
    const values=[actor.userId,b.noticed,b.expression,b.next_step,b.status,b.status==='published'?now:null,now];
    if(current){
     const result=await db.prepare('UPDATE activity_cards SET editor_id=?,noticed=?,expression=?,next_step=?,status=?,published_at=?,updated_at=?,version=version+1 WHERE session_id=? AND learner_id=? AND version=?').run(...values,...pair,b.version);
     if(!result.changes)throw new ReviewError('回顾卡已有更新，请刷新后重试。',409);
    }else await db.prepare('INSERT INTO activity_cards (editor_id,noticed,expression,next_step,status,published_at,updated_at,session_id,learner_id) VALUES (?,?,?,?,?,?,?,?,?)').run(...values,...pair);
    if(b.status==='published')await db.prepare("INSERT INTO notifications (id,user_id,session,kind,due,read) VALUES (?,?,?,'review',?,0) ON CONFLICT DO NOTHING").run(randomUUID(),b.learner,b.session,now);
   }else{
    if(actor.userId!==b.learner||role!=='learner')throw new ReviewError('只能回应自己的回顾卡。',403);
    const result=await db.prepare("UPDATE activity_cards SET usefulness=?,return_intent=?,responded_at=? WHERE session_id=? AND learner_id=? AND status='published'").run(b.usefulness,b.return_intent,now,...pair);
    if(!result.changes)throw new ReviewError('回顾卡尚未发布。',409);
   }
   await this.repo.audit(actor.userId,`activity.${b.action}`,`${b.session}:${b.learner}`);
   return {ok:true};
  });
 }
}
