import {payApplication,sendPaymentEvent} from './payment-helpers';
import { test, expect, type BrowserContext } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedId } from '../../server/db/seed';
import { defaultOrganizationId } from '../../domain/workspace';

test.use({ actionTimeout: 8000 });

test('learners wait outside the workspace, must supply WeChat, and enter only after team placement', async ({ browser }) => {
  if (process.env.PG_LOCAL_TEST !== '1' || !process.env.DATABASE_URL) throw new Error('Use test:invites disposable database.');
  const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: false }), contexts: BrowserContext[] = [];
  const origin = 'http://127.0.0.1:3117', headers = { origin }, now = new Date().toISOString();
  const profile = { name: 'Waiting learner', age_band: '25-34', life_stage: 'working', location: 'Shanghai', goal: 'Speak with friends', level: 'intermediate', timezone: '+08:00', availability_slots: [{ day: 6, start: '10:00', end: '12:00' }], interests: '日常生活', contact_preference: 'wechat', contact: 'learner_wechat', consent: true, language: 'English', plan: 'native' };
  async function session(id: string, method = 'email') {
    const token = randomBytes(32).toString('hex');
    await db`INSERT INTO iriva.auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (${createHash('sha256').update(token).digest('hex')},${id},${Date.now()+3600000},${method})`;
    const context = await browser.newContext({baseURL:origin}); contexts.push(context);
    await context.addCookies([{ name: 'iriva_session', value: token, url: origin }]);
    return context;
  }
  async function learner() {
    const id = randomUUID(), email = `${id}@example.test`;
    await db`INSERT INTO iriva.users(id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (${id},'Waiting learner',${email},'UTC','',1,${now},${now})`;
    return { id, context: await session(id) };
  }
  try {
    const first = await learner(), page = await first.context.newPage();
    const api = first.context.request;
    await page.goto(`${origin}/learn`);
    await expect(page).toHaveURL(/\/apply$/);
    await expect(page.locator('.portal')).toHaveCount(0);
    for (const contact of [undefined, '', '   ']) {
      expect((await api.post(`${origin}/api/apply`, { headers, data: { ...profile, contact } })).status()).toBe(400);
    }
    expect((await api.post(`${origin}/api/apply`, { headers, data: { ...profile, contact_preference: 'email' } })).status()).toBe(400);
    expect((await api.post(`${origin}/api/apply`, { headers, data: { ...profile, invite_code: 'old-code' } })).status()).toBe(403);
    expect((await api.post(`${origin}/api/apply/join`, { headers, data: { code: 'old-code' } })).status()).toBe(403);
    await page.getByLabel('想学习哪种语言？').selectOption(profile.language);
    await page.getByLabel('怎么称呼你？', { exact: true }).fill(profile.name);
    await page.getByRole('combobox', { name: /^年龄段/ }).selectOption('25-34');
    await page.getByRole('combobox', { name: /^学习或工作阶段/ }).selectOption('working');
    await page.getByLabel('所在国家或地区', { exact: true }).fill('Shanghai');
    await page.getByLabel('最希望改善哪一种交流？', { exact: true }).fill(profile.goal);
    await page.getByLabel('日常生活', { exact: true }).check();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('目前的口语状态').selectOption('intermediate');
    await page.getByRole('button', { name: '＋ 添加可参加时段' }).click();
    await page.getByRole('combobox', { name: /^星期/ }).selectOption('6');
    await page.getByRole('combobox', { name: /^从/ }).selectOption('10:00');
    await page.getByRole('combobox', { name: /^到/ }).selectOption('12:00');
    const wechat = page.getByRole('textbox', { name: /^微信号（必填）/ });
    await expect(wechat).toHaveAttribute('required', '');
    await expect(page.getByText('方便客服人员添加，确保服务质量。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(wechat).toBeFocused();
    await wechat.fill('   ');
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '请填写微信号' })).toBeVisible();
    await wechat.fill(profile.contact);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('我同意青鸟团队使用这些资料', { exact: false }).check();
    await page.getByRole('button', { name: '提交加入资料' }).click();
    await expect(page.getByRole('heading', { name: '资料已保存，请选择套餐并付款。' })).toBeVisible();
    await expect(page.getByText('微信：learner_wechat', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Household 邀请码', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '学习空间与进度' })).toHaveCount(0);
    expect((await db`SELECT contact,contact_preference,status,household FROM iriva.member_applications WHERE user_id=${first.id}`)[0]).toMatchObject({ contact: profile.contact, contact_preference: 'wechat', status: 'awaiting_payment', household: null });
    for (const tab of ['Home','Conversations','Schedule','Partner practice','My coach','Reviews','Notifications','Household']) {
      await page.goto(`${origin}/app?org=${defaultOrganizationId}&tab=${encodeURIComponent(tab)}`);
      await expect(page).toHaveURL(/\/apply$/);
      await expect(page.getByRole('heading', { name: '资料已保存，请选择套餐并付款。' })).toBeVisible();
      await expect(page.locator('.portal')).toHaveCount(0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/learn?tab=Schedule`);
    await expect(page).toHaveURL(/\/apply$/);
    await expect(page.locator('.portal')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/member-waiting-mobile.png', fullPage: true });
    expect((await api.patch(`${origin}/api/apply`, { headers, data: { ...profile, contact: '', revision: 0 } })).status()).toBe(400);
    expect((await api.patch(`${origin}/api/profile`, { headers, data: { ...profile, contact_preference: 'email' } })).status()).toBe(400);
    expect((await api.post(`${origin}/api/household`, { headers, data: { action: 'join', code: 'old-code' } })).status()).toBe(403);
    expect((await api.patch(`${origin}/api/apply`, { headers, data: { ...profile, contact: 'updated_wechat', revision: 0 } })).status()).toBe(200);
    // Legacy contact choices remain readable, but editing requires an explicit WeChat ID.
    await db`UPDATE iriva.member_applications SET contact_preference='other',contact='old phone' WHERE user_id=${first.id}`;
    await page.reload();
    await page.getByRole('button', { name: '补充或修改资料' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(wechat).toHaveValue('');
    await wechat.fill('updated_wechat');
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('我同意青鸟团队使用这些资料', { exact: false }).check();
    await page.getByRole('button', { name: '保存补充资料' }).click();
    await expect(page.getByRole('heading', { name: '资料已保存，请选择套餐并付款。' })).toBeVisible();
    const team = await session(seedId(6), 'password');
    const own=(await (await api.get('/api/apply')).json()).application;
    const before=(await (await team.request.get('/api/team')).json()).applications;
    expect(before.find((a:{user_id:string})=>a.user_id===first.id).payment_status).toBe('unpaid');
    expect((await team.request.post('/api/team',{headers,data:{action:'review',id:own.id,revision:own.revision,status:'shortlist'}})).status()).toBe(200);
    expect((await api.post('/api/apply/checkout',{headers,data:{plan:'everyday'}})).status()).toBe(400);
    await expect(page.getByRole('radio',{name:/基础档/})).toBeDisabled();
    await expect(page.getByRole('radio',{name:/专业档/})).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The return URL is not proof of payment.
    await page.goto(`${origin}/apply?payment=success`);
    await expect(page.getByRole('heading',{name:'选择套餐，完成付款'})).toBeVisible();
    await first.context.route('https://buy.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Stripe checkout</h1>'}));
    const checkoutPagePromise=first.context.waitForEvent('page');
    await page.getByRole('button',{name:'确认套餐并付款 · ¥1,980'}).click();
    const checkoutPage=await checkoutPagePromise;
    await expect(checkoutPage).toHaveURL(/buy\.stripe\.com/);
    const reference=new URL(checkoutPage.url()).searchParams.get('client_reference_id');
    await checkoutPage.close();
    await page.goto(`${origin}/apply`);
    await expect(page.getByRole('heading',{name:'选择套餐，完成付款'})).toBeVisible();
    const invalid={id:`cs_${randomUUID()}`,client_reference_id:reference,payment_status:'paid',amount_total:1,currency:'cny',payment_intent:`pi_${randomUUID()}`};
    expect((await (await sendPaymentEvent(api,invalid)).json()).result).toBe('payment-mismatch');
    await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
    const payment=await payApplication(api);
    await expect(page.getByRole('dialog')).toBeVisible({timeout:10000});
    await expect(page.getByRole('dialog')).toContainText('扫码加入官方售后/交流群，查询分组进度');
    const qr=page.getByRole('img',{name:'IRIVA 青鸟官方售后及交流群微信二维码'});
    await expect(qr).toHaveJSProperty('naturalWidth',720);
    await page.screenshot({path:'test-results/payment-success-qr-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'知道了，查看匹配进度'}).click();
    await expect(page.getByRole('heading',{name:'付款成功，正在等待匹配。'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'选择套餐，完成付款'})).toHaveCount(0);
    await page.reload();await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'加入官方售后 / 交流群'}).click();await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect((await api.post('/api/apply/checkout',{headers,data:{plan:'native'}})).status()).toBe(409);
    expect((await (await team.request.get('/api/team')).json()).applications.find((a:{user_id:string})=>a.user_id===first.id).status).toBe('pending');
    await sendPaymentEvent(api,payment);
    const learners = [first];
    for (let i = 0; i < 3; i++) {
      const next = await learner(); learners.push(next);
      expect((await next.context.request.post(`${origin}/api/apply`, { headers, data: profile })).status()).toBe(200);
      await payApplication(next.context.request);
    }
    const ids = learners.map(l => l.id);
    await db`UPDATE iriva.member_applications SET status='shortlist' WHERE user_id IN ${db(ids)}`;
    const applications = await db`SELECT id,revision FROM iriva.member_applications WHERE user_id IN ${db(ids)}`;
    const matched = await team.request.post(`${origin}/api/team`, { headers, data: { action: 'match', ids: applications.map(a => a.id), revisions: applications, hostEmail: 'emma@example.com', hostName: 'Emma', name: 'Matched waiting learners' } });
    expect(matched.status(), await matched.text()).toBe(200);
    await page.getByRole('button', { name: '刷新匹配进度' }).click();
    await expect(page).toHaveURL(/\/app\?org=/);
    await expect(page.getByRole('heading', { name: '很高兴，在这里见到你。' })).toBeVisible();
    const householdState=await (await api.get(`${origin}/api/household`)).json();
    expect(householdState.household.name).toBe('Matched waiting learners');
    expect(householdState.payment.status).toBe('paid');
    const refunded=await sendPaymentEvent(api,{payment_intent:payment.payment_intent,amount_refunded:198000,refunded:true},'charge.refunded');
    expect(refunded.status()).toBe(200);
    await sendPaymentEvent(api,payment);
    expect((await (await api.get('/api/household')).json()).payment.status).toBe('refunded');
  } finally { await Promise.all(contexts.map(c => c.close())); await db.end(); }
});
