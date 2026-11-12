import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedId } from '../../server/db/seed';

async function fixture(browser:Browser) {
  if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Run npm run test:e2e with the disposable PostgreSQL harness.');
  const db=postgres(process.env.DATABASE_URL,{max:1,ssl:false,prepare:false});
  const contexts:BrowserContext[]=[];
  const [group]=await db`SELECT h.id,h.organization_id FROM iriva.households h JOIN iriva.memberships m ON m.household_id=h.id WHERE h.host_id=${seedId(5)} AND m.user_id=${seedId(1)} LIMIT 1`;
  const org=String(group.organization_id);
  async function session(userId:string) {
    const token=randomBytes(32).toString('hex');
    await db`INSERT INTO iriva.auth_sessions VALUES (${createHash('sha256').update(token).digest('hex')},${userId},${Date.now()+3600000})`;
    const context=await browser.newContext({baseURL:"http://127.0.0.1:3117"});contexts.push(context);
    await context.addCookies([{name:'iriva_session',value:token,url:'http://127.0.0.1:3117',httpOnly:true,sameSite:'Lax'}]);
    return context;
  }
  const learn=await session(seedId(1)),host=await session(seedId(5)),ops=await session(seedId(6));
  const headers={'x-workspace-id':org,'origin':'http://127.0.0.1:3117'};
  return {db,group,org,learn,host,ops,headers,close:async()=>{await Promise.all(contexts.map(c=>c.close()));await db.end();}};
}

