import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test('quick density has tactile progress and updates its fill without changing layout',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const slider=page.getByRole('slider',{name:'クイック密度'});
  await expect(slider).toBeVisible();
  await expect(slider).toHaveClass(/studio-progress-range/);
  const bounding=await slider.boundingBox();
  await slider.fill('75');
  await expect(slider).toHaveValue('75');
  await expect.poll(async()=>slider.evaluate(el=>
    (el as HTMLInputElement).style.getPropertyValue('--studio-range-fill'))).toBe('75%');
  const after=await slider.boundingBox();
  expect(Math.abs(after!.width-bounding!.width)).toBeLessThan(1);
  expect(Math.abs(after!.y-bounding!.y)).toBeLessThan(1);
  await slider.fill('30');
  await expect.poll(async()=>slider.evaluate(el=>
    (el as HTMLInputElement).style.getPropertyValue('--studio-range-fill'))).toBe('30%');
  expect(errors).toEqual([]);
});

test('fine settings cards have pressed feedback, keep focus and respect reduced motion',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  await openSettingsCategory(page,'図形');
  const item=page.getByRole('button',{name:'シードと生成方式の詳細設定を開く'});
  await expect(item).toBeVisible();
  const feedback=await item.evaluate(el=>{
    const style=getComputedStyle(el);
    return {transition:style.transitionDuration,
      radius:parseFloat(style.borderRadius),touch:style.touchAction};
  });
  expect(feedback.transition).toBe('0s');
  expect(feedback.radius).toBeGreaterThanOrEqual(8);
  await item.click();
  const back=page.locator('#fine-sections-shapes-detail').getByRole('button',{name:'細かい設定一覧へ'});
  await expect(back).toBeVisible();
  await back.click();
  await expect(item).toBeFocused();
  expect(errors).toEqual([]);
});

test('3D slider shows real percentage and fullscreen inspector preserves iPhone dock',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const dock=page.locator('.studio-app > .studio-mobile-dock');
  const before=await dock.boundingBox();
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  await page.getByRole('button',{name:'図形の間隔の詳細設定を開く'}).click();
  const slider=page.locator('#three-spacing');
  await expect(slider).toHaveClass(/studio-progress-range/);
  await slider.fill('175');
  await expect(slider).toHaveValue('175');
  const fill=await slider.evaluate(el=>
    parseFloat((el as HTMLInputElement).style.getPropertyValue('--studio-range-fill')));
  expect(fill).toBeGreaterThan(83);
  expect(fill).toBeLessThan(84);
  await page.locator('#three-shapes-fullscreen-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  const after=await dock.boundingBox();
  expect(Math.abs(after!.x-before!.x)).toBeLessThan(1);
  expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
  await expect(dock).toBeVisible();
  expect(errors).toEqual([]);
});
