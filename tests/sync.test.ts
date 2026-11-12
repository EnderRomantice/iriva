import 'fake-indexeddb/auto';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localDb, enqueue } from '../local/database';
import { synchronize } from '../local/sync';
import type { Snapshot } from '../domain/models';
import type { Command } from '../domain/commands';

const snapshot:Snapshot={actor:{role:'learn',userId:randomUUID()},serverTime:new Date().toISOString(),organizations:[],organizationMemberships:[],channels:[],channelParticipants:[],messages:[],users:[],terms:[],households:[],memberships:[],sessions:[],assignments:[],submissions:[],feedback:[],applications:[],enrollments:[]};
const command=():Command=>({id:randomUUID(),entityId:randomUUID(),kind:'message.send',baseVersion:0,payload:{channelId:randomUUID(),body:'Keep my message'}});
function browser(t:TestContext) {
  const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const navigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  t.after(()=>{
    if(storage)Object.defineProperty(globalThis,'localStorage',storage);else Reflect.deleteProperty(globalThis,'localStorage');
    if(navigator)Object.defineProperty(globalThis,'navigator',navigator);else Reflect.deleteProperty(globalThis,'navigator');
  });
}

test('auth expiry and transient failures preserve pending edits; retry keeps the command ID',async t=>{
  browser(t);
  for(const status of [401,408,425,429,503]) {
    const scope=`learn:transient-${status}` as const, op=command();
    await enqueue(scope,op);
    const sent:string[]=[];
    let failed=true;
    t.mock.method(globalThis,'fetch',async (_url:unknown,init:RequestInit)=>{
      if(String(_url).includes('/items?'))return Response.json({items:[],related:{},cardCatalog:[]});
      if(init.method==='POST') {sent.push(JSON.parse(String(init.body)).id);return failed?Response.json({error:'Try again'},{status}):Response.json({version:1});}
      return Response.json(snapshot);
    });
    await assert.rejects(synchronize(scope),/Try again/);
    assert.equal((await localDb.outbox.where('role').equals(scope).first())?.status,'pending');
    failed=false;
    await synchronize(scope);
    assert.deepEqual(sent,[op.id,op.id]);
    assert.equal(await localDb.outbox.where('role').equals(scope).count(),0);
    t.mock.restoreAll();
  }
});

test('lost response retries the same operation; real conflicts block only their own entity',async t=>{
  browser(t);
  const scope='learn:lost-response',op=command(),other=command();
  await enqueue(scope,op);await enqueue(scope,other);
  let first=true;
  const sent:string[]=[];
  t.mock.method(globalThis,'fetch',async (_url:unknown,init:RequestInit)=>{
    if(String(_url).includes('/items?'))return Response.json({items:[],related:{},cardCatalog:[]});
    if(init.method!=='POST')return Response.json(snapshot);
    const id=JSON.parse(String(init.body)).id;sent.push(id);
    if(first){first=false;throw new Error('Response lost');}
    return id===op.id?Response.json({error:'Version changed'},{status:409}):Response.json({version:1});
  });
  await assert.rejects(synchronize(scope),/Response lost/);
  await Promise.all([synchronize(scope),synchronize(scope),synchronize(scope)]);
  assert.deepEqual(sent,[op.id,op.id,other.id]);
  const remaining=await localDb.outbox.where('role').equals(scope).toArray();
  assert.equal(remaining.length,1);assert.equal(remaining[0].status,'conflict');
});
