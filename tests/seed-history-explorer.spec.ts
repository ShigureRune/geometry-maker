import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test('searches beyond the eight most recent seeds and bookmarks without changing artwork',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  for(let i=0;i<12;i++){
    await seed.fill('history-seed-'+i);
    await seed.press('Enter');
  }
  await expect(seed).toHaveValue('history-seed-11');
  const history=page.locator('.seed-vault-history');
  await history.locator('summary').click();
  await expect(history.locator('.seed-vault-history-entry')).toHaveCount(13);
  const search=page.getByRole('searchbox',{name:'履歴を検索'});
  await search.fill('history-seed-0');
  await expect(history.locator('.seed-vault-history-entry')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'history-seed-0の履歴を呼び出す'})).toBeVisible();
  await page.getByRole('button',{name:'history-seed-0をお気に入りに保存'}).click();
  await expect(page.getByRole('button',{name:'history-seed-0を呼び出す'})).toBeVisible();
  await expect(seed).toHaveValue('history-seed-11');
  await expect(page.getByLabel('履歴の位置')).toHaveText('13 / 13');
  await expect(page.getByText('現在の作品は変更していません。',{exact:false})).toBeVisible();
  await page.reload();
  await openSettingsCategory(page,'図形');
  await expect(page.getByRole('button',{name:'history-seed-0を呼び出す'})).toBeVisible();
  await expect(seed).toHaveValue('history-seed-11');
  expect(errors).toEqual([]);
});

test('history explorer stays bounded and usable at mobile width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  for(let i=0;i<15;i++){
    await seed.fill('mobile-history-'+i);
    await seed.press('Enter');
  }
  const history=page.locator('.seed-vault-history');
  await history.locator('summary').click();
  const results=history.locator('.seed-vault-history-results');
  const size=await results.evaluate(el=>({
    clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,
    overflow:getComputedStyle(el).overflowY,
  }));
  expect(size.clientHeight).toBeLessThanOrEqual(301);
  expect(size.scrollHeight).toBeGreaterThan(size.clientHeight);
  expect(size.overflow).toBe('auto');
  await page.getByRole('searchbox',{name:'履歴を検索'}).fill('mobile-history-14');
  await expect(history.locator('.seed-vault-history-entry')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
