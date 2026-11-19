import {test,expect} from '@playwright/test';

test('settings checklist opens sliding details and keeps previous values',async({page})=>{
  await page.goto('./?legacy-ui=1');
  const screen=page.locator('.settings-screen');
  const choices=page.getByRole('navigation',{name:'設定カテゴリー'});
  await expect(screen).not.toHaveClass(/is-detail/);
  await expect(choices.getByRole('checkbox',{name:'図形の設定を開く'})).toBeVisible();

  await choices.getByRole('checkbox',{name:'図形の設定を開く'}).check();
  await expect(screen).toHaveClass(/is-detail/);
  const seed=page.getByLabel('シード値',{exact:true});
  await seed.fill('slide-menu-verification');

  await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  await expect(screen).not.toHaveClass(/is-detail/);
  await choices.getByRole('checkbox',{name:'背景の設定を開く'}).check();
  await expect(page.getByRole('region',{name:'背景の設定を開く'})).toBeVisible();

  await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  await choices.getByRole('checkbox',{name:'図形の設定を開く'}).check();
  await expect(seed).toHaveValue('slide-menu-verification');
});

test('mobile floating top button returns to the first screen',async({page})=>{
  await page.setViewportSize({width:390,height:720});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
  await page.getByRole('checkbox',{name:'アニメーションの設定を開く'}).check();
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const toTop=page.getByRole('button',{name:'ページの先頭に戻る'});
  await expect(toTop).toBeVisible();
  await toTop.click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(30);
  await expect(page.locator('html')).not.toHaveAttribute('data-error','true');
});

test('keyboard navigation transfers focus to the settings detail and back',async({page})=>{
  await page.goto('./?legacy-ui=1');
  const shapes=page.getByRole('checkbox',{name:'図形の設定を開く'});
  await shapes.focus();
  await shapes.press('Space');
  const back=page.getByRole('button',{name:'設定一覧へ',exact:true});
  await expect(back).toBeFocused();
  await back.press('Enter');
  await expect(shapes).toBeFocused();
  await expect(page.locator('.settings-screen')).not.toHaveClass(/is-detail/);
});
