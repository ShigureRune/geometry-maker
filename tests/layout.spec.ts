import {openSettingsCategory} from './settings-test-helper';
import {test,expect} from '@playwright/test';
test('mobile category grid and desktop preview retain usable layouts',async({page})=>{
 await page.goto('./');for(const width of [390,720,1440]){
 if((await page.locator('.settings-screen').getAttribute('class'))?.includes('is-detail'))await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
 await page.setViewportSize({width,height:844});const preview=(await page.locator('.preview-panel').boundingBox())!,controls=(await page.locator('.controls').boundingBox())!;
 if(width<=720)expect(controls.y).toBeGreaterThanOrEqual(preview.y+preview.height-1);else expect(controls.x+controls.width).toBeLessThanOrEqual(preview.x+1);
 const options=page.locator('.settings-index-option');await expect(options).toHaveCount(7);for(const button of await options.all()){const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThan(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 await openSettingsCategory(page,'書き出し');await expect(page.getByRole('button',{name:'PNGを書き出す',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await openSettingsCategory(page,'図形');
 }
});
