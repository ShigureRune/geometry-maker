import {test,expect} from '@playwright/test';

test('command palette supports arrow selection and Enter activation',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'コマンド検索'}).click();
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  await expect(search).toBeFocused();
  const items=page.locator('.studio-command-result');
  expect(await items.count()).toBeGreaterThan(1);
  const second=items.nth(1);
  const target=await second.textContent();
  await search.press('ArrowDown');
  await expect(second).toHaveAttribute('aria-current','true');
  await expect(search).toHaveAttribute('aria-activedescendant',await second.getAttribute('id')??'');
  await search.press('ArrowUp');
  await expect(items.first()).toHaveAttribute('aria-current','true');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toHaveCount(0);
  expect(target).toBeTruthy();
});

test('filtering resets keyboard selection and empty search does not execute',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'コマンド検索'}).click();
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  await search.press('ArrowDown');
  await search.fill('絶対に存在しないコマンド');
  await expect(page.getByText('一致する操作がありません。')).toBeVisible();
  await expect(search).not.toHaveAttribute('aria-activedescendant',/./);
  await search.press('Enter');
  await expect(page.getByRole('dialog',{name:'クイックコマンド'})).toBeVisible();
  await search.fill('背景');
  await expect(page.locator('.studio-command-result').first()).toHaveAttribute('aria-current','true');
});

test('keyboard navigation highlights and scrolls the selected command into view',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'コマンド検索'}).click();
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  const items=page.locator('.studio-command-result');
  expect(await items.count()).toBeGreaterThan(4);
  await search.press('End');
  await expect(items.last()).toHaveAttribute('aria-current','true');
  await expect(items.last()).toHaveCSS('background-color','rgb(47, 50, 82)');
  await expect.poll(()=>page.locator('.studio-command-results').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await search.press('Home');
  await expect(items.first()).toHaveAttribute('aria-current','true');
  await expect(page.locator('.studio-command-results')).toHaveJSProperty('scrollTop',0);
  await expect(search).toBeFocused();
});


test('command search announces result counts to assistive technology',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'コマンド検索'}).click();
  const search=page.getByRole('searchbox',{name:'コマンドを検索'});
  const status=page.getByRole('status');
  const count=await page.locator('.studio-command-result').count();
  await expect(status).toHaveText(`${count} 件のコマンドが見つかりました`);
  await search.fill('絶対に存在しないコマンド');
  await expect(status).toHaveText('0 件のコマンドが見つかりました');
  await search.fill('背景');
  await expect(status).toHaveText(/^[1-9]\d* 件のコマンドが見つかりました$/);
});
