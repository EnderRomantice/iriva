import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Sql } from 'postgres';
import type { SqliteRepository } from '../repositories/sqlite-repository';

export const migrationTables = ['users','organizations','terms','households','organization_memberships','memberships','sessions','assignments','submissions','feedback','applications','enrollments','channels','channel_participants','messages','mutation_receipts','audit_events','credentials','auth_sessions','bookings','plan_orders','email_challenges','email_identities','host_grants','group_requests'] as const;
export type DataSnapshot = Record<string, Record<string, unknown>[]>;
const jsonColumns = new Set(['host_qualifications','reactions','cards']);
const epochColumns = new Set(['expires_at','verified_at']);
function ordered(value:unknown):unknown {
  if(Array.isArray(value))return value.map(ordered);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,ordered(v)]));
  return value;
}
function canonical(rows:Record<string,unknown>[],table:string) {
  return rows.map(row=>JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key=>{
    let value=row[key];
    if(jsonColumns.has(key)&&typeof value==='string') value=JSON.parse(value);
    if(epochColumns.has(key)||(table==='email_challenges'&&key==='created_at')) value=Number(value);
    return [key,ordered(value)];
  })))).sort();
}
export function sqliteSnapshot(repo:SqliteRepository):DataSnapshot {
  return repo.atomic(()=>Object.fromEntries(migrationTables.map(table=>[table,repo.db.prepare(`SELECT * FROM ${table}`).all() as Record<string,unknown>[]])));
}
export async function applyPostgresMigrations(sql:Sql) {
  const filename='20261101224532_iriva_postgres.sql';
  const source=readFileSync(path.join(process.cwd(),'supabase/migrations',filename),'utf8');
  const checksum=createHash('sha256').update(source).digest('hex');
  await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(735814290)`;
    await tx`CREATE SCHEMA IF NOT EXISTS iriva`;
    await tx`REVOKE ALL ON SCHEMA iriva FROM PUBLIC`;
    await tx`CREATE TABLE IF NOT EXISTS iriva._migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    const [existing]=await tx`SELECT checksum FROM iriva._migrations WHERE name=${filename}`;
    if(existing){
      if(existing.checksum!==checksum) throw new Error('Applied migration checksum differs; create a new migration instead.');
      return;
    }
    await tx.unsafe(source);
    await tx`INSERT INTO iriva._migrations (name,checksum) VALUES (${filename},${checksum})`;
    await tx`CREATE TABLE iriva._imports (fingerprint text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now())`;
  });
}
export async function verifyPostgresSnapshot(sql:Sql,snapshot:DataSnapshot) {
  const counts:Record<string,number>={};
  await sql.begin('isolation level repeatable read read only',async tx=>{
    for(const table of migrationTables){
      const rows=await tx.unsafe(`SELECT * FROM iriva.${table}`);
      if(JSON.stringify(canonical(rows,table))!==JSON.stringify(canonical(snapshot[table],table))) throw new Error(`Data verification failed: ${table}`);
      counts[table]=rows.length;
    }
  });
  return counts;
}
export async function importPostgresSnapshot(sql:Sql,snapshot:DataSnapshot) {
  const fingerprint=createHash('sha256').update(JSON.stringify(migrationTables.map(table=>[table,canonical(snapshot[table],table)]))).digest('hex');
  await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(735814290)`;
    if((await tx`SELECT fingerprint FROM iriva._imports WHERE fingerprint=${fingerprint}`).length) return;
    for(const table of migrationTables){
      if((await tx.unsafe(`SELECT 1 FROM iriva.${table} LIMIT 1`)).length) throw new Error(`Refusing to overwrite nonempty destination: ${table}`);
    }
    await tx`SET CONSTRAINTS ALL DEFERRED`;
    for(const table of migrationTables){
      for(const row of snapshot[table]){
        const columns=Object.keys(row);
        if(columns.some(c=>!/^\w+$/.test(c)))throw new Error('Invalid source column');
        await tx.unsafe(`INSERT INTO iriva.${table} (${columns.join(',')}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(',')})`,columns.map(key=>jsonColumns.has(key)?tx.json(JSON.parse(String(row[key]))):row[key]) as never[]);
      }
      const persisted=await tx.unsafe(`SELECT * FROM iriva.${table}`);
      if(JSON.stringify(canonical(persisted,table))!==JSON.stringify(canonical(snapshot[table],table))) throw new Error(`Import verification failed: ${table}`);
    }
    await tx`INSERT INTO iriva._imports (fingerprint) VALUES (${fingerprint})`;
  });
  return verifyPostgresSnapshot(sql,snapshot);
}
