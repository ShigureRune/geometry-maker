import {openSettingsCategory} from './settings-test-helper';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('2D exploration compares related and random seed batches without changing the current work',async({page})=>{
  test.setTimeout(75_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.fill('explorer-browser-source');
  await seed.press('Enter');
  await page.getByRole('button',{name:'構図探索ボードを開く'}).click();
  const dialog=page.getByRole('dialog',{name:'構図探索ボード'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.seed-explorer-card')).toHaveCount(4);
  const original=await dialog.locator('.seed-explorer-card code').allTextContents();
  expect(new Set(original).size).toBe(4);
  await expect(dialog.locator('.seed-explorer-thumbnail svg')).toHaveCount(6);
  await dialog.getByRole('button',{name:'派生案を8件'}).click();
  await expect(dialog.locator('.seed-explorer-card')).toHaveCount(8);
  await dialog.getByRole('button',{name:'前の候補セット'}).click();
  await expect(dialog.locator('.seed-explorer-card code')).toHaveText(original);
  await dialog.getByRole('button',{name:'ランダム案を4件'}).click();
  await expect(dialog.locator('.seed-explorer-card')).toHaveCount(4);
  const random=await dialog.locator('.seed-explorer-card code').allTextContents();
  expect(new Set(random).size).toBe(4);
  await dialog.getByRole('button',{name:'候補 3 を比較Aに指定'}).click();
  await expect(dialog.getByRole('button',{name:'候補 3 を比較Aに指定'}))
    .toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'現在のシードを追加'}).click();
  await expect(dialog.locator('.seed-explorer-card code').first()).toHaveText('explorer-browser-source');
  await dialog.getByRole('button',{name:'探索ボードを閉じる'}).click();
  await expect(seed).toHaveValue('explorer-browser-source');
  expect(errors).toEqual([]);
});

test('favorite a candidate, adopt it, then reuse it from the existing Seed Vault',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  await page.getByLabel('シード値',{exact:true}).fill('explorer-favorites-start');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'構図探索ボードを開く'}).click();
  const dialog=page.getByRole('dialog',{name:'構図探索ボード'});
  const picked=await dialog.locator('.seed-explorer-card code').first().innerText();
  await dialog.getByRole('button',{name:'候補 1 をお気に入り保存'}).click();
  await expect(dialog.locator('.seed-explorer-card').first()).toContainText('★ 保存済み');
  await dialog.getByRole('button',{name:'候補 1 を採用'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue(picked);
  await expect(page.getByRole('button',{name:'探索案 1を呼び出す'})).toBeVisible();
  await page.getByRole('button',{name:'← 前のシード'}).click();
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('explorer-favorites-start');
  await page.getByRole('button',{name:'探索案 1を呼び出す'}).click();
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue(picked);
});

test('copy share links, export candidate TXT and close the mobile gallery with Escape',async({page})=>{
  test.setTimeout(60_000);
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:async(text:string)=>{(window as Window & {__explorerCopy?:string}).__explorerCopy=text;},
    }});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  await page.getByRole('button',{name:'構図探索ボードを開く'}).click();
  const dialog=page.getByRole('dialog',{name:'構図探索ボード'});
  await expect(dialog).toBeVisible();
  const bounds=await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  const first=await dialog.locator('.seed-explorer-card code').first().innerText();
  await dialog.getByRole('button',{name:'候補 1 の共有リンクをコピー'}).click();
  const link=await page.evaluate(()=>(window as Window & {__explorerCopy?:string}).__explorerCopy);
  const url=new URL(link!);
  expect(url.searchParams.get('seed')).toBe(first);
  expect(url.pathname).toBe(new URL(page.url()).pathname);
  await dialog.getByRole('button',{name:'全候補のシードをコピー'}).click();
  expect((await page.evaluate(()=>(window as Window & {__explorerCopy?:string}).__explorerCopy))?.split('\n'))
    .toHaveLength(4);
  const download=page.waitForEvent('download');
  await dialog.getByRole('button',{name:'全候補をTXT保存'}).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('geometry-maker-candidates.txt');
  const text=await readFile((await file.path())!,'utf8');
  expect(text.split('\n')).toHaveLength(4);
  expect(text.split('\n')[0]).toBe(first);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
