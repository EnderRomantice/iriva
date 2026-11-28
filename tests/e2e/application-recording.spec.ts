import {seedPaidApplication} from './payment-helpers';
import {test,expect,type BrowserContext} from '@playwright/test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {seedId} from '../../server/db/seed';
import {defaultOrganizationId} from '../../domain/workspace';

test('record, submit, privately play, review and replace an English speaking sample',async({browser})=>{
 if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Use disposable PostgreSQL harness.');
 const db=postgres(process.env.DATABASE_URL,{max:1,ssl:false}),contexts:BrowserContext[]=[];
 const origin='http://127.0.0.1:3117',headers={origin},now=new Date().toISOString();
 async function session(team=false){
  const id=team?seedId(6):randomUUID(),token=randomBytes(32).toString('hex');
  if(!team)await db`INSERT INTO iriva.users(id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (${id},'Recording learner',${id+'@example.test'},'UTC','',1,${now},${now})`;
  await db`INSERT INTO iriva.auth_sessions(token_hash,user_id,expires_at,auth_method) VALUES (${createHash('sha256').update(token).digest('hex')},${id},${Date.now()+3600000},${team?'password':'email'})`;
  const context=await browser.newContext({permissions:['microphone']});contexts.push(context);await context.addCookies([{name:'iriva_session',value:token,url:origin},{name:'iriva_locale',value:'zh',url:origin}]);return context;
 }
 try{
  const learner=await session(),team=await session(true),other=await session(),page=await learner.newPage();
  // A real MediaRecorder encodes a generated audio stream; no machine microphone is needed.
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{const audio=new AudioContext(),source=audio.createOscillator(),destination=audio.createMediaStreamDestination();source.connect(destination);source.start();return destination.stream}});
  await page.goto('/apply');
  await page.getByLabel('想学习哪种语言？').selectOption('English');
  await page.getByLabel('怎么称呼你？',{exact:true}).fill('Recording learner');
  await page.getByRole('combobox',{name:/^年龄段/}).selectOption('25-34');
  await page.getByRole('combobox',{name:/^学习或工作阶段/}).selectOption('working');
  await page.getByLabel('所在国家或地区',{exact:true}).fill('Shanghai');
  await page.getByLabel('最希望改善哪一种交流？',{exact:true}).fill('Speak with friends');
  await page.getByLabel('日常生活',{exact:true}).check();
  await page.getByRole('button',{name:'下一步'}).click();
  await expect(page.getByText('Please introduce yourself in English.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'开始录音',exact:true}).click();
  await expect(page.getByRole('button',{name:'下一步'})).toBeDisabled();
  await expect(page.getByRole('button',{name:/停止录音 · [1-9]/})).toBeVisible();
  await page.getByRole('button',{name:/停止录音/}).click();
  await expect(page.getByLabel('试听口语录音')).toBeVisible();
  await page.getByLabel('目前的口语状态').selectOption('intermediate');
  await page.getByRole('button',{name:'＋ 添加可参加时段'}).click();
  await page.getByRole('combobox',{name:/^星期/}).selectOption('6');
  await page.getByRole('combobox',{name:/^从/}).selectOption('10:00');
  await page.getByRole('combobox',{name:/^到/}).selectOption('12:00');
  await page.getByLabel('微信号（必填）').fill('recording_test');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/oral-recorder-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'下一步'}).click();
  await page.getByLabel('我同意青鸟团队使用这些资料',{exact:false}).check();
  await page.getByRole('button',{name:'提交加入资料'}).click();
  await expect(page.getByRole('heading',{name:'资料已保存，请选择套餐并付款。'})).toBeVisible();
  const own=(await (await learner.request.get('/api/apply')).json()).application,id=own.id;
  await seedPaidApplication(db,id);
  await db`UPDATE iriva.member_applications SET status='pending' WHERE id=${id}`;
  expect(own.recording_updated).toBeTruthy();expect(own).not.toHaveProperty('oral_score');
  const audio=await learner.request.get(`/api/apply/recording?id=${id}`);expect(audio.status()).toBe(200);expect(audio.headers()['content-type']).toBe('audio/webm');
  expect((await learner.request.get(`/api/apply/recording?id=${id}`,{headers:{Range:'bytes=0-9'}})).status()).toBe(206);
  expect((await other.request.get(`/api/apply/recording?id=${id}`)).status()).toBe(404);
  const staffPage=await team.newPage();await staffPage.goto('/team');
  await staffPage.getByRole('button',{name:'申请与筛选',exact:true}).click();
  await staffPage.getByLabel('录音评估状态').selectOption('pending');
  await staffPage.locator('article').filter({has:staffPage.getByRole('heading',{name:'Recording learner',exact:true})}).getByRole('button',{name:'查看与跟进 ↗'}).click();
  const player=staffPage.getByLabel('申请人口语录音');await expect(player).toBeVisible();
  await player.evaluate(async(el:HTMLAudioElement)=>{await el.play();el.pause()});
  await staffPage.getByLabel('口语评分（0–100）').fill('82');
  await staffPage.getByLabel('口语跟进记录').fill('表达清晰，建议继续练习流利度。');
  await staffPage.getByLabel('跟进确认的口语水平').selectOption('intermediate');
  await staffPage.screenshot({path:'test-results/oral-review.png',fullPage:true});
  await staffPage.getByRole('button',{name:'保存跟进记录',exact:true}).click();
  await expect(staffPage.getByRole('dialog')).toHaveCount(0);
  let [row]=await db`SELECT * FROM iriva.member_applications WHERE id=${id}`;expect(row.oral_score).toBe(82);expect(row.oral_reviewer).toBeTruthy();
  const review={action:'review',id,revision:Number(row.revision),status:'new',oral_score:101};
  expect((await team.request.post('/api/team',{headers,data:review})).status()).toBe(400);
  expect((await team.request.post('/api/team',{headers,data:{...review,revision:0,oral_score:70}})).status()).toBe(409);
  const [stored]=await db`SELECT * FROM iriva.application_recordings WHERE application_id=${id}`;
  const profile={...own,name:'Recording learner',revision:Number(row.revision),consent:true,availability_slots:[{day:6,start:'10:00',end:'12:00'}],recording:{data:stored.data_base64,type:stored.mime_type,duration:stored.duration}};
  expect((await learner.request.patch('/api/apply',{headers,data:profile})).status()).toBe(200);
  [row]=await db`SELECT * FROM iriva.member_applications WHERE id=${id}`;expect(row.oral_score).toBeNull();expect(row.oral_notes).toBe('');expect(row.oral_level).toBe('');
  // Organization scope must still be enforced for a valid password-authenticated admin.
  const foreign=randomUUID();
  await db`INSERT INTO iriva.organizations(id,name,initials,color,version,created_at,updated_at) VALUES (${foreign},'Other','O','blue',1,${now},${now})`;
  await db`UPDATE iriva.member_applications SET organization_id=${foreign} WHERE id=${id}`;
  expect((await team.request.get(`/api/apply/recording?id=${id}&org=${defaultOrganizationId}`)).status()).toBe(404);
  // No recording or review fields are leaked through the learner-facing application response.
  const final=(await (await learner.request.get('/api/apply')).json()).application;expect(final).not.toHaveProperty('oral_notes');
 }finally{await Promise.all(contexts.map(c=>c.close()));await db.end()}
});
