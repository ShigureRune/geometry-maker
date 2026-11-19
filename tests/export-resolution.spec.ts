import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test('2D export locks the current dimensions, rotates orientation and keeps project settings',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await openSettingsCategory(page,'書き出し');
  await page.getByRole('button',{name:'画像と設定ファイルの保存の詳細設定を開く'}).click();
  const width=page.locator('#export-width');
  const height=page.locator('#export-height');
  await expect(width).toHaveValue('1920');
  await expect(height).toHaveValue('1080');
  const lock=page.getByRole('checkbox',{name:/縦横比を固定/});
  await lock.check();
  await width.fill('1280');
  await expect(height).toHaveValue('720');
  await expect(page.getByText(/0.92 MP/)).toBeVisible();
  await page.getByRole('button',{name:'縦横を入れ替え'}).click();
  await expect(width).toHaveValue('720');
  await expect(height).toHaveValue('1280');
  await height.fill('1920');
  await expect(width).toHaveValue('1080');
  await lock.uncheck();
  await width.fill('1000');
  await expect(height).toHaveValue('1920');
  await expect(page.getByText(/幅と高さを個別に編集できます/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('2D export preset and invalid input remain safe with aspect lock',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await openSettingsCategory(page,'書き出し');
  await page.getByRole('button',{name:'画像と設定ファイルの保存の詳細設定を開く'}).click();
  const width=page.locator('#export-width'),height=page.locator('#export-height');
  const lock=page.getByRole('checkbox',{name:/縦横比を固定/});
  await lock.check();
  await page.locator('#export-preset').selectOption('1080x1920');
  await expect(width).toHaveValue('1080');
  await expect(height).toHaveValue('1920');
  await width.fill('8192');
  await expect(page.getByText(/縦横比を保ったまま/)).toBeVisible();
  await expect(page.getByRole('button',{name:'PNGを書き出す'})).toBeDisabled();
  await page.locator('#export-preset').selectOption('1920x1080');
  await expect(width).toHaveValue('1920');
  await expect(height).toHaveValue('1080');
  await expect(lock).toBeChecked();
});
