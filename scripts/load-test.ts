import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PostgresRepository } from '../server/repositories/postgres-repository';
import { WorkspaceService } from '../server/services/workspace-service';
import { seedId } from '../server/db/seed';

async function main() {
  if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL||!['127.0.0.1','localhost','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Use the disposable local PostgreSQL harness.');
  const clients=Number(process.env.LOAD_CLIENTS||8),seconds=Number(process.env.LOAD_SECONDS||15),rows=Number(process.env.LOAD_MESSAGES||1000);
  if(![clients,seconds,rows].every(Number.isInteger)||clients<1||clients>200||seconds<1||seconds>300||rows<0||rows>100000)throw new Error('Invalid load parameters.');
  const repo=new PostgresRepository(process.env.DATABASE_URL),service=new WorkspaceService(repo);
  const state=await repo.read(),org=state.organizations.find(o=>o.kind==='host'&&o.ownerId===seedId(5))!;
  const actor={userId:seedId(5),role:'host' as const,organizationId:org.id},channelId=randomUUID();
  await service.execute(actor,{id:randomUUID(),entityId:channelId,baseVersion:0,kind:'channel.create',payload:{name:'Load fixture',kind:'public',description:''}});
  const now=new Date().toISOString();
  await repo.sql.begin(async tx=>{
    for(let i=0;i<rows;i++)await tx`INSERT INTO iriva.messages (id,channel_id,author_id,body,version,created_at,updated_at) VALUES (${randomUUID()},${channelId},${actor.userId},${'Load history '+i},1,${now},${now})`;
  });
  const token=randomUUID();
  await repo.db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),actor.userId,Date.now()+3600000);
  mkdirSync('test-results',{recursive:true});
  const fd=openSync('test-results/load-server.log','w');
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3118'],{env:{...process.env,NODE_ENV:'production'},stdio:['ignore',fd,fd]});
  const origin='http://127.0.0.1:3118';
  const headers={cookie:`iriva_session=${token}`,'x-workspace-id':org.id,origin,'content-type':'application/json'};
  const timings:{read:number[];write:number[]}={read:[],write:[]},statuses:Record<string,number>={};
  const commandIds:string[]=[];let readResponseBytes=0;
  try {
    let ready=false;
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw new Error('Load server exited; see test-results/load-server.log');
      try{if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,'Load server must start');
    // Simultaneous response-loss retries must produce a single message and audit event.
    const replay={id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'message.send',payload:{channelId,body:'Replay storm'}};
    const replayResults=await Promise.all(Array.from({length:20},()=>fetch(`${origin}/api/mutations`,{method:'POST',headers,body:JSON.stringify(replay)}).then(async r=>{await r.text();return r.status;})));
    assert.ok(replayResults.every(s=>s===200),`Replay statuses: ${replayResults}`);
    assert.equal((await repo.db.prepare('SELECT id FROM audit_events WHERE entity_id=?').all(replay.entityId)).length,1);
    const started=performance.now(),deadline=started+seconds*1000;
    await Promise.all(Array.from({length:clients},async(_,client)=>{
      let step=client;
      while(performance.now()<deadline){
        const kind=step++%5===0?'write':'read',start=performance.now();
        const op={id:randomUUID(),entityId:randomUUID(),baseVersion:0,kind:'message.send',payload:{channelId,body:`Load ${client} ${step}`}};
        try {
          const response=await fetch(`${origin}/api/${kind==='write'?'mutations':'workspace'}`,{headers,method:kind==='write'?'POST':'GET',body:kind==='write'?JSON.stringify(op):undefined,signal:AbortSignal.timeout(15000)});
          const body=await response.text();if(kind==='read')readResponseBytes+=Buffer.byteLength(body);statuses[response.status]=(statuses[response.status]||0)+1;
          if(response.ok&&kind==='write')commandIds.push(op.entityId);
        } catch {statuses.network=(statuses.network||0)+1;}
        timings[kind].push(performance.now()-start);
      }
    }));
    const elapsed=(performance.now()-started)/1000;
    const summary=(values:number[])=>{const sorted=values.sort((a,b)=>a-b);return {count:sorted.length,p95Ms:Math.round(sorted[Math.ceil(sorted.length*.95)-1]||0),p99Ms:Math.round(sorted[Math.ceil(sorted.length*.99)-1]||0)};};
    const total=Object.values(statuses).reduce((a,b)=>a+b,0),errors=Object.entries(statuses).filter(([code])=>Number(code)<200||Number(code)>=300||code==='network').reduce((a,[,n])=>a+n,0);
    const [saved]=await repo.sql`SELECT count(*)::int AS n FROM iriva.messages WHERE channel_id=${channelId}`;
    assert.equal(saved.n,rows+1+commandIds.length,'Every successful write must persist exactly once');
    const report={at:new Date().toISOString(),environment:'local production Next.js + disposable PostgreSQL; single server; closed-loop mixed HTTP load',clients,seconds,historyMessages:rows,elapsedSeconds:elapsed,requestsPerSecond:Math.round(total/elapsed),statuses,errorRate:errors/total,read:summary(timings.read),write:summary(timings.write),readResponseBytes,averageReadResponseBytes:Math.round(readResponseBytes/timings.read.length),replayRequests:20,replayEffects:1,persistedWrites:commandIds.length};
    writeFileSync('test-results/load-report.json',JSON.stringify(report,null,2));writeFileSync(`test-results/load-${clients}-${rows}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
    assert.ok(report.errorRate<0.001,'Unexpected errors exceed 0.1%');
    assert.ok(report.read.p95Ms<=800,'Read P95 exceeds 800ms');
    assert.ok(report.write.p95Ms<=1500,'Write P95 exceeds 1500ms');
  } finally {
    if(server.exitCode===null){server.kill('SIGTERM');await new Promise<void>(resolve=>server.once('exit',()=>resolve()));}
    closeSync(fd);await repo.db.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
