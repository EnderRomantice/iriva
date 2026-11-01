import { postgresTls } from '../server/db/postgres-tls';
import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync } from 'node:fs';
import postgres from 'postgres';

async function main(){
  if(!process.env.SUPABASE_DATABASE_URL)throw new Error('SUPABASE_DATABASE_URL is required.');
  const adminUrl=new URL(process.env.SUPABASE_DATABASE_URL);
  const sql=postgres(adminUrl.toString(),{max:1,prepare:false,ssl:postgresTls(adminUrl.toString()),connect_timeout:15,onnotice:()=>{}});
  try{
    if((await sql`SELECT 1 FROM pg_roles WHERE rolname='iriva_app'`).length){
      throw new Error('iriva_app already exists; use its saved DATABASE_URL. This script never resets an existing password.');
    }
    if(!(await sql`SELECT 1 FROM pg_roles WHERE rolname='iriva_runtime'`).length)throw new Error('Run database migration before provisioning.');
    const password=randomBytes(36).toString('base64url');
    await sql.begin(async tx=>{
      const [statement]=await tx`SELECT format('CREATE ROLE iriva_app LOGIN PASSWORD %L',${password}::text) AS query`;
      await tx.unsafe(statement.query);
      await tx`GRANT iriva_runtime TO iriva_app`;
    });
    const runtimeUrl=new URL(adminUrl);
    const username=decodeURIComponent(adminUrl.username);
    runtimeUrl.username=`iriva_app${username.includes('.')?username.slice(username.indexOf('.')):''}`;
    runtimeUrl.password=password;
    // Save before verification so credentials survive transient connectivity errors.
    appendFileSync('.env.supabase.local',`\nDATABASE_URL=${runtimeUrl.toString()}\n`,{mode:0o600});
    chmodSync('.env.supabase.local',0o600);
    const runtime=postgres(runtimeUrl.toString(),{max:1,prepare:false,ssl:postgresTls(runtimeUrl.toString()),connect_timeout:15});
    try{
      await runtime`SELECT count(*) FROM iriva.users`;
      const [role]=await runtime`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
      if(role.rolsuper||role.rolbypassrls)throw new Error('Runtime role unexpectedly bypasses database permissions.');
    }finally{await runtime.end({timeout:5});}
    console.log('Restricted runtime connection verified and saved to .env.supabase.local.');
  }finally{await sql.end({timeout:5});}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Provisioning failed');process.exitCode=1;});
