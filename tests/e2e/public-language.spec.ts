import {test, expect} from '@playwright/test';

test('browser language presents the brand and both learning choices', async ({browser}) => {
  for (const locale of ['zh-CN','en-US']) {
    const context = await browser.newContext({locale});
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading',{name:locale==='zh-CN'?'你想从哪一种语言开始？':'Which language brings you here?'})).toBeVisible();
    await expect(page.locator('#languages a')).toHaveCount(2);
    await expect(page.getByText('¥1,980')).toHaveCount(0);
    const chinese = page.locator('#languages a').nth(1);
    await chinese.click();
    await expect(page).toHaveURL(/\/courses\/chinese$/);
    await expect(page.getByRole('link',{name:locale==='zh-CN'?'申请加入':'Apply to join',exact:true}).first()).toHaveAttribute('href','/apply?language=Chinese');
    await context.close();
  }
});

test('manual preference persists and switching display language keeps the selected course', async ({browser}) => {
  const context = await browser.newContext({locale:'en-US'});
  const page = await context.newPage();
  await page.goto('/en/courses/chinese');
  await page.getByRole('button',{name:'Choose language',exact:true}).click();
  await page.getByRole('button',{name:'简体中文',exact:true}).click();
  await expect(page).toHaveURL(/\/courses\/chinese$/);
  await expect(page.getByRole('heading',{level:1})).toContainText('用中文');
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'你想从哪一种语言开始？'})).toBeVisible();
  await context.close();
});

test('mobile homepage fits the viewport and language entries are visible', async ({browser}) => {
  const context = await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#languages a').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'切换导航'}).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.screenshot({path:'test-results/brand-mobile.png',fullPage:true});
  await context.close();
});
