import {test,expect} from '@playwright/test';

test('iPhone screenshot gallery persists across reload and supports 2D filters, seed search, reuse and delete',async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?seed=gallery-demo-2026');
  await page.getByLabel('クイック比率').selectOption('9:16');
  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  const gallery=page.getByRole('dialog',{name:'スクショ作品ギャラリー'});
  await expect(gallery).toBeVisible();
  await expect(gallery.getByTestId('gallery-empty')).toBeVisible();
  await gallery.getByRole('button',{name:'ギャラリーを閉じる'}).click();

  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const photo=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(photo).toBeVisible({timeout:45000});
  await expect(photo.getByTestId('screenshot-image')).toHaveJSProperty('naturalHeight',1600);
  await photo.getByRole('button',{name:'スクショ画面を閉じる'}).click();

  await expect.poll(async()=>page.evaluate(async()=>{
    return new Promise<number>((resolve,reject)=>{
      const req=indexedDB.open('geometry-maker-screenshot-gallery-v1');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('captures','readonly');
        const count=tx.objectStore('captures').count();
        count.onsuccess=()=>resolve(count.result);
        tx.oncomplete=()=>db.close();
      };
    });
  })).toBe(1);
  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await expect(gallery).toContainText('gallery-demo-2026');
  await expect(gallery).toContainText('2D · 9:16 · 900×1600');
  await gallery.getByRole('button',{name:'3D',exact:true}).click();
  await expect(gallery).toContainText('条件に合うスクショがありません');
  await gallery.getByRole('button',{name:'2D',exact:true}).click();
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  const search=gallery.getByRole('searchbox',{name:'スクショをシード値で検索'});
  await search.fill('does-not-exist');
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(0);
  await search.fill('gallery-demo');
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await gallery.getByRole('button',{name:'ギャラリーを閉じる'}).click();

  await page.reload();
  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await gallery.getByRole('button',{name:'写真を開く'}).click();
  await expect(gallery).toHaveCount(0);
  await expect(photo).toBeVisible();
  await expect(photo).toContainText('gallery-demo-2026');
  await expect(photo.getByTestId('screenshot-image')).toHaveJSProperty('naturalWidth',900);
  await photo.getByRole('button',{name:'スクショ画面を閉じる'}).click();

  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  await gallery.getByRole('button',{name:'スクショを削除：gallery-demo-2026'}).click();
  await expect(gallery.getByTestId('gallery-empty')).toBeVisible();
  await gallery.getByRole('button',{name:'ギャラリーを閉じる'}).click();
  expect(errors).toEqual([]);
});

test('gallery bulk clear requires a second confirmation and does not change editor seed',async({page})=>{
  test.setTimeout(90000);
  await page.goto('./?seed=archive-seed-2026');
  const before=await page.getByTestId('current-seed').textContent();
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const photo=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(photo).toBeVisible({timeout:45000});
  await photo.getByRole('button',{name:'スクショ画面を閉じる'}).click();
  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  const gallery=page.getByRole('dialog',{name:'スクショ作品ギャラリー'});
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await gallery.getByRole('button',{name:'履歴をすべて削除'}).click();
  await expect(gallery.getByRole('button',{name:'全件削除する'})).toBeVisible();
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await gallery.getByRole('button',{name:'キャンセル'}).click();
  await expect(gallery.getByTestId('gallery-item')).toHaveCount(1);
  await gallery.getByRole('button',{name:'履歴をすべて削除'}).click();
  await gallery.getByRole('button',{name:'全件削除する'}).click();
  await expect(gallery.getByTestId('gallery-empty')).toBeVisible();
  await gallery.getByRole('button',{name:'ギャラリーを閉じる'}).click();
  await expect(page.getByTestId('current-seed')).toHaveText(before??'');
});

test('screenshot gallery works when storage is unavailable: capture and PNG download remain usable',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
  });
  await page.goto('./');
  await page.getByRole('button',{name:'スクショ',exact:true}).click();
  const photo=page.getByRole('dialog',{name:'スクショのプレビュー'});
  await expect(photo).toBeVisible();
  await expect(photo.getByTestId('screenshot-image')).toBeVisible();
  await photo.getByRole('button',{name:'スクショ画面を閉じる'}).click();
  await expect(page.getByText('ギャラリーに自動保存できませんでした。')).toBeVisible();
  await page.getByRole('button',{name:'スクショギャラリー'}).click();
  await expect(page.getByRole('dialog',{name:'スクショ作品ギャラリー'}))
    .toContainText('ギャラリーを開けませんでした。');
});
