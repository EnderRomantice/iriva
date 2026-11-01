import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PostgresRepository, postgresQuery } from '../server/repositories/postgres-repository';
import { WorkspaceService } from '../server/services/workspace-service';
import { seedId } from '../server/db/seed';

const enabled=process.env.PG_LOCAL_TEST==='1'&&!!process.env.DATABASE_URL;
const repo=enabled?new PostgresRepository(process.env.DATABASE_URL!):undefined;
after(async()=>{await repo?.db.close();});
test('SQL binding preserves literals and scopes table references',()=>{
  assert.equal(postgresQuery("SELECT '?' AS sample FROM messages WHERE body=? AND id=?"),"SELECT '?' AS sample FROM iriva.messages WHERE body=$1 AND id=$2");
});
test('PostgreSQL runtime role cannot alter schema or read migration metadata',{skip:!enabled},async()=>{
  await assert.rejects(repo!.sql`SELECT * FROM iriva._imports`,{code:'42501'});
  await assert.rejects(repo!.sql`CREATE TABLE iriva.forbidden (id text)`,{code:'42501'});
  const [role]=await repo!.sql`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
});
test('PostgreSQL rolls back failed writes and persists a retried concurrent command once',{skip:!enabled},async()=>{
  const state=await repo!.read(),host=state.organizations.find(o=>o.kind==='host'&&o.ownerId===seedId(5))!;
  assert.ok(host);
  const actor={userId:host.ownerId!,role:'host' as const,organizationId:host.id};
  const id=randomUUID();
  await assert.rejects(repo!.transaction(async()=>{
    await repo!.db.prepare('UPDATE users SET name=? WHERE id=?').run('Rolled back',actor.userId);
    throw new Error('Deliberate rollback');
  }),/Deliberate rollback/);
  assert.equal((await repo!.read()).users.find(u=>u.id===actor.userId)!.name,state.users.find(u=>u.id===actor.userId)!.name);
  const second=new PostgresRepository(process.env.DATABASE_URL!);
  try{
    const command={id:randomUUID(),entityId:id,baseVersion:0,kind:'channel.create' as const,payload:{name:'Concurrent group chat',description:'',kind:'public' as const}};
    const services=[new WorkspaceService(repo!),new WorkspaceService(second)];
    const results=await Promise.all(services.map(service=>service.execute(actor,command)));
    assert.equal(results[0].version,results[1].version);
    assert.equal((await repo!.read()).channels.filter(c=>c.id===id).length,1);
    assert.equal((await repo!.db.prepare('SELECT * FROM mutation_receipts WHERE actor_id=? AND command_id=?').all(actor.userId,command.id)).length,1);
    const messageId=randomUUID();
    await services[0].execute(actor,{id:randomUUID(),entityId:messageId,baseVersion:0,kind:'message.send',payload:{channelId:id,body:'Persistent conversation'}});
    await services[0].execute(actor,{id:randomUUID(),entityId:messageId,baseVersion:1,kind:'message.react',payload:{emoji:'👍',active:true}});
    const message=(await second.read()).messages.find(m=>m.id===messageId)!;
    assert.ok(Array.isArray(message.reactions));assert.equal(message.reactions?.length,1);
    assert.equal(message.body,'Persistent conversation');
  }finally{await second.db.close();}
});
