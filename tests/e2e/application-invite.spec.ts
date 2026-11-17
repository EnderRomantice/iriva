import { test, expect, type BrowserContext } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedId } from '../../server/db/seed';
import { defaultOrganizationId } from '../../domain/workspace';

test.use({ actionTimeout: 8000 });

test('submit profile, enter code, reach household; invalid, missing-profile and concurrent joins are safe', async ({ browser }) => {
  if (process.env.PG_LOCAL_TEST !== '1' || !process.env.DATABASE_URL) throw new Error('Use test:invites disposable database.');
  const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: false }), contexts: BrowserContext[] = [];
  const origin = 'http://127.0.0.1:3117', headers = { origin }, house = randomUUID(), code = randomUUID().replaceAll('-', ''), now = new Date().toISOString();
  const profile = { name: 'Invite learner', age_band: '25-34', life_stage: 'working', location: 'Shanghai', goal: 'Speak with friends', level: 'intermediate', timezone: '+08:00', availability_slots: [{ day: 6, start: '10:00', end: '12:00' }], interests: '日常生活', contact_preference: 'email', consent: true, language: 'English', plan: 'native' };
  async function learner() {
    const id = randomUUID(), token = randomBytes(32).toString('hex'), email = `${id}@example.test`;
    await db`INSERT INTO iriva.users(id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (${id},'Invite learner',${email},'UTC','',1,${now},${now})`;
    await db`INSERT INTO iriva.auth_sessions VALUES (${createHash('sha256').update(token).digest('hex')},${id},${Date.now()+3600000})`;
    const context = await browser.newContext(); contexts.push(context);
    await context.addCookies([{ name: 'iriva_session', value: token, url: origin }]);
    return { id, context, join: () => context.request.post(`${origin}/api/apply/join`, { headers, data: { code } }) };
  }
  try {
    await db`INSERT INTO iriva.households(id,name,term_id,host_id,timezone,capacity,theme,version,created_at,updated_at,organization_id,code) VALUES (${house},'邀请码测试空间',${seedId(101)},${seedId(5)},'UTC',4,'A story',1,${now},${now},${defaultOrganizationId},${code})`;
    const first = await learner();
    expect((await first.join()).status()).toBe(409);
    const page = await first.context.newPage(); await page.goto(`${origin}/apply`);
    await expect(page.getByLabel('Household 邀请码', { exact: true })).toHaveCount(0);
    await page.getByLabel('怎么称呼你？', { exact: true }).fill('Invite learner');
    await page.getByRole('combobox', { name: /^年龄段/ }).selectOption('25-34');
    await page.getByRole('combobox', { name: /^学习或工作阶段/ }).selectOption('working');
    await page.getByLabel('所在国家或地区', { exact: true }).fill('Shanghai');
    await page.getByLabel('最希望改善哪一种交流？', { exact: true }).fill('Speak with friends');
    await page.getByLabel('日常生活', { exact: true }).check();
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('目前的口语状态').selectOption('intermediate');
    await page.getByRole('button', { name: '＋ 添加可参加时段' }).click();
    await page.getByRole('combobox', { name: /^星期/ }).selectOption('6');
    await page.getByRole('combobox', { name: /^从/ }).selectOption('10:00');
    await page.getByRole('combobox', { name: /^到/ }).selectOption('12:00');
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByLabel('我同意青鸟团队使用这些资料', { exact: false }).check();
    await page.getByRole('button', { name: '提交加入资料' }).click();
    await expect(page.getByRole('heading', { name: '资料已收到。' })).toBeVisible();
    const input = page.getByLabel('Household 邀请码', { exact: true });
    await input.fill('incorrect-code');
    await page.getByRole('button', { name: '进入学习空间', exact: true }).click();
    await expect(page.getByText('没有找到这个邀请码，请核对后再试。', { exact: true })).toBeVisible();
    expect((await db`SELECT status FROM iriva.member_applications WHERE user_id=${first.id}`)[0].status).toBe('new');
    await page.screenshot({ path: 'test-results/invite-after-submit.png', fullPage: true });
    await page.goto(`${origin}/learn`);
    await expect(input).toBeVisible();
    await input.fill(`  ${code}  `);
    await page.getByRole('button', { name: '进入学习空间', exact: true }).click();
    await expect(page.getByRole('heading', { name: '很高兴，在这里见到你。' })).toBeVisible();
    expect((await db`SELECT household,status,goal FROM iriva.member_applications WHERE user_id=${first.id}`)[0]).toMatchObject({ household: house, status: 'assigned', goal: 'Speak with friends' });
    expect((await first.join()).status()).toBe(200);
    const others = [];
    for (let i = 0; i < 4; i++) { const person = await learner(); others.push(person); expect((await person.context.request.post(`${origin}/api/apply`, { headers, data: profile })).status()).toBe(200); }
    expect((await others[0].join()).status()).toBe(200); expect((await others[1].join()).status()).toBe(200);
    const raced = await Promise.all([others[2].join(), others[3].join()]);
    expect(raced.map(r => r.status()).sort()).toEqual([200, 409]);
    expect(Number((await db`SELECT count(*) AS n FROM iriva.memberships WHERE household_id=${house} AND role='learner'`)[0].n)).toBe(4);
  } finally { await Promise.all(contexts.map(c => c.close())); await db.end(); }
});
