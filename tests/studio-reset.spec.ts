import {test,expect,type Page} from '@playwright/test';
import {STUDIO_AUTOSAVE_KEY} from '../src/studio-autosave';

test.setTimeout(120_000);
async function openCategory(page:Page,name:string){
  if((await page.locator('.settings-screen').getAttribute('class'))?.includes('is-detail')){
    if((await page.locator('.settings-detail-current').textContent())===name)return;
    await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:name+'の設定を開く'}).check();
}
async function acceptReset(page:Page,name:string){
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name,exact:true}).click();
}
test('cancel leaves settings intact; confirmed full reset clears 2D, 3D, seed and UI but not other storage',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  await page.getByLabel('シード値',{exact:true}).fill('keep-until-reset');
  await page.getByLabel('キャンバスの比率').selectOption('9:16');
  await page.getByLabel('図形密度').fill('80');
  await page.getByRole('button',{name:'UIテーマ切り替え'}).click();
  await page.evaluate(()=>localStorage.setItem('another-app-key','safe'));
  await expect.poll(async()=>page.evaluate(key=>{
    try{return JSON.parse(localStorage.getItem(key)??'null')?.twoD?.seed;}catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toBe('keep-until-reset');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'すべての設定を初期化'}).click();
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('keep-until-reset');
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('9:16');
  page.once('dialog',dialog=>dialog.accept());
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button',{name:'すべての設定を初期化'}).click(),
  ]);
  await expect(page.getByRole('button',{name:'2Dモード',exact:true})).toHaveAttribute('aria-pressed','true');
  await openCategory(page,'図形');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue(/^[0-9a-f]{24}$/);
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('16:9');
  await expect(page.getByLabel('図形密度')).toHaveValue('50');
  expect(await page.evaluate(()=>localStorage.getItem('geometry-ui-theme'))).toBe('dark');
  expect(await page.evaluate(()=>localStorage.getItem('another-app-key'))).toBe('safe');
  await expect.poll(async()=>page.evaluate(key=>{
    try{return JSON.parse(localStorage.getItem(key)??'null')?.twoD?.seed;}catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toMatch(/^[0-9a-f]{24}$/);
  expect(errors).toEqual([]);
});
test('individual 3D resets restore GALAXY/PARTICLE values while preserving current seed and active mode',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  await page.getByLabel('シード値',{exact:true}).fill('keep-3d-seed');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openCategory(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await openCategory(page,'拡張');
  await page.getByLabel('GALAXY MODEを有効化').check();
  await page.locator('#galaxy-arms').fill('6');
  await page.locator('#galaxy-core').fill('150');
  await openCategory(page,'図形');
  await acceptReset(page,'GALAXY設定を初期化');
  await openCategory(page,'拡張');
  await expect(page.getByLabel('GALAXY MODEを有効化')).toBeChecked();
  await expect(page.locator('#galaxy-arms')).toHaveValue('2');
  await expect(page.locator('#galaxy-core')).toHaveValue('75');
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await page.locator('#particle-count').fill('1000');
  await openCategory(page,'図形');
  await acceptReset(page,'PARTICLE設定を初期化');
  await openCategory(page,'拡張');
  await expect(page.getByLabel('PARTICLE MODEを有効化')).toBeChecked();
  await expect(page.locator('#particle-count')).toHaveValue('4000');
  await expect(page.getByLabel('GALAXY MODEを有効化')).not.toBeChecked();
  await openCategory(page,'図形');
  await acceptReset(page,'3D設定を初期化');
  await openCategory(page,'拡張');
  await expect(page.getByLabel('PARTICLE MODEを有効化')).not.toBeChecked();
  await expect(page.getByLabel('GALAXY MODEを有効化')).not.toBeChecked();
  await openCategory(page,'図形');
  await expect(page.getByLabel('3D描画品質')).toHaveValue('auto');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('keep-3d-seed');
  expect(errors).toEqual([]);
});
test('VOID reset restores web defaults without losing the seed; 2D reset retains seed',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  await page.getByLabel('シード値',{exact:true}).fill('preserve-seed');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openCategory(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await openCategory(page,'拡張');
  await page.getByLabel('VOID MODEを有効化').check();
  await page.locator('#void-object-limit').fill('900');
  await openCategory(page,'図形');
  await acceptReset(page,'VOID設定を初期化');
  await openCategory(page,'拡張');
  await expect(page.getByLabel('VOID MODEを有効化')).toBeChecked();
  await expect(page.locator('#void-object-limit')).toHaveValue('1400');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await openCategory(page,'図形');
  await page.getByLabel('キャンバスの比率').selectOption('9:16');
  await page.getByLabel('図形密度').fill('85');
  await acceptReset(page,'2D設定を初期化');
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('16:9');
  await expect(page.getByLabel('図形密度')).toHaveValue('50');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('preserve-seed');
  expect(errors).toEqual([]);
});
