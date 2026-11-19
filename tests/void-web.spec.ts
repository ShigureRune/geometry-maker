import {openSettingsCategory} from './settings-test-helper';
import {test,expect,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {threeDefaults} from '../src/three/settings';
import {voidWebDefaults} from '../src/three/void-settings';
import type {ThreeProject} from '../src/three/project';

test.setTimeout(180_000);
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function fixture(seed='cosmic-web-01'):ThreeProject{return {
  kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed,aspectRatio:'16:9',density:100,visualTheme:'cosmic',
  background:{mode:'gradient',solid:'#04091b',colors:['#08051d','#0a1027','#031422'],angle:135,glowIntensity:75,figureColors:{primary:'#b995ff',support:'#65bfe4',accent:'#a8ebcf'}},
  settings:{...threeDefaults,animation:false,quality:'high',floorGrid:{...threeDefaults.floorGrid!,enabled:false},celestial:{...threeDefaults.celestial!,enabled:false},
    entrance:{...threeDefaults.entrance!,enabled:false},voidMode:{...voidWebDefaults,enabled:true,objectLimit:1400}},
  elapsedSeconds:24,floorElapsedSeconds:24,exportWidth:640,exportHeight:360,
};}
async function category(page:Page,name:string){await openSettingsCategory(page,name);}
function errorsOn(page:Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|GLSL|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});return errors;}
async function restore(page:Page,project:ThreeProject){
  await category(page,'書き出し');const old=await page.getByTestId('three-preview').locator('canvas').elementHandle();
  await page.getByLabel('保存した3D設定ファイル',{exact:true}).setInputFiles({name:'web.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  if(old)await page.waitForFunction(element=>!element.isConnected,old);
  await expect(page.getByRole('button',{name:'視点をリセット',exact:true})).toBeEnabled({timeout:30_000});
}
async function open(page:Page,project=fixture()){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./?legacy-ui=1');await page.getByRole('button',{name:'3Dモード',exact:true}).click();await restore(page,project);
}
async function png(page:Page){await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3D PNGを書き出す',exact:true}).click();return readFile((await(await pending).path())!);}
async function saved(page:Page):Promise<ThreeProject>{await category(page,'書き出し');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'3Dの設定を保存',exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,'utf8'));}
async function inspect(page:Page){return page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
  const {_roots}=await import(/* @vite-ignore */url);const root=_roots.get(document.querySelector('[data-testid="three-preview"] canvas')) as any,scene=root.store.getState().scene;
  let bodies=0,outlines=0,bodyBatches=0,outlineBatches=0,individual=0,sphereVertices=0;const matrices:Record<string,number[]>={};
  scene.getObjectByName('void-web-batches')?.traverse((o:any)=>{
    if(o.isInstancedMesh){
      if(o.name==='void-web-outline'){outlines+=o.count;outlineBatches++;}
      else{bodies+=o.count;bodyBatches++;if(o.name==='void-web-solid-sphere')sphereVertices=o.geometry.getAttribute('position').count;for(let i=0;i<o.count;i++)matrices[`${o.name}:${i}`]=Array.from(o.instanceMatrix.array.slice(i*16,i*16+16));}
    }else if(o.isMesh)individual++;
  });
  const gl=root.store.getState().gl,context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER));
  return {bodies,outlines,bodyBatches,outlineBatches,individual,matrices,fog:!!scene.fog,sphereVertices,renderer};
});}

