import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRecording,saveRecording} from '../server/services/application-recordings';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {seedDemo,seedId} from '../server/db/seed';
const recording={data:Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(20)]).toString('base64'),type:'audio/webm',duration:30};
test('recordings reject forged MIME, oversized data, invalid base64 and invalid durations',()=>{
 assert.deepEqual(parseRecording(recording),recording);
 for(const value of [null,{}, {...recording,type:'text/html'}, {...recording,type:'audio/mp4'}, {...recording,data:'not an audio file'}, {...recording,duration:121}, {...recording,duration:0}, {...recording,duration:1.5}, {...recording,data:'a'.repeat(3_000_000)}])assert.equal(parseRecording(value),null);
});
test('replacement clears assessment, rolls back with application, and cascades on deletion',async t=>{
 const sqlite=new SqliteRepository(':memory:');seedDemo(sqlite);const repo=asyncSqliteRepository(sqlite);t.after(()=>repo.db.close());
 await repo.db.prepare("INSERT INTO member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,created) VALUES ('recording-test',?,'a@example.test','A','learner','English','Speak','beginner','+08:00','Weekends','Books','','now')").run(seedId(1));
 await repo.transaction(()=>saveRecording(repo,'recording-test',recording,'first'));
 await repo.db.prepare("UPDATE member_applications SET oral_score=80,oral_level='intermediate',oral_notes='Good',oral_reviewer='Reviewer',oral_reviewed_at='today' WHERE id='recording-test'").run();
 await assert.rejects(repo.transaction(async()=>{await saveRecording(repo,'recording-test',{...recording,duration:50},'failed');throw new Error('rollback')}));
 assert.equal((await repo.db.prepare("SELECT oral_score FROM member_applications WHERE id='recording-test'").get()).oral_score,80);
 await repo.transaction(()=>saveRecording(repo,'recording-test',{...recording,duration:50},'second'));
 assert.deepEqual(await repo.db.prepare("SELECT recording_updated,oral_score,oral_level,oral_notes,oral_reviewer,oral_reviewed_at FROM member_applications WHERE id='recording-test'").get(),{recording_updated:'second',oral_score:null,oral_level:'',oral_notes:'',oral_reviewer:'',oral_reviewed_at:''});
 assert.equal((await repo.db.prepare("SELECT duration FROM application_recordings WHERE application_id='recording-test'").get()).duration,50);
 await repo.db.prepare("DELETE FROM member_applications WHERE id='recording-test'").run();
 assert.equal(await repo.db.prepare("SELECT 1 FROM application_recordings").get(),undefined);
});
