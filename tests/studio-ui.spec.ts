import {test,expect,type Page} from '@playwright/test';

async function openCategory(page:Page,name:string){
  if((await page.locator('.settings-screen').getAttribute('class'))?.includes('is-detail')){
    if((await page.locator('.settings-detail-current').textContent())===name)return;
    await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:name+'の設定を開く'}).check();
}

test('Studio v2 desktop quick tuning, command search, inspector, focus, and theme',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  await expect(page.locator('.studio-app')).toBeVisible();
  await expect(page.locator('.studio-controls')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'モバイルクイック操作'})).toBeHidden();
  await page.getByLabel('クイック比率').selectOption('9:16');
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('9:16');
  await page.getByLabel('クイック密度').fill('75');
  await expect(page.getByLabel('図形密度')).toHaveValue('75');

  await page.getByRole('button',{name:'コマンド検索'}).click();
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toBeVisible();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('背景');
  await page.getByText('背景の設定を開く',{exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.settings-detail-current')).toHaveText('背景');

  await page.getByRole('button',{name:'設定パネルの表示切り替え'}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-sidebar-collapsed/);
  await expect(page.locator('.studio-controls')).toBeHidden();
  await page.getByRole('button',{name:'設定パネルの表示切り替え'}).click();
  await expect(page.locator('.studio-controls')).toBeVisible();
  await page.getByRole('button',{name:'集中表示',exact:true}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-focus/);
  await expect(page.locator('.studio-controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.studio-app')).not.toHaveClass(/studio-focus/);
  await expect(page.locator('.studio-controls')).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button',{name:'UIテーマ切り替え'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(errors).toEqual([]);
});

test('Studio v2 mobile action dock and command navigation do not overflow',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  const dock=page.getByRole('navigation',{name:'モバイルクイック操作'});
  await expect(dock).toBeVisible();
  await expect(page.locator('.studio-preview-panel')).toBeVisible();
  const original=await page.getByTestId('current-seed').textContent();
  await dock.getByRole('button',{name:'新規'}).click();
  await expect(page.getByTestId('current-seed')).not.toHaveText(original!);

  await dock.getByRole('button',{name:'保存'}).click();
  await expect(page.locator('.settings-detail-current')).toHaveText('書き出し');
  await dock.getByRole('button',{name:'集中'}).click();
  await expect(page.locator('.studio-app')).toHaveClass(/studio-focus/);
  await dock.getByRole('button',{name:'戻る'}).click();
  await expect(page.locator('.studio-app')).not.toHaveClass(/studio-focus/);

  await dock.getByRole('button',{name:'探す'}).click();
  await page.getByRole('searchbox',{name:'コマンドを検索'}).fill('カラー');
  await page.getByText('カラーの設定を開く',{exact:true}).click();
  await expect(page.locator('.settings-detail-current')).toHaveText('カラー');
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('Studio v2 advanced settings share one checkbox design and circled info toggles',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  // Keep the old accessible name while simplifying the visible seed label.
  await expect(page.getByLabel('シード値',{exact:true})).toBeVisible();
  await expect(page.getByText('模様の合言葉',{exact:true})).toBeVisible();
  await openCategory(page,'背景');
  const info=page.locator('#panel-background .studio-info-disclosure').first();
  await expect(info).toBeVisible();
  await expect(info.locator('.studio-info-icon')).toHaveText('i');
  const popup=page.getByTestId('studio-info-popover');
  await expect(popup).toHaveCount(0);
  await info.locator('summary').click();
  await expect(popup).toBeVisible();
  await info.locator('summary').press('Enter');
  await expect(popup).toHaveCount(0);
  await openCategory(page,'アニメーション');
  const checkbox=page.locator('#panel-animation input[type="checkbox"]').first();
  await expect(checkbox).toBeVisible();
  const style=await checkbox.evaluate(element=>{
    const computed=getComputedStyle(element);
    return {appearance:computed.appearance,width:element.getBoundingClientRect().width,
      radius:computed.borderRadius};
  });
  expect(style.appearance).toBe('none');
  expect(style.width).toBeGreaterThanOrEqual(18);
  expect(style.radius).toBe('6px');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openCategory(page,'アニメーション');
  await expect(page.getByRole('heading',{name:'自動切り替え'})).toBeVisible();
  await expect(page.getByLabel('3D待機画面モードを有効化')).toBeVisible();
  const standbyInfo=page.locator('.three-standby-controls .studio-info-disclosure');
  await expect(popup).toHaveCount(0);
  await standbyInfo.locator('summary').click();
  await expect(popup).toContainText('なめらか');
  expect(errors).toEqual([]);
});

