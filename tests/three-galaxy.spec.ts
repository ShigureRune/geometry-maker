import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {GALAXY_TYPES} from '../src/three/galaxy';
test.setTimeout(120_000);
async function category(page:Page,name:string){
  const button=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function openGalaxy(page:Page,gasOnly=false,starsOnly=false,detailOnly=false){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(detailOnly?'./?galaxyDetailOnly=1':
    gasOnly?'./?galaxyGasOnly=1':starsOnly?'./?galaxyStarsOnly=1':'./');
  await page.getByLabel('シード値',{exact:true}).fill('galaxy-ci');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await category(page,'図形');
  await page.getByLabel('3D描画品質').selectOption('low');
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await page.getByLabel('GALAXY MODEを有効化').check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-gas-representation','3d-points');
  await expect(page.getByTestId('three-preview'))
    .toHaveAttribute('data-galaxy-disk-representation','3d-thin-stellar-volume');
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
test('faint 3D disk keeps distinct face-on and steep edge-on silhouettes',async({page})=>{
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await page.getByLabel('3D描画品質').selectOption('high');
  await page.locator('#galaxy-count').fill('12000');
  await expect(preview).toHaveAttribute('data-galaxy-disk-representation',
    '3d-thin-stellar-volume');
  await mkdir('test-results',{recursive:true});
  await page.locator('#galaxy-inclination').fill('0');
  await expect(page.locator('#galaxy-inclination')).toHaveValue('0');
  await page.waitForTimeout(250);
  const face=await preview.locator('canvas').screenshot({
    path:'test-results/galaxy-v4-face-on-disk.png',
  });
  await page.locator('#galaxy-inclination').fill('75');
  await expect(page.locator('#galaxy-inclination')).toHaveValue('75');
  await page.waitForTimeout(250);
  const edge=await preview.locator('canvas').screenshot({
    path:'test-results/galaxy-v4-edge-on-disk.png',
  });
  expect(face.equals(edge)).toBe(false);
});
test('extreme zoom reveals sharp additional stars with no distant extra glow',async({page})=>{
  test.setTimeout(160_000);
  const shaderErrors:string[]=[];
  page.on('console',message=>{
    if(message.type()==='error'&&/shader error|shader compile|webglprogram/i.test(message.text()))
      shaderErrors.push(message.text());
  });
  await openGalaxy(page,false,false,true);
  const preview=page.getByTestId('three-preview');
  const canvas=preview.locator('canvas');
  await page.getByLabel('3D描画品質').selectOption('high');
  await page.locator('#galaxy-count').fill('9000');
  await expect(preview).toHaveAttribute('data-galaxy-camera-near','0.025');
  await expect(preview).toHaveAttribute('data-galaxy-detail-only-probe','true');
  await expect.poll(async()=>Number(await preview.getAttribute('data-galaxy-detail-count')))
    .toBeGreaterThan(40000);
  await mkdir('test-results',{recursive:true});
  await page.waitForTimeout(300);
  const distant=(await canvas.screenshot({path:'test-results/galaxy-star-lod-distant.png'}))
    .toString('base64');
  await canvas.hover();
  await page.mouse.wheel(0,-430);
  await page.waitForTimeout(400);
  const close=(await canvas.screenshot({path:'test-results/galaxy-star-lod-close.png'}))
    .toString('base64');
  const measure=await page.evaluate(async({distant,close})=>{
    async function stats(base64:string){
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const work=document.createElement('canvas');work.width=320;work.height=240;
      const ctx=work.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(img,0,0,320,240);
      const pixels=ctx.getImageData(0,0,320,240).data;
      let bright=0,core=0;
      for(let y=0;y<240;y++)for(let x=0;x<320;x++){
        const p=(y*320+x)*4;
        if(pixels[p]+pixels[p+1]+pixels[p+2]>95){
          bright++;
          if(Math.hypot(x-160,y-120)<40)core++;
        }
      }
      // Do NOT downsample sharp stellar cores for brightness measurement:
      // a 2px bright pinpoint at 920x518 becomes a dim subpixel at 320x240.
      const native=document.createElement('canvas');
      native.width=img.width;native.height=img.height;
      const source=native.getContext('2d',{willReadFrequently:true})!;
      source.drawImage(img,0,0);
      const raw=source.getImageData(0,0,img.width,img.height).data;
      let strong=0;
      for(let p=0;p<raw.length;p+=4){
        if(Math.max(raw[p],raw[p+1],raw[p+2])>170)strong++;
      }
      return {bright,core,strong};
    }
    return {distant:await stats(distant),close:await stats(close)};
  },{distant,close});
  console.log('GALAXY EXTREME ZOOM STAR LOD',measure);
  // The public starry sky background also contributes a few hundred bright
  // pixels (232 in the baseline); it is not the near-field stellar LOD.
  expect(measure.distant.bright,'far-away view must retain a sparse sky')
    .toBeLessThan(450);
  expect(measure.close.bright,'zoom should reveal much denser resolved stars')
    .toBeGreaterThan(measure.distant.bright*4);
  expect(measure.close.strong,'nearby stars must have visibly sharp cores at native resolution')
    .toBeGreaterThan(measure.distant.strong+250);
  expect(shaderErrors).toEqual([]);
});
test('deep zoom keeps the stellar disk colorful without a washed-out white field',async({page})=>{
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  const canvas=preview.locator('canvas');
  await page.getByLabel('3D描画品質').selectOption('high');
  await page.locator('#galaxy-count').fill('9000');
  await page.locator('#galaxy-inclination').fill('0');
  await canvas.hover();
  await page.mouse.wheel(0,-430);
  await page.waitForTimeout(350);
  await mkdir('test-results',{recursive:true});
  const photo=(await canvas.screenshot({path:'test-results/galaxy-star-color-deep-zoom.png'}))
    .toString('base64');
  const sample=await page.evaluate(async b64=>{
    const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
    // Measure at native screen resolution. Resizing ~2px stars to 320x240
    // falsely removes their colored cores and confuses a warm central bulge
    // with an entirely monochromatic galaxy.
    const surface=document.createElement('canvas');
    surface.width=img.width;surface.height=img.height;
    const ctx=surface.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,img.width,img.height).data;
    let bright=0,warm=0,cool=0,pale=0,corner=0,cornerCount=0;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
      const p=(y*img.width+x)*4;
      const red=pixels[p],green=pixels[p+1],blue=pixels[p+2];
      if(x<img.width*.08&&y<img.height*.08){
        corner+=(red+green+blue)/3;cornerCount++;
      }
      const r=Math.hypot(x/img.width*320-160,y/img.height*240-120);
      // Preserve the intentionally smooth ivory nuclear core, but check
      // both the warm inner rim and outer blue/pink stellar arms.
      if(r<22)continue;
      const max=Math.max(red,green,blue),min=Math.min(red,green,blue);
      if(max<65)continue;
      bright++;
      if(red>blue+12)warm++;
      if(blue>red+12)cool++;
      if(min>190&&max-min<24)pale++;
    }
    return {bright,warm,cool,pale,cornerMean:corner/cornerCount};
  },photo);
  console.log('GALAXY DEEP ZOOM COLORS',sample);
  expect(sample.bright,'nearby stars should illuminate the disk').toBeGreaterThan(6000);
  expect(sample.warm,'old amber stars must survive zoom').toBeGreaterThan(1500);
  expect(sample.cool,'outer blue stars must survive zoom').toBeGreaterThan(200);
  expect(sample.cornerMean,'deep zoom must retain dark sky, not uniform beige fog')
    .toBeLessThan(48);
  expect(sample.pale/(sample.bright||1),'the disk must not turn into a pale white haze')
    .toBeLessThan(.30);
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
    await expect(preview).toHaveAttribute('data-galaxy-bulge-representation','3d-unresolved-volume');
    await expect(preview).toHaveAttribute('data-galaxy-bulge-count',type==='interacting'?'2':'1');
    const hasDisk=['grand_design','barred_spiral','flocculent','interacting'].includes(type);
    await expect(preview).toHaveAttribute('data-galaxy-disk-representation',
      hasDisk?'3d-thin-stellar-volume':'none');
    await expect(preview).toHaveAttribute('data-galaxy-disk-count',
      !hasDisk?'0':type==='interacting'?'2':'1');
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
async function galaxyExposure(page:Page,filename:string,galaxyType='grand_design'){
  const preview=page.getByTestId('three-preview');
  const png=(await preview.locator('canvas').screenshot({path:filename})).toString('base64');
  return page.evaluate(async({base64,galaxyType})=>{
    const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
    const canvas=document.createElement('canvas');
    canvas.width=320;canvas.height=240;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(img,0,0,320,240);
    const data=ctx.getImageData(0,0,320,240).data;
    let sum=0,clips=0,washed=0,count=0;
    // The fixed galaxy-ci seed has two distinct, deliberately white-hot
    // nuclei in interacting mode. Neither belongs to the spiral-arm sample.
    // Pixel positions correspond to this test's 320x240 screenshot probe.
    const nuclei=galaxyType==='interacting'
      ? [[140,121],[197,104]] : [[160,120]];
    for(let y=12;y<228;y++)for(let x=30;x<290;x++){
      if(nuclei.some(([cx,cy])=>Math.hypot(x-cx,y-cy)<24))continue;
      const o=(y*320+x)*4;
      const r=data[o],g=data[o+1],b=data[o+2];
      sum+=(r+g+b)/3;
      if(Math.min(r,g,b)>245)clips++;
      // Highlights can look washed out long before any RGB channel hits 255.
      if((r+g+b)/3>140&&Math.max(r,g,b)-Math.min(r,g,b)<40)washed++;
      count++;
    }
    return {mean:sum/count,whiteFraction:clips/count,washedOutFraction:washed/count};
  },{base64:png,galaxyType});
}
test('PNG export preserves the preview gas and star glow at a larger resolution',async({page})=>{
  test.setTimeout(160_000);
  await openGalaxy(page);
  await page.getByLabel('3D描画品質').selectOption('high');
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-quality','high');
  await page.locator('#galaxy-count').fill('7500');
  await page.waitForTimeout(350);
  const livePng=(await preview.locator('canvas').screenshot()).toString('base64');
  const css=await preview.locator('canvas').evaluate(canvas=>({
    width:Math.round(canvas.clientWidth),height:Math.round(canvas.clientHeight),
  }));
  // Keep the same camera aspect ratio; otherwise an export letterbox
  // would distort brightness comparisons independently of the renderer.
  const factor=Math.min(1920/css.width,1080/css.height,2.5);
  const width=Math.max(256,Math.round(css.width*factor));
  const height=Math.max(256,Math.round(css.height*factor));
  await category(page,'書き出し');
  await page.locator('#three-export-width').fill(String(width));
  await page.locator('#three-export-height').fill(String(height));
  const downloadPromise=page.waitForEvent('download',{timeout:120_000});
  await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();
  const saved=await downloadPromise;
  const exportedPng=(await readFile((await saved.path())!)).toString('base64');
  const lastScale=Number(await preview.getAttribute('data-galaxy-last-png-point-scale'));
  console.log('GALAXY EXPORT SCALE', {css,width,height,lastScale});
  expect(lastScale).toBeGreaterThan(1.1);
  const levels=await page.evaluate(async({livePng,exportedPng})=>{
    async function stats(encoded:string){
      const bitmap=new Image();bitmap.src='data:image/png;base64,'+encoded;
      await bitmap.decode();
      const canvas=document.createElement('canvas');
      canvas.width=320;canvas.height=180;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,320,180).data;
      let total=0,lit=0,core=0,coreN=0,white=0;
      for(let y=10;y<170;y++)for(let x=25;x<295;x++){
        const p=(y*320+x)*4;
        const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
        const brightness=r*.30+g*.48+b*.22;
        total+=brightness;
        if(brightness>15)lit++;
        if(Math.hypot(x-160,y-90)<26){core+=brightness;coreN++;}
        if(Math.min(r,g,b)>245)white++;
      }
      return {mean:total/(270*160),lit:lit/(270*160),
        core:core/coreN,whiteFraction:white/(270*160)};
    }
    return {preview:await stats(livePng),exported:await stats(exportedPng)};
  },{livePng,exportedPng});
  console.log('GALAXY PNG VS PREVIEW', levels);
  const l=levels.preview,e=levels.exported;
  expect(l.mean).toBeGreaterThan(1);
  expect(e.mean/l.mean,'export must keep global luminosity').toBeGreaterThan(.63);
  expect(e.mean/l.mean,'export must not wash out the galaxy').toBeLessThan(1.48);
  expect(e.lit/l.lit,'export must keep the cloud/arm apparent coverage').toBeGreaterThan(.69);
  expect(e.lit/l.lit,'export must not inflate all the glowing cloudlets').toBeLessThan(1.52);
  expect(e.core/l.core,'export must preserve core glow').toBeGreaterThan(.62);
  expect(e.core/l.core,'export must not clip the nucleus').toBeLessThan(1.55);
  expect(e.whiteFraction).toBeLessThan(.06);
});

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
    const high=await galaxyExposure(page,'test-results/galaxy-exposure-high-'+type+'.png',type);
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

test('central photographic hotspot intensifies without washing out distant arms',async({page})=>{
  await openGalaxy(page);
  const preview=page.getByTestId('three-preview');
  await page.getByLabel('3D描画品質').selectOption('high');
  await page.locator('#galaxy-count').fill('12000');
  await page.locator('#galaxy-inclination').fill('0');
  await expect(preview).toHaveAttribute('data-quality','high');
  await expect.poll(async()=>Number(await preview.getAttribute('data-galaxy-nucleus-count')))
    .toBeGreaterThan(400);
  await expect(preview).toHaveAttribute('data-galaxy-bulge-representation','3d-unresolved-volume');
  await expect(preview).toHaveAttribute('data-galaxy-bulge-count','1');
  async function sample(){
    const screenshot=(await preview.locator('canvas').screenshot()).toString('base64');
    return page.evaluate(async b64=>{
      const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
      const square=Math.min(img.width,img.height);
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(img,(img.width-square)/2,(img.height-square)/2,square,square,0,0,256,256);
      const pixels=ctx.getImageData(0,0,256,256).data;
      let core=0,coreN=0,outer=0,outerN=0,brightest=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const d=Math.hypot(x-128,y-128);
        const n=(y*256+x)*4;
        const lum=pixels[n]*.3+pixels[n+1]*.48+pixels[n+2]*.22;
        if(d<11){core+=lum;coreN++;brightest=Math.max(brightest,lum);}
        if(d>63&&d<94){outer+=lum;outerN++;}
      }
      return {core:core/coreN,outer:outer/outerN,brightest};
    },screenshot);
  }
  await page.locator('#galaxy-core').fill('0');
  const dim=await sample();
  await page.locator('#galaxy-core').fill('135');
  const bright=await sample();
  console.log('WHITE HOT NUCLEUS', {dim,bright});
  expect(bright.core).toBeGreaterThan(dim.core*1.15+3);
  expect(bright.brightest).toBeGreaterThan(dim.brightest+5);
  // The *nucleus only* may clip slightly, as in a long-exposure galaxy photo.
  expect(bright.brightest).toBeGreaterThan(248);
  expect(bright.outer).toBeLessThan(dim.outer*1.13+3);
  // A zoomed galaxy must reveal small warm stars and shadows, rather than
  // enlarging the additive pinprick into a blank, pure-white circular disk.
  const canvas=preview.locator('canvas');
  await canvas.hover();
  await page.mouse.wheel(0,-160);
  await page.waitForTimeout(180);
  const zoomed=(await canvas.screenshot({path:'test-results/galaxy-nucleus-zoom-high.png'})).toString('base64');
  const detail=await page.evaluate(async b64=>{
    const image=new Image();image.src='data:image/png;base64,'+b64;await image.decode();
    const size=Math.min(image.width,image.height);
    const surface=document.createElement('canvas');surface.width=256;surface.height=256;
    const context=surface.getContext('2d',{willReadFrequently:true})!;
    context.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,256,256);
    const pixels=context.getImageData(0,0,256,256).data;
    let sum=0,sumSq=0,clipped=0,count=0;
    for(let y=64;y<192;y++)for(let x=64;x<192;x++){
      const radius=Math.hypot(x-128,y-128);
      if(radius<12||radius>58)continue;
      const i=(y*256+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      const lum=(r+g+b)/3;
      sum+=lum;sumSq+=lum*lum;count++;
      if(Math.min(r,g,b)>245)clipped++;
    }
    const mean=sum/count;
    return {mean,variation:Math.sqrt(Math.max(0,sumSq/count-mean*mean)),
      whiteFraction:clipped/count};
  },zoomed);
  console.log('ZOOMED NUCLEAR DETAIL',detail);
  expect(detail.whiteFraction,'the enlarged bulge should retain detail, not a white disk')
    .toBeLessThan(.65);
  expect(detail.variation,'the enlarged bulge should have visible spatial texture')
    .toBeGreaterThan(9);
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