test('PARTICLE MODE can render the real cosmic web in one bounded GPU draw call',async({page})=>{
  const project=fixture('void-web-particle-integration');
  project.settings.quality='low';
  project.settings.voidMode!.objectLimit=2800;
  const errors=errorsOn(page);
  await open(page,project);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-void-mode','web');
  await expect(preview).toHaveAttribute('data-object-count','640');
  const before=await preview.locator('canvas').screenshot();
  const nodeCount=await preview.getAttribute('data-object-count');
  await category(page,'拡張');
  const toggle=page.getByLabel('PARTICLE MODEを有効化');
  await expect(toggle).toBeEnabled();
  await toggle.check();
  await expect(preview).toHaveAttribute('data-particle-mode','on');
  await expect(preview).toHaveAttribute('data-particle-type','cosmic-web');
  const budget=80000;
  await expect(preview).toHaveAttribute('data-particle-count',String(budget));
  await expect(preview).toHaveAttribute('data-object-count',nodeCount!);
  expect(Number(await preview.getAttribute('data-void-particle-filaments')))
    .toBeGreaterThan(200);
  await page.locator('#particle-count').fill('500000');
  await expect(preview).toHaveAttribute('data-particle-count',String(budget));
  const networkEdges=await preview.getAttribute('data-network-count');
  const state=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>
      e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector(
      '[data-testid="three-preview"] canvas'));
    const scene=root.store.getState().scene;
    const cloud=scene.getObjectByName('void-web-particle-cloud') as any;
    const flags=cloud?.geometry.getAttribute('aNode')?.array as Uint8Array|undefined;
    const nodeParticles=flags?.reduce((sum,value)=>sum+value,0)??0;
    return {
      nodeParticles,filamentParticles:(flags?.length??0)-nodeParticles,
      count:cloud?.geometry.getAttribute('position').count??0,
      targets:cloud?.geometry.getAttribute('aTarget').count??0,
      hasSolids:!!scene.getObjectByName('void-web-batches'),
      isPoints:!!cloud?.isPoints,
      hasShader:!!cloud?.material?.isShaderMaterial,
    };
  });
  expect(state).toEqual({
    count:budget,targets:budget,nodeParticles:72000,filamentParticles:8000,
    hasSolids:false,isPoints:true,hasShader:true,
  });
  // Reallocate the same GPU vertices to figures without breaking original wires.
  const share=page.locator('#void-particle-node-share');
  await expect(share).toHaveValue('90');
  await share.fill('100');
  await expect(share).toHaveValue('100');
  await expect(preview).toHaveAttribute('data-network-count',networkEdges!);
  const figuresOnly=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector('[data-testid="three-preview"] canvas'));
    const flags=root.store.getState().scene.getObjectByName('void-web-particle-cloud')?.geometry.getAttribute('aNode').array as Uint8Array;
    return {count:flags.length,nodes:flags.reduce((sum,n)=>sum+n,0)};
  });
  expect(figuresOnly).toEqual({count:budget,nodes:budget});
  const after=await preview.locator('canvas').screenshot();
  expect(after.equals(before)).toBe(false);
  await category(page,'書き出し');
  const result=await saved(page);
  expect(result.settings.voidMode?.enabled).toBe(true);
  expect(result.settings.particle).toMatchObject({enabled:true,count:4000});
  expect(result.settings.voidMode?.particleCount).toBe(500000);
  expect(result.settings.voidMode?.nodeShare).toBe(100);
  await category(page,'拡張');
  await toggle.uncheck();
  await expect(preview).toHaveAttribute('data-particle-mode','off');
  expect((await inspect(page)).bodies).toBeGreaterThan(0);
  // Switching to the legacy VOID version never activates its old geometry
  // sampler; the toggle is disabled until the full cosmic web is selected.
  await category(page,'拡張');
  await page.locator('#void-version').selectOption('void-filaments-v1');
  await expect(preview).toHaveAttribute('data-void-mode','prototype');
  await category(page,'拡張');
  await expect(toggle).toBeDisabled();
  await expect(preview).toHaveAttribute('data-particle-mode','off');
  expect(errors).toEqual([]);
});
test('cosmic-web seed changes morph the real GPU cloud, pause, and settle',async({page})=>{
  const errors=errorsOn(page),project=fixture('web-seed-morph-start');
  project.settings.quality='low';
  project.settings.animation=true;
  project.settings.particle={...threeDefaults.particle!,enabled:true,
    seedTransition:true,seedDuration:10,swirl:1.5};
  project.settings.voidMode!.particleCount=12000;
  project.elapsedSeconds=9;
  await open(page,project);
  const preview=page.getByTestId('three-preview');
  await expect(preview).toHaveAttribute('data-particle-type','cosmic-web');
  await category(page,'拡張');
  await expect(page.getByLabel('シード変更時に粒子を再集合')).toBeChecked();
  // The random seed button belongs to the figure category. Switch tabs
  // only AFTER clicking it, then pause before costly WebGL inspection.
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','transition');
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'3Dを一時停止'}).click();
  const gpu=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>
      e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector(
      '[data-testid="three-preview"] canvas'));
    const cloud=root.store.getState().scene.getObjectByName('void-web-particle-cloud') as any;
    const from=cloud.geometry.getAttribute('aFrom').array as Float32Array;
    const targets=cloud.geometry.getAttribute('aTarget').array as Float32Array;
    let differences=0;
    for(let i=0;i<Math.min(120,from.length);i+=3)
      if(Math.hypot(from[i]-targets[i],from[i+1]-targets[i+1],
        from[i+2]-targets[i+2])>.01)differences++;
    return {count:from.length/3,fromColor:cloud.geometry.getAttribute('aFromColor').count,
      fromNode:cloud.geometry.getAttribute('aFromNode').count,
      gpuMorphActive:cloud.material.uniforms.uSeedProgress.value>=0,differences};
  });
  expect(gpu).toMatchObject({count:12000,fromColor:12000,fromNode:12000,
    gpuMorphActive:true});
  expect(gpu.differences).toBeGreaterThan(20);
  const frozen=await preview.getAttribute('data-particle-seed-progress');
  await page.waitForTimeout(250);
  expect(await preview.getAttribute('data-particle-seed-progress')).toBe(frozen);
  // The new seed's network must not leap into place while the particles
  // are still moving from the previous shape. Signals wait for wires too.
  expect(Number(frozen)).toBeLessThan(.72);
  await expect(preview).toHaveAttribute('data-void-wire-seed-reveal','0.000');
  const pausedWires=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>
      e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector(
      '[data-testid="three-preview"] canvas'));
    const scene=root.store.getState().scene;
    const wires=scene.getObjectByName('void-web-network-lines') as any;
    const signals=scene.getObjectByName('neural-signal-packets') as any;
    return {wires:wires?.geometry.instanceCount??-1,signalCount:signals?.count??0};
  });
  expect(pausedWires.wires).toBe(0);
  expect(pausedWires.signalCount).toBe(0);
  await page.getByRole('button',{name:'3Dを再生'}).click();
  await expect.poll(async()=>Number(await preview.getAttribute('data-void-wire-seed-reveal')),
    {timeout:18000}).toBeGreaterThan(.05);
  await expect(preview).toHaveAttribute('data-particle-seed-phase','settled',{timeout:24000});
  await expect(preview).toHaveAttribute('data-void-wire-seed-reveal','1.000');
  const settledWires=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>
      e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector(
      '[data-testid="three-preview"] canvas'));
    return (root.store.getState().scene.getObjectByName(
      'void-web-network-lines') as any)?.geometry.instanceCount??0;
  });
  expect(settledWires).toBeGreaterThan(100);
  await category(page,'拡張');
  await page.getByLabel('シード変更時に粒子を再集合').uncheck();
  await page.getByRole('button',{name:'ランダムシードを生成'}).click();
  await expect(preview).toHaveAttribute('data-particle-seed-phase','settled');
  const active=await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>
      e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const root=(_roots as any).get(document.querySelector(
      '[data-testid="three-preview"] canvas'));
    const cloud=root.store.getState().scene.getObjectByName('void-web-particle-cloud') as any;
    return cloud.material.uniforms.uSeedProgress.value;
  });
  expect(active).toBe(-1);
  expect(errors).toEqual([]);
});

