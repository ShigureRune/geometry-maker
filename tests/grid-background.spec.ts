import {test,expect,type Page} from './ui-test';

async function openCategory(page:Page,name:string){
  if((await page.locator('.settings-screen').getAttribute('class'))?.includes('is-detail')){
    if((await page.locator('.settings-detail-current').textContent())===name)return;
    await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:name+'の設定を開く'}).check();
}
import {readFile} from 'node:fs/promises';

test('2D grid controls, SVG/PNG export, JSON round-trip, and 3D isolation',async({page})=>{
  await page.goto('./?legacy-ui=1');

  await openCategory(page,'アニメーション');
  await page.getByLabel('アニメーションを有効化').uncheck();
  await openCategory(page,'背景');
  await expect(page.getByRole('heading',{name:'2Dグリッド背景'})).toBeVisible();
  const toggle=page.getByLabel('グリッド背景を有効化');
  await toggle.check();
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-type','line');
  await page.getByLabel('種類',{exact:true}).selectOption('dot');
  await page.locator('#grid-spacing').fill('80');
  await page.locator('#grid-opacity').fill('50');
  await page.locator('#grid-rotation').fill('20');
  await page.getByLabel('グリッドの色').selectOption('custom');
  await page.getByLabel('カスタム色').fill('#ff3355');
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-type','dot');
  const before=await page.getByTestId('shapes').evaluate(node=>node.outerHTML);
  await openCategory(page,'図形');
  await page.getByLabel('シード値').fill('stable-grid-test');
  const withSeed=await page.getByTestId('shapes').evaluate(node=>node.outerHTML);
  await openCategory(page,'背景');
  await toggle.uncheck();
  await expect(page.getByTestId('grid-background')).toHaveCount(0);
  await toggle.check();
  expect(await page.getByTestId('shapes').evaluate(node=>node.outerHTML)).toBe(withSeed);
  expect(before).not.toBe('');

  await openCategory(page,'書き出し');
  const saved=page.waitForEvent('download');
  await page.getByRole('button',{name:'作品の設定を保存',exact:true}).click();
  const data=await readFile((await (await saved).path())!);
  const project=JSON.parse(data.toString());
  expect(project.gridBackground.type).toBe('dot');
  expect(project.gridBackground.spacing).toBe(80);
  await page.getByLabel('保存した設定ファイル').setInputFiles({name:'grid.json',mimeType:'application/json',buffer:data});
  await openCategory(page,'背景');
  await expect(page.getByLabel('グリッド背景を有効化')).toBeChecked();

  await openCategory(page,'書き出し');
  const svgDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();
  const svg=(await readFile((await (await svgDownload).path())!)).toString();
  expect(svg).toContain('data-testid="grid-background"');
  expect(svg).toContain('#ff3355');
  const pngDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'PNGを書き出す',exact:true}).click();
  expect(await (await pngDownload).failure()).toBeNull();
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('grid-background')).toHaveCount(0);
});

