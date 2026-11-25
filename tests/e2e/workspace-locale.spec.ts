import {test,expect} from '@playwright/test';
import {createHash,randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {seedId} from '../../server/db/seed';
import {defaultOrganizationId} from '../../domain/workspace';

for(const role of ['host','learner'] as const)test(`${role} switches shared workspace language, preserving drafts and preference`,async({browser})=>{
 if(process.env.PG_LOCAL_TEST!=='1'||!process.env.DATABASE_URL)throw new Error('Use the disposable PostgreSQL harness.');
 const db=postgres(process.env.DATABASE_URL,{max:1,ssl:false}),context=await browser.newContext();
 const origin='http://127.0.0.1:3117',errors:string[]=[];
 try{
  const token=randomBytes(32).toString('hex');
  await db`INSERT INTO iriva.auth_sessions (token_hash,user_id,expires_at,auth_method) VALUES (${createHash('sha256').update(token).digest('hex')},${seedId(role==='host'?5:1)},${Date.now()+3600000},'password')`;
  await context.addCookies([{name:'iriva_session',value:token,url:origin},{name:'iriva_locale',value:'zh',url:origin}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const switchTo=async(lang:'en'|'zh')=>{await page.getByRole('button',{name:lang==='en'?'选择语言':'Choose language',exact:true}).click();await page.getByRole('button',{name:lang==='en'?'English':'简体中文',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang',lang==='en'?'en':'zh-CN');};
  await page.goto(`${origin}/app?org=${defaultOrganizationId}`);
  await expect(page.getByRole('heading',{name:'很高兴，在这里见到你。'})).toBeVisible();
  const state=await(await context.request.get(`${origin}/api/household?org=${defaultOrganizationId}`)).json();
  await page.getByRole('button',{name:'小组交流',exact:true}).click();
  await page.getByRole('textbox',{name:'发消息到小组客厅',exact:true}).fill('保留我的草稿 Hello');
  await switchTo('en');
  await expect(page.getByRole('textbox',{name:'Message the group lounge',exact:true})).toHaveValue('保留我的草稿 Hello');
  await expect(page.getByRole('heading',{name:'Welcome to the group lounge',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:role==='host'?'Host observations':'Activity reviews',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Partner practice',exact:true}).click();
  await expect(page.getByRole('heading',{name:role==='host'?'Assign practice partners':'Your assigned practice partner',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Learning space navigation'}).getByRole('button',{name:/^Notifications/}).click();
  await expect(page.getByRole('heading',{name:'Session updates',exact:true})).toBeVisible();
  if(role==='host'){
   await page.getByRole('button',{name:'Schedule',exact:true}).click();
   await page.getByRole('button',{name:'Plan a session',exact:true}).first().click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.getByRole('combobox',{name:'Session type',exact:true})).toBeVisible();
   await expect(page.getByLabel('Title',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Close',exact:true}).click();
  }
  await page.getByRole('link',{name:'Personal information',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Basic information',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Upload image',exact:true})).toBeVisible();
  await page.getByLabel('What should your partners call you?',{exact:true}).fill('未保存的名字 Emma');
  await switchTo('zh');
  await expect(page.getByLabel('伙伴怎么称呼你',{exact:true})).toHaveValue('未保存的名字 Emma');
  await switchTo('en');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Basic information',exact:true})).toBeVisible();
  // The preference survives a new route load; user-generated names/topics stay untouched.
  await page.goto(`${origin}/app?org=${defaultOrganizationId}`);
  await expect(page.getByRole('heading',{name:'It is good to see you here.',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:state.household.topic,exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await switchTo('zh');await switchTo('en');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  if(role==='host')await page.screenshot({path:'test-results/host-locale-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
 }finally{await context.close();await db.end();}
});
