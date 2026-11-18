import {test,expect} from './ui-test';
import {mkdir} from 'node:fs/promises';
test('growth start, seek, completion, playback and complete exports',async({page})=>{
 await page.goto('./');await page.getByLabel('アニメーションを有効化').uncheck();await page.getByLabel('シード値',{exact:true}).fill('undefined-heartbeat');await page.getByLabel('発光強度').fill('0');const shapes=page.getByTestId('shapes');
 const count=await shapes.locator(':scope > g').count();
 await page.getByLabel('アニメーションを有効化').check();
 await expect(shapes.locator(':scope > g')).toHaveCount(0);
 await mkdir('test-results/growth',{recursive:true});await page.getByTestId('preview').screenshot({path:'test-results/growth/start.png'});
 await page.getByLabel('タイムライン',{exact:true}).fill('500');
 expect(await shapes.locator(':scope > g').count()).toBeGreaterThan(0);
 expect(await shapes.locator('[style*="stroke-dashoffset"]').count()).toBeGreaterThan(0);
 await page.getByTestId('preview').screenshot({path:'test-results/growth/middle.png'});
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();const file=await pending;const {readFile}=await import('node:fs/promises');const svg=await readFile((await file.path())!,'utf8');expect(svg).not.toContain('stroke-dashoffset');expect(svg.match(/data-shape-id=/g)?.length).toBe(count);
 const pngPending=page.waitForEvent('download');await page.getByRole('button',{name:'PNGを書き出す',exact:true}).click();const png=await pngPending;const partialPNG=await readFile((await png.path())!);
 await page.getByRole('button',{name:'完成状態を表示',exact:true}).click();await expect(shapes.locator(':scope > g')).toHaveCount(count);expect(await shapes.locator('[style*="stroke-dashoffset"]').count()).toBe(0);
 await page.getByTestId('preview').screenshot({path:'test-results/growth/complete.png'});
 const fullPending=page.waitForEvent('download');await page.getByRole('button',{name:'PNGを書き出す',exact:true}).click();const full=await fullPending;expect((await readFile((await full.path())!)).equals(partialPNG)).toBe(true);
 await page.getByLabel('成長時間（秒）').fill('1');await page.getByLabel('再生速度',{exact:true}).selectOption('4');await page.getByRole('button',{name:'最初から再生',exact:true}).click();await expect(page.getByTestId('playback-position')).toContainText('100%');
 await page.getByLabel('成長時間（秒）').fill('8');await page.getByLabel('再生速度',{exact:true}).selectOption('1');
 await page.getByLabel('タイムライン',{exact:true}).fill('200');await page.getByRole('button',{name:'再生',exact:true}).click();await page.getByRole('button',{name:'一時停止',exact:true}).click();const pos=await page.getByTestId('playback-position').textContent();await page.waitForTimeout(150);expect(await page.getByTestId('playback-position').textContent()).toBe(pos);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('v4 classic contour light flows after 100%, pauses, resumes and leaves shapes fixed',async({page})=>{
 await page.goto('./');
 await page.getByLabel('生成アルゴリズム').selectOption('2d-v4');
 // This known seed contains both v4 bands and a two-layer arc. Include all
 // density candidates so the secondary dotted arc is actually rendered.
 await page.getByLabel('シード値',{exact:true}).fill('postgrowth-bar-and-arc');
 await page.getByLabel('シード値',{exact:true}).press('Enter');
 await page.getByLabel('図形密度').fill('100');
 await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-v4');
 await expect(page.getByLabel('完成後も線に光を流す')).toBeChecked();
 await page.getByLabel('成長時間（秒）').fill('1');
 await page.getByLabel('再生速度',{exact:true}).selectOption('4');
 await page.getByRole('button',{name:'最初から再生',exact:true}).click();
 await expect(page.getByTestId('playback-position')).toContainText('100%',{timeout:6000});
 await expect.poll(async()=>Number.parseFloat(await page.getByTestId('post-growth-motion').textContent()??'0'),
   {timeout:6000}).toBeGreaterThan(.3);
 const mainGlow=page.locator('[data-role="hero"] [data-testid="main-figure-halo"]').first();
 await expect(mainGlow).toHaveCount(1);
 const oldHeroGlow=await mainGlow.getAttribute('stroke-dashoffset');
 await expect.poll(async()=>mainGlow.getAttribute('stroke-dashoffset'),
   {timeout:5000}).not.toBe(oldHeroGlow);
 await expect(page.getByTestId('bar-soft-sheen')).toHaveCount(0);
 await expect(page.getByTestId('bar-soft-feather')).toHaveCount(0);
 // Real hero-connected circuits receive synchronized energy packets.
 const link=page.locator('[data-kind="circuit"] [data-testid="energy-relay"]').first();
 await expect(link).toHaveCount(1);
 await expect.poll(async()=>link.getByTestId('energy-transfer').count(),
   {timeout:10000}).toBe(1);
 const flow=page.getByTestId('figure-flow').first();
 await expect(flow).toHaveCount(1);
 await expect.poll(async()=>Number(await flow.getAttribute('data-flow-opacity'))).toBeGreaterThan(.05);
 const parent=flow.locator('..');
 const shapeId=await parent.getAttribute('data-shape-id');
 expect(shapeId).toBeTruthy();
 const originalShape=page.getByTestId('shapes').locator(`[data-shape-id="${shapeId}"]`);
 const originalTransform=await originalShape.getAttribute('transform');
 const first=await flow.getAttribute('data-flow-offset');
 await expect.poll(async()=>flow.getAttribute('data-flow-offset'),{timeout:5000}).not.toBe(first);
 expect(await originalShape.getAttribute('transform')).toBe(originalTransform);
 // Thick bands, decorative narrow rectangles AND thin lines all move as
 // complete shapes. Compare world-space motion (not internal light streaks).
 await expect(page.getByTestId('bar-flow')).toHaveCount(0);
 const movingBar=page.locator('[data-kind="band"] [data-testid="bar-body-motion"]').first();
 const movingLine=page.locator('[data-kind="line"] [data-testid="bar-body-motion"]').first();
 const movingStrip=page.locator('[data-kind="rectangle"] [data-testid="bar-body-motion"]').first();
 await expect(movingBar).toHaveCount(1);
 await expect(movingLine).toHaveCount(1);
 await expect(movingStrip).toHaveCount(1);
 const barRoot=movingBar.locator('..');
 const originalBarPosition=await barRoot.getAttribute('transform');
 const oldBar=Number(await movingBar.getAttribute('data-bar-shift'));
 const oldLine=Number(await movingLine.getAttribute('data-bar-shift'));
 await expect.poll(async()=>Number(await movingBar.getAttribute('data-bar-shift')),{timeout:5000}).toBeGreaterThan(oldBar);
 await expect.poll(async()=>Number(await movingLine.getAttribute('data-bar-shift')),{timeout:5000}).toBeGreaterThan(oldLine);
 const nowBar=Number(await movingBar.getAttribute('data-bar-shift'));
 const nowLine=Number(await movingLine.getAttribute('data-bar-shift'));
 await expect.poll(async()=>Number(await movingBar.getAttribute('data-bar-shift')),{timeout:5000}).toBeGreaterThan(nowBar);
 await expect.poll(async()=>Number(await movingLine.getAttribute('data-bar-shift')),{timeout:5000}).toBeGreaterThan(nowLine);
 expect(await barRoot.getAttribute('transform')).toBe(originalBarPosition);
 // Generated edge highlights share kind="line" with the thin rods, but
 // role="accent" means an overlay: they must NEVER follow rod translations.
 const highlight=page.locator('[data-role="accent"]').first();
 await expect(highlight).toHaveCount(1);
 const highlightPosition=await highlight.getAttribute('transform');
 await expect(highlight.getByTestId('bar-body-motion')).toHaveCount(0);
 await expect(highlight.getByTestId('figure-flow')).toHaveCount(0);
 const previousRodShift=Number(await movingLine.getAttribute('data-bar-shift'));
 await expect.poll(async()=>Number(await movingLine.getAttribute('data-bar-shift')),
   {timeout:5000}).toBeGreaterThan(previousRodShift);
 expect(await highlight.getAttribute('transform')).toBe(highlightPosition);
 const coupled=page.locator('[data-role="hero"] [data-testid="coupled-rotation"]').first();
 await expect(coupled).toHaveCount(1);
 const initialRotation=await coupled.getAttribute('data-rotation-angle');
 await expect.poll(async()=>coupled.getAttribute('data-rotation-angle'),{timeout:5000}).not.toBe(initialRotation);
 // Seed density may omit all eligible linked satellite contours; the unit
 // fixture verifies their synchronized counter-rotation independently.
 const dottedArc=page.locator('[data-kind="arc"] path[stroke-dasharray][transform^="rotate("]').first();
 await expect(dottedArc).toHaveCount(1);
 const oldAngle=await dottedArc.getAttribute('transform');
 await expect.poll(async()=>dottedArc.getAttribute('transform'),{timeout:5000}).not.toBe(oldAngle);
 await page.getByRole('button',{name:'一時停止',exact:true}).click();
 await page.waitForTimeout(110);
 const frozen=await flow.getAttribute('data-flow-offset');
 const frozenBar=await movingBar.getAttribute('data-bar-shift');
 const frozenRotation=await coupled.getAttribute('data-rotation-angle');
 await page.waitForTimeout(220);
 expect(await flow.getAttribute('data-flow-offset')).toBe(frozen);
 expect(await movingBar.getAttribute('data-bar-shift')).toBe(frozenBar);
 expect(await coupled.getAttribute('data-rotation-angle')).toBe(frozenRotation);
 expect(await originalShape.getAttribute('transform')).toBe(originalTransform);
 await page.getByRole('button',{name:'再生',exact:true}).click();
 await expect.poll(async()=>flow.getAttribute('data-flow-offset'),{timeout:5000}).not.toBe(frozen);
 await expect.poll(async()=>movingBar.getAttribute('data-bar-shift'),{timeout:5000}).not.toBe(frozenBar);
 await page.getByRole('button',{name:'完成状態を表示',exact:true}).click();
 await expect(page.getByTestId('figure-flow')).toHaveCount(0);
 await expect(page.getByTestId('bar-body-motion')).toHaveCount(0);
 await expect(page.getByTestId('coupled-rotation')).toHaveCount(0);
 await expect(page.getByTestId('main-figure-halo')).toHaveCount(0);
 await expect(page.getByTestId('energy-relay')).toHaveCount(0);
 await expect(page.getByTestId('energy-arrival')).toHaveCount(0);
 expect(await originalShape.getAttribute('transform')).toBe(originalTransform);
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'SVGを書き出す',exact:true}).click();
 const svg=await (await import('node:fs/promises')).readFile((await (await download).path())!,'utf8');
 expect(svg).not.toContain('data-testid="figure-flow"');
 await page.getByRole('button',{name:'再生',exact:true}).click();
 await expect(flow).toHaveCount(1);
 await page.getByLabel('完成後も線に光を流す').uncheck();
 await expect(page.getByTestId('figure-flow')).toHaveCount(0);
 await expect(page.getByTestId('bar-body-motion')).toHaveCount(0);
 await expect(page.getByTestId('coupled-rotation')).toHaveCount(0);
 await expect(page.getByTestId('main-figure-halo')).toHaveCount(0);
 await expect(page.getByTestId('energy-relay')).toHaveCount(0);
 await expect(page.getByTestId('energy-arrival')).toHaveCount(0);
 expect(await originalShape.getAttribute('transform')).toBe(originalTransform);
 await page.getByLabel('完成後も線に光を流す').check();
 await expect(flow).toHaveCount(1);
 await page.getByLabel('生成アルゴリズム').selectOption('2d-v5');
 await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm','2d-v5');
 await expect(page.getByLabel('完成後も線に光を流す')).toBeChecked();
});

