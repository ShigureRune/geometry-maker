import {openSettingsCategory} from './settings-test-helper';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('seed history is committed, navigable, branched, and persists after reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  const original=await seed.inputValue();
  await seed.fill('first-vault-seed');
  await seed.press('Enter');
  await expect(page.getByLabel('履歴の位置')).toHaveText('2 / 2');
  await seed.fill('second-vault-seed');
  await seed.press('Enter');
  await expect(page.getByLabel('履歴の位置')).toHaveText('3 / 3');
  await page.getByRole('button',{name:'← 前のシード'}).click();
  await expect(seed).toHaveValue('first-vault-seed');
  await page.getByRole('button',{name:'次のシード →'}).click();
  await expect(seed).toHaveValue('second-vault-seed');
  await page.getByRole('button',{name:'← 前のシード'}).click();
  await seed.fill('branch-vault-seed');
  await seed.press('Enter');
  await expect(page.getByLabel('履歴の位置')).toHaveText('3 / 3');
  await expect(page.getByRole('button',{name:'次のシード →'})).toBeDisabled();
  await page.locator('.seed-vault-history summary').click();
  await expect(page.locator('.seed-vault-history')).not.toContainText('second-vault-seed');
  await expect(page.locator('.seed-vault-history')).toContainText(original);
  await expect.poll(async()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-studio-seed-vault-v1')??'null')?.history?.at(-1)??null;}
    catch{return null;}
  })).toBe('branch-vault-seed');
  await expect.poll(async()=>page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')?.twoD?.seed??null;}
    catch{return null;}
  })).toBe('branch-vault-seed');
  await page.reload();
   await openSettingsCategory(page,'図形');
  await expect(seed).toHaveValue('branch-vault-seed');
  await expect(page.getByLabel('履歴の位置')).toHaveText('3 / 3');
  await page.getByRole('button',{name:'← 前のシード'}).click();
  await expect(seed).toHaveValue('first-vault-seed');
  expect(errors).toEqual([]);
});

test('bookmarks can be named, searched, recalled, renamed and deleted',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.fill('star-vault-seed');await seed.press('Enter');
  await page.getByLabel('お気に入りの名前').fill('星空');
  await page.getByRole('button',{name:'☆ 現在のシードを保存'}).click();
  await expect(page.getByRole('button',{name:'星空を呼び出す'})).toBeVisible();
  await seed.fill('new-geometry-seed');await seed.press('Enter');
  await page.getByRole('button',{name:'星空を呼び出す'}).click();
  await expect(seed).toHaveValue('star-vault-seed');
  await page.getByLabel('保存済みシードを検索').fill('星空 star');
  await expect(page.getByRole('button',{name:'星空を呼び出す'})).toBeVisible();
  await page.getByRole('button',{name:'星空の名前を変更'}).click();
  await page.getByLabel('新しいシード名').fill('夜の星');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.getByLabel('保存済みシードを検索').fill('夜の星');
  await expect(page.getByRole('button',{name:'夜の星を呼び出す'})).toBeVisible();
  await page.reload();
   await openSettingsCategory(page,'図形');
  await expect(page.getByRole('button',{name:'夜の星を呼び出す'})).toBeVisible();
  await page.getByRole('button',{name:'夜の星を削除'}).click();
  await expect(page.getByText('まだ保存済みシードがありません。')).toBeVisible();
});

test('named seed collections round-trip JSON without replacing the active project',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.fill('json-library-seed');await seed.press('Enter');
  await page.getByLabel('お気に入りの名前').fill('一覧用');
  await page.getByRole('button',{name:'☆ 現在のシードを保存'}).click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'一覧をJSON保存'}).click();
  const saved=await download;
  expect(saved.suggestedFilename()).toBe('geometry-maker-seeds.json');
  const data=await readFile((await saved.path())!);
  expect(JSON.parse(data.toString())).toEqual({format:'geometry-maker-seed-collection',
    version:1,bookmarks:[{seed:'json-library-seed',name:'一覧用'}]});
  await page.getByRole('button',{name:'一覧用を削除'}).click();
  await page.getByLabel('シード一覧JSONを読み込む')
    .setInputFiles({name:'seeds.json',mimeType:'application/json',buffer:data});
  await expect(page.getByRole('button',{name:'一覧用を呼び出す'})).toBeVisible();
  await expect(seed).toHaveValue('json-library-seed');
  await expect(page.getByText('1件を追加、0件をスキップしました。')).toBeVisible();
  await page.getByLabel('シード一覧JSONを読み込む')
    .setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{not-json')});
  await expect(page.getByRole('button',{name:'一覧用を呼び出す'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'JSON'})).toBeVisible();
});

test('shared seed URLs are safe, survive a reload and do not leak editor data',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:async(text:string)=>{(window as Window & {__sharedSeedUrl?:string}).__sharedSeedUrl=text;},
    }});
  });
  await page.goto('./?legacy-ui=1&seed=shared%20seed%20%2F%2042');
  await openSettingsCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await expect(seed).toHaveValue('shared seed / 42');
  await expect.poll(()=>page.url()).not.toContain('?seed=');
  await page.getByRole('button',{name:'共有リンクをコピー'}).click();
  const link=await page.evaluate(()=>(window as Window & {__sharedSeedUrl?:string}).__sharedSeedUrl);
  expect(link).toBeTruthy();
  const shared=new URL(link!);
  expect(shared.searchParams.get('seed')).toBe('shared seed / 42');
  expect(shared.pathname).toBe(new URL(page.url()).pathname);
  expect(shared.search).not.toContain('textOverlay');
  await page.reload();
   await openSettingsCategory(page,'図形');
  await expect(seed).toHaveValue('shared seed / 42');
});
