import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('screenshot opens real photo with preview portrait ratio and PNG save/X actions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await page.getByLabel('クイック比率').selectOption('9:16');
  const seedBefore=await page.getByTestId('current-seed').textContent();
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('9:16 · 900 × 1600 px');
  const photo=dialog.getByTestId('screenshot-image');
  await expect(photo).toBeVisible();
  await expect.poll(async()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(900);
  await expect(photo).toHaveJSProperty('naturalHeight',1600);
  const actions=dialog.getByRole('group',{name:'スクショの操作'});
  await expect(actions.getByRole('button',{name:'保存'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'コピー'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'共有',exact:true})).toBeVisible();
  const x=actions.getByRole('link',{name:'Xで共有'});
  await expect(x).toBeVisible();
  await expect(x).toHaveAttribute('target','_blank');
  expect(new URL(await x.getAttribute('href')??'').pathname).toBe('/intent/tweet');
  await expect(dialog).toContainText('シード値：'+seedBefore);
  await expect(dialog).toContainText('画像をクリップボードにコピーし、シード値入りのX投稿画面を別タブで開きます');
  const fallback=new URL(await x.getAttribute('href')??'');
  expect(fallback.searchParams.get('text')).toContain('シード値：'+seedBefore);

  const download=page.waitForEvent('download');
  await actions.getByRole('button',{name:'保存'}).click();
  const file=await download;
  expect(file.suggestedFilename()).toContain('_screenshot_900x1600.png');
  const buffer=await readFile((await file.path())!);
  expect(buffer.subarray(1,4).toString()).toBe('PNG');
  expect(buffer.readUInt32BE(16)).toBe(900);
  expect(buffer.readUInt32BE(20)).toBe(1600);

  await dialog.getByRole('button',{name:'スクショ画面を閉じる'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('current-seed')).toHaveText(seedBefore??'');
  await expect(page.getByLabel('クイック比率')).toHaveValue('9:16');
  expect(errors).toEqual([]);
});

test('X opens directly while copying the PNG; native share still sends the seed',async({page})=>{
  test.setTimeout(100000);
  const seed='X用-紫雨+2026-🌌';
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:({files}:ShareData)=>!!files?.length});
    Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{
      const file=data.files?.[0];
      const existing=(window as Window & {screenshotShareCalls?:unknown[]}).screenshotShareCalls??[];
      existing.push({title:data.title,text:data.text,filename:file?.name,type:file?.type,size:file?.size});
      Object.assign(window,{screenshotShareCalls:existing});
    }});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      write:async(items:ClipboardItem[])=>{
        const png=await items[0].getType('image/png');
        Object.assign(window,{screenshotCopiedPng:{type:png.type,size:png.size}});
      },
    }});
  });
  // Never rely on an external X server in CI: the browser still executes
  // actual target=_blank navigation, intercepted on its first request.
  await page.context().route('https://twitter.com/**',route=>
    route.fulfill({status:200,contentType:'text/html',body:'<title>X composer</title>'}));
  await page.goto('./?seed='+encodeURIComponent(seed));
  const originalPath=new URL(page.url()).pathname;
  await page.getByLabel('クイック比率').selectOption('1:1');
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(dialog).toBeVisible({timeout:45000});
  await expect(dialog.getByTestId('screenshot-image')).toHaveJSProperty('naturalHeight',1200);
  await expect(dialog.getByTestId('screenshot-share-text')).toContainText('シード値：'+seed);
  await dialog.getByRole('button',{name:'共有',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>(
    window as Window & {screenshotShareCalls?:unknown[]}
  ).screenshotShareCalls?.length)).toBe(1);
  const calls=await page.evaluate(()=>(
    window as Window & {screenshotShareCalls?:{
      title:string;text:string;filename:string;type:string;size:number
    }[]}
  ).screenshotShareCalls??[]);
  expect(calls[0].text).toContain('シード値：'+seed);
  expect(calls[0].filename).toMatch(/_screenshot_1200x1200\.png$/);
  expect(calls[0].type).toBe('image/png');
  expect(calls[0].size).toBeGreaterThan(100);

  const x=dialog.getByRole('link',{name:'Xで共有'});
  await expect(x).toHaveAttribute('target','_blank');
  const href=new URL(await x.getAttribute('href')??'');
  expect(href.searchParams.get('text')).toContain('シード値：'+seed);
  const popupPromise=page.waitForEvent('popup');
  await x.click();
  const popup=await popupPromise;
  await expect.poll(()=>popup.url()).toContain('/intent/tweet');
  await expect.poll(async()=>page.evaluate(()=>(
    window as Window & {screenshotCopiedPng?:{type:string;size:number}}
  ).screenshotCopiedPng?.size??0)).toBeGreaterThan(100);
  const copied=await page.evaluate(()=>(
    window as Window & {screenshotCopiedPng?:{type:string;size:number}}
  ).screenshotCopiedPng);
  expect(copied?.type).toBe('image/png');
  // X launch is never intercepted by navigator.share, even if available.
  expect(await page.evaluate(()=>(
    window as Window & {screenshotShareCalls?:unknown[]}
  ).screenshotShareCalls?.length)).toBe(1);
  expect(new URL(page.url()).pathname).toBe(originalPath);
  await popup.close();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('X still opens with seed when clipboard copying is forbidden',async({page})=>{
  const seed='fallback-seed-2026';
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('X must not use native share')}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      write:async()=>{throw new Error('Clipboard permission denied');},
    }});
  });
  await page.context().route('https://twitter.com/**',route=>
    route.fulfill({status:200,contentType:'text/html',body:'<title>X composer</title>'}));
  await page.goto('./?seed='+seed);
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(dialog).toBeVisible();
  const x=dialog.getByRole('link',{name:'Xで共有'});
  const href=new URL(await x.getAttribute('href')??'');
  expect(href.hostname).toBe('twitter.com');
  expect(href.pathname).toBe('/intent/tweet');
  expect(href.searchParams.get('text')).toContain('シード値：'+seed);
  const popupPromise=page.waitForEvent('popup');
  await x.click();
  const popup=await popupPromise;
  await expect.poll(()=>popup.url()).toContain('/intent/tweet');
  await expect(dialog.getByRole('status').last()).toContainText('画像をコピーできませんでした');
  await expect(dialog.getByRole('button',{name:'投稿文をコピー'})).toBeVisible();
  await popup.close();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('3D live camera screenshot has correct preview aspect and closes cleanly',async({page})=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toBeVisible({timeout:60000});
  const snap=page.getByRole('button',{name:'スクショ',exact:true});
  await expect(snap).toBeEnabled({timeout:60000});
  await snap.click();
  const dialog=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(dialog).toBeVisible({timeout:60000});
  await expect(dialog).toContainText('3D · 16:9 · 1600 × 900 px');
  const img=dialog.getByTestId('screenshot-image');
  await expect.poll(async()=>img.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(1600);
  await expect(img).toHaveJSProperty('naturalHeight',900);
  await dialog.getByRole('button',{name:'スクショ画面を閉じる'}).click();
  await expect(preview).toBeVisible();
  expect(errors).toEqual([]);
});
