import {test,expect} from '@playwright/test';
import {openSettingsCategory} from './settings-test-helper';

test.setTimeout(120_000);

test('fine settings preview opens individual particle and galaxy inspectors without confusing enable switches',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await openSettingsCategory(page,'図形');

  const nav=page.getByRole('navigation',{name:'3D図形の細かい設定'});
  const particleDetail=page.getByTestId('particle-mode-controls');
  const galaxyDetail=page.getByTestId('galaxy-mode-controls');
  const particleChoice=nav.getByRole('checkbox',{name:'PARTICLE MODE · 渦巻き集合の詳細設定を開く'});
  const galaxyChoice=nav.getByRole('checkbox',{name:'GALAXY MODE · 巨大銀河の詳細設定を開く'});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('checkbox')).toHaveCount(6);
  await expect(particleChoice).not.toBeChecked();
  await expect(galaxyChoice).not.toBeChecked();
  await expect(particleDetail).toBeHidden();
  await expect(galaxyDetail).toBeHidden();

  await particleChoice.check();
  const back=page.getByRole('button',{name:'細かい設定一覧へ'});
  await expect(back).toBeFocused();
  await expect(particleDetail).toBeVisible();
  await expect(galaxyDetail).toBeHidden();
  await page.getByRole('checkbox',{name:'PARTICLE MODEを有効化'}).check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','on');
  await back.click();
  await expect(nav).toBeVisible();
  await expect(particleChoice).toBeFocused();
  await expect(particleChoice).not.toBeChecked();
  await expect(nav).toContainText('現在ON');

  await galaxyChoice.check();
  await expect(galaxyDetail).toBeVisible();
  await expect(particleDetail).toBeHidden();
  await page.getByRole('checkbox',{name:'GALAXY MODEを有効化'}).check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-galaxy-mode','on');
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','off');
  await page.keyboard.press('Escape');
  await expect(nav).toBeVisible();
  await expect(galaxyChoice).toBeFocused();
  await expect(galaxyDetail).toBeHidden();
  expect(errors).toEqual([]);
});

test('ordinary 3D settings keep the pre-existing checkbox workflow until fine settings are adopted',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(page.getByTestId('three-preview').locator('canvas')).toBeVisible();
  await openSettingsCategory(page,'図形');
  await expect(page.getByTestId('particle-mode-controls')).toBeVisible();
  await expect(page.getByTestId('galaxy-mode-controls')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'3D図形の細かい設定'})).toHaveCount(0);
});

test('all six fine-grained shape sections open separately and retain values',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  const nav=page.getByRole('navigation',{name:'3D図形の細かい設定'});
  const back=page.getByRole('button',{name:'細かい設定一覧へ'});
  const groups=[
    {id:'spacing',name:'図形の間隔'},
    {id:'kinds',name:'図形の種類'},
    {id:'celestial',name:'星や惑星'},
    {id:'particle',name:'PARTICLE MODE · 渦巻き集合'},
    {id:'galaxy',name:'GALAXY MODE · 巨大銀河'},
    {id:'quality',name:'3D描画品質'},
  ] as const;
  for(const {id,name} of groups){
    const choice=nav.getByRole('checkbox',{name:name+'の詳細設定を開く'});
    await choice.check();
    await expect(back).toBeFocused();
    const section=page.locator(`.three-shape-controls > [data-fine-item="${id}"]`);
    await expect(section).toBeVisible();
    for(const other of groups.filter(other=>other.id!==id)){
      await expect(page.locator(`.three-shape-controls > [data-fine-item="${other.id}"]`)).toBeHidden();
    }
    if(id==='spacing'){
      await page.locator('#three-spacing').fill('135');
      await expect(page.locator('#three-spacing')).toHaveValue('135');
    }
    if(id==='quality'){
      await page.getByLabel('3D描画品質',{exact:true}).selectOption('low');
    }
    await back.click();
    await expect(nav).toBeVisible();
    await expect(choice).not.toBeChecked();
    await expect(choice).toBeFocused();
  }
  await nav.getByRole('checkbox',{name:'図形の間隔の詳細設定を開く'}).check();
  await expect(page.locator('#three-spacing')).toHaveValue('135');
  await back.click();
  await nav.getByRole('checkbox',{name:'3D描画品質の詳細設定を開く'}).check();
  await expect(page.getByLabel('3D描画品質',{exact:true})).toHaveValue('low');
});

test('fine inspector is usable on a mobile viewport and responds to Escape',async({page})=>{
  await page.setViewportSize({width:390,height:720});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  const choice=page.getByRole('checkbox',{name:'星や惑星の詳細設定を開く'});
  await expect(choice).toBeVisible();
  await choice.check();
  await expect(page.getByRole('checkbox',{name:'3D天体を表示'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(choice).toBeFocused();
  await expect(page.getByRole('navigation',{name:'3D図形の細かい設定'})).toBeVisible();
});


test('fine preview keeps main categories as seven tabs and reserves checkboxes for small items',async({page})=>{
  await page.goto('./?fine-preview=1');
  const tabs=page.getByRole('navigation',{name:'設定カテゴリー'});
  await expect(tabs.getByRole('button')).toHaveCount(7);
  await expect(tabs.getByRole('checkbox')).toHaveCount(0);
  await expect(tabs.getByRole('button',{name:'図形',exact:true})).toHaveAttribute('aria-pressed','true');
  await tabs.getByRole('button',{name:'背景',exact:true}).click();
  await expect(page.locator('#panel-background')).toBeVisible();
  await expect(tabs.getByRole('button',{name:'背景',exact:true})).toHaveAttribute('aria-pressed','true');
  await tabs.getByRole('button',{name:'図形',exact:true}).click();
  await expect(page.locator('#panel-shapes')).toBeVisible();
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  await expect(page.getByRole('navigation',{name:'3D図形の細かい設定'}).getByRole('checkbox')).toHaveCount(6);
});
