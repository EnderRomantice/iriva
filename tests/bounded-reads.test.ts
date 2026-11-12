import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync,mkdirSync } from 'node:fs';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { PostgresRepository } from '../server/repositories/postgres-repository';
import { seedDemo,seedId } from '../server/db/seed';
import { WorkspaceService } from '../server/services/workspace-service';
import { collectionPage } from '../server/services/workspace-queries';
import { syncWorkspace } from '../server/services/workspace-sync';
import { accountPage } from '../server/services/account-pages';
import { demoActors } from '../domain/models';

// Same assertions run against SQLite and the disposable restricted-role PostgreSQL suite.
test('bounded runtime queries, full-history search, revocation and idle sync stay independent of database size',async t=>{
 const repo=process.env.DATABASE_URL?new PostgresRepository(process.env.DATABASE_URL):new SqliteRepository(':memory:');
 if(repo instanceof SqliteRepository)seedDemo(repo);
 t.after(async()=>{await repo.db.close();});
 const actor={...demoActors.learn,organizationId:seedId(1001)},now=new Date().toISOString(),channel=randomUUID();
 await repo.saveChannel({id:channel,organizationId:seedId(1001),ownerId:actor.userId,kind:'public',name:'Egress fixture',description:'',directKey:'',version:1,createdAt:now,updatedAt:now});
 await repo.db.prepare('UPDATE users SET avatar=? WHERE id=?').run('data:image/png;base64,'+'A'.repeat(620000),actor.userId);
 const count=10000;
 if(repo instanceof PostgresRepository){await repo.sql`INSERT INTO iriva.messages (id,channel_id,author_id,body,version,created_at,updated_at) SELECT md5(i::text),${channel},${actor.userId},'History '||i||CASE WHEN i=1 THEN ' old needle 100%_' ELSE '' END,1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z' FROM generate_series(1,${count}) i`;}
 else repo.atomic(()=>{for(let i=1;i<=count;i++)repo.saveMessage({id:String(i).padStart(32,'0'),channelId:channel,authorId:actor.userId,body:`History ${i}${i===1?' old needle 100%_':''}`,version:1,createdAt:'2025-01-01T00:00:00.000Z',updatedAt:'2025-01-01T00:00:00.000Z'});});
 let bytes=0,queries=0;
 if(repo instanceof PostgresRepository)repo.onQuery=e=>{bytes+=e.bytes;queries++;};
 const legacy=await repo.read(),legacyBytes=repo instanceof PostgresRepository?bytes:Buffer.byteLength(JSON.stringify(legacy));
 const service=new WorkspaceService(repo);
 // Runtime must not fall back to full snapshots, including command handling.
 t.mock.method(repo,'read',()=>{throw new Error('Full-table runtime read forbidden');});
 bytes=0;queries=0;
 const initial=await syncWorkspace(repo,actor,null),firstBytes=repo instanceof PostgresRepository?bytes:Buffer.byteLength(JSON.stringify(initial.snapshot));
 assert.ok(initial.snapshot);assert.ok(initial.snapshot.messages.length<=50);assert.ok(!JSON.stringify(initial.snapshot).includes('data:image/'));
 assert.ok(firstBytes/legacyBytes<0.05,`${firstBytes}/${legacyBytes} must reduce returned bytes by at least 95%`);
 const beforeIdle=bytes;
 assert.equal((await syncWorkspace(repo,actor,initial.etag)).snapshot,null);
 const idleBytes=bytes-beforeIdle;assert.ok(idleBytes<2500,`Idle read ${idleBytes} bytes`);
 const first=await collectionPage(repo,actor,'messages',{channelId:channel,limit:37});
 const second=await collectionPage(repo,actor,'messages',{channelId:channel,limit:37,after:first.nextCursor!});
 assert.equal(new Set([...first.items,...second.items].map(m=>m.id)).size,74,'Equal timestamps must not skip or repeat rows');
 const search=await collectionPage(repo,actor,'messages',{channelId:channel,query:'100%_'});assert.equal(search.items.length,1,'SQL wildcard characters are literal');
 assert.ok(search.items[0].body.includes('old needle'));
 const foreignUser=randomUUID();await repo.saveUser({id:foreignUser,name:'Unrelated',email:foreignUser+'@example.test',timezone:'UTC',avatar:'blue',version:1,createdAt:now,updatedAt:now});
 const foreign=randomUUID();await repo.saveChannel({id:foreign,organizationId:seedId(1002),ownerId:foreignUser,kind:'public',name:'Other tenant',description:'',directKey:'',version:1,createdAt:now,updatedAt:now});
 await repo.saveMessage({id:randomUUID(),channelId:foreign,authorId:foreignUser,body:'old needle secret',version:1,createdAt:now,updatedAt:now});
 assert.equal((await collectionPage(repo,actor,'messages',{query:'old needle secret'})).items.length,0);
 const op={id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'message.send' as const,payload:{channelId:channel,body:'bounded write'}};
 await service.execute(actor,op);await service.execute(actor,op);
 const changed=await syncWorkspace(repo,actor,initial.etag);assert.notEqual(changed.etag,initial.etag);
 assert.ok(changed.snapshot?.messages.some(m=>m.id===op.entityId));
 await repo.db.prepare('DELETE FROM messages WHERE id=?').run(op.entityId);
 const removed=await syncWorkspace(repo,actor,changed.etag);assert.notEqual(removed.etag,changed.etag);assert.ok(!removed.snapshot?.messages.some(m=>m.id===op.entityId));
 assert.ok((await accountPage(repo as never,actor,'hosts',{query:'nothing matches'})).items.length===0);
 // Growing an unrelated tenant cannot inflate returned business data.
 const baseline=JSON.stringify(removed.snapshot).length;
 await repo.db.prepare('UPDATE users SET avatar=? WHERE id=?').run('data:image/png;base64,'+'B'.repeat(700000),foreignUser);
 const unrelated=await syncWorkspace(repo,actor,removed.etag);
 assert.equal(JSON.stringify(unrelated.snapshot).length,baseline);
 await repo.db.prepare('DELETE FROM organization_memberships WHERE organization_id=? AND user_id=?').run(seedId(1001),actor.userId);
 await assert.rejects(syncWorkspace(repo,actor,unrelated.etag),{status:403});
 const report={engine:repo instanceof PostgresRepository?'PostgreSQL':'SQLite',historyMessages:count,legacyBytes,firstBytes,reductionPercent:Number((100*(1-firstBytes/legacyBytes)).toFixed(2)),idleBytes,queryCount:queries,fullReadGuard:true,searchHistory:true,timestampTiePagination:true,revocation:true};
 mkdirSync('test-results',{recursive:true});writeFileSync(`test-results/egress-${report.engine}.json`,JSON.stringify(report,null,2));console.log(report);
});
