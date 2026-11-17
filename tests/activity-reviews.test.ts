import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { asyncSqliteRepository } from '../server/repositories/async-sqlite-repository';
import { PostgresRepository } from '../server/repositories/postgres-repository';
import { ActivityReviews } from '../server/services/activity-reviews';
import type { DatabaseRepository } from '../server/repositories/database-repository';
import { seedDemo } from '../server/db/seed';

import { reviewFixture } from './helpers/review-fixture';

for(const backend of ['sqlite','postgres'] as const)test(`${backend}: activity review permissions, publication, notifications, concurrency and metrics`,{skip:backend==='postgres'&&process.env.PG_LOCAL_TEST!=='1'},async t=>{
 let repo:DatabaseRepository;
 if(backend==='postgres')repo=new PostgresRepository(process.env.DATABASE_URL!);else{const source=new SqliteRepository(':memory:');seedDemo(source);repo=asyncSqliteRepository(source);}
 t.after(()=>repo.db.close());const ids=await reviewFixture(repo),service=new ActivityReviews(repo);
 const learner={userId:ids.learner,team:false},host={userId:ids.host,team:false},team={userId:ids.team,team:true},outsider={userId:ids.outsider,team:false};
 const pair={session:ids.session,learner:ids.learner};
 const reflection={...pair,action:'reflect',moment:'今天还没有',support:'Host 的提问',comfort:2,goal:'主动追问一次',expression:'',consent:true};
 const observation={...pair,action:'observe',attendance:'present',moment:'认真听完伙伴的故事',invitation:'请他分享一个工作中的例子',status:'draft',version:0};
 const card={...pair,action:'card',noticed:'你为伙伴留出了讲故事的时间。',expression:'',next_step:'下次试着追问一个小细节。',status:'published',version:0};
 assert.equal((await service.list(outsider)).total,0);
 assert.equal((await service.list(learner)).records.some(r=>r.session_id===ids.privateSession),false);
 await assert.rejects(service.write(learner,{...reflection,session:ids.future}),{status:403});
 await assert.rejects(service.write(outsider,reflection),{status:403});
 await assert.rejects(service.write(host,reflection),{status:403});
 await assert.rejects(service.write(learner,{...reflection,comfort:6}),{status:400});
 await assert.rejects(service.write(learner,{...reflection,consent:false}),{status:400});
 await service.write(learner,reflection);
 await assert.rejects(service.write(learner,reflection),{status:409});
 await service.write(host,observation);
 assert.equal((await service.list(team,{learner:ids.learner})).records[0].observation,null);
 assert.equal((await service.list(host,{learner:ids.learner})).records[0].reflection,null);
 await assert.rejects(service.write(team,card),{status:409});
 await assert.rejects(service.write(host,{...observation,version:0}),{status:409});
 await service.write(host,{...observation,version:1,status:'submitted'});
 assert.equal((await service.list(learner)).records[0].observation,null);
 await service.write(team,{...card,status:'draft'});
 assert.equal((await service.list(learner)).records[0].card,null);
 await assert.rejects(service.write(host,{...card,version:1}),{status:403});
 const results=await Promise.allSettled([service.write(team,{...card,version:1}),service.write(team,{...card,version:1})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const notices=await repo.db.prepare("SELECT * FROM notifications WHERE user_id=? AND session=? AND kind='review'").all(ids.learner,ids.session);assert.equal(notices.length,1);
 assert.equal((await service.list(learner)).records[0].card?.noticed,card.noticed);
 assert.equal((await service.list(learner)).latestGoal?.goal,reflection.goal);
 assert.equal((await service.list(learner)).latestGoal?.next_step,card.next_step);
 await assert.rejects(service.write(outsider,{...pair,action:'respond',usefulness:'yes',return_intent:'yes'}),{status:403});
 await service.write(learner,{...pair,action:'respond',usefulness:'yes',return_intent:'yes'});
 const report=await service.list(team,{learner:ids.learner});assert.deepEqual(report.stats,{eligible:1,reflections:1,published:1,present:1,helpful:1,responses:1});
 assert.equal((await service.list(team,{learner:ids.learner,status:'pending'})).total,0);
 assert.equal((await service.list(team,{learner:ids.learner,status:'published'})).total,1);
 assert.equal((await service.list(team,{learner:ids.learner,page:1})).records.length,0);
 const publishedBefore=await repo.db.prepare('SELECT * FROM activity_cards WHERE session_id=? AND learner_id=?').get(...Object.values(pair));
 await assert.rejects(service.write(team,{...card,version:2,noticed:'overwrite'}),{status:409});
 assert.deepEqual(await repo.db.prepare('SELECT * FROM activity_cards WHERE session_id=? AND learner_id=?').get(...Object.values(pair)),publishedBefore);
 // Joining after an activity does not expose old participant records.
 await repo.db.prepare('UPDATE memberships SET created_at=? WHERE user_id=?').run('2026-03-01T00:00:00.000Z',ids.learner);
 assert.equal((await service.list(learner)).total,0);
});
