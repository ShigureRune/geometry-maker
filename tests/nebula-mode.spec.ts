import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';
import {STUDIO_AUTOSAVE_KEY} from '../src/studio-autosave';

test.setTimeout(140_000);

test('NEBULA presets and custom colors render, autosave and reload without replacing the seed',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-nebula-mode','off');
  await openSettingsCategory(page,'拡張');
  const nav=page.getByRole('navigation',{name:'拡張モードの細かい設定'});
  const nebula=nav.getByRole('button',{name:'NEBULA MODE · 星雲空間の詳細設定を開く'});
  await nebula.click();
  await page.getByLabel('星雲プリセット').selectOption('pink_bloom');
  await expect(page.getByRole('checkbox',{name:'NEBULA MODEを有効化'})).toBeChecked();
  await expect(preview).toHaveAttribute('data-nebula-mode','on');
  await expect(preview).toHaveAttribute('data-nebula-preset','pink_bloom');
  await expect(page.locator('#nebula-density')).toHaveValue('65');
  await page.locator('#nebula-density').fill('70');
  await page.getByLabel('星雲の色1').fill('#1122dd');
  await expect(page.getByLabel('星雲プリセット')).toHaveValue('custom');
  await expect.poll(async()=>page.evaluate(key=>{
    try{const d=JSON.parse(localStorage.getItem(key)??'null');
      return [d?.threeD?.settings?.nebula?.density,d?.threeD?.settings?.nebula?.colorA,
        d?.threeD?.settings?.nebula?.preset,d?.threeD?.settings?.nebula?.enabled];}
    catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toEqual([70,'#1122dd','custom',true]);
  await page.reload();
  await expect(page.getByRole('button',{name:'3Dモード',exact:true})).toHaveAttribute('aria-pressed','true');
  await openSettingsCategory(page,'拡張');
  await nav.getByRole('button',{name:'NEBULA MODE · 星雲空間の詳細設定を開く'}).click();
  await expect(page.locator('#nebula-density')).toHaveValue('70');
  await expect(page.getByLabel('星雲の色1')).toHaveValue('#1122dd');
  await expect(preview).toHaveAttribute('data-nebula-mode','on');
  expect(errors).toEqual([]);
});

test('NEBULA coexists with GALAXY and PARTICLE on iPhone without moving the fixed dock',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  await page.getByRole('button',{name:'3D描画品質の詳細設定を開く'}).click();
  await page.getByLabel('3D描画品質',{exact:true}).selectOption('low');
  await page.locator('#three-shapes-fullscreen-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await openSettingsCategory(page,'拡張');
  const nav=page.getByRole('navigation',{name:'拡張モードの細かい設定'});
  const back=page.locator('#three-extensions-fullscreen-detail').getByRole('button',{name:'細かい設定一覧へ'});
  const dock=page.locator('.studio-app > .studio-mobile-dock');
  const dockBefore=await dock.boundingBox();
  await nav.getByRole('button',{name:'GALAXY MODE · 巨大銀河の詳細設定を開く'}).click();
  await page.getByRole('checkbox',{name:'GALAXY MODEを有効化'}).check();
  await back.click();
  await nav.getByRole('button',{name:'NEBULA MODE · 星雲空間の詳細設定を開く'}).click();
  await page.getByLabel('星雲プリセット').selectOption('deep_blue');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-mode','on');
  await expect(preview).toHaveAttribute('data-nebula-mode','on');
  await page.keyboard.press('Escape');
  await nav.getByRole('button',{name:'PARTICLE MODE · 渦巻き集合の詳細設定を開く'}).click();
  await page.getByRole('checkbox',{name:'PARTICLE MODEを有効化'}).check();
  await expect(preview).toHaveAttribute('data-galaxy-mode','off');
  await expect(preview).toHaveAttribute('data-particle-mode','on');
  await expect(preview).toHaveAttribute('data-nebula-mode','on');
  await back.click();
  await expect(dock).toBeVisible();
  const dockAfter=await dock.boundingBox();
  expect(Math.abs(dockAfter!.x-dockBefore!.x)).toBeLessThan(1);
  expect(Math.abs(dockAfter!.y-dockBefore!.y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
