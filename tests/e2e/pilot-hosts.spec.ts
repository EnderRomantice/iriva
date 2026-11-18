import { test, expect } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { seedId } from '../../server/db/seed';
import { defaultOrganizationId } from '../../domain/workspace';

test('team adds Host, first email verification enters Host waiting page, matching opens household', async ({ browser }) => {
  if (process.env.PG_LOCAL_TEST !== '1' || !process.env.DATABASE_URL) throw new Error('Use disposable PostgreSQL harness --hosts.');
  const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: false });
  const team = await browser.newContext(), host = await browser.newContext();
  const origin = 'http://127.0.0.1:3117', email = `host-${randomUUID()}@example.test`;
  const headers = { origin };
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  try {
    const token = randomBytes(32).toString('hex');
    await db`INSERT INTO iriva.auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (${hash(token)},${seedId(6)},${Date.now()+3600000},'password')`;
    await team.addCookies([{ name: 'iriva_session', value: token, url: origin }]);
    expect((await host.request.post(`${origin}/api/team`, { headers, data: { action: 'host', email, name: 'Emma' } })).status()).toBe(401);
    const page = await team.newPage();
    await page.goto(`${origin}/team`);
    await page.getByRole('button', { name: 'Host 管理', exact: true }).click();
    await page.getByLabel('Host 姓名', { exact: true }).fill('Emma');
    await page.getByLabel('Host 登录邮箱', { exact: true }).fill(email.toUpperCase());
    await page.getByRole('button', { name: '保存 Host', exact: true }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByText('Host · 待首次登录', { exact: true })).toBeVisible();
    // Deliver a deterministic challenge in the disposable database; exercise the real verification endpoint.
    const challenge = randomUUID(), code = '427318';
    await db`INSERT INTO iriva.email_challenges (id,email,organization_id,code_hash,created_at,expires_at,delivered) VALUES (${challenge},${email},${defaultOrganizationId},${hash(`${challenge}:${code}`)},${Date.now()},${Date.now()+600000},1)`;
    expect((await host.request.post(`${origin}/api/auth`, { headers, data: { action: 'verify', challengeId: challenge, code } })).status()).toBe(200);
    const hostPage = await host.newPage();
    await hostPage.goto(`${origin}/learn`);
    await expect(hostPage.getByRole('heading', { name: '等待团队安排 Household' })).toBeVisible();
    await expect(hostPage.getByRole('link', { name: '填写加入资料' })).toHaveCount(0);
    expect((await host.request.post(`${origin}/api/team`, { headers, data: { action: 'host', email: 'other@example.test', name: 'Other' } })).status()).toBe(401);
    expect((await host.request.post(`${origin}/api/apply`, { headers, data: {} })).status()).toBe(409);
    await hostPage.goto(`${origin}/apply`);
    await expect(hostPage).toHaveURL(`${origin}/app?org=${defaultOrganizationId}`);
    // Create four eligible learner applications, then exercise the real team matching action.
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = randomUUID(), user = randomUUID(), learnerEmail = `${user}@example.test`, now = new Date().toISOString(); ids.push(id);
      await db`INSERT INTO iriva.users (id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (${user},${`Learner ${i}`},${learnerEmail},'UTC','',1,${now},${now})`;
      await db`INSERT INTO iriva.member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,status,created) VALUES (${id},${user},${learnerEmail},${`Learner ${i}`},'learner','English','Speaking','intermediate','+08:00','Saturday','Books','','shortlist',${now})`;
    }
    const matched = await team.request.post(`${origin}/api/team`, { headers, data: { action: 'match', ids, hostEmail: email, hostName: 'Emma', name: 'Host flow Household', revisions: ids.map(id => ({ id, revision: 0 })) } });
    expect(matched.status(), await matched.text()).toBe(200);
    await hostPage.reload();
    await expect(hostPage.getByRole('heading', { name: '等待团队安排 Household' })).toHaveCount(0);
    const state = await (await host.request.get(`${origin}/api/household`)).json();
    expect(state.user.role).toBe('host'); expect(state.household.name).toBe('Host flow Household'); expect(state.people).toHaveLength(5);
    await hostPage.screenshot({ path: 'test-results/host-flow.png', fullPage: true });
  } finally { await team.close(); await host.close(); await db.end(); }
});