test('3D quality, not mobile device type, determines cosmic-web particle budget',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=errorsOn(page);
  try{
    const project=fixture('mobile-high-density');
    project.settings.particle={...threeDefaults.particle!,enabled:true};
    project.settings.voidMode!.particleCount=120000;
    project.settings.quality='auto';
    await open(page,project);
    const preview=page.getByTestId('three-preview');
    await expect(preview).toHaveAttribute('data-quality','low');
    await expect(preview).toHaveAttribute('data-particle-count','80000');
    project.settings.quality='high';
    await restore(page,project);
    await expect(preview).toHaveAttribute('data-quality','high');
    await expect(preview).toHaveAttribute('data-particle-count','120000');
    const count=await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
      const {_roots}=await import(/* @vite-ignore */url);
      const root=(_roots as any).get(document.querySelector('[data-testid="three-preview"] canvas'));
      return root?.store.getState().scene.getObjectByName('void-web-particle-cloud')?.geometry.getAttribute('position').count??0;
    });
    expect(count).toBe(120000);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('a new VOID session defaults to a large web and explicitly retains the old version',async({page})=>{
  const errors=errorsOn(page),normal=fixture();delete normal.settings.voidMode;await open(page,normal);
  const original=hash(await png(page));await category(page,'拡張');await page.getByLabel('VOID MODEを有効化').check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-void-mode','web');
  await expect(page.locator('#void-version')).toHaveValue('void-web-v2');
  expect(Number(await page.getByTestId('three-preview').getAttribute('data-object-count'))).toBeGreaterThan(600);
  await category(page,'図形');const spacing=page.locator('#three-spacing');
  await expect(spacing).toHaveValue('100');
  const start=await inspect(page),key=Object.keys(start.matrices).find(id=>Math.abs(start.matrices[id][12])>.01)!;
  await spacing.fill('150');await expect(spacing).toHaveValue('150');
  await expect.poll(async()=>(await inspect(page)).matrices[key]?.[12]).not.toBe(start.matrices[key][12]);
  await spacing.fill('100');
  await expect.poll(async()=>(await inspect(page)).matrices[key]?.[12]).toBe(start.matrices[key][12]);
  await category(page,'拡張');
  await page.locator('#void-version').selectOption('void-filaments-v1');await expect(page.getByTestId('three-preview')).toHaveAttribute('data-void-mode','prototype');
  expect(Number(await page.getByTestId('three-preview').getAttribute('data-object-count'))).toBeLessThanOrEqual(35);
  await page.getByLabel('VOID MODEを有効化').uncheck();expect(hash(await png(page))).toBe(original);
  const automatic=fixture();automatic.settings.quality='auto';automatic.settings.voidMode!.objectLimit=2800;await restore(page,automatic);
  const actual=await inspect(page);if(/swiftshader|llvmpipe|software|basic render/i.test(actual.renderer)){
    await expect(page.getByTestId('three-preview')).toHaveAttribute('data-quality','low');await expect(page.getByTestId('three-preview')).toHaveAttribute('data-object-count','640');
  }
  expect(errors).toEqual([]);
});

