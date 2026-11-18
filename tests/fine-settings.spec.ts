import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test.setTimeout(120_000);

test('fine settings preview opens individual particle and galaxy inspectors without confusing enable switches',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await openSettingsCategory(page,'図形');

  const nav=page.getByRole('navigation',{name:'粒子・銀河の個別設定'});
  const particleDetail=page.getByTestId('particle-mode-controls');
  const galaxyDetail=page.getByTestId('galaxy-mode-controls');
  const particleChoice=nav.getByRole('checkbox',{name:'PARTICLE MODEの詳細設定を開く'});
  const galaxyChoice=nav.getByRole('checkbox',{name:'GALAXY MODEの詳細設定を開く'});
  await expect(nav).toBeVisible();
  await expect(particleChoice).not.toBeChecked();
  await expect(galaxyChoice).not.toBeChecked();
  await expect(particleDetail).toBeHidden();
  await expect(galaxyDetail).toBeHidden();

  await particleChoice.check();
  const back=page.getByRole('button',{name:'細かい設定一覧へ'});
  await expect(back).toBeFocused();
  await expect(particleDetail).toBeVisible();
  await expect(galaxyDetail).toBeHidden();
  await page.getByRole('checkbox',{name:'PARTICLE MODEを有効化'}).check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','on');
  await back.click();
  await expect(nav).toBeVisible();
  await expect(particleChoice).toBeFocused();
  await expect(particleChoice).not.toBeChecked();
  await expect(nav).toContainText('現在ON');

  await galaxyChoice.check();
  await expect(galaxyDetail).toBeVisible();
  await expect(particleDetail).toBeHidden();
  await page.getByRole('checkbox',{name:'GALAXY MODEを有効化'}).check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','off');
  await page.keyboard.press('Escape');
  await expect(nav).toBeVisible();
  await expect(galaxyChoice).toBeFocused();
  await expect(galaxyDetail).toBeHidden();
  expect(errors).toEqual([]);
});

test('ordinary 3D settings keep the pre-existing checkbox workflow until fine settings are adopted',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await openSettingsCategory(page,'図形');
  await expect(page.getByTestId('particle-mode-controls')).toBeVisible();
  await expect(page.getByTestId('galaxy-mode-controls')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'粒子・銀河の個別設定'})).toHaveCount(0);
});