test('animated grid scrolls, rotates and pulses independently of shape growth',async({page})=>{
 await page.goto('./?legacy-ui=1');

 await openCategory(page,'アニメーション');
 await page.getByLabel('アニメーションを有効化').uncheck();
 await openCategory(page,'背景');
 await page.getByLabel('グリッド背景を有効化').check();
 await page.getByLabel('グリッドアニメーションを有効化').check();
 await page.locator('#grid-animation-duration').fill('4');
 await page.locator('#grid-animation-speed').fill('7.5');
 await expect(page.locator('#grid-animation-speed')).toHaveValue('7.5');
 const pattern=page.getByTestId('grid-background').locator('pattern');
 await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-motion','scroll');
 const start=await pattern.getAttribute('patternTransform');
 await expect.poll(()=>pattern.getAttribute('patternTransform'),{timeout:4000}).not.toBe(start);
 await page.locator('#grid-animation-mode').selectOption('rotate');
 await page.getByLabel('反時計回り').check();
 await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-motion','rotate');
 const rotated=await pattern.getAttribute('patternTransform');
 await expect.poll(()=>pattern.getAttribute('patternTransform'),{timeout:4000}).not.toBe(rotated);
 await page.locator('#grid-animation-mode').selectOption('pulse');
 const opacity=page.getByTestId('grid-background').locator('rect').last();
 const before=await opacity.getAttribute('opacity');
 await expect.poll(()=>opacity.getAttribute('opacity'),{timeout:4000}).not.toBe(before);
 await openCategory(page,'書き出し');
 const saved=page.waitForEvent('download');
 await page.getByRole('button',{name:'作品の設定を保存',exact:true}).click();
 const bytes=await readFile((await(await saved).path())!);
 const settings=JSON.parse(bytes.toString());
 expect(settings.gridBackground.animation).toMatchObject({enabled:true,mode:'pulse',duration:4,speed:7.5,reverse:true});
 await page.getByLabel('保存した設定ファイル').setInputFiles({name:'grid-animated.json',mimeType:'application/json',buffer:bytes});
 await openCategory(page,'背景');
 await expect(page.getByLabel('グリッドアニメーションを有効化')).toBeChecked();
 await expect(page.locator('#grid-animation-mode')).toHaveValue('pulse');
 await page.locator('#grid-animation-mode').selectOption('scroll');
 await expect(page.locator('#grid-animation-speed')).toHaveValue('7.5');
 await expect(page.locator('#grid-animation-direction')).toHaveCount(0);
 await page.getByRole('button',{name:'3Dモード',exact:true}).click();
 await expect(page.getByTestId('grid-background')).toHaveCount(0);
});

test('grid speed is independent and follows the 0–360 degree infinite figure scroll setting',async({page})=>{
 await page.goto('./?legacy-ui=1');

 await openCategory(page,'背景');
 await page.getByLabel('グリッド背景を有効化').check();
 await page.getByLabel('グリッドアニメーションを有効化').check();
 await page.locator('#grid-animation-speed').fill('0.1');
 await expect(page.locator('#grid-animation-speed')).toHaveValue('0.1');
 await openCategory(page,'アニメーション');
 await page.getByLabel('自動待機画面を有効化').check();
 await page.getByLabel('待機アニメーション').selectOption('scroll');
 await page.getByText('待機画面の詳細設定',{exact:true}).click();
 await expect(page.locator('#ambient-scrollAngle')).toBeVisible();
 await page.locator('.ambient-range:has(#ambient-scrollAngle) + .studio-info-disclosure > summary').click();
 await expect(page.getByTestId('studio-info-popover')).toContainText('0°=右、90°=下、180°=左、270°=上');
 await page.keyboard.press('Escape');
 await expect(page.getByTestId('studio-info-popover')).toHaveCount(0);
 await page.locator('#ambient-scrollAngle').fill('90');
 await expect(page.locator('#ambient-scrollAngle')).toHaveValue('90');
 await expect(page.getByTestId('ambient-preview').getByTestId('grid-background')).toHaveAttribute('data-grid-motion','scroll');
 await expect(page.getByTestId('ambient-preview')).toHaveAttribute('data-scroll-world','v3');
 await openCategory(page,'書き出し');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'作品の設定を保存',exact:true}).click();
 const bytes=await readFile((await(await download).path())!);
 const settings=JSON.parse(bytes.toString());
 expect(settings.gridBackground.animation.speed).toBe(0.1);
 expect(settings.ambient.scrollAngle).toBe(90);
});


test('grid presets provide ready-made static and animated backgrounds',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await openCategory(page,'背景');
  await page.getByRole('button',{name:'星屑ドットプリセットを適用'}).click();
  await expect(page.getByLabel('グリッド背景を有効化')).toBeChecked();
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-type','dot');
  await expect(page.locator('#grid-spacing')).toHaveValue('64');
  await page.getByRole('button',{name:'ネオン方眼プリセットを適用'}).click();
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-type','line');
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-motion','pulse');
  await expect(page.locator('#grid-color')).toHaveValue('#57e4ff');
  await page.getByRole('button',{name:'流れるドットプリセットを適用'}).click();
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-motion','scroll');
  await expect(page.locator('#grid-animation-speed')).toHaveValue('1.4');
  await page.getByRole('button',{name:'方眼プリセットを適用',exact:true}).click();
  await expect(page.getByTestId('grid-background')).toHaveAttribute('data-grid-type','line');
  await expect(page.getByLabel('グリッドアニメーションを有効化')).not.toBeChecked();
});
