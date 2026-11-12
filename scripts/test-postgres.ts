import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import postgres from 'postgres';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { seedDemo } from '../server/db/seed';
import { bootstrapOwnedWorkspaces } from '../server/services/owned-workspaces';
import { applyPostgresMigrations, importPostgresSnapshot, sqliteSnapshot } from '../server/db/postgres-migration';

async function main(){
  const url=new URL(process.env.TEST_POSTGRES_ADMIN_URL||'postgres://localhost:5432/postgres');
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Contract tests require a local, disposable PostgreSQL server.');
  const admin=postgres(url.toString(),{max:1,ssl:false,connect_timeout:5,onnotice:()=>{}});
  const suffix=randomUUID().replaceAll('-',''),role=`iriva_test_${suffix}`;
  const sqlite=new SqliteRepository(':memory:');seedDemo(sqlite);await bootstrapOwnedWorkspaces(sqlite);
  const snapshot=sqliteSnapshot(sqlite);sqlite.db.close();
  try{
    await admin.unsafe(`CREATE ROLE ${role} LOGIN`);
    const browser=process.argv.includes('--e2e');
    const load=process.argv.includes('--load');
    for(const file of browser?['browser']:load?['load']:['account.test.ts','owned-workspaces.test.ts','postgres-contract.test.ts','bounded-reads.test.ts']){
      const name=`iriva_test_${randomUUID().replaceAll('-','')}`;
      await admin.unsafe(`CREATE DATABASE ${name}`);
      const dbUrl=new URL(url);dbUrl.pathname=`/${name}`;
      const setup=postgres(dbUrl.toString(),{max:1,ssl:false,onnotice:()=>{}});
      try{
        await applyPostgresMigrations(setup);
        await importPostgresSnapshot(setup,snapshot);
        await importPostgresSnapshot(setup,snapshot); // A rerun must not duplicate rows.
        await admin.unsafe(`GRANT iriva_runtime TO ${role}`);
        dbUrl.username=role;dbUrl.password='';
        const exit=await new Promise<number|null>((resolve,reject)=>{
          const args=browser?['node_modules/playwright/cli.js','test']:load?['--import','tsx','scripts/load-test.ts']:['--import','tsx','--test',`tests/${file}`];
          const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,DATABASE_URL:dbUrl.toString(),PG_LOCAL_TEST:'1',NODE_ENV:browser?'production':'test'}});
          child.once('error',reject);child.once('exit',resolve);
        });
        if(exit!==0)throw new Error(`PostgreSQL contract failed: ${file}`);
      }finally{
        await setup.end();
        await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`);
      }
    }
  }finally{
    await admin.unsafe(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
}
// Some drivers unref reconnect timers. An unresolved connection must never look like success.
let completed=false;
process.on('beforeExit',()=>{if(!completed){console.error('PostgreSQL tests did not complete. Check TEST_POSTGRES_ADMIN_URL.');process.exitCode=1;}});
const deadline=setTimeout(()=>{console.error('PostgreSQL tests exceeded 120 seconds.');process.exit(1);},process.argv.includes('--e2e')||process.argv.includes('--load')?600_000:120_000);
main().then(()=>{console.log('PostgreSQL contract suites completed.');},error=>{console.error(error instanceof Error?error.message:'PostgreSQL tests failed');process.exitCode=1;}).finally(()=>{completed=true;clearTimeout(deadline);});
