import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {GALAXY_TYPES} from '../src/three/galaxy';
test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function openGalaxy(page:Page,gasOnly=false,starsOnly=false){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(gasOnly?'./?galaxyGasOnly=1':starsOnly?'./?galaxyStarsOnly=1':'./');
  await page.getByLabel('シード値',{exact:true}).fill('galaxy-ci');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await page.getByLabel('GALAXY MODEを有効化').check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-gas-representation','3d-points');
  expect(Number(await page.getByTestId('three-preview').getAttribute('data-galaxy-gas-count')))
    .toBeGreaterThan(300);
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
/** Measure the ACTUAL output pixels after Three.js' full high-quality
 * EffectComposer + OutputPass, not shader values or low-mode screenshots. */
async function galaxyExposure(page:Page,filename:string){
  const preview=page.getByTestId('three-preview');
  const png=(await preview.locator('canvas').screenshot({path:filename})).toString('base64');
  return page.evaluate(async(base64)=>{
    const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
    const canvas=document.createElement('canvas');
    canvas.width=320;canvas.height=240;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(img,0,0,320,240);
    const data=ctx.getImageData(0,0,320,240).data;
    let sum=0,clips=0,washed=0,count=0;
    for(let y=12;y<228;y++)for(let x=30;x<290;x++){
      const o=(y*320+x)*4;
      const r=data[o],g=data[o+1],b=data[o+2];
      sum+=(r+g+b)/3;
      if(Math.min(r,g,b)>245)clips++;
      // Highlights can look washed out long before any RGB channel hits 255.
      if((r+g+b)/3>140&&Math.max(r,g,b)-Math.min(r,g,b)<40)washed++;
      count++;
    }
    return {mean:sum/count,whiteFraction:clips/count,washedOutFraction:washed/count};
  },png);
}
test('high quality preserves galaxy colors with volumetric 3D gas',async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const shaders:string[]=[];page.on('console',msg=>{
    if(msg.type()==='error'&&/shader error|shader compile|webglprogram/i.test(msg.text()))
      shaders.push(msg.text());
  });
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await mkdir('test-results',{recursive:true});
  await page.locator('#galaxy-count').fill('30000');
  await page.getByLabel('3D描画品質').selectOption('low');
  await expect(preview).toHaveAttribute('data-quality','low');
  const normal=await galaxyExposure(page,'test-results/galaxy-exposure-low.png');
  await page.getByLabel('3D描画品質').selectOption('high');
  await expect(preview).toHaveAttribute('data-quality','high');
  await expect(preview).toHaveAttribute('data-galaxy-count','30000');
  for(const type of ['grand_design','ring','interacting'] as const){
    await expect(preview).toHaveAttribute('data-galaxy-gas-representation','3d-points');
    await page.locator('#galaxy-type').selectOption(type);
    await expect(preview).toHaveAttribute('data-galaxy-type',type);
    const high=await galaxyExposure(page,'test-results/galaxy-exposure-high-'+type+'.png');
    console.log('GALAXY HIGH EXPOSURE',type,{low:normal,high});
    expect(high.whiteFraction,type+' should preserve actual RGB colors').toBeLessThan(.055);
    expect(high.washedOutFraction,type+' should not have washed-out pale arms').toBeLessThan(.055);
    expect(high.mean,type+' should remain visible').toBeGreaterThan(3);
    if(type==='grand_design')
      expect(high.mean,type+' cannot become many times brighter than low quality')
        .toBeLessThan(normal.mean*1.35+2);
  }
  expect(shaders).toEqual([]);
  expect(errors).toEqual([]);
});

/** Angle of actual pixels, not the angular velocity predicted by the GLSL math.
 * This catches a texture plane rendered back-to-front or an accidentally
 * inverted shader sampling coordinate. All screenshots are real WebGL output. */
