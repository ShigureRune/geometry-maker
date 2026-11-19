import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';
import {STUDIO_AUTOSAVE_KEY} from '../src/studio-autosave';

test.setTimeout(150_000);

test('one-tap VOID and PARTICLE looks update the live cosmic web and its saved settings',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'拡張');
  const nav=page.getByRole('navigation',{name:'拡張モードの細かい設定'});
  const back=page.locator('#three-extensions-fullscreen-detail').getByRole('button',{name:'細かい設定一覧へ'});
  const dock=page.locator('.studio-app > .studio-mobile-dock');
  const initialDock=await dock.boundingBox();
  await nav.getByRole('button',{name:'VOID MODE · コズミックウェブの詳細設定を開く'}).click();
  await page.getByLabel('VOIDの演出プリセット').selectOption('neon');
  await expect(page.getByLabel('VOID MODEを有効化')).toBeChecked();
  await expect(page.locator('#void-object-limit')).toHaveValue('2400');
  await expect(page.locator('#void-depth-fade')).toHaveValue('65');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-void-mode','web');
  await back.click();
  await expect(nav.getByRole('button',{name:/VOID MODE/})).toContainText('現在ON');
  await nav.getByRole('button',{name:'PARTICLE MODE · 渦巻き集合の詳細設定を開く'}).click();
  await page.getByLabel('粒子の演出プリセット').selectOption('vortex');
  await expect(page.getByLabel('PARTICLE MODEを有効化')).toBeChecked();
  await expect(page.locator('#particle-count')).toHaveValue('80000');
  await expect(page.locator('#particle-swirl')).toHaveValue('2.7');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','on');
  await expect.poll(async()=>page.evaluate(key=>{
    const stored=JSON.parse(localStorage.getItem(key)||'null');
    return {
      voidLimit:stored?.threeD?.settings?.voidMode?.objectLimit,
      cloudCount:stored?.threeD?.settings?.voidMode?.particleCount,
      nodeShare:stored?.threeD?.settings?.voidMode?.nodeShare,
      swirl:stored?.threeD?.settings?.particle?.swirl,
    };
  },STUDIO_AUTOSAVE_KEY)).toEqual({voidLimit:2400,cloudCount:80000,nodeShare:90,swirl:2.7});
  await back.click();
  await expect(dock).toBeVisible();
  const endDock=await dock.boundingBox();
  expect(Math.abs(endDock!.x-initialDock!.x)).toBeLessThan(1);
  expect(Math.abs(endDock!.y-initialDock!.y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('cinematic GALAXY looks retain manual adjustments and survive a reload',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'拡張');
  const nav=page.getByRole('navigation',{name:'拡張モードの細かい設定'});
  await nav.getByRole('button',{name:'GALAXY MODE · 巨大銀河の詳細設定を開く'}).click();
  await page.getByLabel('GALAXY MODEを有効化').check();
  await page.getByLabel('銀河プリセット').selectOption('blueNight');
  await expect(page.locator('#galaxy-radius')).toHaveValue('7.5');
  await expect(page.locator('#galaxy-palette')).toHaveValue('blue');
  await page.locator('#galaxy-twist').fill('2.4');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  await expect.poll(async()=>page.evaluate(key=>
    JSON.parse(localStorage.getItem(key)||'null')?.threeD?.settings?.galaxy?.twist,
  STUDIO_AUTOSAVE_KEY)).toBe(2.4);
  await page.reload();
  await openSettingsCategory(page,'拡張');
  await nav.getByRole('button',{name:'GALAXY MODE · 巨大銀河の詳細設定を開く'}).click();
  await expect(page.locator('#galaxy-twist')).toHaveValue('2.4');
  await expect(page.locator('#galaxy-palette')).toHaveValue('blue');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  expect(errors).toEqual([]);
});