test('real hero circuits fan out simultaneous light in both v4 and v5 playback',async({page})=>{
 for(const version of ['2d-v4','2d-v5'] as const){
  await page.goto('./');
  await page.getByLabel('生成アルゴリズム').selectOption(version);
  // An arbitrary generated v5 layout may have no visible circuits.
  // Pick a deterministic real scene with at least two authored hero branches.
  const kind=version==='2d-v4'?'circuit':'branch-circuit';
  let found=false;
  for(const candidate of [
   'postgrowth-bar-and-arc','real-connected-energy-2d-v5',
   'v5-branched-flow','geometry-circuits-01','geometry-circuits-02',
   'circular-network','hero-branches','multi-anchor-energy',
  ]){
   await page.getByLabel('シード値',{exact:true}).fill(candidate);
   await page.getByLabel('シード値',{exact:true}).press('Enter');
   await page.getByLabel('図形密度').fill('100');
   // React updates the visible scene asynchronously after Enter.
   // Wait for a real two-route layout rather than reading a stale frame.
   try{
    await expect.poll(async()=>page.locator(
      `[data-kind="${kind}"][data-parent^="hero"]`).count(),
      {timeout:1800,intervals:[100,250,400]}).toBeGreaterThan(1);
    found=true;break;
   }catch{ /* This deterministic seed simply has fewer than two visible branches. */ }
  }
  expect(found,version+' needs a scene with two real authored circuits').toBe(true);
  await expect(page.getByTestId('preview')).toHaveAttribute('data-algorithm',version);
  await page.getByLabel('成長時間（秒）').fill('1');
  await page.getByLabel('再生速度',{exact:true}).selectOption('4');
  const hero=page.locator('[data-role="hero"]').first();
  const initialTransform=await hero.getAttribute('transform');
  await page.getByRole('button',{name:'最初から再生',exact:true}).click();
  await expect(page.getByTestId('playback-position')).toContainText('100%',{timeout:6000});
  const signals=page.locator(`[data-kind="${kind}"] [data-testid="energy-relay"]`);
  await expect.poll(async()=>signals.count(),{timeout:7000}).toBeGreaterThan(1);
  await expect.poll(async()=>page.getByTestId('energy-branch').count(),
    {timeout:14000}).toBeGreaterThan(1);
  expect(await hero.getAttribute('transform')).toBe(initialTransform);
  await expect(page.getByTestId('bar-body-motion').first()).toHaveCount(1);
  await expect(page.getByTestId('coupled-rotation').first()).toHaveCount(1);
  await page.getByRole('button',{name:'完成状態を表示',exact:true}).click();
  await expect(page.getByTestId('energy-branch')).toHaveCount(0);
  await expect(page.getByTestId('energy-merge')).toHaveCount(0);
 }
});
