import { postgresTls } from '../server/db/postgres-tls';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { bootstrapOwnedWorkspaces } from '../server/services/owned-workspaces';
import { applyPostgresMigrations, importPostgresSnapshot, sqliteSnapshot } from '../server/db/postgres-migration';

async function main(){
  const source=process.env.SQLITE_PATH||path.join(process.cwd(),'data/iriva.sqlite');
  const url=process.env.SUPABASE_DATABASE_URL;
  if(!url)throw new Error('SUPABASE_DATABASE_URL must contain the admin connection string.');
  if(!existsSync(source))throw new Error('SQLite source does not exist; refusing to migrate an empty database.');
  const directory=path.join(process.cwd(),'data/backups');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const backup=path.join(directory,`pre-supabase-${Date.now()}.sqlite`);
  const sourceDb=new Database(source,{readonly:true});
  try{await sourceDb.backup(backup);}finally{sourceDb.close();}
  chmodSync(backup,0o600);
  // Upgrade only the backup. The original SQLite database remains untouched.
  const repo=new SqliteRepository(backup);
  let snapshot;
  try{await bootstrapOwnedWorkspaces(repo);snapshot=sqliteSnapshot(repo);}finally{repo.db.close();}
  const sql=postgres(url,{max:1,prepare:false,ssl:postgresTls(url),connect_timeout:15,onnotice:()=>{}});
  try{
    await applyPostgresMigrations(sql);
    const counts=await importPostgresSnapshot(sql,snapshot);
    console.log(JSON.stringify({backup,tables:counts,verified:true},null,2));
  }finally{await sql.end({timeout:5});}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed');process.exitCode=1;});
