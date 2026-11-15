import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('particle-smoke');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
}
test('PARTICLE MODE switches between solids and seeded surface particles without 3D errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  const preview=page.getByTestId('three-preview');
  const original=await preview.locator('canvas').screenshot();
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await expect(preview).toHaveAttribute('data-particle-mode','on');
  await expect(preview).toHaveAttribute('data-particle-count','1600');
  const cloud=await preview.locator('canvas').screenshot();
  expect(original.equals(cloud)).toBe(false);
  await page.locator('#particle-count').fill('500');
  await expect(preview).toHaveAttribute('data-particle-count','500');
  await page.getByLabel('PARTICLE MODEを有効化').uncheck();
  await expect(preview).toHaveAttribute('data-particle-mode','off');
  expect(errors).toEqual([]);
});
test('particle settings are saved and restored with 3D project JSON',async({page})=>{
  await start(page);
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await page.locator('#particle-count').fill('1500');
  await page.locator('#particle-swirl').fill('2');
  await page.getByLabel('粒子の揺らぎ').uncheck();
  await category(page,'書き出し');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const settings=JSON.parse((await readFile((await (await download).path())!)).toString('utf8'));
  expect(settings.settings.particle).toMatchObject({enabled:true,count:1500,swirl:2,jitter:false});
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'particle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settings))
  });
  await category(page,'図形');
  await expect(page.getByLabel('PARTICLE MODEを有効化')).toBeChecked();
  await expect(page.locator('#particle-count')).toHaveValue('1500');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','on');
});


test('changing the seed morphs the visible cloud, pauses smoothly, then settles',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  const preview=page.getByTestId('three-preview');
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await expect(page.getByLabel('シード変更時に粒子を再集合')).toBeChecked();
  await page.locator('#particle-seed-duration').fill('2');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.getByRole('button',{name:'粒子集合を最初から再生'}).click();
  await page.waitForTimeout(3400);
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','transition');
  await expect.poll(async()=>Number(await preview.getAttribute('data-particle-seed-progress')))
    .toBeGreaterThan(.03);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  const stopped=await preview.getAttribute('data-particle-seed-progress');
  await page.waitForTimeout(250);
  expect(await preview.getAttribute('data-particle-seed-progress')).toBe(stopped);
  await page.getByRole('button',{name:'3Dを再生'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','settled',{timeout:10000});
  await category(page,'図形');
  await page.getByLabel('シード変更時に粒子を再集合').uncheck();
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','settled');
  expect(errors).toEqual([]);
});

test('automatic standby seed change uses the same particle morph',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await category(page,'アニメーション');
  await page.getByLabel('3D待機画面モードを有効化').check();
  const preview=page.getByTestId('three-preview');
  const before=await page.getByTestId('current-seed').textContent();
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','transition');
  expect(await page.getByTestId('current-seed').textContent()).not.toBe(before);
  await expect(preview).toHaveAttribute('data-particle-seed-phase','settled',{timeout:12000});
  expect(errors).toEqual([]);
});