test('2800 real solids use bounded GPU batches and restore PNG, limits, density, depth and JSON',async({page})=>{
  const errors=errorsOn(page),project=fixture();project.settings.voidMode!.objectLimit=2800;await open(page,project);
  const preview=page.getByTestId('three-preview');await expect(preview).toHaveAttribute('data-object-count','2800');
  expect(Number(await preview.getAttribute('data-void-filaments'))).toBeGreaterThan(70);
  const first=await inspect(page);expect(first.bodies).toBe(2800);expect(first.outlines).toBe(2800);expect(first.bodyBatches).toBe(13);expect(first.outlineBatches).toBe(13);expect(first.individual).toBe(0);expect(first.fog).toBe(true);
  const image=await png(page),json=await saved(page);await restore(page,json);expect(hash(await png(page))).toBe(hash(image));
  await category(page,'拡張');await page.locator('#void-object-limit').fill('600');await expect(preview).toHaveAttribute('data-object-count','600');
  await page.locator('#void-object-limit').fill('2800');const restored=await inspect(page);expect(restored.matrices).toEqual(first.matrices);
  await category(page,'図形');await page.getByLabel('クイック密度').fill('0');await expect(preview).toHaveAttribute('data-object-count','0');
  await page.getByLabel('クイック密度').fill('100');expect((await inspect(page)).matrices).toEqual(first.matrices);
  await category(page,'拡張');await page.locator('#void-depth-fade').fill('0');expect((await inspect(page)).fog).toBe(false);expect(hash(await png(page))).not.toBe(hash(image));
  await category(page,'拡張');await page.locator('#void-depth-fade').fill('80');expect(hash(await png(page))).toBe(hash(image));
  await mkdir('test-results/void-web',{recursive:true});await page.getByTestId('three-preview').screenshot({path:'test-results/void-web/large-web.png'});expect(errors).toEqual([]);
  const canvas=preview.locator('canvas');await canvas.scrollIntoViewIfNeeded();await canvas.hover();await page.mouse.wheel(0,-3000);
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBeGreaterThan(first.sphereVertices);
  expect((await inspect(page)).matrices).toEqual(first.matrices);
  const closeImage=await png(page),closeProject=await saved(page);await restore(page,closeProject);
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBeGreaterThan(first.sphereVertices);
  expect(hash(await png(page))).toBe(hash(closeImage));
  await page.getByRole('button',{name:'視点をリセット',exact:true}).click();
  await expect.poll(async()=>(await inspect(page)).sphereVertices,{timeout:30_000}).toBe(first.sphereVertices);expect(errors).toEqual([]);
});

