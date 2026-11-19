import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
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
  const particleChoice=nav.getByRole('button',{name:'PARTICLE MODE · 渦巻き集合の詳細設定を開く'});
  const galaxyChoice=nav.getByRole('button',{name:'GALAXY MODE · 巨大銀河の詳細設定を開く'});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button')).toHaveCount(6);
  await expect(particleChoice).toHaveAttribute('aria-expanded','false');
  await expect(galaxyChoice).toHaveAttribute('aria-expanded','false');
  await expect(particleDetail).toBeHidden();
  await expect(galaxyDetail).toBeHidden();

  await particleChoice.click();
  const back=page.getByRole('button',{name:'細かい設定一覧へ'});
  await expect(back).toBeFocused();
  await expect(particleDetail).toBeVisible();
  await expect(galaxyDetail).toBeHidden();
  await page.getByRole('checkbox',{name:'PARTICLE MODEを有効化'}).check();
  await expect(page.getByTestId('three-preview')).toHaveAttribute('data-particle-mode','on');
  await back.click();
  await expect(nav).toBeVisible();
  await expect(particleChoice).toBeFocused();
  await expect(particleChoice).toHaveAttribute('aria-expanded','false');
  await expect(nav).toContainText('現在ON');

  await galaxyChoice.click();
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
  await page.goto('./?legacy-ui=1');
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
    const choice=nav.getByRole('button',{name:name+'の詳細設定を開く'});
    await choice.click();
    await expect(back).toBeFocused();
    const section=page.locator(`#three-shapes-fullscreen-detail .fine-shape-detail-fields > [data-fine-item="${id}"]`);
    await expect(section).toBeVisible();
    for(const other of groups.filter(other=>other.id!==id)){
      await expect(page.locator(`#three-shapes-fullscreen-detail .fine-shape-detail-fields > [data-fine-item="${other.id}"]`)).toBeHidden();
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
    await expect(choice).toHaveAttribute('aria-expanded','false');
    await expect(choice).toBeFocused();
  }
  await nav.getByRole('button',{name:'図形の間隔の詳細設定を開く'}).click();
  await expect(page.locator('#three-spacing')).toHaveValue('135');
  await back.click();
  await nav.getByRole('button',{name:'3D描画品質の詳細設定を開く'}).click();
  await expect(page.getByLabel('3D描画品質',{exact:true})).toHaveValue('low');
});

test('fine inspector is usable on a mobile viewport and responds to Escape',async({page})=>{
  await page.setViewportSize({width:390,height:720});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  const choice=page.getByRole('button',{name:'星や惑星の詳細設定を開く'});
  await expect(choice).toBeVisible();
  await choice.click();
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
  await expect(page.getByRole('navigation',{name:'3D図形の細かい設定'}).getByRole('button')).toHaveCount(6);
});