test('three roles: Host task → learner submission → Host feedback → learner and ops see persisted results',async({browser})=>{
  const f=await fixture(browser);
  try {
    const assignmentId=randomUUID(),title=`Release exercise ${assignmentId.slice(0,8)}`;
    const created=await f.host.request.post('/api/mutations',{headers:f.headers,data:{id:randomUUID(),entityId:assignmentId,baseVersion:0,kind:'assignment.create',payload:{householdId:f.group.id,title,description:'Write one sentence.',category:'practice',week:1,dueAt:'2030-12-01T00:00:00.000Z'}}});
    expect(created.status()).toBe(200);
    const learner=await f.learn.newPage(),host=await f.host.newPage(),ops=await f.ops.newPage();
    const errors:string[]=[];for(const p of [learner,host,ops])p.on('pageerror',e=>errors.push(e.message));
    await learner.goto(`/learn?org=${f.org}&view=tasks`);
    await learner.getByRole('button',{name:new RegExp(title)}).click();
    await learner.locator('.sp-practice textarea').fill('My release test practice.');
    await learner.getByRole('button',{name:'提交练习',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect.poll(async()=>Number((await f.db`SELECT count(*) AS n FROM iriva.submissions WHERE assignment_id=${assignmentId} AND status='submitted'`)[0].n)).toBe(1);
    await host.goto(`/host?org=${f.org}&view=tasks`);
    await host.getByRole('button',{name:'学员反馈',exact:true}).click();
    await host.getByRole('button',{name:new RegExp(title)}).click();
    await host.locator('.sp-practice textarea').fill('Your release feedback is published.');
    await host.getByRole('button',{name:'发布反馈',exact:true}).click();
    await expect.poll(async()=>Number((await f.db`SELECT count(*) AS n FROM iriva.feedback f JOIN iriva.submissions s ON f.submission_id=s.id WHERE s.assignment_id=${assignmentId} AND f.status='published'`)[0].n)).toBe(1);
    const snapshot=await (await f.learn.request.get('/api/workspace',{headers:f.headers})).json();
    expect(snapshot.feedback.some((v:{body:string})=>v.body==='Your release feedback is published.')).toBe(true);
    await ops.goto(`/ops?org=${f.org}&view=household`);
    await expect(ops.locator('.sp-app')).toBeVisible();
    const overview=await (await f.ops.request.get('/api/workspace',{headers:f.headers})).json();
    expect(overview.assignments.some((v:{id:string})=>v.id===assignmentId)).toBe(true);
    expect(errors).toEqual([]);
  } finally {await f.close();}
});

test('offline chat survives reload and rapid duplicate submit sends one message',async({browser})=>{
  const f=await fixture(browser);
  try {
    const id=randomUUID(),body=`Offline release ${id}`;
    expect((await f.host.request.post('/api/mutations',{headers:f.headers,data:{id:randomUUID(),entityId:id,baseVersion:0,kind:'channel.create',payload:{name:`release-${id.slice(0,8)}`,description:'',kind:'public'}}})).status()).toBe(200);
    const page=await f.learn.newPage();
    await page.goto(`/learn?org=${f.org}&view=channels&channel=${id}`);
    const input=page.locator('.sp-chat-composer textarea');
    await expect(input).toBeEnabled();
    await page.evaluate(()=>{localStorage.setItem('iriva-network','offline');window.dispatchEvent(new Event('iriva-network'));});
    await input.fill(body);
    await page.getByRole('button',{name:'发送消息',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect(input).toHaveValue('');
    await page.reload();
    await expect(page.getByText(body,{exact:true})).toBeVisible();
    await page.evaluate(()=>{localStorage.setItem('iriva-network','online');window.dispatchEvent(new Event('iriva-network'));});
    await expect.poll(async()=>Number((await f.db`SELECT count(*) AS n FROM iriva.messages WHERE channel_id=${id} AND body=${body}`)[0].n)).toBe(1);
    await page.reload();
    await expect(page.getByText(body,{exact:true})).toHaveCount(1);
  } finally {await f.close();}
});

test('production rejects demo identity, cross-account queue and learner management writes',async({browser,request})=>{
  const f=await fixture(browser);
  try {
    expect((await request.get('/api/workspace',{headers:{'x-demo-role':'ops'}})).status()).toBe(401);
    expect((await f.learn.request.get('/api/workspace',{headers:{...f.headers,'x-account-id':seedId(5)}})).status()).toBe(401);
    expect((await f.learn.request.post('/api/account',{headers:f.headers,data:{action:'host.add',email:'forged@example.test'}})).status()).toBe(403);
  } finally {await f.close();}
});

test('Host rapid booking confirmation is locked and audited once; stale reversal is rejected',async({browser})=>{
  const f=await fixture(browser);
  try {
    const id=randomUUID(),channelId=randomUUID();
    const conversation=await f.host.request.post('/api/mutations',{headers:f.headers,data:{id:randomUUID(),entityId:channelId,baseVersion:0,kind:'conversation.open',payload:{userId:seedId(1)}}});
    expect(conversation.status()).toBe(200);
    const direct=(await conversation.json()).entityId;
    await f.db`INSERT INTO iriva.bookings VALUES (${id},${seedId(1001)},${seedId(1)},${seedId(5)},${direct},'pending',${new Date().toISOString()})`;
    const page=await f.host.newPage();
    await page.goto(`/host?org=${f.org}&view=applications&tab=bookings`);
    const confirm=page.getByRole('button',{name:'已确定加入',exact:true});
    await confirm.evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect(confirm).toBeDisabled();
    await expect(page.getByText('约谈结论已保存。',{exact:true})).toBeVisible();
    expect(Number((await f.db`SELECT count(*) AS n FROM iriva.audit_events WHERE entity_id=${id} AND kind='booking.accepted'`)[0].n)).toBe(1);
    expect((await f.host.request.post('/api/account',{headers:f.headers,data:{action:'booking',id,status:'rejected',expectedStatus:'pending'}})).status()).toBe(409);
    expect((await f.db`SELECT status FROM iriva.bookings WHERE id=${id}`)[0].status).toBe('accepted');
  } finally {await f.close();}
});

for (const role of ['learn', 'host', 'ops']) {
 test(`signed-out ${role} opens the email login flow`, async ({page}) => {
  await page.goto(`/${role}`);
  await expect(page).toHaveURL(/\/apply$/);
  await expect(page.getByRole('heading', {name:'登录或注册'})).toBeVisible();
  await expect(page.getByRole('textbox', {name:'邮箱', exact:true})).toBeVisible();
 });
}

test('chat pages older history, searches beyond the first page, and idle sync returns 304',async({browser})=>{
 const f=await fixture(browser);
 try{
  const channel=randomUUID();
  expect((await f.host.request.post('/api/mutations',{headers:f.headers,data:{id:randomUUID(),entityId:channel,baseVersion:0,kind:'channel.create',payload:{name:'History acceptance',description:'',kind:'public'}}})).status()).toBe(200);
  await f.db`INSERT INTO iriva.messages (id,channel_id,author_id,body,version,created_at,updated_at) SELECT md5(${channel}||i::text),${channel},${seedId(5)},CASE WHEN i=1 THEN 'Archive needle only' ELSE 'Historical message '||i END,1,to_char('2025-01-01'::timestamp+i*interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),to_char('2025-01-01'::timestamp+i*interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM generate_series(1,125) i`;
  const page=await f.learn.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/learn?org=${f.org}&view=channels&channel=${channel}`);
  await expect(page.getByRole('button',{name:'加载更早消息',exact:true})).toBeVisible();
  await expect(page.getByText('Archive needle only',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'加载更早消息',exact:true}).click();
  await expect(page.locator('.sp-chat-message')).toHaveCount(100);
  const search=page.getByRole('textbox',{name:'搜索消息或频道',exact:true});
  await search.fill('Archive needle');
  await expect(page.getByText('Archive needle only',{exact:true})).toBeVisible();
  const first=await f.learn.request.get('/api/workspace',{headers:f.headers});
  expect(first.status()).toBe(200);
  const unchanged=await f.learn.request.get('/api/workspace',{headers:{...f.headers,'If-None-Match':first.headers().etag}});
  expect(unchanged.status()).toBe(304);expect((await unchanged.body()).length).toBe(0);
  await page.screenshot({path:'test-results/history-search.png',fullPage:true});
  expect(errors).toEqual([]);
 }finally{await f.close();}
});

test('profile avatars are stored separately, returned as URLs and served with authenticated caching',async({browser,request})=>{
 const f=await fixture(browser);
 try{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5R8AAAAASUVORK5CYII=';
  const saved=await f.learn.request.post('/api/account',{headers:f.headers,data:{action:'profile',profile:{name:'Avatar acceptance',signature:'Learning together',avatar:image,mbti:'INTJ',timezone:'Asia/Shanghai',city:'上海',zodiac:'',birthChart:'',occupation:''}}});expect(saved.status()).toBe(200);
  const account=await (await f.learn.request.get('/api/account',{headers:f.headers})).json();
  expect(account.user.avatar).toMatch(/^\/api\/avatars\//);expect(JSON.stringify(account)).not.toContain('base64');
  expect((await f.db`SELECT avatar FROM iriva.users WHERE id=${seedId(1)}`)[0].avatar).toBe('avatar:stored');
  const first=await f.learn.request.get(account.user.avatar);expect(first.status()).toBe(200);expect(first.headers()['content-type']).toBe('image/png');
  expect((await first.body()).equals(Buffer.from(image.split(',')[1],'base64'))).toBe(true);
  expect((await f.learn.request.get(account.user.avatar,{headers:{'if-none-match':first.headers().etag}})).status()).toBe(304);
  expect((await request.get(account.user.avatar)).status()).toBe(401);
  const again=await f.learn.request.post('/api/account',{headers:f.headers,data:{action:'profile',profile:{name:account.user.name,signature:'Edited without upload',avatar:account.user.avatar,mbti:'INTJ',timezone:'Asia/Shanghai',city:'上海',zodiac:'',birthChart:'',occupation:''}}});expect(again.status()).toBe(200);
 }finally{await f.close();}
});