test('mobile lightweight web grows, preserves paused frames and completes standby rewiring',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),page=await context.newPage(),errors=errorsOn(page);
  try{
    const project=fixture();project.aspectRatio='9:16';project.settings.quality='auto';project.settings.voidMode!.objectLimit=2800;project.settings.entrance={...project.settings.entrance!,enabled:true,mode:'neural-grow'};
    project.elapsedSeconds=0;await open(page,project);const preview=page.getByTestId('three-preview');
    await expect(preview).toHaveAttribute('data-quality','low');await expect(preview).toHaveAttribute('data-object-count','640');expect((await inspect(page)).bodies).toBe(0);
    project.elapsedSeconds=2.5;await restore(page,project);const middle=await inspect(page);expect(middle.bodies).toBeGreaterThan(0);expect(middle.bodies).toBeLessThan(640);
    project.elapsedSeconds=12;await restore(page,project);expect((await inspect(page)).bodies).toBe(640);
    const first=hash(await png(page));await page.waitForTimeout(150);expect(hash(await png(page))).toBe(first);
    await category(page,'拡張');const slider=page.locator('#void-object-limit');await slider.scrollIntoViewIfNeeded();const box=(await slider.boundingBox())!;await page.touchscreen.tap(box.x+box.width*.75,box.y+box.height/2);
    expect(Number(await slider.inputValue())).toBeGreaterThan(600);await expect(preview).toHaveAttribute('data-object-count','640');
    await category(page,'アニメーション');await page.getByRole('button',{name:'3Dを再生',exact:true}).click();await page.getByLabel('3D待機画面モードを有効化').check();await page.getByRole('button',{name:'今すぐ次の3Dシードへ',exact:true}).click();
    await expect(preview).toHaveAttribute('data-standby-active','true');await expect(preview).toHaveAttribute('data-standby-active','false',{timeout:30_000});
    await expect(preview).toHaveAttribute('data-void-mode','web');expect(Number(await preview.getAttribute('data-object-count'))).toBeLessThanOrEqual(640);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('cosmic web reconnect sparks visibly follow the ON/OFF switch during standby',async({page})=>{
  const project=fixture('reconnect-cosmic');
  project.settings.quality='low';
  project.settings.voidMode!.objectLimit=600;
  project.settings.animation=true;
  project.settings.standby={...threeDefaults.standby!,enabled:true,mode:'morph',
    transitionSeconds:8,pauseOnInteraction:false,reconnectGlow:true};
  project.elapsedSeconds=12;
  await open(page,project);
  await category(page,'アニメーション');
  const glow=page.getByRole('checkbox',{name:'ワイヤー再接続時に発光'});
  await expect(glow).toBeChecked();
  await expect(page.locator('#three-standby-reconnect-intensity')).toHaveValue('25');
  const preview=page.getByTestId('three-preview');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await expect(preview).toHaveAttribute('data-standby-wire-phase','reconnect',{timeout:20_000});
  const count=async()=>page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    const root=_roots.get(canvas) as any;
    return root?.store.getState().scene.getObjectByName('standby-reconnect-sparks')?.count??0;
  });
  // Freeze on the exact frame where the (much smaller) spark is visible.
  // An external Playwright click can take hundreds of milliseconds, after
  // which the short reconnection phase may already have finished.
  await page.waitForFunction(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!.name;
    const {_roots}=await import(/* @vite-ignore */url);
    const canvas=document.querySelector('[data-testid="three-preview"] canvas');
    const scene=(_roots.get(canvas) as any)?.store.getState().scene;
    if(!(scene?.getObjectByName('standby-reconnect-sparks')?.count>0))return false;
    const button=Array.from(document.querySelectorAll('button')).find(el=>
      (el.getAttribute('aria-label')??'').includes('3Dを一時停止')||
      (el.textContent??'').includes('3Dを一時停止'));
    if(!button)return false;
    button.click();
    return true;
  },undefined,{timeout:9000,polling:25});
  await expect(page.getByRole('button',{name:'3Dを再生',exact:true})).toBeVisible();
  await expect.poll(count,{timeout:1000}).toBeGreaterThan(0);
  const canvas=preview.locator('canvas');
  const on=await canvas.screenshot();
  const strength=page.locator('#three-standby-reconnect-intensity');
  await strength.fill('0');
  await expect.poll(count).toBe(0);
  const zero=await canvas.screenshot();
  expect(on.equals(zero)).toBe(false);
  await glow.uncheck();
  await expect.poll(count).toBe(0);
  const off=await canvas.screenshot();
  expect(on.equals(off)).toBe(false);
});

