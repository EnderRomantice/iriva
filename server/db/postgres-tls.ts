import { readFileSync } from 'node:fs';
import path from 'node:path';

export function postgresTls(url:string) {
  const hostname=new URL(url).hostname;
  if(process.env.PG_LOCAL_TEST==='1'&&!process.env.VERCEL&&['localhost','127.0.0.1','[::1]'].includes(hostname))return false;
  if(hostname.endsWith('.pooler.supabase.com')||hostname.endsWith('.supabase.co'))return {
    rejectUnauthorized:true,
    ca:readFileSync(path.join(process.cwd(),'server/db/certs/supabase-ca.pem'),'utf8'),
  };
  return 'verify-full' as const;
}
