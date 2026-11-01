import type { Awaitable, WorkspaceRepository, WorkspaceUnitOfWork } from './workspace-repository';

/** SQL is server-authored; values are always bound parameters. */
export interface SqlStatement {
  get(...values: unknown[]): Awaitable<any>;
  all(...values: unknown[]): Awaitable<any[]>;
  run(...values: unknown[]): Awaitable<{changes:number}>;
}
export interface DatabaseRepository extends WorkspaceRepository, WorkspaceUnitOfWork {
  db: { prepare(sql:string):SqlStatement; close():Awaitable<unknown> };
  put(table:string,value:object):Awaitable<void>;
}