async function orbitalPixelProfile(page:Page):Promise<number[][]>{
  const png=(await page.getByTestId('three-preview').locator('canvas').screenshot()).toString('base64');
  return page.evaluate(async(base64)=>{
    const bitmap=new Image();
    bitmap.src='data:image/png;base64,'+base64;
    await bitmap.decode();
    const square=Math.min(bitmap.width,bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(bitmap,(bitmap.width-square)/2,(bitmap.height-square)/2,
      square,square,0,0,256,256);
    const pixel=ctx.getImageData(0,0,256,256).data;
    const profiles:number[][]=[];
    for(const radius of [.34,.48,.62,.76]){
      const profile:number[]=[];
      for(let i=0;i<360;i++){
        const a=i*Math.PI/180;
        let total=0;
        for(const dr of [-.035,-.018,0,.018,.035]){
          const r=(radius+dr)*107.5; // R=5.5, camera distance=18, fov=40°
          const x=Math.max(0,Math.min(255,Math.round(128+Math.cos(a)*r)));
          const y=Math.max(0,Math.min(255,Math.round(128-Math.sin(a)*r)));
          const p=(y*256+x)*4;
          total+=(pixel[p]*.30+pixel[p+1]*.48+pixel[p+2]*.22)/5;
        }
        profile.push(total);
      }
      profiles.push(profile);
    }
    return profiles;
  },png);
}
function bestAngularShift(a:number[][],b:number[][]):{shift:number;score:number}{
  const demean=(v:number[])=>{
    const avg=v.reduce((x,y)=>x+y,0)/v.length;
    return v.map(x=>x-avg);
  };
  const aa=a.map(demean),bb=b.map(demean);
  let best=-Infinity,shift=0;
  for(let d=-105;d<=105;d++){
    let total=0;
    for(let k=0;k<aa.length;k++){
      const x=aa[k],y=bb[k];
      for(let i=0;i<360;i++){
        const next=(i+d+360)%360;
        total+=x[i]*y[next];
      }
    }
    if(total>best){best=total;shift=d;}
  }
  return {shift,score:best};
}
test('3D gas reveals depth on inclination and retains visible color',async({page})=>{
  await openGalaxy(page,true);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-gas-representation','3d-points');
  await page.locator('#galaxy-inclination').fill('0');
  const faceOn=await preview.locator('canvas').screenshot();
  await page.locator('#galaxy-inclination').fill('70');
  const inclined=await preview.locator('canvas').screenshot();
  expect(inclined.equals(faceOn)).toBe(false);
  expect(Number(await preview.getAttribute('data-galaxy-gas-count'))).toBeGreaterThan(300);
});
test('gas and star spiral arms visibly rotate in the SAME screen direction',async({page})=>{
  test.setTimeout(120_000);
  const shifts:Record<string,number>={};
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const layer of ['stars','gas'] as const){
    await openGalaxy(page,layer==='gas',layer==='stars');
    const preview=page.getByTestId('three-preview');
    await page.locator('#galaxy-spin').fill('2');
    await page.locator('#galaxy-inclination').fill('0');
    await category(page,'アニメーション');
    await page.getByLabel('3Dアニメーションを有効化').check();
    await category(page,'図形');
    const key=layer==='stars'?'data-galaxy-star-material-time':'data-galaxy-gas-material-time';
    await page.evaluate(()=>{
      (document.querySelector('[data-testid="three-preview"]') as HTMLDivElement)
        .dataset.galaxyMotionClock='10';
    });
    await expect(preview).toHaveAttribute(key,'10.000');
    const before=await orbitalPixelProfile(page);
    await page.evaluate(()=>{
      (document.querySelector('[data-testid="three-preview"]') as HTMLDivElement)
        .dataset.galaxyMotionClock='14';
    });
    await expect(preview).toHaveAttribute(key,'14.000');
    const after=await orbitalPixelProfile(page);
    const movement=bestAngularShift(before,after);
    console.log('VISIBLE ORBIT PIXELS',layer,movement);
    expect(Math.abs(movement.shift),layer+' must visibly rotate').toBeGreaterThan(6);
    shifts[layer]=movement.shift;
  }
  expect(Math.sign(shifts.gas),'gas and stars must not counter-rotate on screen')
    .toBe(Math.sign(shifts.stars));
  // The previous version was confirmed +42°/+40° with this CI camera and
  // seed. Its spiral arms visibly rotated in the leading (wrong) direction.
  expect(shifts.stars,'stars should now visually orbit the OTHER way').toBeLessThan(-6);
  expect(shifts.gas,'3D gas must follow the stars in that trailing direction').toBeLessThan(-6);
  expect(errors).toEqual([]);
});

