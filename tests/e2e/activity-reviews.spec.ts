import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {createHash,randomUUID} from 'node:crypto';
import {PostgresRepository} from '../../server/repositories/postgres-repository';
import {reviewFixture} from '../helpers/review-fixture';

test('activity review: learner → Host → team publication → notification → next preparation',async({browser},testInfo)=>{
 if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Use npm run test:reviews with the disposable PostgreSQL harness.');
 const repo=new PostgresRepository(process.env.DATABASE_URL);
 const ids=await reviewFixture(repo);
 await repo.db.prepare("INSERT INTO organization_access VALUES ('10000000-0000-4000-8000-000000001001',?,'admin',?)").run(ids.team,new Date().toISOString());
const errors:string[]=[];const pages:Record<string,Page>={};const contexts:BrowserContext[]=[];
try{
for(const role of ['learner','host','team','outsider']){const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);const token=randomUUID();await repo.db.prepare("INSERT INTO auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (?,?,?,'password')").run(createHash('sha256').update(token).digest('hex'),ids[role as 'learner'|'host'|'team'|'outsider'],Date.now()+3600000);await context.addCookies([{name:'iriva_session',value:token,domain:'127.0.0.1',path:'/'}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages[role]=page;}
const learner=pages.learner;await learner.goto('http://127.0.0.1:3117/learn');await learner.getByRole('button',{name:'活动复盘',exact:true}).click();
await learner.getByLabel('今天有没有一个时刻').fill('我主动追问了伙伴的故事。');
await learner.getByLabel('今天卡住时').selectOption('Host 的提问');await learner.locator('input[name="comfort"][value="4"]').check();
await learner.getByLabel('我知道这份活动复盘').check();await learner.getByRole('button',{name:'提交活动复盘',exact:true}).click();
await learner.getByText('复盘已交给青鸟团队。',{exact:true}).waitFor();
const host=pages.host;await host.goto('http://127.0.0.1:3117/learn');await host.getByRole('button',{name:'活动观察',exact:true}).click();await host.locator('.review-group').filter({hasText:'A small win'}).locator('button').filter({hasText:'Review learner'}).click();
await host.getByLabel('这次是否出席').selectOption('present');await host.getByLabel('一个具体的参与时刻').fill('主动追问伙伴的决定。');await host.getByLabel('下次可以给他的邀请').fill('分享一个工作中的例子。');await host.getByRole('button',{name:'提交给团队',exact:true}).click();await host.getByText('观察已提交到审核工作区。',{exact:true}).waitFor();
const team=pages.team;await team.goto('http://127.0.0.1:3117/team');await team.locator('.review-group').filter({hasText:'A small win'}).locator('button').filter({hasText:'Review learner'}).click();
await team.getByLabel('今天我注意到').fill('你主动追问了伙伴，让故事继续了下去。');await team.getByLabel('值得留下的表达',{exact:true}).fill('What led you to that decision?');await team.getByLabel('下次可以试试').fill('分享一个你自己遇到类似情况的例子。');
await team.screenshot({path:testInfo.outputPath('team-desktop.png'),fullPage:true});
await team.getByRole('button',{name:'审核并发布',exact:true}).click();await team.getByText('回顾卡已发布，学员将收到站内通知。',{exact:true}).waitFor();
await learner.getByRole('button',{name:'刷新'}).click();await learner.getByRole('button',{name:'相见通知',exact:true}).click();await learner.getByRole('button',{name:'查看活动回顾'}).click();await learner.getByText('这一次，值得记得。',{exact:true}).waitFor();
await learner.getByLabel('你的感受').selectOption('yes');await learner.getByLabel('你愿意参加下一次活动吗').selectOption('yes');await learner.getByRole('button',{name:'告诉青鸟',exact:true}).click();await learner.getByText('已保存。',{exact:true}).waitFor();
await learner.screenshot({path:testInfo.outputPath('learner-desktop.png'),fullPage:true});
await learner.getByRole('button',{name:'AI 准备 · Beta',exact:true}).click();await learner.getByText('你给自己的小目标',{exact:true}).waitFor();await learner.getByText('分享一个你自己遇到类似情况的例子。',{exact:false}).waitFor();
await team.setViewportSize({width:390,height:844});await team.screenshot({path:testInfo.outputPath('team-mobile.png'),fullPage:true});
const overflow=await team.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Mobile horizontal overflow');
const denied=await pages.outsider.request.post('http://127.0.0.1:3117/api/activity-reviews',{data:{session:ids.session,learner:ids.learner,action:'respond',usefulness:'yes',return_intent:'yes'}});if(denied.status()!==403)throw new Error('Outsider write not denied');
if(errors.length)throw new Error(errors.join('\n'));
console.log('PASS: browser learner → Host → team → notification → card response → next preparation, mobile layout, unauthorized write; zero page errors.');

}finally{await Promise.all(contexts.map(c=>c.close()));await repo.db.close();}
});

test('Slack-style group chat: draft recovery, IME, retry deduplication, search and shared visual theme',async({browser},testInfo)=>{
 if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Use the disposable PostgreSQL harness.');
 const repo=new PostgresRepository(process.env.DATABASE_URL),ids=await reviewFixture(repo),contexts:BrowserContext[]=[];
 try{
  async function session(user:string){const token=randomUUID();await repo.db.prepare("INSERT INTO auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (?,?,?,'password')").run(createHash('sha256').update(token).digest('hex'),user,Date.now()+3600000);const c=await browser.newContext({baseURL:'http://127.0.0.1:3117',viewport:{width:1440,height:1000}});contexts.push(c);await c.addCookies([{name:'iriva_session',value:token,domain:'127.0.0.1',path:'/'}]);return c;}
  const context=await session(ids.learner),host=await session(ids.host),outsider=await session(ids.outsider),page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const welcome=await host.request.post('/api/household',{data:{action:'message',body:'欢迎来到小组客厅！这周有什么想分享的小事？'}});if(welcome.status()!==200)throw new Error(await welcome.text());
  await page.goto('/learn');await page.getByRole('button',{name:'小组交流',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'发送到小组客厅'});
  await editor.fill('这是一份还没发出的草稿');await page.getByRole('button',{name:'相见日程',exact:true}).first().click();await page.getByRole('button',{name:'小组交流',exact:true}).click();
  await expect(editor).toHaveValue('这是一份还没发出的草稿');
  await page.reload();await page.getByRole('button',{name:'小组交流',exact:true}).click();await expect(editor).toHaveValue('这是一份还没发出的草稿');
  await editor.fill('我今天主动问了一个问题');await editor.dispatchEvent('compositionstart');await editor.press('Enter');await editor.dispatchEvent('compositionend');
  if(!(await editor.inputValue()).includes('我今天主动问了一个问题'))throw new Error('IME composition unexpectedly sent message');
  await editor.fill('我今天主动问了一个问题');await editor.press('Shift+Enter');await editor.press('Shift+Enter');await editor.fill('我今天主动问了一个问题\n虽然有点紧张，但是很开心。');
  await page.getByRole('button',{name:'插入表情',exact:true}).click();await page.getByRole('button',{name:'插入 🌱',exact:true}).click();
  let drop=true;await page.route('**/api/household',async route=>{if(route.request().method()==='POST'&&drop){drop=false;await route.fetch();await route.abort('failed');}else await route.continue();});
  await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.locator('.chat-send-error').waitFor();
  if(!await editor.inputValue())throw new Error('Lost failed draft');
  await page.getByRole('button',{name:'重试发送消息',exact:true}).click();await page.locator('.chat-message').filter({hasText:'我今天主动问了一个问题'}).waitFor();
  await expect(editor).toHaveValue('');
  const rows=await repo.db.prepare('SELECT id,body FROM household_messages WHERE author_id=? AND household_id=?').all(ids.learner,ids.house);
  if(rows.length!==1)throw new Error('Lost-response retry duplicated message');
  await page.getByRole('searchbox',{name:'搜索小组消息'}).fill('主动');await expect(page.locator('.chat-message')).toHaveCount(1);
  await page.getByRole('searchbox',{name:'搜索小组消息'}).fill('');await page.getByRole('button',{name:/小组成员/}).click();await page.getByRole('heading',{name:/小组成员/}).waitFor();
  if(await page.locator('.chat-members').textContent().then(v=>v?.includes('@example.test')))throw new Error('Member email leaked');
  await page.screenshot({path:testInfo.outputPath('chat-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'关闭成员列表'}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator('.chat-message-content p').last()).toBeInViewport({ratio:0.8});await page.screenshot({path:testInfo.outputPath('chat-mobile.png'),fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Chat mobile overflow');
  const duplicate=await context.request.post('/api/household',{data:{action:'message',id:rows[0].id,body:rows[0].body}});if(duplicate.status()!==200)throw new Error('Idempotent retry rejected');
  const spoof=await host.request.post('/api/household',{data:{action:'message',id:rows[0].id,body:rows[0].body}});if(spoof.status()!==409)throw new Error('Peer reused message ID');
  const deny=await outsider.request.post('/api/household',{data:{action:'message',body:'not a member'}});if(deny.status()!==403)throw new Error('Nonmember could post');
  const palette=await page.locator('.portal').evaluate(el=>getComputedStyle(el).getPropertyValue('--ws-sidebar'));
  await repo.db.prepare("INSERT INTO organization_access VALUES ('10000000-0000-4000-8000-000000001001',?,'admin',?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role='admin'").run(ids.learner,new Date().toISOString());
  await page.setViewportSize({width:1440,height:1000});await page.goto('/team');await page.locator('.team-page').waitFor();
  if(await page.locator('.team-page').evaluate(el=>getComputedStyle(el).getPropertyValue('--ws-sidebar'))!==palette)throw new Error('Workspace palettes diverge');
  await page.screenshot({path:testInfo.outputPath('unified-team.png'),fullPage:true});
  if(errors.length)throw new Error(errors.join('\n'));
 }finally{await Promise.all(contexts.map(c=>c.close()));await repo.db.close();}
});