test('cosmic web lights all completed wires once, with adjustable soft glow',async({page})=>{
  const project=fixture('reconnect-web-final-ignition');
  project.settings.quality='low';
  project.settings.voidMode!.objectLimit=600;
  project.settings.animation=true;
  project.settings.standby={...threeDefaults.standby!,enabled:true,
    mode:'morph',transitionSeconds:4,pauseOnInteraction:false,
    reconnectGlow:true,reconnectIntensity:25};
  project.elapsedSeconds=12;
  await open(page,project);
  const preview=page.getByTestId('three-preview'),canvas=preview.locator('canvas');
  await category(page,'アニメーション');
  await page.getByRole('button',{name:'今すぐ次の3Dシードへ'}).click();
  await page.waitForFunction(()=>{
    const preview=document.querySelector('[data-testid="three-preview"]') as HTMLElement|null;
    if(preview?.dataset.standbyActive!=='false'||
      Number(preview.dataset.standbyGlobalFlash??0)<.16)return false;
    const button=Array.from(document.querySelectorAll('button')).find(el=>el.textContent?.trim()==='3Dを一時停止');
    if(!button)return false;
    button.click();
    return true;
  },undefined,{polling:16,timeout:25_000});
  await expect(page.getByRole('button',{name:'3Dを再生',exact:true})).toBeVisible();
  const flash=async()=>Number(await preview.getAttribute('data-standby-global-flash'));
  await expect.poll(flash,{timeout:2000}).toBeGreaterThan(.02);
  const on=await canvas.screenshot();
  await page.locator('#three-standby-reconnect-intensity').fill('0');
  await expect.poll(flash).toBe(0);
  const off=await canvas.screenshot();
  expect(on.equals(off)).toBe(false);
  await page.locator('#three-standby-reconnect-intensity').fill('25');
  await expect.poll(flash).toBeGreaterThan(.02);
});

