import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test('live palette export offers CSS, GIMP and SVG without modifying the seed',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./?fine-preview=1');
  const original=await page.getByTestId('current-seed').textContent();
  await openSettingsCategory(page,'カラー');
  await page.getByRole('button',{name:'配色を持ち出すの詳細設定を開く'}).click();
  const panel=page.getByRole('region',{name:'配色の持ち出し'});
  await expect(panel).toBeVisible();
  await expect(panel.locator('.palette-export-swatches > div')).toHaveCount(7);
  const css=page.waitForEvent('download');
  await panel.getByRole('button',{name:'CSSを保存'}).click();
  const downloaded=await css;
  expect(downloaded.suggestedFilename()).toBe('geometry-palette.css');
  const gpl=page.waitForEvent('download');
  await panel.getByRole('button',{name:'GIMPパレットを保存'}).click();
  expect((await gpl).suggestedFilename()).toBe('geometry-palette.gpl');
  const svg=page.waitForEvent('download');
  await panel.getByRole('button',{name:'SVG色見本を保存'}).click();
  expect((await svg).suggestedFilename()).toBe('geometry-palette.svg');
  await expect(page.getByTestId('current-seed')).toHaveText(original!);
  expect(errors).toEqual([]);
});
