import type {Page} from '@playwright/test';

/** Open a settings detail screen using the actual user-facing checkbox workflow. */
export async function openSettingsCategory(page:Page,name:string){
  const screen=page.locator('.settings-screen');
  // In the modern UI the category tabs slide away when a fine detail is open.
  // Find the tab without relying on its current accessibility visibility, then
  // return from the nested detail before switching categories.
  const tabs=page.locator('.settings-tabs-navigation');
  if((await screen.count())>0&&(await tabs.count())>0){
    const tab=tabs.locator('button').filter({hasText:new RegExp('^'+name+'
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
)});
    if((await tab.getAttribute('aria-pressed'))==='true')return;
    const back=page.locator('.category-panel:not([hidden]) .fine-sections.is-detail .fine-sections-back-button, .category-panel:not([hidden]) .three-shape-controls.fine-detail-open .fine-settings-back button');
    if(await back.count())await back.first().click();
    await tab.click();
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
