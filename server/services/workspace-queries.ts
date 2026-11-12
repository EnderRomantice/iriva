import type { Actor, Snapshot, State } from '../../domain/models';
import { defaultOrganizationId } from '../../domain/workspace';
import { DomainError } from '../../domain/commands';
import { tables } from '../repositories/tables';
import { decode, selection, sqlName, rows, type QueryDatabase, type Table } from '../repositories/queries';
import { workspaceStats } from './workspace-stats';
import { cardCatalog } from './message-cards';

export const emptyState=():State=>Object.fromEntries(tables.map(t=>[t,[]])) as unknown as State;
export const viewerValues=(actor:Actor)=>[actor.userId,actor.organizationId||defaultOrganizationId,actor.role];
export const accessCTE=`WITH viewer AS (SELECT ? AS user_id, ? AS org, ? AS role),
 scope_groups AS (SELECT h.id FROM households h WHERE h.organization_id=(SELECT org FROM viewer) OR ((SELECT role FROM viewer)='ops' AND EXISTS (SELECT 1 FROM organizations o WHERE o.id=h.organization_id AND o.parent_id=(SELECT org FROM viewer) AND o.kind='host'))),
 allowed_groups AS (SELECT h.id FROM households h WHERE h.id IN (SELECT id FROM scope_groups) AND ((SELECT role FROM viewer)='ops' OR ((SELECT role FROM viewer)='host' AND h.host_id=(SELECT user_id FROM viewer)) OR ((SELECT role FROM viewer)='learn' AND EXISTS (SELECT 1 FROM memberships m WHERE m.household_id=h.id AND m.user_id=(SELECT user_id FROM viewer) AND m.role='learner')))),
 visible_channels AS (SELECT c.id FROM channels c WHERE c.organization_id=(SELECT org FROM viewer) AND (c.kind='public' OR (c.kind='private' AND c.owner_id=(SELECT user_id FROM viewer)) OR (c.kind='direct' AND EXISTS (SELECT 1 FROM channel_participants p WHERE p.channel_id=c.id AND p.user_id=(SELECT user_id FROM viewer))))),
 visible_assignments AS (SELECT a.id FROM assignments a WHERE a.household_id IN (SELECT id FROM allowed_groups)),
 visible_submissions AS (SELECT s.id FROM submissions s WHERE s.assignment_id IN (SELECT id FROM visible_assignments) AND ((SELECT role FROM viewer)='ops' OR ((SELECT role FROM viewer)='host' AND s.status='submitted') OR ((SELECT role FROM viewer)='learn' AND s.learner_id=(SELECT user_id FROM viewer))))`;