test('3D background fine inspector drills into its four sections and retains settings',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'背景');
  const nav=page.locator('#fine-sections-background').getByRole('navigation',{name:'細かい設定項目一覧'});
  const groups=[
    ['base','背景の種類'],['void','VOID MODE'],['sky','空と景色'],['floor','床の模様']
  ] as const;
  await expect(nav.getByRole('button')).toHaveCount(groups.length);
  const back=page.locator('#fine-sections-background-detail').getByRole('button',{name:'細かい設定一覧へ'});
  for(const [id,name] of groups){
    const choice=nav.getByRole('button',{name:name+'の詳細設定を開く'});
    await choice.click();
    await expect(back).toBeFocused();
    await expect(page.locator('#fine-background-panel-'+id)).toBeVisible();
    for(const [other] of groups.filter(([other])=>other!==id)){
      await expect(page.locator('#fine-background-panel-'+other)).toBeHidden();
    }
    if(id==='base'){
      await page.getByRole('button',{name:'グラデーション',exact:true}).click();
      await expect(page.getByRole('button',{name:'グラデーション',exact:true})).toHaveAttribute('aria-pressed','true');
    }
    await back.click();
    await expect(choice).toBeFocused();
  }
  await nav.getByRole('button',{name:'背景の種類の詳細設定を開く'}).click();
  await expect(page.getByRole('button',{name:'グラデーション',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('3D decoration and animation have independent fine lists without changing toggle states',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'装飾');
  const decoration=page.locator('#fine-sections-decoration');
  const decorList=decoration.getByRole('navigation',{name:'細かい設定項目一覧'});
  const decos=[['glow','発光と線の太さ'],['network','光る線とつながり'],['material','質感と光']] as const;
  await expect(decorList.getByRole('button')).toHaveCount(decos.length);
  for(const [id,name] of decos){
    const choice=decorList.getByRole('button',{name:name+'の詳細設定を開く'});
    await choice.click();
    await expect(page.locator('#fine-sections-decoration-detail').locator('[data-fine-panel="'+id+'"]')).toBeVisible();
    for(const [other] of decos.filter(([other])=>other!==id)){
      await expect(page.locator('#fine-sections-decoration-detail').locator('[data-fine-panel="'+other+'"]')).toBeHidden();
    }
    if(id==='glow'){
      await page.locator('#glow-intensity').fill('80');
      await expect(page.locator('#glow-intensity')).toHaveValue('80');
    }
    await page.locator('#fine-sections-decoration-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
    await expect(choice).toBeFocused();
  }
  await decorList.getByRole('button',{name:'発光と線の太さの詳細設定を開く'}).click();
  await expect(page.locator('#glow-intensity')).toHaveValue('80');
  await openSettingsCategory(page,'アニメーション');
  const animation=page.locator('#fine-sections-animation');
  const animList=animation.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(animList.getByRole('button')).toHaveCount(2);
  const motion=animList.getByRole('button',{name:'図形の動きの詳細設定を開く'});
  await motion.click();
  await expect(page.getByLabel('3Dアニメーションを有効化')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(motion).toBeFocused();
  await animList.getByRole('button',{name:'自動切り替えの詳細設定を開く'}).click();
  await expect(page.locator('#fine-sections-animation-detail').locator('[data-fine-panel="standby"]')).toBeVisible();
});

test('non-preview 3D background, decoration and animation retain existing direct controls',async({page})=>{
  await page.goto('./?legacy-ui=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'背景');
  await expect(page.getByRole('heading',{name:'VOID MODE · コズミックウェブ'})).toBeVisible();
  await expect(page.locator('.fine-sections')).toHaveCount(0);
  await openSettingsCategory(page,'装飾');
  await expect(page.locator('#glow-intensity')).toBeVisible();
  await expect(page.locator('.fine-sections')).toHaveCount(0);
  await openSettingsCategory(page,'アニメーション');
  await expect(page.getByLabel('3Dアニメーションを有効化')).toBeVisible();
  await expect(page.locator('.fine-sections')).toHaveCount(0);
});


test('2D shape details allow switching between seed, density and ratio without losing values',async({page})=>{
  await page.goto('./?fine-preview=1');
  await openSettingsCategory(page,'図形');
  const list=page.locator('#fine-sections-shapes').getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(list.getByRole('button')).toHaveCount(7);
  const seed=list.getByRole('button',{name:'シードと生成方式の詳細設定を開く'});
  await seed.click();
  await expect(page.getByLabel('シード値',{exact:true})).toBeVisible();
  await page.getByLabel('シード値',{exact:true}).fill('fine-2d-regression');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.locator('#fine-sections-shapes-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  const density=list.getByRole('button',{name:'図形密度の詳細設定を開く'});
  await density.click();
  await page.locator('#density').fill('65');
  await expect(page.locator('#density')).toHaveValue('65');
  await page.keyboard.press('Escape');
  await expect(density).toBeFocused();
  await list.getByRole('button',{name:'縦横比の詳細設定を開く'}).click();
  await expect(page.locator('#ratio')).toBeVisible();
  await page.locator('#fine-sections-shapes-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await seed.click();
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('fine-2d-regression');
  await expect(page.locator('#density')).toBeHidden();
});

test('2D background, colors, and decoration use small settings screens',async({page})=>{
  await page.goto('./?fine-preview=1');
  await openSettingsCategory(page,'背景');
  const background=page.locator('#fine-sections-background');
  const bg=background.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(bg.getByRole('button')).toHaveCount(2);
  await bg.getByRole('button',{name:'背景の種類の詳細設定を開く'}).click();
  await page.getByRole('button',{name:'グラデーション',exact:true}).click();
  await page.locator('#fine-sections-background-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await bg.getByRole('button',{name:'2Dグリッド背景の詳細設定を開く'}).click();
  await expect(page.getByRole('heading',{name:'2Dグリッド背景'})).toBeVisible();

  await openSettingsCategory(page,'カラー');
  const colors=page.locator('#fine-sections-colors');
  const palette=colors.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(palette.getByRole('button')).toHaveCount(3);
  await palette.getByRole('button',{name:'ビジュアルテーマの詳細設定を開く'}).click();
  await expect(page.locator('#visual-theme')).toBeVisible();
  await page.locator('#fine-sections-colors-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await palette.getByRole('button',{name:'背景と図形の配色の詳細設定を開く'}).click();
  await expect(page.locator('#color-mode')).toBeVisible();

  await openSettingsCategory(page,'装飾');
  const decor=page.locator('#fine-sections-decoration');
  const list=decor.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(list.getByRole('button')).toHaveCount(2);
  await list.getByRole('button',{name:'線の太さの詳細設定を開く'}).click();
  await page.locator('#line-width').fill('150');
  await page.locator('#fine-sections-decoration-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await list.getByRole('button',{name:'発光の強さの詳細設定を開く'}).click();
  await expect(page.locator('#glow-intensity')).toBeVisible();
});

test('2D text, animation and export preserve their original controls behind fine navigation',async({page})=>{
  await page.goto('./?fine-preview=1');
  await openSettingsCategory(page,'文字');
  const text=page.locator('#fine-sections-text');
  const tnav=text.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(tnav.getByRole('button')).toHaveCount(4);
  await tnav.getByRole('button',{name:'文字とフォントの詳細設定を開く'}).click();
  await page.locator('#overlay-text').fill('小項目テスト');
  await page.locator('#fine-sections-text-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await tnav.getByRole('button',{name:'位置と重なり順の詳細設定を開く'}).click();
  await expect(page.locator('#text-align')).toBeVisible();
  await page.locator('#fine-sections-text-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await tnav.getByRole('button',{name:'文字とフォントの詳細設定を開く'}).click();
  await expect(page.locator('#overlay-text')).toHaveValue('小項目テスト');

  await openSettingsCategory(page,'アニメーション');
  const animation=page.locator('#fine-sections-animation-2d');
  const aList=animation.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(aList.getByRole('button')).toHaveCount(2);
  await aList.getByRole('button',{name:'成長アニメーションの詳細設定を開く'}).click();
  await expect(page.locator('#fine-sections-animation-2d-detail').locator('[data-fine-panel="growth"]')).toBeVisible();

  await openSettingsCategory(page,'書き出し');
  const exp=page.locator('#fine-sections-export');
  const eList=exp.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(eList.getByRole('button')).toHaveCount(2);
  await eList.getByRole('button',{name:'画像と設定ファイルの保存の詳細設定を開く'}).click();
  await expect(page.getByRole('button',{name:'PNGを書き出す'})).toBeVisible();
  await page.locator('#fine-sections-export-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await eList.getByRole('button',{name:'動画の書き出しの詳細設定を開く'}).click();
  await expect(page.locator('#fine-sections-export-detail').locator('[data-fine-panel="video"]')).toBeVisible();
});


test('3D export has separate PNG, video, and project settings inspectors',async({page})=>{
  await page.goto('./?fine-preview=1');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'書き出し');
  const root=page.locator('#fine-sections-export-3d');
  const nav=root.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(nav.getByRole('button')).toHaveCount(3);
  const image=nav.getByRole('button',{name:'3D画像の保存の詳細設定を開く'});
  await image.click();
  await expect(page.getByRole('button',{name:'3D PNGを書き出す'})).toBeVisible();
  await page.locator('#three-export-width').fill('1600');
  await page.locator('#fine-sections-export-3d-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await nav.getByRole('button',{name:'3D設定の保存・復元の詳細設定を開く'}).click();
  await expect(page.getByRole('button',{name:'3Dの設定を保存'})).toBeVisible();
  await page.locator('#fine-sections-export-3d-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await nav.getByRole('button',{name:'3D動画の保存の詳細設定を開く'}).click();
  await expect(page.locator('#fine-sections-export-3d-detail').locator('[data-fine-panel="video"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(image).toHaveAttribute('aria-expanded','false');
  await image.click();
  await expect(page.locator('#three-export-width')).toHaveValue('1600');
});


test('the public default URL opens fine settings while legacy view remains an explicit opt-in',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const categories=page.getByRole('navigation',{name:'設定カテゴリー'});
  await expect(categories.getByRole('button')).toHaveCount(7);
  await expect(categories.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('#fine-sections-shapes').getByRole('button')).toHaveCount(7);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/fine-default-2d-desktop.png',fullPage:true});
  const seedChoice=page.getByRole('button',{name:'シードと生成方式の詳細設定を開く'});
  await seedChoice.click();
  await page.getByLabel('シード値',{exact:true}).fill('new-default-ui-smoke');
  await page.getByLabel('シード値',{exact:true}).press('Enter');
  await page.locator('#fine-sections-shapes-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await expect(seedChoice).toBeFocused();
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'図形');
  const fine=page.getByRole('navigation',{name:'3D図形の細かい設定'});
  const common=page.locator('#fine-sections-shapes');
  await expect(fine.getByRole('button')).toHaveCount(6);
  await expect(common.getByRole('button')).toHaveCount(6);
  await expect(page.getByLabel('シード値',{exact:true})).toBeHidden();
  await common.getByRole('button',{name:'シードと生成方式の詳細設定を開く'}).click();
  await expect(page.getByLabel('シード値',{exact:true})).toBeVisible();
  await expect(page.locator('.studio-fullscreen-overview')).toHaveAttribute('aria-hidden','true');
  await page.locator('#fine-sections-shapes-detail').getByRole('button',{name:'細かい設定一覧へ'}).click();
  await expect(fine).toBeVisible();
  const particle=fine.getByRole('button',{name:'PARTICLE MODE · 渦巻き集合の詳細設定を開く'});
  await particle.click();
  await expect(page.locator('.studio-fullscreen-overview')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByTestId('particle-mode-controls')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(particle).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/fine-default-3d-mobile.png',fullPage:true});

  await page.goto('./?legacy-ui=1');
  const legacy=page.getByRole('navigation',{name:'設定カテゴリー'});
  await expect(legacy.getByRole('checkbox',{name:'図形の設定を開く'})).toBeVisible();
  await expect(legacy.getByRole('button')).toHaveCount(0);
});

test('fine navigation uses full-width sliding pages with no navigation checkboxes',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const fine=page.locator('#fine-sections-shapes');
  const list=fine.getByRole('navigation',{name:'細かい設定項目一覧'});
  await expect(list.getByRole('checkbox')).toHaveCount(0);
  const choice=list.getByRole('button',{name:'シードと生成方式の詳細設定を開く'});
  await choice.click();
  await expect(fine).toHaveClass(/is-detail/);
  const wholeScreen=page.locator('.studio-fullscreen-track');
  await expect(wholeScreen).toHaveClass(/is-detail/);
  await expect(page.locator('.studio-fullscreen-overview')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.studio-fullscreen-overview .studio-preview-panel')).toHaveCount(1);
  const distance=await wholeScreen.evaluate(element=>{
    const transform=getComputedStyle(element).transform;
    return transform==='none'?0:Number(new DOMMatrixReadOnly(transform).m41);
  });
  expect(distance).toBeLessThan(-300);
  await expect(page.getByLabel('シード値',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fine).not.toHaveClass(/is-detail/);
  await expect(choice).toBeFocused();
});

test('the entire desktop overview moves away, including header and live preview',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('./');
  const track=page.locator('.studio-fullscreen-track');
  const header=page.locator('.studio-fullscreen-overview .studio-topbar');
  const preview=page.locator('.studio-fullscreen-overview .studio-preview-panel');
  const canvas=page.getByTestId('preview');
  await expect(canvas).toBeVisible();
  const previewWidth=await preview.evaluate(node=>node.getBoundingClientRect().width);
  await page.getByRole('button',{name:'シードと生成方式の詳細設定を開く'}).click();
  await expect(track).toHaveClass(/is-detail/);
  await expect(page.locator('.studio-fullscreen-overview')).toHaveAttribute('aria-hidden','true');
  await expect.poll(async()=>header.evaluate(node=>node.getBoundingClientRect().right)).toBeLessThan(50);
  await expect.poll(async()=>preview.evaluate(node=>node.getBoundingClientRect().right)).toBeLessThan(50);
  await expect(page.getByLabel('シード値',{exact:true})).toBeVisible();
  await expect(preview).toHaveCount(1);
  await expect(preview.evaluate(node=>node.getBoundingClientRect().width)).resolves.toBe(previewWidth);
  await page.locator('#fine-sections-shapes-detail .fine-sections-back-button').click();
  await expect(track).not.toHaveClass(/is-detail/);
  await expect.poll(async()=>header.evaluate(node=>node.getBoundingClientRect().left)).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('.studio-fullscreen-overview')).toHaveAttribute('aria-hidden','false');
});

test('mobile fullscreen detail opens at top and restores overview scroll without stray fixed controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  const choice=page.getByRole('button',{name:'シードと生成方式の詳細設定を開く'});
  await choice.scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo({top:350,behavior:'instant'}));
  await choice.scrollIntoViewIfNeeded();
  const previousScroll=await page.evaluate(()=>window.scrollY);
  expect(previousScroll).toBeGreaterThan(100);

  await choice.click();
  const full=page.locator('.studio-fullscreen-track');
  await expect(full).toHaveClass(/is-detail/);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(page.getByRole('button',{name:'編集画面に戻る'})).toBeInViewport();
  await expect(page.getByLabel('シード値',{exact:true})).toBeInViewport();
  await expect(page.locator('.studio-mobile-dock')).toBeHidden();
  await expect(page.locator('.studio-back-to-top')).toBeHidden();
  // Capture the completed transition rather than an in-between animation frame.
  await expect.poll(()=>full.evaluate(node=>
    Math.round(new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)
  )).toBeLessThanOrEqual(-385);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/fine-default-2d-mobile-detail.png'});

  await page.getByRole('button',{name:'編集画面に戻る'}).click();
  await expect(full).not.toHaveClass(/is-detail/);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThanOrEqual(previousScroll-2);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThanOrEqual(previousScroll+2);
  await expect(choice).toBeVisible();
  await expect(page.locator('.studio-mobile-dock')).toBeVisible();
});
