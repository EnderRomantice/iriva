import { z } from 'zod';
import type { DatabaseRepository } from '../repositories/database-repository';
import { canManage, type TeamContext } from './organization-access';
import { DomainError } from '../../domain/commands';
const schema=z.object({q:z.string().trim().max(100).default(''),actor:z.string().max(100).default(''),action:z.string().max(100).default(''),result:z.enum(['','success','denied','failed']).default(''),from:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),to:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(''),page:z.coerce.number().int().min(0).max(100000).default(0),order:z.enum(['desc','asc']).default('desc'),asOf:z.iso.datetime().optional()});
export async function organizationAudit(repo:DatabaseRepository,ctx:TeamContext,input:unknown){
 if(!canManage(ctx.organization.role))throw new DomainError(403,'只有管理员可以查看操作日志。');
 const b=schema.parse(input),asOf=b.asOf||new Date().toISOString();
 let where='organization_id=? AND created_at<=?',args:unknown[]=[ctx.organization.id,asOf];
 for(const [column,value] of [['actor_id',b.actor],['action',b.action],['result',b.result]])if(value){where+=` AND ${column}=?`;args.push(value);}
 if(b.from&&b.to&&b.from>b.to)throw new DomainError(400,'开始日期不能晚于结束日期。');
 if(b.from){const start=new Date(`${b.from}T00:00:00+08:00`);if(!Number.isFinite(+start))throw new DomainError(400,'开始日期无效。');where+=' AND created_at>=?';args.push(start.toISOString());}
 if(b.to){const end=new Date(`${b.to}T00:00:00+08:00`);if(!Number.isFinite(+end))throw new DomainError(400,'结束日期无效。');where+=' AND created_at<?';args.push(new Date(+end+86400000).toISOString());}
 if(b.q){const q='%'+b.q.replace(/[\\%_]/g,c=>'\\'+c).toLowerCase()+'%';where+=" AND (lower(actor_name) LIKE ? ESCAPE '\\' OR lower(actor_email) LIKE ? ESCAPE '\\' OR lower(target) LIKE ? ESCAPE '\\' OR lower(action) LIKE ? ESCAPE '\\')";args.push(q,q,q,q);}
 const [items,total,actors,actions]=await Promise.all([
  repo.db.prepare(`SELECT * FROM organization_audit WHERE ${where} ORDER BY created_at ${b.order},id ${b.order} LIMIT 25 OFFSET ?`).all(...args,b.page*25),
  repo.db.prepare(`SELECT COUNT(*) AS n FROM organization_audit WHERE ${where}`).get(...args),
  repo.db.prepare('SELECT DISTINCT actor_id,actor_name,actor_email FROM organization_audit WHERE organization_id=? ORDER BY actor_name').all(ctx.organization.id),
  repo.db.prepare('SELECT DISTINCT action FROM organization_audit WHERE organization_id=? ORDER BY action').all(ctx.organization.id),
 ]);
 return {items,total:Number(total.n),page:b.page,pageSize:25,asOf,actors,actions:actions.map(a=>a.action)};
}
