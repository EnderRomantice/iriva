import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessAudio,assessmentRecording} from '../server/services/oral-assessment';
import {saveRecording} from '../server/services/application-recordings';
import {applicationPaymentStatusSql} from '../server/services/application-payments';
import {SqliteRepository} from '../server/repositories/sqlite-repository';
import {asyncSqliteRepository} from '../server/repositories/async-sqlite-repository';
import {seedDemo,seedId} from '../server/db/seed';
import {defaultOrganizationId} from '../domain/workspace';

test('audio is sent to model; invalid, truncated, silent and failed results never fabricate grades',async t=>{
 const old=process.env.OPENROUTER_API_KEY;process.env.OPENROUTER_API_KEY='test';t.after(()=>{if(old===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=old});
 const recording={data_base64:'synthetic-test-audio',mime_type:'audio/webm',language:'English'};
 const dimension={grade:'B',evidence:'I enjoy reading.',reasoning:'能用完整句子表达日常兴趣。'};
 const result={transcript:'I enjoy reading.',grade:'B',dimensions:{pronunciation:dimension,fluency:dimension,vocabulary:dimension,grammar:dimension},rationale:'表达可理解，各维度支持日常交流等级，但句式变化有限。',nextGrade:'练习解释原因并使用更丰富的连接词。',limitations:'短录音不能证明复杂情境的表达能力。'};
 const response=(value:unknown,status='stop')=>new Response(JSON.stringify({choices:[{finish_reason:status,message:{content:JSON.stringify(value)}}]}));
 const request:typeof fetch=async(url,options)=>{assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');const body=JSON.parse(String(options?.body));assert.equal(body.messages[1].content[1].input_audio.data,recording.data_base64);assert.equal(body.messages[1].content[1].input_audio.format,'webm');return response(result)};
 const assessed=await assessAudio(recording,request);
 assert.equal(assessed.grade,'B');assert.equal(assessed.transcript,result.transcript);
 for(const label of ['发音清晰度','流利度与连贯性','词汇丰富度与准确性','语法与句式控制','综合评级理由','更高等级还需要什么','评估局限',result.rationale,result.nextGrade])assert.ok(assessed.notes.includes(label));
 assert.equal((await assessAudio(recording,async()=>response({...result,grade:null,transcript:'[无可辨认语音]'}))).grade,null);
 for(const value of [{...result,grade:'S'},{...result,transcript:''},{...result,rationale:''},{...result,dimensions:{...result.dimensions,grammar:{...dimension,grade:null}}},{...result,dimensions:{pronunciation:dimension}}])await assert.rejects(assessAudio(recording,async()=>response(value)));
 await assert.rejects(assessAudio(recording,async()=>response(result,'incomplete')));
 await assert.rejects(assessAudio(recording,async()=>new Response('upstream secret',{status:500})),/AI 语音服务暂不可用/);
 await assert.rejects(assessAudio(recording,async()=>{throw Error('network')}),/连接失败/);
});

test('unpaid applicants are visible; AI requires same organization and current revision without a separate opt-in; replacing recording clears grade',async t=>{
 const sqlite=new SqliteRepository(':memory:');seedDemo(sqlite);const repo=asyncSqliteRepository(sqlite);t.after(()=>repo.db.close());
 await repo.db.prepare("INSERT INTO member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,created,organization_id) VALUES ('oral',?,'oral@example.test','Oral','learner','English','Speak','beginner','+08:00','Weekends','Books','','now',?)").run(seedId(1),defaultOrganizationId);
 const rows=await repo.db.prepare(`SELECT a.id,${applicationPaymentStatusSql} AS payment_status FROM member_applications a WHERE organization_id=?`).all(defaultOrganizationId);
 assert.deepEqual(rows,[{id:'oral',payment_status:'unpaid'}]);
 await saveRecording(repo,'oral',{data:'dGVzdA==',type:'audio/webm',duration:20},'first');
 assert.equal((await assessmentRecording(repo,defaultOrganizationId,'oral',0)).language,'English');
 await repo.db.prepare("UPDATE member_applications SET oral_grade='A+',oral_transcript='Old transcript',oral_ai_evaluation='Old evaluation' WHERE id='oral'").run();
 assert.equal((await assessmentRecording(repo,defaultOrganizationId,'oral',0)).language,'English');
 await assert.rejects(assessmentRecording(repo,'other','oral',0),/找不到/);
 await assert.rejects(assessmentRecording(repo,defaultOrganizationId,'oral',1),/资料已更新/);
 await saveRecording(repo,'oral',{data:'dGVzdA==',type:'audio/webm',duration:20},'second');
 assert.deepEqual(await repo.db.prepare("SELECT oral_grade,oral_transcript,oral_ai_evaluation FROM member_applications WHERE id='oral'").get(),{oral_grade:'',oral_transcript:'',oral_ai_evaluation:''});
});
