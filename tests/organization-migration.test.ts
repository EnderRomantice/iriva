import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {defaultOrganizationId} from '../domain/workspace';
test('populated v22 database preserves business data and assigns explicit admin as owner before legacy ops',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'iriva-org-migration-')),file=path.join(dir,'old.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const db=new Database(file);db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');
 for(const name of readdirSync('server/db/migrations').filter(n=>Number(n.slice(0,3))<=22).sort()){db.exec(readFileSync(path.join('server/db/migrations',name),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(Number(name.slice(0,3)),new Date().toISOString());}
 for(const id of ['a-ops','z-admin','partner','learner']){db.prepare('INSERT INTO users (id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (?,?,?,\'UTC\',\'\',1,?,?)').run(id,id,id+'@example.test','2026-01-01','2026-01-01');db.prepare('INSERT INTO auth_sessions VALUES (?,?,?)').run(id,id,Date.now()+100000);}
 db.prepare("INSERT INTO organization_memberships VALUES ('ops',?,?,'ops',1,?,?)").run(defaultOrganizationId,'a-ops','2026-01-01','2026-01-01');
 db.prepare("INSERT INTO team_members VALUES ('z-admin@example.test','Admin','admin'),('partner@example.test','Partner','staff')").run();db.close();
 const repo=new SqliteRepository(file);t.after(()=>repo.db.close());
 assert.equal((repo.db.prepare('SELECT role FROM organization_access WHERE organization_id=? AND user_id=?').get(defaultOrganizationId,'z-admin') as {role:string}).role,'owner');
 assert.equal((repo.db.prepare('SELECT role FROM organization_access WHERE organization_id=? AND user_id=?').get(defaultOrganizationId,'partner') as {role:string}).role,'partner');
 assert.equal((repo.db.prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n,4);
 assert.equal((repo.db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get() as {n:number}).n,1);
 assert.equal((repo.db.prepare('SELECT user_id FROM auth_sessions').get() as {user_id:string}).user_id,'learner');
 assert.equal((repo.db.pragma('foreign_key_check') as unknown[]).length,0);
});
