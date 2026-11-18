import type {Page} from '@playwright/test';

/** Open a settings detail screen using the actual user-facing checkbox workflow. */
export async function openSettingsCategory(page:Page,name:string){
  const screen=page.locator('.settings-screen');
  // Prototype: big categories are ordinary tabs, not checkbox drill-downs.
  const tab=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
  if((await screen.count())>0&&(await tab.count())>0){
    if((await tab.getAttribute('aria-pressed'))!=='true')await tab.click();
    return;
  }
  // Reference checkouts used by cross-version regression tests still use the legacy category buttons.
  if((await screen.count())===0){
    const oldButton=page.getByRole('navigation',{name:'設定カテゴリー'}).getByRole('button',{name,exact:true});
    if((await oldButton.getAttribute('aria-expanded'))!=='true')await oldButton.click();
    return;
  }
  if((await screen.getAttribute('class'))?.includes('is-detail')){
    if((await page.locator('.settings-detail-current').textContent())?.trim()===name)return;
    await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  }
  await page.getByRole('checkbox',{name:name+'の設定を開く'}).check();
}