test('volumetric central nucleus brightens with glow setting, not the whole disk',async({page})=>{
  await openGalaxy(page,true);
  await page.locator('#galaxy-type').selectOption('grand_design');
  await page.locator('#galaxy-inclination').fill('0');
  const preview=page.getByTestId('three-preview');
  async function measure(){
    const png=(await preview.locator('canvas').screenshot()).toString('base64');
    return page.evaluate(async base64=>{
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const square=Math.min(img.width,img.height);
      const canvas=document.createElement('canvas');
      canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(img,(img.width-square)/2,(img.height-square)/2,square,square,0,0,256,256);
      const data=ctx.getImageData(0,0,256,256).data;
      let core=0,inner=0,outer=0,coreN=0,innerN=0,outerN=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const dist=Math.hypot(x-128,y-128);
        if(dist>78)continue;
        const i=(y*256+x)*4;
        const light=(data[i]*.30+data[i+1]*.48+data[i+2]*.22);
        if(dist<=16){core+=light;coreN++;}
        else if(dist<32){inner+=light;innerN++;}
        else if(dist>46&&dist<70){outer+=light;outerN++;}
      }
      return {core:core/coreN,inner:inner/innerN,outer:outer/outerN};
    },png);
  }
  await page.locator('#galaxy-core').fill('0');
  const dark=await measure();
  await page.locator('#galaxy-core').fill('180');
  const bright=await measure();
  console.log('3D NUCLEAR GLOW', {dark,bright});
  expect(bright.core,'turning up the core slider should brighten the galaxy center')
    .toBeGreaterThan(dark.core*1.25+1);
  expect(bright.outer,'core slider should NOT illuminate the whole galaxy disk')
    .toBeLessThan(dark.outer*1.20+3);
});

test('stellar arm particles independently orbit, pause and stop at zero speed',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const shaders:string[]=[];page.on('console',msg=>{
    if(msg.type()==='error'&&/shader error|shader compile|webglprogram/i.test(msg.text()))
      shaders.push(msg.text());
  });
  await openGalaxy(page,false,true);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-stars-only-probe','true');
  await page.locator('#galaxy-spin').fill('2');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await page.waitForTimeout(2900);
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  await category(page,'図形');
  await page.waitForTimeout(120);
  const t0=Number(await preview.getAttribute('data-galaxy-star-time'));
  const frozen=await preview.locator('canvas').screenshot();
  await page.waitForTimeout(220);
  expect((await preview.locator('canvas').screenshot()).equals(frozen),
    'stars must freeze on pause').toBe(true);
  expect(Number(await preview.getAttribute('data-galaxy-star-time'))).toBe(t0);
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを再生'}).click();
  await category(page,'図形');
  await page.waitForTimeout(800);
  const t1=Number(await preview.getAttribute('data-galaxy-star-time'));
  expect(t1).toBeGreaterThan(t0+.1);
  expect(Number(await preview.getAttribute('data-galaxy-star-material-time'))).toBeGreaterThan(t0+.1);
  const moved=await preview.locator('canvas').screenshot();
  expect(moved.equals(frozen),'the star-only GPU image must actually rotate').toBe(false);
  await page.locator('#galaxy-spin').fill('0');
  await expect(preview).toHaveAttribute('data-galaxy-star-material-time',/^\d+\.\d{3}$/);
  await page.waitForTimeout(180);
  const stopped=await preview.locator('canvas').screenshot();
  await page.waitForTimeout(420);
  expect((await preview.locator('canvas').screenshot()).equals(stopped),
    'zero spin must freeze the star image while the scene clock advances').toBe(true);
  expect(shaders).toEqual([]);
  expect(errors).toEqual([]);
});

