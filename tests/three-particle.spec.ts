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
