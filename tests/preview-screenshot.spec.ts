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
  await expect(dialog).toContainText('画像の自動添付には対応していない');

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

test('screenshot delivers PNG files to native share and works in square format',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{
      const file=data.files?.[0];
      Object.assign(window,{screenshotSharedFile:file?{
        name:file.name,type:file.type,size:file.size,
      }:null});
    }});
  });
  await page.goto('./');
  await page.getByLabel('クイック比率').selectOption('1:1');
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('screenshot-image')).toHaveJSProperty('naturalHeight',1200);
  await dialog.getByRole('button',{name:'共有',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>(
    window as Window & {screenshotSharedFile?:{name:string;type:string;size:number}}
  ).screenshotSharedFile)).toMatchObject({
    name:/_screenshot_1200x1200\.png$/,type:'image/png',
  });
  const shared=await page.evaluate(()=>(
    window as Window & {screenshotSharedFile?:{size:number}}
  ).screenshotSharedFile?.size??0);
  expect(shared).toBeGreaterThan(100);
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