test('luminous gas itself moves in all seven galaxy types and freezes when paused',async({page})=>{
  test.setTimeout(225_000);
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
  for(const [index,type] of GALAXY_TYPES.entries()){
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
    if(index<GALAXY_TYPES.length-1){
      await category(page,'アニメーション');
      await page.getByRole('button',{name:'3Dを一時停止'}).click();
      await page.getByRole('button',{name:'3Dを再生'}).click();
      await category(page,'図形');
    }
  }
  expect(errors).toEqual([]);
  expect(shaders).toEqual([]);
});

test('gas flow stops at zero rotation speed while the 3D clock keeps playing',async({page})=>{
  await openGalaxy(page,true);
  await page.locator('#galaxy-type').selectOption('ring');
  await page.locator('#galaxy-spin').fill('0');
  await category(page,'アニメーション');
  await page.getByLabel('3Dアニメーションを有効化').check();
  await category(page,'図形');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-galaxy-gas-only-probe','true');
  await expect(preview).toHaveAttribute('data-galaxy-gas-speed','0.00');
  await page.waitForTimeout(3100);
  const beforeTime=Number(await preview.getAttribute('data-galaxy-gas-time'));
  const image=await preview.locator('canvas').screenshot();
  await page.waitForTimeout(550);
  const afterTime=Number(await preview.getAttribute('data-galaxy-gas-time'));
  expect(afterTime).toBeGreaterThan(beforeTime+.10);
  expect((await preview.locator('canvas').screenshot()).equals(image)).toBe(true);
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

test('high-quality PNG captures the same visible galaxy exposure at 2x resolution',async({page})=>{
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await page.getByLabel('3D描画品質').selectOption('high');
  await expect(preview).toHaveAttribute('data-quality','high');
  await page.locator('#galaxy-count').fill('18000');
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  await category(page,'図形');
  // Both layers seek to the same settled, static 3D pose.
  await preview.evaluate(element=>{element.dataset.galaxyMotionClock='20';});
  await page.locator('#galaxy-core').fill('90');
  await expect.poll(async()=>Number(await preview.getAttribute('data-galaxy-star-time'))).toBe(20);
  await expect(preview).toHaveAttribute('data-galaxy-gas-time','20.000');
  await mkdir('test-results',{recursive:true});
  const before=await preview.locator('canvas').screenshot({
    path:'test-results/galaxy-exposure-png-preview.png',
  });
  const dimensions=await preview.locator('canvas').evaluate(canvas=>({
    width:Math.round(canvas.clientWidth),height:Math.round(canvas.clientHeight),
  }));
  const width=dimensions.width*2,height=dimensions.height*2;
  expect(width).toBeLessThanOrEqual(4096);
  expect(height).toBeLessThanOrEqual(4096);
  await category(page,'書き出し');
  await page.locator('#three-export-width').fill(String(width));
  await page.locator('#three-export-height').fill(String(height));
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'3D PNGを書き出す'}).click();
  const download=await pending;
  const exported=await readFile((await download.path())!);
  expect(exported.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
  await writeFile('test-results/galaxy-exposure-png-export.png',exported);
  const metrics=await page.evaluate(async({previewBase64,exportBase64})=>{
    async function profile(base64:string){
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(img,0,0,320,240);
      const pixels=ctx.getImageData(0,0,320,240).data;
      let brightness=0,highlights=0;
      for(let y=12;y<228;y++)for(let x=30;x<290;x++){
        const i=(y*320+x)*4;
        const value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
        brightness+=value;
        if(value>75)highlights++;
      }
      return {mean:brightness/(260*216),highlights:highlights/(260*216)};
    }
    return {preview:await profile(previewBase64),exported:await profile(exportBase64)};
  },{previewBase64:before.toString('base64'),exportBase64:exported.toString('base64')});
  console.log('GALAXY PNG EXPOSURE PARITY',metrics);
  expect(metrics.preview.mean).toBeGreaterThan(3);
  expect(metrics.exported.mean).toBeGreaterThan(metrics.preview.mean*.70);
  expect(metrics.exported.mean).toBeLessThan(metrics.preview.mean*1.30);
  // Export must return the canvas to its normal preview resolution.
  await expect.poll(async()=>Number(await preview.getAttribute('data-galaxy-star-pixel-scale')))
    .toBeGreaterThan(0);
});
