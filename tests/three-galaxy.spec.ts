import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {GALAXY_TYPES} from '../src/three/galaxy';
test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function openGalaxy(page:Page,gasOnly=false){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(gasOnly?'./?galaxyGasOnly=1':'./');
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
  await page.locator('#galaxy-type').selectOption('ring');
  await page.locator('#galaxy-ring-radius').fill('.70');
  await page.locator('#galaxy-ring-width').fill('.18');
  await category(page,'書き出し');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();
  const project=JSON.parse((await readFile((await (await pending).path())!)).toString('utf8'));
  expect(project.settings.galaxy).toMatchObject({enabled:true,arms:5,count:5000,palette:'gold',armWidth:2,inclination:35,barred:false,darkBackground:true,galaxyType:'ring',ringRadius:.7,ringWidth:.18});
  await page.getByLabel('保存した3D設定ファイル').setInputFiles({
    name:'galaxy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project)),
  });
  await category(page,'図形');
  await expect(page.getByLabel('GALAXY MODEを有効化')).toBeChecked();
  await expect(page.locator('#galaxy-palette')).toHaveValue('gold');
  await expect(page.locator('#galaxy-type')).toHaveValue('ring');
  await expect(page.locator('#galaxy-ring-radius')).toHaveValue('0.7');
  await expect(page.locator('#galaxy-ring-width')).toHaveValue('0.18');
  await expect(page.locator('#galaxy-inclination')).toHaveValue('35');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
});
test('all seven galaxies render distinct 3D silhouettes and have type-specific controls and presets',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const shaders:string[]=[];page.on('console',message=>{
    if(message.type()==='error'&&/shader error|shader compile|webglprogram/i.test(message.text()))
      shaders.push(message.text());
  });
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await mkdir('test-results',{recursive:true});
  let prior:Buffer|null=null;
  for(const type of GALAXY_TYPES){
    await page.locator('#galaxy-type').selectOption(type);
    await expect(preview).toHaveAttribute('data-galaxy-type',type);
    const screenshot=await preview.locator('canvas').screenshot({
      path:`test-results/galaxy-v4-${type}.png`,
    });
    if(prior)expect(screenshot.equals(prior)).toBe(false);
    prior=screenshot;
  }
  await page.locator('#galaxy-type').selectOption('ring');
  await expect(page.locator('#galaxy-ring-width')).toBeVisible();
  await expect(page.locator('#galaxy-arms')).toHaveCount(0);
  await page.locator('#galaxy-type').selectOption('elliptical');
  await expect(page.locator('#galaxy-ellipticity')).toBeVisible();
  await page.locator('#galaxy-type').selectOption('flocculent');
  await expect(page.locator('#galaxy-branchiness')).toBeVisible();
  await page.locator('#galaxy-type').selectOption('irregular');
  await expect(page.locator('#galaxy-irregularity')).toBeVisible();
  await page.locator('#galaxy-type').selectOption('interacting');
  await expect(page.locator('#galaxy-companion-distance')).toBeVisible();
  await expect(page.locator('#galaxy-tidal')).toBeVisible();
  await page.locator('#galaxy-preset').selectOption('m51');
  await expect(page.locator('#galaxy-type')).toHaveValue('grand_design');
  await page.locator('#galaxy-preset').selectOption('interaction');
  await expect(page.locator('#galaxy-type')).toHaveValue('interacting');
  expect(shaders).toEqual([]);
  expect(errors).toEqual([]);
});
test('luminous gas itself moves in all seven galaxy types and freezes when paused',async({page})=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const shaders:string[]=[];page.on('console',message=>{
    if(message.type()==='error'&&/shader error|shader compile|webglprogram/i.test(message.text()))
      shaders.push(message.text());
  });
  // Hide ONLY star particles using the development-only probe.
  // Thus image differences prove the nebula SHADER moves, not just stars.
  await openGalaxy(page,true);
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.waitForTimeout(3050); // allow initial formation to complete
  await category(page,'図形');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-gas-only-probe','true');
  for(const type of GALAXY_TYPES){
    await page.locator('#galaxy-type').selectOption(type);
    await expect(preview).toHaveAttribute('data-galaxy-type',type);
    await category(page,'アニメーション');
    await page.getByRole('button',{name:'3Dを一時停止'}).click();
    await category(page,'図形');
    const frozenTime=Number(await preview.getAttribute('data-galaxy-gas-time'));
    const frozen=await preview.locator('canvas').screenshot({path:`test-results/gas-probe-${type}-paused.png`});
    await page.waitForTimeout(260);
    const frozenAgain=await preview.locator('canvas').screenshot();
    expect(frozenAgain.equals(frozen),type+' gas must not move while paused').toBe(true);
    expect(Number(await preview.getAttribute('data-galaxy-gas-time'))).toBe(frozenTime);
    await category(page,'アニメーション');
    await page.getByRole('button',{name:'3Dを再生'}).click();
    await category(page,'図形');
    await page.waitForTimeout(200);
    const runningStart=await preview.locator('canvas').screenshot();
    await page.waitForTimeout(1250);
    const animatedTime=Number(await preview.getAttribute('data-galaxy-gas-time'));
    expect(animatedTime,type+' shader clock must advance').toBeGreaterThan(frozenTime+.15);
    expect(Number(await preview.getAttribute('data-galaxy-gas-material-time'))).toBeGreaterThan(frozenTime+.15);
    const moved=await preview.locator('canvas').screenshot({path:`test-results/gas-probe-${type}-played.png`});
    console.log('GAS PROBE',type,{frozenTime,animatedTime,
      beforeBytes:frozen.length,liveBytes:runningStart.length,afterBytes:moved.length});
    expect(moved.equals(runningStart),type+' gas must animate while playback is RUNNING').toBe(false);
    await category(page,'アニメーション');
    await page.getByRole('button',{name:'3Dを一時停止'}).click();
    await page.getByRole('button',{name:'3Dを再生'}).click();
    await category(page,'図形');
  }
  // Rotation speed zero should stop the gas flow even with the clock running.
  await page.locator('#galaxy-type').selectOption('ring');
  await page.locator('#galaxy-spin').fill('0');
  await expect(preview).toHaveAttribute('data-galaxy-gas-speed','0.00');
  const idle=await preview.locator('canvas').screenshot();
  await page.waitForTimeout(450);
  expect((await preview.locator('canvas').screenshot()).equals(idle),
    'zero galaxy rotation speed must stop all gas motion').toBe(true);
  expect(errors).toEqual([]);
  expect(shaders).toEqual([]);
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
