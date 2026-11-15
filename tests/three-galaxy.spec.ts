import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function openGalaxy(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await page.getByLabel('シード値',{exact:true}).fill('galaxy-ci');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await page.getByLabel('GALAXY MODEを有効化').check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
}
test('galaxy renders stars, responds to controls and switches cleanly to particles',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const shaderErrors:string[]=[];
  page.on('console',message=>{
    if(message.type()==='error'&&/shader error|shader compile|webglprogram/i.test(message.text()))
      shaderErrors.push(message.text());
  });
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-count','3600');
  await expect(preview).toHaveAttribute('data-galaxy-arms','2');
  await expect(preview).toHaveAttribute('data-galaxy-space-background','on');
  await page.getByLabel('銀河に暗い宇宙背景を使う').uncheck();
  await expect(preview).toHaveAttribute('data-galaxy-space-background','off');
  await page.getByLabel('銀河に暗い宇宙背景を使う').check();
  await expect(preview).toHaveAttribute('data-galaxy-space-background','on');
  await expect(preview).toHaveAttribute('data-floor-grid','off');
  // Retain a real browser rendering for visual QA, rather than inferring
  // galaxy realism from settings and geometric unit tests alone.
  await page.waitForTimeout(500);
  await mkdir('test-results',{recursive:true});
  const initial=await preview.locator('canvas').screenshot({path:'test-results/galaxy-v3-visible-disk.png'});
  await page.locator('#galaxy-arms').fill('6');
  await page.locator('#galaxy-arm-width').fill('1.8');
  await page.locator('#galaxy-inclination').fill('40');
  await page.getByLabel('棒状渦巻銀河にする').check();
  await page.locator('#galaxy-count').fill('2000');
  await page.locator('#galaxy-palette').selectOption('blue');
  await expect(preview).toHaveAttribute('data-galaxy-arms','6');
  await expect(preview).toHaveAttribute('data-galaxy-count','2000');
  await expect(page.getByLabel('棒状渦巻銀河にする')).toBeChecked();
  await expect(page.locator('#galaxy-inclination')).toHaveValue('40');
  const changed=await preview.locator('canvas').screenshot();
  expect(initial.equals(changed)).toBe(false);
  await page.getByRole('button',{name:'観測写真風（2本腕）に整える'}).click();
  await expect(preview).toHaveAttribute('data-galaxy-arms','2');
  await expect(page.locator('#galaxy-count')).toHaveValue('18000');
  await expect(preview).toHaveAttribute('data-galaxy-count','3600');
  await page.getByLabel('PARTICLE MODEを有効化').check();
  await expect(preview).toHaveAttribute('data-galaxy-mode','off');
  await expect(preview).toHaveAttribute('data-particle-mode','on');
  expect(shaderErrors).toEqual([]);
  expect(errors).toEqual([]);
});
test('galaxy settings export as 3D JSON and restore',async({page})=>{
  await openGalaxy(page);
  await page.locator('#galaxy-arms').fill('5');
  await page.locator('#galaxy-count').fill('5000');
  await page.locator('#galaxy-palette').selectOption('gold');
  await page.locator('#galaxy-arm-width').fill('2');
  await page.locator('#galaxy-inclination').fill('35');
  await page.getByLabel('棒状渦巻銀河にする').check();
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const project=JSON.parse((await readFile((await (await pending).path())!)).toString('utf8'));
  expect(project.settings.galaxy).toMatchObject({enabled:true,arms:5,count:5000,palette:'gold',armWidth:2,inclination:35,barred:true,darkBackground:true});
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'galaxy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project)),
  });
  await category(page,'図形');
  await expect(page.getByLabel('GALAXY MODEを有効化')).toBeChecked();
  await expect(page.locator('#galaxy-palette')).toHaveValue('gold');
  await expect(page.getByLabel('棒状渦巻銀河にする')).toBeChecked();
  await expect(page.locator('#galaxy-inclination')).toHaveValue('35');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
});
test('galaxy morphs when the seed changes and pauses with the 3D clock',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await openGalaxy(page);
  await page.locator('#galaxy-transition').fill('4');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.getByRole('button',{name:'銀河形成を最初から再生'}).click();
  await category(page,'図形');
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-seed-phase','transition');
  await expect.poll(async()=>Number(await preview.getAttribute('data-galaxy-seed-progress'))).toBeGreaterThan(.02);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  const frozen=await preview.getAttribute('data-galaxy-seed-progress');
  await page.waitForTimeout(200);
  expect(await preview.getAttribute('data-galaxy-seed-progress')).toBe(frozen);
  await page.getByRole('button',{name:'3Dを再生'}).click();
  await expect(preview).toHaveAttribute('data-galaxy-seed-phase','settled',{timeout:12000});
  expect(errors).toEqual([]);
});
