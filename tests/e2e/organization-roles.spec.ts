import {seedPaidApplication} from './payment-helpers';
import {test,expect} from '@playwright/test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {seedId} from '../../server/db/seed';
import {defaultOrganizationId} from '../../domain/workspace';

test('one space: Host manages two organizations, tab writes remain isolated, student cannot switch',async({browser})=>{
 if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Use disposable PostgreSQL harness.');
 const db=postgres(process.env.DATABASE_URL,{max:1,ssl:false}),origin='http://127.0.0.1:3117';
 const admin=await browser.newContext(),host=await browser.newContext(),learner=await browser.newContext();
 const errors:string[]=[];
 const session=async(context:typeof admin,user:string,method='email')=>{const token=randomBytes(32).toString('hex');await db`INSERT INTO iriva.auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (${createHash('sha256').update(token).digest('hex')},${user},${Date.now()+3600000},${method})`;await context.addCookies([{name:'iriva_session',value:token,url:origin}]);};
 const headers=(org:string)=>({origin,'x-iriva-organization':org});
 try{
  await session(admin,seedId(6),'password');
  const created=await admin.request.post(origin+'/api/team/organizations',{headers:headers(defaultOrganizationId),data:{action:'create',name:'Host second organization'}});expect(created.status(),await created.text()).toBe(200);
  const second=(await created.json()).organization.id;
  const email=`multi-${randomUUID()}@example.test`,groups:string[]=[],students:string[]=[];
  // Assign an invited Host in both organizations before the first sign-in.
  for(const [index,org] of [defaultOrganizationId,second].entries()){
   const ids:string[]=[];
   for(let i=0;i<4;i++){
    const user=randomUUID(),id=randomUUID(),now=new Date().toISOString();ids.push(id);students.push(user);
    await db`INSERT INTO iriva.users (id,name,email,timezone,avatar,version,created_at,updated_at) VALUES (${user},${`Learner ${index}-${i}`},${user+'@example.test'},'UTC','',1,${now},${now})`;
    await db`INSERT INTO iriva.member_applications (id,user_id,email,name,role,language,goal,level,timezone,availability,interests,contact,status,created,organization_id) VALUES (${id},${user},${user+'@example.test'},${`Learner ${index}-${i}`},'learner','English','Speaking','intermediate','+08:00','Saturday','Books','','shortlist',${now},${org})`;
      await seedPaidApplication(db,id);
   }
   const matched=await admin.request.post(origin+'/api/team',{headers:headers(org),data:{action:'match',ids,hostEmail:email,hostName:'Multi Host',name:`Host household ${index+1}`,revisions:ids.map(id=>({id,revision:0}))}});
   expect(matched.status(),await matched.text()).toBe(200);groups.push((await matched.json()).household);
  }
  const challenge=randomUUID(),code='427319';
  await db`INSERT INTO iriva.email_challenges (id,email,organization_id,code_hash,created_at,expires_at,delivered) VALUES (${challenge},${email},${defaultOrganizationId},${createHash('sha256').update(challenge+':'+code).digest('hex')},${Date.now()},${Date.now()+600000},1)`;
  expect((await host.request.post(origin+'/api/auth',{headers:{origin},data:{action:'verify',challengeId:challenge,code}})).status()).toBe(200);
  await session(learner,students[0]);
  const page=await host.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/app?org='+defaultOrganizationId);
  await expect(page.getByRole('button',{name:'组织切换与设置',exact:true})).toBeVisible();
  await expect(page.locator('.p-crumb')).toContainText('Host household 1');
  await expect(page.getByRole('button',{name:'组织切换与设置',exact:true})).toContainText('Host household 1');
  await expect(page.getByRole('link',{name:/进入学习空间|团队工作台/})).toHaveCount(0);
  const other=await host.newPage();await other.goto(origin+'/app?org='+defaultOrganizationId);
  await other.getByRole('button',{name:'组织切换与设置',exact:true}).click();
  await other.getByRole('menuitemradio',{name:'Host household 2 Host'}).click();
  await expect(other).toHaveURL(origin+'/app?org='+second);
  await expect(other.locator('.p-crumb')).toContainText('Host household 2');
  await expect(other.getByRole('button',{name:'组织切换与设置',exact:true})).toContainText('Host household 2');
  // The other tab changed the cookie; the first tab must still write to organization 1.
  await page.getByRole('button',{name:'更新本周话题 ↗',exact:true}).click();
  await page.getByLabel('交流话题').fill('Only organization one');await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Only organization one',exact:true})).toBeVisible();
  const first=await (await host.request.get(origin+'/api/household',{headers:headers(defaultOrganizationId)})).json();
  const two=await (await host.request.get(origin+'/api/household',{headers:headers(second)})).json();
  expect(first.household.topic).toBe('Only organization one');expect(two.household.topic).not.toBe('Only organization one');
  await other.getByRole('button',{name:'组织切换与设置',exact:true}).click();await other.getByRole('menuitem',{name:'小组设置',exact:true}).click();
  await expect(other.getByRole('heading',{name:'Host household 2',exact:true})).toBeVisible();
  // Stored group facts and unknown member timezones must not be replaced by display constants.
  await db`UPDATE iriva.households SET capacity=6 WHERE id=${groups[1]}`;
  await db`INSERT INTO iriva.memberships (id,household_id,user_id,role,version,created_at,updated_at) VALUES (${randomUUID()},${groups[1]},${seedId(5)},'host',1,${new Date().toISOString()},${new Date().toISOString()})`;
  await db`UPDATE iriva.member_applications SET language='Chinese',timezone='' WHERE user_id=${students[4]}`;
  await db`UPDATE iriva.memberships SET timezone='' WHERE household_id=${groups[1]} AND user_id=${students[4]}`;
  await other.getByRole('button',{name:'刷新',exact:true}).click();
  await expect(other.locator('.p-people .p-section-title')).toContainText('4 / 6 位学员 · 2 位 Host');
  await expect(other.locator('.p-space-head')).toContainText('Chinese');
  await expect(other.locator('.p-members > div').filter({hasText:'Learner 1-0'})).toContainText('时区待确认');
  expect(two.household.topic).toBe('');
  const switcher=other.getByRole('button',{name:'组织切换与设置',exact:true});
  await expect(switcher.locator('.workspace-mark')).toHaveText('H');
  await other.locator('.p-avatar-setting input[type=file]').setInputFiles('public/bluebird-transparent.png');
  await expect(switcher.locator('img')).toHaveAttribute('src',new RegExp('org='+second));
  const avatarUrl=await switcher.locator('img').getAttribute('src');
  await expect(switcher.locator('img')).toHaveJSProperty('naturalWidth',256);
  await switcher.click();
  await expect(other.getByRole('menuitemradio',{name:'Host household 2 Host'}).locator('img')).toHaveAttribute('src',avatarUrl!);
  await expect(other.getByRole('menuitemradio',{name:'Host household 1 Host'}).locator('img')).toHaveCount(0);
  await other.keyboard.press('Escape');
  await other.getByRole('link',{name:'个人信息',exact:true}).first().click();
  await expect(other.getByRole('button',{name:'组织切换与设置',exact:true})).toContainText('Host household 2');
  await expect(switcher.locator('img')).toHaveAttribute('src',avatarUrl!);
  await other.setViewportSize({width:390,height:844});await other.getByRole('button',{name:'组织切换与设置',exact:true}).click();
  await expect(other.getByRole('menuitemradio',{name:'Host household 2 Host'})).toBeVisible();
  await expect(other.getByRole('menuitem',{name:'小组设置',exact:true})).toBeVisible();
  await other.getByRole('menuitem',{name:'小组设置',exact:true}).click({trial:true});
  await other.screenshot({path:'test-results/host-organizations-mobile.png',fullPage:true});
  await page.screenshot({path:'test-results/host-organizations-desktop.png',fullPage:true});
  await other.getByRole('menuitem',{name:'小组设置',exact:true}).click();
  await other.getByRole('button',{name:'移除小组头像',exact:true}).click();
  await expect(switcher.locator('img')).toHaveCount(0);
  await expect(switcher.locator('.workspace-mark')).toHaveText('H');
  const student=await learner.newPage();await student.goto(origin+'/learn');
  await expect(student).toHaveURL(origin+'/app?org='+defaultOrganizationId);
  await expect(student.locator('.p-crumb')).toContainText('Host household 1');
  await expect(student.getByRole('button',{name:'组织切换与设置',exact:true})).toHaveCount(0);
  expect((await learner.request.post(origin+'/api/organizations',{headers:{origin},data:{organizationId:second}})).status()).toBe(403);
  expect((await learner.request.post(origin+'/api/household',{headers:headers(second),data:{action:'topic',week:1,topic:'forbidden'}})).status()).toBe(403);
  expect((await host.request.get(origin+'/api/team',{headers:headers(second)})).status()).toBe(401);
  const ops=await admin.newPage();await ops.goto(origin+'/app');
  await expect(ops.getByRole('button',{name:'Host 管理',exact:true})).toBeVisible();await expect(ops.getByRole('link',{name:'进入学习空间',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await Promise.all([admin.close(),host.close(),learner.close()]);await db.end()}
});
