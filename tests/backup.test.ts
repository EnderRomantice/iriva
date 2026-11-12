import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { seedDemo, seedId } from '../server/db/seed';

test('portable backups preserve receipt fingerprints and can restore legacy v12 receipts',t=>{
  const dir=mkdtempSync(join(tmpdir(),'iriva-backup-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const source=join(dir,'source.sqlite'),file=join(dir,'export.json');
  const repo=new SqliteRepository(source);seedDemo(repo);repo.acknowledge(seedId(1),'receipt-test',2,'payload-fingerprint');repo.db.close();
  const run=(args:string[])=>{const result=spawnSync(process.execPath,['--import','tsx',...args],{encoding:'utf8',env:{...process.env,SQLITE_PATH:source}});assert.equal(result.status,0,result.stderr);};
  run(['scripts/export-data.ts',file]);
  const backup=JSON.parse(readFileSync(file,'utf8'));assert.equal(backup.schemaVersion,13);
  const destination=join(dir,'restored.sqlite');run(['scripts/import-data.ts',file,destination]);
  const restored=new SqliteRepository(destination);
  assert.deepEqual(restored.receipt(seedId(1),'receipt-test'),{version:2,fingerprint:'payload-fingerprint'});restored.db.close();
  backup.schemaVersion=12;for(const receipt of backup.mutationReceipts)delete receipt.fingerprint;
  writeFileSync(file,JSON.stringify(backup));
  const legacy=join(dir,'legacy.sqlite');run(['scripts/import-data.ts',file,legacy]);
  const old=new SqliteRepository(legacy);assert.deepEqual(old.receipt(seedId(1),'receipt-test'),{version:2,fingerprint:null});
  old.db.prepare('INSERT INTO mutation_receipts VALUES (?,?,?,?)').run(seedId(1),'old-app-command',1,new Date().toISOString());
  assert.deepEqual(old.receipt(seedId(1),'old-app-command'),{version:1,fingerprint:null});old.db.close();
});
