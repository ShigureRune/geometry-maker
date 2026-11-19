import {expect,test} from '@playwright/test';

/**
 * Settings inspector accessibility and navigation regression suite.
 * Each test starts with a fresh browser context; reduced motion removes
 * timing sensitivity without changing the interaction contract.
 */
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?legacy-ui=1');
});

const categories=[
  ['図形','shapes'],['背景','background'],['カラー','colors'],
  ['文字','text'],['装飾','decoration'],['アニメーション','animation'],
  ['書き出し','export'],
] as const;

test('all seven settings choices have unique accessible labels and valid panel targets',async({page})=>{
  const navigation=page.getByRole('navigation',{name:'設定カテゴリー'});
  const checkboxes=navigation.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(categories.length);
  for(const [label,id] of categories){
    const choice=navigation.getByRole('checkbox',{name:`${label}の設定を開く`});
    await expect(choice).toHaveAttribute('id',`category-${id}`);
    await expect(choice).toHaveAttribute('aria-controls',`panel-${id}`);
    await expect(page.locator(`#panel-${id}`)).toHaveCount(1);
    await expect(choice).not.toBeChecked();
  }
});

test('the inactive page is inert and hidden from assistive technology in both directions',async({page})=>{
  const index=page.getByRole('region',{name:'設定一覧',includeHidden:true});
  const detail=page.getByRole('region',{name:'個別設定',includeHidden:true});
  const choice=page.getByRole('checkbox',{name:'背景の設定を開く'});
  await expect(index).not.toHaveAttribute('inert','');
  await expect(index).toHaveAttribute('aria-hidden','false');
  await expect(detail).toHaveAttribute('inert','');
  await expect(detail).toHaveAttribute('aria-hidden','true');
  await choice.check();
  await expect(index).toHaveAttribute('inert','');
  await expect(index).toHaveAttribute('aria-hidden','true');
  await expect(detail).not.toHaveAttribute('inert','');
  await expect(detail).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#panel-background')).toBeVisible();
  await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
  await expect(index).not.toHaveAttribute('inert','');
  await expect(detail).toHaveAttribute('inert','');
});

test('keyboard activation and Escape return focus to the last category',async({page})=>{
  const choice=page.getByRole('checkbox',{name:'カラーの設定を開く'});
  await choice.focus();
  await choice.press('Space');
  const back=page.getByRole('button',{name:'設定一覧へ',exact:true});
  await expect(back).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings-screen')).not.toHaveClass(/is-detail/);
  await expect(choice).toBeFocused();
});

test('every category can be opened and closed without exposing other panels',async({page})=>{
  const back=page.getByRole('button',{name:'設定一覧へ',exact:true});
  for(const [label,id] of categories){
    await page.getByRole('checkbox',{name:`${label}の設定を開く`}).check();
    await expect(page.locator('.settings-detail-current')).toHaveText(label);
    await expect(page.locator(`#panel-${id}`)).toBeVisible();
    for(const [,other] of categories.filter(([,other])=>other!==id)){
      await expect(page.locator(`#panel-${other}`)).toBeHidden();
    }
    await back.click();
    await expect(page.locator('.settings-screen')).not.toHaveClass(/is-detail/);
  }
});

test('mobile dock returns to the settings index and opens export',async({page})=>{
  await page.setViewportSize({width:390,height:720});
  await page.getByRole('checkbox',{name:'図形の設定を開く'}).check();
  const dock=page.getByRole('navigation',{name:'モバイルクイック操作'});
  await dock.getByRole('button',{name:'設定'}).click();
  await expect(page.locator('.settings-screen')).not.toHaveClass(/is-detail/);
  await dock.getByRole('button',{name:'保存'}).click();
  await expect(page.locator('#panel-export')).toBeVisible();
  await expect(page.locator('.settings-detail-current')).toHaveText('書き出し');
});