test('Compact seed help sits next to the label instead of beneath the seed input',async({page})=>{
  // Geometry assertions must sample both boxes in one stable animation state.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  const row=page.locator('#panel-shapes .studio-setting-label').filter({
    has:page.getByText('模様の合言葉',{exact:true}),
  });
  const label=row.locator('label[for="seed"]');
  const trigger=row.locator('.studio-info-disclosure > summary');
  await expect(label).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-label','シードの説明');
  await expect(trigger.locator('.studio-info-icon')).toHaveText('i');
  const popup=page.getByTestId('studio-info-popover');
  await expect(popup).toHaveCount(0);
  const labelBox=await label.boundingBox(),buttonBox=await trigger.boundingBox();
  expect(labelBox).not.toBeNull();expect(buttonBox).not.toBeNull();
  expect(buttonBox!.width).toBeLessThanOrEqual(34);
  expect(buttonBox!.x).toBeGreaterThanOrEqual(labelBox!.x+labelBox!.width-2);
  expect(Math.abs(buttonBox!.y+buttonBox!.height/2-(labelBox!.y+labelBox!.height/2)))
    .toBeLessThan(12);
  await trigger.click();
  await expect(popup).toContainText('同じ模様');
  await expect(popup).toBeVisible();
  const rect=await popup.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.width).toBeGreaterThan(280);
  expect(rect!.width).toBeLessThanOrEqual(365);
  expect(rect!.x).toBeGreaterThanOrEqual(8);
  expect(rect!.x+rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width-6);
  // A tap elsewhere or on the explanation deselects the hint.
  await page.mouse.click(8,8); // Outside even if the popup covers nearby controls.
  await expect(popup).toHaveCount(0);
  await trigger.click();
  await expect(popup).toBeVisible();
  await popup.click();
  await expect(popup).toHaveCount(0);
  await trigger.click();
  await expect(popup).toBeVisible();
  await trigger.click();
  await expect(popup).toHaveCount(0);
  // Selection is exclusive: opening another i replaces this explanation.
  await trigger.click();
  const ratioHint=page.locator('#panel-shapes .ratio-section .studio-info-disclosure > summary');
  await ratioHint.click();
  await expect(popup).toContainText('図形の形を保ったまま');
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  expect(await popup.evaluate(el=>Number(getComputedStyle(el).zIndex))).toBeGreaterThan(50);
  // Regression for the narrow shape-legend bubble reported on mobile.
  const shapeHint=page.locator('.shape-kind-controls .studio-info-disclosure > summary');
  await shapeHint.click();
  await expect(popup).toContainText('OFFの図形');
  const shapeBox=await popup.boundingBox();
  expect(shapeBox).not.toBeNull();
  expect(shapeBox!.width).toBeGreaterThan(280);
  await page.locator('.shape-kind-presets button').first().click();
  await expect(popup).toHaveCount(0);
});


test('Studio command search supports slash, multi-term matching and five-item paging',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.focus();
  await seed.press('/');
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toHaveCount(0);
  await seed.evaluate(element=>(element as HTMLElement).blur());
  await page.keyboard.press('/');
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  await expect(search).toBeFocused();
  await search.fill('2d svg');
  await expect(page.getByText('2Dモードに切り替える',{exact:true})).toBeVisible();
  await search.fill('存在しない 2d');
  await expect(page.locator('.studio-command-result')).toHaveCount(0);
  await search.fill('');
  const items=page.locator('.studio-command-result');
  expect(await items.count()).toBeGreaterThan(6);
  await search.press('PageDown');
  await expect(items.nth(5)).toHaveAttribute('aria-current','true');
  await search.press('PageUp');
  await expect(items.first()).toHaveAttribute('aria-current','true');
  await search.press('End');
  await expect(items.last()).toHaveAttribute('aria-current','true');
  await search.press('Home');
  await expect(items.first()).toHaveAttribute('aria-current','true');
});

test('Studio command favorites and recent actions survive reopening and reload',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  await page.getByRole('button',{name:'コマンド検索'}).click();
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  await search.fill('背景');
  await expect(page.locator('.studio-command-result').first()).toContainText('背景の設定を開く');
  await page.getByRole('button',{name:'☆ 選択中をお気に入り'}).click();
  await expect(page.getByRole('button',{name:'★ お気に入り解除'})).toHaveAttribute('aria-pressed','true');
  await search.fill('');
  await expect(page.locator('.studio-command-result').first()).toContainText('背景の設定を開く');
  await search.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'コマンド検索'}).click();
  await expect(page.locator('.studio-command-result').first()).toContainText('背景の設定を開く');
  await expect(page.getByText('★ 1 件のお気に入り')).toBeVisible();
  await page.getByRole('button',{name:'★ お気に入り解除'}).click();
  await expect(page.getByRole('button',{name:'☆ 選択中をお気に入り'})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.studio-command-result').first()).toContainText('背景の設定を開く');
});

test('Seed clipboard can copy and paste reproducible project seeds',async({page})=>{
  await page.addInitScript(()=>{
    const clipWindow=window as Window & {__seedTestClipboard?:string};
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText:async(text:string)=>{clipWindow.__seedTestClipboard=text;},
      readText:async()=>clipWindow.__seedTestClipboard??'',
    }});
  });
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'図形');
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.fill('copied-seed-42');
  await page.getByRole('button',{name:'シードをコピー',exact:true}).click();
  await expect(page.getByText('シードをコピーしました')).toBeVisible();
  expect(await page.evaluate(()=>(window as Window & {__seedTestClipboard?:string}).__seedTestClipboard))
    .toBe('copied-seed-42');
  await page.evaluate(()=>{(window as Window & {__seedTestClipboard?:string}).__seedTestClipboard='pasted-seed-77';});
  await page.getByRole('button',{name:'シードを貼り付け',exact:true}).click();
  await expect(seed).toHaveValue('pasted-seed-77');
  await expect(page.getByTestId('current-seed')).toHaveText('pasted-seed-77');
  await expect(page.getByText('シードを貼り付けて生成しました')).toBeVisible();
});
