import { postgresTls } from '../db/postgres-tls';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { DatabaseRepository } from './database-repository';
import type { Awaitable, WorkspaceUnitOfWork } from './workspace-repository';
import type { State, Channel, ChannelParticipant, Message, Submission, Feedback, Application, Assignment, Household, Session, Membership, Enrollment, OrganizationMembership, User } from '../../domain/models';
import { tables } from './tables';

const snake=(key:string)=>key.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`);
const camel=(key:string)=>key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase());
const sqlTables=[...tables.map(snake),'mutation_receipts','audit_events','credentials','auth_sessions','bookings','plan_orders','email_challenges','email_identities','host_grants','group_requests'];
/** Convert the internal SQL dialect; quoted strings never contain placeholders. */
export function postgresQuery(query:string) {
  let parameter=0;
  const tokens=query.split(/('(?:[^']|'')*')/g);
  return tokens.map((token,index)=>index%2?token:token.replace(/\?/g,()=>`$${++parameter}`).replace(new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+(${sqlTables.join('|')})\\b`,'gi'),(_m,verb,table)=>`${verb} iriva.${table.toLowerCase()}`)).join('');
}

export class PostgresRepository implements DatabaseRepository {
  private readonly context=new AsyncLocalStorage<TransactionSql>();
  readonly sql:Sql;
  constructor(url:string) {
    this.sql=postgres(url,{max:3,prepare:false,ssl:postgresTls(url),connect_timeout:10,idle_timeout:20,max_lifetime:1800});
  }
  readonly db:DatabaseRepository["db"]={
    prepare:(query:string)=>({
      all:(...values:unknown[])=>this.query(query,values),
      get:async(...values:unknown[])=>(await this.query(query,values))[0],
      run:async(...values:unknown[])=>({changes:(await this.query(query,values)).count}),
    }),
    close:()=>this.sql.end({timeout:5}),
  };
  private query(query:string,values:unknown[]) {
    return (this.context.getStore()||this.sql).unsafe(postgresQuery(query),values as postgres.ParameterOrJSON<never>[]);
  }
  async transaction<T>(work:(tx:WorkspaceUnitOfWork)=>Awaitable<T>):Promise<T> {
    if(this.context.getStore()) return await work(this);
    for(let attempt=0;;attempt++) {
      try {
        // Serializable transactions preserve the domain's read/validate/write invariants
        // across independent serverless instances. Retry only database rollbacks.
        return await this.sql.begin('isolation level serializable',async sql=>this.context.run(sql,async()=>await work(this))) as T;
      } catch(error) {
        const code=(error as {code?:string}).code;
        if(attempt>=4||!['40001','40P01'].includes(code||'')) throw error;
        await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)+Math.random()*20));
      }
    }
  }
  async read():Promise<State> {
    // One statement provides a consistent snapshot without 15 network round trips.
    const [snapshot]=await this.query(`SELECT ${tables.map(table=>`(SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM ${snake(table)} AS row) AS "${table}"`).join(',')}`,[]);
    return Object.fromEntries(tables.map(table=>[table,snapshot[table].map((row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[camel(key),['host_qualifications','reactions','cards'].includes(key)&&typeof value==='string'?JSON.parse(value):['completed','host_featured','host_full_time'].includes(key)?Boolean(value):value])))])) as unknown as State;
  }
  snapshot(){return this.read();}
  async put(table:string,value:object) {
    if(!(tables as readonly string[]).includes(table)) throw new Error('Unknown domain table');
    const entries=Object.entries(value),names=entries.map(([key])=>snake(key));
    if(names.some(name=>!/^\w+$/.test(name))) throw new Error('Invalid column');
    await this.db.prepare(`INSERT INTO ${snake(table)} (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${names.filter(n=>n!=='id').map(n=>`${n}=excluded.${n}`).join(',')}`).run(...entries.map(([,v])=>Array.isArray(v)?this.sql.json(v as postgres.JSONValue):typeof v==='boolean'?Number(v):v));
  }
  receipt(actorId:string,commandId:string){return this.db.prepare('SELECT version FROM mutation_receipts WHERE actor_id=? AND command_id=?').get(actorId,commandId);}
  async acknowledge(actorId:string,commandId:string,version:number){await this.db.prepare('INSERT INTO mutation_receipts VALUES (?,?,?,?)').run(actorId,commandId,version,new Date().toISOString());}
  async audit(actorId:string,kind:string,entityId:string){await this.db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?)').run(randomUUID(),actorId,kind,entityId,new Date().toISOString());}
  async admission(userId:string,organizationId:string,hostId:string){
    return {registered:!!await this.db.prepare('SELECT user_id FROM credentials WHERE user_id=? UNION SELECT user_id FROM email_identities WHERE user_id=?').get(userId,userId),accepted:!!await this.db.prepare("SELECT id FROM bookings WHERE learner_id=? AND organization_id=? AND host_id=? AND status='accepted'").get(userId,organizationId,hostId),order:await this.db.prepare('SELECT plan,amount_minor AS "amountMinor" FROM plan_orders WHERE user_id=? AND status=? ORDER BY created_at DESC LIMIT 1').get(userId,'paid')};
  }
  saveChannel(v:Channel){return this.put('channels',v);}
  saveChannelParticipant(v:ChannelParticipant){return this.put('channelParticipants',v);}
  saveMessage(v:Message){return this.put('messages',v);}
  saveSubmission(v:Submission){return this.put('submissions',v);}
  saveFeedback(v:Feedback){return this.put('feedback',v);}
  saveApplication(v:Application){return this.put('applications',v);}
  saveAssignment(v:Assignment){return this.put('assignments',v);}
  saveHousehold(v:Household){return this.put('households',v);}
  saveSession(v:Session){return this.put('sessions',v);}
  saveMembership(v:Membership){return this.put('memberships',v);}
  saveEnrollment(v:Enrollment){return this.put('enrollments',v);}
  saveOrganizationMembership(v:OrganizationMembership){return this.put('organizationMemberships',v);}
  saveUser(v:User){return this.put('users',v);}
}
