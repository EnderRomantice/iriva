import type { Actor } from '../../domain/models';
import type { DatabaseRepository } from '../repositories/database-repository';
import { selection,decode,exists } from '../repositories/queries';
import { platformId } from './owned-workspaces';
export type AccountCollection='hosts'|'bookings'|'orders'|'requests'|'grants';
export async function accountPage(repo:DatabaseRepository,actor:Actor,collection:AccountCollection,options:{after?:string;query?:string;status?:string;kind?:string;qualification?:string}={}) {
 const org=await platformId(repo,actor.organizationId),after=options.after||'',q='%'+(options.query||'').toLowerCase().replace(/[\\%_]/g,c=>'\\'+c)+'%',values:unknown[]=[];
 let sql='';
 if(collection==='hosts'){
  sql=`SELECT ${selection('users')} FROM users t WHERE t.id>? AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id=? AND m.user_id=t.id AND m.role='host') AND (lower(t.name) LIKE ? ESCAPE '\\' OR lower(t.signature) LIKE ? ESCAPE '\\' OR lower(t.city) LIKE ? ESCAPE '\\')`;
  values.push(after,org,q,q,q);
  if(options.kind==='featured')sql+=' AND t.host_featured=1';
  if(options.kind==='full-time')sql+=' AND t.host_full_time=1';
  if(options.qualification&&options.qualification!=='all'){sql+=" AND CAST(t.host_qualifications AS TEXT) LIKE ? ESCAPE '\\'";values.push('%'+options.qualification.replace(/[\\%_]/g,c=>'\\'+c)+'%');}
  sql+=' ORDER BY t.id LIMIT 51';
 }else if(collection==='bookings'){
  sql=`SELECT b.id,b.status,b.channel_id,b.learner_id,b.host_id,u.name learner_name,h.name host_name FROM bookings b JOIN users u ON u.id=b.learner_id JOIN users h ON h.id=b.host_id WHERE b.organization_id=? AND b.id>?`;
  values.push(org,after);
  if(actor.role!=='ops'){sql+=` AND b.${actor.role==='host'?'host_id':'learner_id'}=?`;values.push(actor.userId);}
  if(options.status&&options.status!=='all'){sql+=' AND b.status=?';values.push(options.status);}
  sql+=" AND (lower(u.name) LIKE ? ESCAPE '\\' OR lower(h.name) LIKE ? ESCAPE '\\') ORDER BY b.id LIMIT 51";values.push(q,q);
 }else if(collection==='orders'){
  sql='SELECT id,plan,frequency,status,amount_minor FROM plan_orders WHERE user_id=? AND id>? ORDER BY id LIMIT 51';values.push(actor.userId,after);
 }else{
  const ops=actor.role==='ops'&&await exists(repo,"SELECT 1 FROM organization_memberships WHERE organization_id=? AND user_id=? AND role='ops'",[org,actor.userId]);
  if(collection==='grants'){
   if(!ops)return {items:[],nextCursor:null};
   sql='SELECT id,email,user_id,created_at FROM host_grants WHERE platform_id=? AND id>? ORDER BY id LIMIT 51';values.push(org,after);
  }else{
   if(actor.role==='learn')return {items:[],nextCursor:null};
   sql='SELECT r.id,r.name,r.reason,r.status,r.review_note,r.workspace_id,u.name host_name FROM group_requests r JOIN users u ON u.id=r.host_id WHERE r.platform_id=? AND r.id>?';values.push(org,after);
   if(!ops){sql+=' AND r.host_id=?';values.push(actor.userId);}
   sql+=' ORDER BY r.id LIMIT 51';
  }
 }
 const found=await repo.db.prepare(sql).all(...values),items=found.slice(0,50).map(row=>collection==='hosts'?{...decode<Record<string,unknown>>(row),email:'',birthChart:''}:row);
 return {items,nextCursor:found.length>50?found[49].id as string:null};
}