export const predicates:Record<Table,string>={
 organizations:"EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id=t.id AND m.user_id=(SELECT user_id FROM viewer))",
 organizationMemberships:"t.user_id=(SELECT user_id FROM viewer) OR t.organization_id=(SELECT org FROM viewer)",
 users:"EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id=t.id AND m.organization_id=(SELECT org FROM viewer)) OR ((SELECT role FROM viewer)='ops' AND EXISTS (SELECT 1 FROM applications a WHERE a.user_id=t.id AND a.organization_id=(SELECT org FROM viewer)))",
 households:'t.id IN (SELECT id FROM allowed_groups)',
 terms:'EXISTS (SELECT 1 FROM households h WHERE h.term_id=t.id AND h.id IN (SELECT id FROM allowed_groups))',
 memberships:'t.household_id IN (SELECT id FROM allowed_groups)',
 sessions:'t.household_id IN (SELECT id FROM allowed_groups)',
 assignments:'t.id IN (SELECT id FROM visible_assignments)',
 submissions:'t.id IN (SELECT id FROM visible_submissions)',
 feedback:"t.submission_id IN (SELECT id FROM visible_submissions) AND ((SELECT role FROM viewer)='ops' OR ((SELECT role FROM viewer)='host' AND t.author_id=(SELECT user_id FROM viewer)) OR ((SELECT role FROM viewer)='learn' AND t.status='published'))",
 applications:"(SELECT role FROM viewer)='ops' AND t.organization_id=(SELECT org FROM viewer)",
 enrollments:"t.household_id IN (SELECT id FROM allowed_groups) AND ((SELECT role FROM viewer)='ops' OR t.user_id=(SELECT user_id FROM viewer))",
 channels:'t.id IN (SELECT id FROM visible_channels)',channelParticipants:'t.channel_id IN (SELECT id FROM visible_channels)',messages:'t.channel_id IN (SELECT id FROM visible_channels)',
};
export async function authorize(repo:QueryDatabase,actor:Actor) {
 if(!await repo.db.prepare('SELECT 1 FROM organization_memberships WHERE organization_id=? AND user_id=? AND role=?').get(actor.organizationId||defaultOrganizationId,actor.userId,actor.role))throw new DomainError(403,'你没有访问这个工作区的权限。');
}
export interface PageOptions { after?:string;limit?:number;query?:string;channelId?:string;from?:string;to?:string;householdId?:string;ids?:string[];status?:string;kind?:string }
export interface Page<T> { items:T[]; nextCursor:string|null }
export async function collectionPage<K extends Table>(repo:QueryDatabase,actor:Actor,table:K,options:PageOptions={}):Promise<Page<State[K][number]>> {
 const limit=Math.min(100,Math.max(1,options.limit||50)), values:unknown[]=[...viewerValues(actor)];
 let where=`(${predicates[table]})`;
 if(options.ids){if(!options.ids.length)return {items:[],nextCursor:null};if(options.ids.length>100)throw new DomainError(400,'最多读取 100 条记录。');where+=` AND t.id IN (${options.ids.map(()=>'?').join(',')})`;values.push(...options.ids);}
 if(table==='channels'&&options.kind){where+=options.kind==='direct'?" AND t.kind='direct'":" AND t.kind<>'direct'";}
 let order='t.id ASC';
 if(table==='messages'){
  order='t.created_at DESC,t.id DESC';
  if(options.channelId){where+=' AND t.channel_id=?';values.push(options.channelId);}
  if(options.after){let cursor:unknown;try{cursor=JSON.parse(Buffer.from(options.after,'base64url').toString());}catch{throw new DomainError(400,'分页游标不正确。');}if(!Array.isArray(cursor)||cursor.length!==2||cursor.some(v=>typeof v!=='string'))throw new DomainError(400,'分页游标不正确。');where+=' AND (t.created_at<? OR (t.created_at=? AND t.id<?))';values.push(cursor[0],cursor[0],cursor[1]);}
 }else if(options.after){where+=' AND t.id>?';values.push(options.after);}
 if(options.householdId&&table==='submissions'){where+=' AND EXISTS (SELECT 1 FROM assignments a WHERE a.id=t.assignment_id AND a.household_id=?)';values.push(options.householdId);}
 if(options.householdId&&['assignments','sessions','memberships'].includes(table)){where+=' AND t.household_id=?';values.push(options.householdId);}
 if(table==='assignments'&&options.from&&options.to){where+=' AND t.due_at>=? AND t.due_at<?';values.push(options.from,options.to);}
 if(table==='sessions'&&options.from&&options.to){where+=' AND t.ends_at>=? AND t.starts_at<?';values.push(options.from,options.to);}
 const searchable:Partial<Record<Table,string[]>>={messages:['body'],users:['name','city','signature'],assignments:['title','description'],households:['name','theme'],channels:['name','description'],applications:['goal','availability'],sessions:['title','description'],enrollments:['plan'],organizations:['name'],terms:['name']};
 if(options.status && options.status!=='all'){
  if(table==='applications'){where+=' AND t.status=?';values.push(options.status);}
  else if(table==='assignments'&&actor.role==='learn'){where+=` AND ${options.status==='done'?'':'NOT '}EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=t.id AND s.learner_id=? AND s.completed=1)`;values.push(actor.userId);}
  else if(table==='submissions'&&actor.role==='host'){where+=` AND ${options.status==='done'?'':'NOT '}EXISTS (SELECT 1 FROM feedback f WHERE f.submission_id=t.id AND f.status='published')`;}
 }
 if(options.query&&table==='submissions'){where+=" AND EXISTS (SELECT 1 FROM assignments a WHERE a.id=t.assignment_id AND (lower(a.title) LIKE ? OR lower(a.description) LIKE ?))";values.push('%'+options.query.toLowerCase()+'%','%'+options.query.toLowerCase()+'%');}
 else if(options.query){const fields=searchable[table];if(!fields)throw new DomainError(400,'此列表不支持搜索。');where+=` AND (${fields.map(f=>`lower(t.${f}) LIKE ? ESCAPE '\\'`).join(' OR ')})`;const term='%'+options.query.toLowerCase().replace(/[\\%_]/g,c=>'\\'+c)+'%';values.push(...fields.map(()=>term));if(table==='applications'||table==='enrollments'){where=where.slice(0,-1)+` OR EXISTS (SELECT 1 FROM users u WHERE u.id=t.user_id AND lower(u.name) LIKE ? ESCAPE '\\'))`;values.push(term);}
 if(table==='channels'){where=where.slice(0,-1)+` OR (t.kind='direct' AND EXISTS (SELECT 1 FROM channel_participants p JOIN users u ON u.id=p.user_id WHERE p.channel_id=t.id AND p.user_id<>? AND lower(u.name) LIKE ? ESCAPE '\\')))`;values.push(actor.userId,term);}}
 const data=await repo.db.prepare(`${accessCTE} SELECT ${selection(table)} FROM ${sqlName(table)} t WHERE ${where} ORDER BY ${order} LIMIT ?`).all(...values,limit+1);
 const more=data.length>limit,items=data.slice(0,limit).map(row=>decode<State[K][number]>(row));
 if(table==='users')for(const user of items as State['users'])if(actor.role!=='ops'&&user.id!==actor.userId){user.email='';user.birthChart='';}
 const last=items.at(-1);
 const nextCursor=more&&last?(table==='messages'?Buffer.from(JSON.stringify([last.createdAt,last.id])).toString('base64url'):last.id):null;
 return {items,nextCursor};
}
/** Bounded initial pages. Details and historical messages are fetched by collection endpoints. */
export async function workspacePage(repo:QueryDatabase,actor:Actor):Promise<Snapshot> {
 await authorize(repo,actor);
 const state=emptyState(),pages:Partial<Record<Table,string|null>>={};
 await Promise.all(tables.map(async table=>{const page=await collectionPage(repo,actor,table,{limit:50});(state[table] as unknown[])=page.items;pages[table]=page.nextCursor;}));
 // Include referenced identities and relations for the first pages without loading unrelated rows.
 const hydrate=async(table:Table,ids:string[])=>{
  const missing=[...new Set(ids)].filter(id=>!state[table].some(row=>row.id===id));
  for(let i=0;i<missing.length;i+=100){const extra=await collectionPage(repo,actor,table,{ids:missing.slice(i,i+100),limit:100});(state[table] as unknown[]).push(...extra.items);}
 };
 await hydrate('submissions',state.feedback.map(f=>f.submissionId));
 await hydrate('assignments',[...state.submissions.map(s=>s.assignmentId),...state.messages.flatMap(m=>(m.cards||[]).filter(c=>c.type==='task').map(c=>c.entityId))]);
 await hydrate('households',[...state.assignments,...state.sessions,...state.memberships].map(a=>a.householdId));
 await hydrate('terms',state.households.map(h=>h.termId));
 await hydrate('users',[actor.userId,...state.messages.map(m=>m.authorId),...state.submissions.map(s=>s.learnerId),...state.households.map(h=>h.hostId),...state.applications.map(a=>a.userId),...state.channelParticipants.map(p=>p.userId)]);
 await hydrate('organizations',[actor.organizationId||defaultOrganizationId]);
 for(let i=0;i<state.households.length;i+=100){const ids=state.households.slice(i,i+100).map(h=>h.id);const own=await rows(repo,'memberships',`t.user_id=? AND t.household_id IN (${ids.map(()=>'?').join(',')})`,[actor.userId,...ids],100);for(const m of own)if(!state.memberships.some(v=>v.id===m.id))state.memberships.push(m);}
 const sharedIds=[...new Set(state.messages.flatMap(m=>(m.cards||[]).filter(c=>c.type==='group').map(c=>c.entityId)))];
 const shared=[] as State['households'];
 for(let i=0;i<sharedIds.length;i+=100){const ids=sharedIds.slice(i,i+100);shared.push(...await rows(repo,'households',`t.organization_id=? AND t.id IN (${ids.map(()=>'?').join(',')})`,[actor.organizationId||defaultOrganizationId,...ids],100));}
 const catalogState={...state,households:[...state.households,...shared.filter(h=>!state.households.some(g=>g.id===h.id))]};
 return {...state,stats:await workspaceStats(repo,actor,state.households.map(h=>h.id)),actor,serverTime:new Date().toISOString(),cardCatalog:cardCatalog(catalogState,actor),pages};
}
