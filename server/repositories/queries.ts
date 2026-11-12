import type { State, User } from '../../domain/models';
import type { SqlStatement } from './database-repository';
export type QueryDatabase = { db: { prepare(sql:string):SqlStatement } };
export type Table = keyof State;
export const columns:Record<Table,string>= {
 organizations:'id,name,initials,color,kind,owner_id,parent_id,is_primary,version,created_at,updated_at',
 users:'id,name,email,timezone,avatar,country_code,city,host_qualifications,host_featured,host_full_time,signature,mbti,zodiac,birth_chart,occupation,plan,version,created_at,updated_at',
 organizationMemberships:'id,organization_id,user_id,role,version,created_at,updated_at',
 terms:'id,name,starts_on,ends_on,version,created_at,updated_at',
 households:'id,organization_id,name,term_id,host_id,timezone,capacity,theme,version,created_at,updated_at',
 memberships:'id,household_id,user_id,role,version,created_at,updated_at',
 sessions:'id,household_id,title,description,starts_at,ends_at,status,meeting_url,version,created_at,updated_at',
 assignments:'id,household_id,title,description,category,due_at,week,version,created_at,updated_at',
 submissions:'id,assignment_id,learner_id,body,status,completed,version,created_at,updated_at',
 feedback:'id,submission_id,author_id,body,status,version,created_at,updated_at',
 applications:'id,organization_id,user_id,goal,availability,status,version,created_at,updated_at',
 enrollments:'id,user_id,term_id,household_id,plan,amount_minor,currency,payment_status,version,created_at,updated_at',
 channels:'id,organization_id,owner_id,name,description,kind,direct_key,version,created_at,updated_at',
 channelParticipants:'id,channel_id,user_id,version,created_at,updated_at',
 messages:'id,channel_id,author_id,body,reactions,cards,version,created_at,updated_at',
};
export const sqlName=(name:string)=>name.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
export function decode<T>(row:Record<string,unknown>):T {
 return Object.fromEntries(Object.entries(row).map(([key,v])=>[key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase()),['cards','reactions','host_qualifications'].includes(key)&&typeof v==='string'?JSON.parse(v):['completed','host_featured','host_full_time'].includes(key)?Boolean(v):v])) as T;
}
export function selection(table:Table,alias='t') {
 return columns[table].split(',').map(key=>table==='users'&&key==='avatar'?`CASE WHEN (${alias}.avatar LIKE 'data:image/%' OR ${alias}.avatar='avatar:stored') THEN '/api/avatars/' || ${alias}.id || '?v=' || ${alias}.version ELSE ${alias}.avatar END AS avatar`:`${alias}.${key}`).join(',');
}
/** Internal SQL predicates only. All request values are bound, and all list reads have a hard cap. */
export async function rows<K extends Table>(repo:QueryDatabase,table:K,where:string,values:unknown[]=[],limit=100,order='t.id ASC'):Promise<State[K]> {
 if(!where.trim()||!Number.isInteger(limit)||limit<1||limit>501)throw new Error('A bounded query predicate is required');
 const found=await repo.db.prepare(`SELECT ${selection(table)} FROM ${sqlName(table)} t WHERE ${where} ORDER BY ${order} LIMIT ?`).all(...values,limit);
 return found.map(row=>decode(row)) as State[K];
}
export async function one<K extends Table>(repo:QueryDatabase,table:K,where:string,values:unknown[]=[]):Promise<State[K][number]|undefined> {
 return (await rows(repo,table,where,values,1))[0];
}
export const userById=(repo:QueryDatabase,id:string)=>one(repo,'users','t.id=?',[id]) as Promise<User|undefined>;
export const userByEmail=(repo:QueryDatabase,email:string)=>one(repo,'users','lower(t.email)=?',[email.toLowerCase()]) as Promise<User|undefined>;
export async function exists(repo:QueryDatabase,sql:string,values:unknown[]=[]) {return !!await repo.db.prepare(sql).get(...values);}

/** Stream an internal migration/authorization update in small bounded batches. */
export async function* batches<K extends Table>(repo:QueryDatabase,table:K,where:string,values:unknown[]=[]) {
 let after='';
 for(;;){const page=await rows(repo,table,`(${where}) AND t.id>?`,[...values,after],100);if(!page.length)return;yield page;after=page.at(-1)!.id;}
}
