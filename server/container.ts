import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseRepository } from './repositories/database-repository';
import { WorkspaceService } from './services/workspace-service';
import { bootstrapOwnedWorkspaces } from './services/owned-workspaces';

let repository:Promise<DatabaseRepository>|undefined;
export function workspaceRepository():Promise<DatabaseRepository> {
  repository ||= initialize().catch(error=>{repository=undefined;throw error;});
  return repository;
}
async function initialize():Promise<DatabaseRepository> {
  if(process.env.DATABASE_URL) {
    const {PostgresRepository}=await import('./repositories/postgres-repository');
    // Schema and data migration run explicitly before deployment, never on requests.
    return new PostgresRepository(process.env.DATABASE_URL);
  }
  if(process.env.VERCEL || process.env.NODE_ENV==='production') throw new Error('DATABASE_URL is required in production. SQLite is only supported for local development.');
  const {SqliteRepository}=await import('./repositories/sqlite-repository');
  const {seedDemo}=await import('./db/seed');
  const filename=process.env.SQLITE_PATH||path.join(process.cwd(),'data/iriva.sqlite');
  mkdirSync(path.dirname(filename),{recursive:true});
  const repo=new SqliteRepository(filename);
  seedDemo(repo);
  await bootstrapOwnedWorkspaces(repo);
  const {asyncSqliteRepository}=await import('./repositories/async-sqlite-repository');
  return asyncSqliteRepository(repo);
}
export async function workspaceService(){return new WorkspaceService(await workspaceRepository());}
