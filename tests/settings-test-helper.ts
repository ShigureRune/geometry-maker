import type {Page} from '@playwright/test';

/** Open a settings detail screen using the actual user-facing checkbox workflow. */
export async function openSettingsCategory(page:Page,name:string){
  const screen=page.locator('.settings-screen');
  if((await screen.getAttribute('class'))?.includes('is-detail')){
    if((await page.locator('.settings-detail-current').textContent())===name)return;
    await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:name+'の設定を開く'}).check();
}
