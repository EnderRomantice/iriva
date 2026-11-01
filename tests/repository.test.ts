import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { asyncSqliteRepository } from '../server/repositories/async-sqlite-repository';

test('local asynchronous queries cannot join or roll back another request transaction',async()=>{
  const source=new SqliteRepository(':memory:'),repo=asyncSqliteRepository(source);
  const user=(id:string)=>({id,name:id,email:`${id}@example.test`,timezone:'UTC',avatar:'blue',version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  let release!:()=>void,started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{started=resolve;});
  const transaction=repo.transaction(async()=>{
    await repo.saveUser(user('rolled-back'));
    started();await gate;throw new Error('Rollback');
  });
  const rejected=assert.rejects(transaction,/Rollback/);
  try{
    await entered;
    let done=false;
    const standalone=Promise.resolve(repo.saveUser(user('retained'))).then(()=>{done=true;});
    await setImmediate();assert.equal(done,false);
    release();await rejected;await standalone;
    assert.deepEqual((await repo.read()).users.map(u=>u.id),['retained']);
    await repo.transaction(()=>repo.transaction(()=>repo.saveUser(user('nested'))));
    assert.equal((await repo.read()).users.length,2);
  }finally{release();await repo.db.close();}
});
