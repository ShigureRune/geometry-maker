import {openSettingsCategory} from './settings-test-helper';
import {test, expect, type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test.setTimeout(90_000);
async function category(page:Page,name:string){await openSettingsCategory(page,name);}
async function start(page: Page) {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await page.getByRole('button', {name: '3Dモード', exact: true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await category(page, '図形');
}
/** Open the nested celestial inspector in the checkbox-based fine settings UI. */
async function celestialControls(page: Page) {
  await category(page, '図形');
  const controls = page.locator('.three-shape-controls');
  const overview = controls.getByRole('button', {name: '星や惑星の詳細設定を開く'});
  if (await overview.count() && await controls.getAttribute('data-fine-selected') !== 'celestial') {
    const back = controls.getByRole('button', {name: '細かい設定一覧へ'});
    if (await back.isVisible()) await back.click();
    await overview.click();
  }
}
/** Select the nested export inspector, including when another export detail is open. */
async function exportControls(page: Page, section: 'image' | 'settings') {
  await category(page, '書き出し');
  const fine = page.locator('#fine-sections-export-3d');
  if (await fine.count()) {
    const choice = fine.locator('#fine-export-3d-' + section);
    if ((await choice.getAttribute('aria-expanded')) !== 'true') {
      const back = fine.locator('.fine-sections-back-button');
      if (await back.isVisible()) await back.click();
      await choice.click();
    }
  }
}
async function png(page: Page) {
  await exportControls(page, 'image');
  await page.getByLabel('3D 幅 (px)').fill('512');
  await page.getByLabel('3D 高さ (px)').fill('512');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', {name: '3D PNGを書き出す', exact: true}).click();
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  return readFile((await download.path())!);
}
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('celestial-only preset draws six bodies, updates PNG and keeps the original solids intact', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const preview = page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-celestial-count', '0');
  const original = await png(page);
  await celestialControls(page);
  await page.getByRole('button', {name: '天体のみ表示'}).click();
  await expect(preview).toHaveAttribute('data-object-count', '0');
  await expect(preview).toHaveAttribute('data-celestial-count', '6');
  const withStars = await png(page);
  expect(hash(withStars)).not.toBe(hash(original));
  await celestialControls(page);
  await page.getByLabel('ブラックホールを生成').uncheck();
  await expect(preview).toHaveAttribute('data-celestial-count', '5');
  expect(hash(await png(page))).not.toBe(hash(withStars));
  await celestialControls(page);
  await page.getByRole('button', {name: '図形＋天体'}).click();
  expect(Number(await preview.getAttribute('data-object-count'))).toBeGreaterThan(0);
  await expect(preview).toHaveAttribute('data-celestial-count', '6');
  await page.getByRole('button', {name: '2Dモード', exact: true}).click();
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(errors).toEqual([]);
});

test('celestial settings are saved, restored and render identically while paused', async ({page}) => {
  await start(page);
  await celestialControls(page);
  await page.getByRole('button', {name: '天体のみ表示'}).click();
  await category(page, 'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').uncheck();
  const before = await png(page);
  expect(hash(await png(page))).toBe(hash(before));
  await exportControls(page, 'settings');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', {name: '3Dの設定を保存'}).click();
  const download = await waiting;
  const bytes = await readFile((await download.path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.settings.celestial.enabled).toBe(true);
  expect(saved.settings.celestial.kinds).toHaveLength(6);
  await category(page, '図形');
  await page.getByLabel('3D天体を表示').uncheck();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count', '0');
  await exportControls(page, 'settings');
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({name: 'celestial.json', mimeType: 'application/json', buffer: bytes});
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-celestial-count', '6');
  expect(hash(await png(page))).toBe(hash(before));
});
