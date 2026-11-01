import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseRepository, SqlStatement } from './database-repository';
import type { Awaitable, WorkspaceUnitOfWork } from './workspace-repository';
import type { SqliteRepository } from './sqlite-repository';

/** Keep standalone development queries out of another request's open transaction. */
export function asyncSqliteRepository(repo:SqliteRepository):DatabaseRepository {
  const context=new AsyncLocalStorage<boolean>();
  const run=<T>(work:()=>Awaitable<T>):Promise<T>=>context.getStore()?Promise.resolve().then(work):repo.transaction(()=>context.run(true,work));
  const db:DatabaseRepository['db']={
    prepare:(query:string):SqlStatement=>({
      get:(...values:unknown[])=>run(()=>repo.db.prepare(query).get(...values)),
      all:(...values:unknown[])=>run(()=>repo.db.prepare(query).all(...values)),
      run:(...values:unknown[])=>run(()=>repo.db.prepare(query).run(...values)),
    }),
    close:async()=>{await run(()=>undefined);repo.db.close();},
  };
  const facade=new Proxy(repo,{
    get(target,key){
      if(key==='db')return db;
      if(key==='transaction')return <T>(work:(tx:WorkspaceUnitOfWork)=>Awaitable<T>)=>run(()=>work(facade));
      const value=Reflect.get(target,key);
      return typeof value==='function'?(...args:unknown[])=>run(()=>value.apply(target,args)):value;
    },
  }) as unknown as DatabaseRepository;
  return facade;
}