test('the web exports WebM and MP4 using exact animation frames and restores preview',async({page})=>{
  const errors=errorsOn(page),project=fixture();project.settings.quality='low';project.settings.voidMode!.objectLimit=600;
  project.settings.entrance={...project.settings.entrance!,enabled:true,mode:'neural-grow',duration:2};project.elapsedSeconds=0;project.exportWidth=256;project.exportHeight=256;await open(page,project);
  const background=(await png(page)).toString('base64');project.elapsedSeconds=12;await restore(page,project);
  const before=hash(await png(page));await category(page,'書き出し');await page.locator('.three-video-panel > summary').click();
  await page.locator('#three-video-width').fill('256');await page.locator('#three-video-height').fill('256');await page.locator('#three-video-duration').fill('3');await page.locator('#three-video-fps').selectOption('24');
  const endFrames:number[][]=[];
  for(const format of ['webm','mp4']){
    await page.locator('#three-video-format').selectOption(format);const start=page.getByRole('button',{name:'3D動画を保存',exact:true});
    await expect(start).toBeEnabled({timeout:30_000});const pending=page.waitForEvent('download');await start.click();const download=await pending;
    expect(await download.failure()).toBeNull();expect((await readFile((await download.path())!)).length).toBeGreaterThan(1000);
    const video=await readFile((await download.path())!);
    const decoded=await page.evaluate(async({bytes,format,background})=>{
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:format==='mp4'?'video/mp4':'video/webm'})),v=document.createElement('video');v.src=url;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d')!;
      const image=new Image();image.src='data:image/png;base64,'+background;await image.decode();c.drawImage(image,0,0);const expected=c.getImageData(0,0,256,256).data;
      try{
        await new Promise<void>((resolve,reject)=>{v.onloadeddata=()=>resolve();v.onerror=()=>reject(new Error('video decode'));});
        c.drawImage(v,0,0);const first=c.getImageData(0,0,256,256).data;let changed=0;
        for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-expected[i])+Math.abs(first[i+1]-expected[i+1])+Math.abs(first[i+2]-expected[i+2])>45)changed++;
        await new Promise<void>(resolve=>{v.onseeked=()=>resolve();v.currentTime=71/24;});c.drawImage(v,0,0);
        return {duration:v.duration,firstForeground:changed,last:Array.from(c.getImageData(0,0,256,256).data)};
      }finally{URL.revokeObjectURL(url);}
    },{bytes:Array.from(video),format,background});
    expect(decoded.duration).toBeGreaterThanOrEqual(2.95);expect(decoded.firstForeground).toBeLessThan(150);endFrames.push(decoded.last);
    expect(hash(await png(page))).toBe(before);
  }
  project.elapsedSeconds=71/24;await restore(page,project);const completed=(await png(page)).toString('base64');
  for(const pixels of endFrames){
    const difference=await page.evaluate(async({pixels,completed})=>{
      const image=new Image();image.src='data:image/png;base64,'+completed;await image.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d')!;c.drawImage(image,0,0);const expected=c.getImageData(0,0,256,256).data;let difference=0;
      for(let i=0;i<expected.length;i++)if(i%4!==3)difference+=Math.abs(expected[i]-pixels[i]);return difference/(256*256*3);
    },{pixels,completed});
    expect(difference).toBeLessThan(12); // lossy codec tolerance at matching timestamp
  }
  expect(errors).toEqual([]);
});
