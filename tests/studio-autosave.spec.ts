import {openSettingsCategory} from './settings-test-helper';
import {test,expect} from '@playwright/test';
import {STUDIO_AUTOSAVE_KEY} from '../src/studio-autosave';

test('2D scene, colors, text and selected settings survive refreshing the page',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await openSettingsCategory(page,'図形');
  const original=await page.getByLabel('シード値',{exact:true}).inputValue();
  expect(original).toMatch(/^[0-9a-f]{24}$/);
  await page.getByLabel('シード値',{exact:true}).fill('remember-my-2d-scene');
  await page.getByLabel('キャンバスの比率').selectOption('9:16');
  await page.getByLabel('図形密度').fill('80');
  await openSettingsCategory(page,'背景');
  await page.getByRole('button',{name:'単色',exact:true}).click();
  await openSettingsCategory(page,'文字');
  await page.getByLabel('文字を表示').check();
  await page.getByLabel('表示する文字').fill('続きから編集');
  await expect.poll(async()=>page.evaluate(key=>{
    try{return JSON.parse(localStorage.getItem(key)??'null')?.twoD?.textOverlay?.text??null;}
    catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toBe('続きから編集');
  await page.reload();
  await openSettingsCategory(page,'図形');
  await expect(page.getByRole('button',{name:'2Dモード',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('remember-my-2d-scene');
  await expect(page.getByLabel('キャンバスの比率')).toHaveValue('9:16');
  await expect(page.getByLabel('図形密度')).toHaveValue('80');
  await openSettingsCategory(page,'文字');
  await expect(page.locator('.settings-detail-current')).toHaveText('文字');
  await expect(page.getByLabel('表示する文字')).toHaveValue('続きから編集');
  await openSettingsCategory(page,'背景');
  await expect(page.getByRole('button',{name:'単色',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('autosave-status')).toContainText('自動保存');
  expect(errors).toEqual([]);
});

test('3D mode and detailed motherboard settings survive a refresh and 2D settings remain available',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await openSettingsCategory(page,'図形');
  await page.getByLabel('シード値',{exact:true}).fill('save-both-modes');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await openSettingsCategory(page,'背景');
  await page.getByLabel('3D床グリッドを有効化').check();
  await page.getByLabel('床のデザイン').selectOption('circuit');
  await page.locator('#floor-circuit-chip-count').fill('16');
  await page.locator('#floor-circuit-core-scale').fill('1.5');
  await expect.poll(async()=>page.evaluate(key=>{
    try{return JSON.parse(localStorage.getItem(key)??'null')?.threeD?.settings?.floorGrid?.circuitChipCount??null;}
    catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toBe(16);
  await page.reload();
  await openSettingsCategory(page,'図形');
  await expect(page.getByRole('button',{name:'3Dモード',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('save-both-modes');
  await openSettingsCategory(page,'背景');
  await expect(page.locator('.settings-detail-current')).toHaveText('背景');
  await expect(page.getByLabel('3D床グリッドを有効化')).toBeChecked();
  await expect(page.getByLabel('床のデザイン')).toHaveValue('circuit');
  await expect(page.locator('#floor-circuit-chip-count')).toHaveValue('16');
  await expect(page.locator('#floor-circuit-core-scale')).toHaveValue('1.5');
  await page.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue('save-both-modes');
  expect(errors).toEqual([]);
});

test('corrupt or unsupported local drafts are ignored rather than crashing startup',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(key=>localStorage.setItem(key,'{"schemaVersion":999,"mode":"3d"}'),STUDIO_AUTOSAVE_KEY);
  await page.goto('./');
  await openSettingsCategory(page,'図形');
  await expect(page.getByRole('button',{name:'2Dモード',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('シード値',{exact:true})).toHaveValue(/^[0-9a-f]{24}$/);
  await expect.poll(async()=>page.evaluate(key=>{
    try{return JSON.parse(localStorage.getItem(key)??'null')?.schemaVersion??null;}catch{return null;}
  },STUDIO_AUTOSAVE_KEY)).toBe(1);
  expect(errors).toEqual([]);
});

test('selected 2D motion preset survives local autosave and reload',async({page})=>{
 await page.goto('./');
  await openSettingsCategory(page,'図形');
 await openSettingsCategory(page,'アニメーション');
 const control=page.getByLabel('アニメーションプリセット');
 await expect(control).toHaveValue('standard');
 await control.selectOption('dynamic');
 await expect.poll(async()=>page.evaluate(()=>{
   try{return JSON.parse(localStorage.getItem('geometry-maker-studio-autosave-v1')??'null')?.twoD?.motionPreset??null;}
   catch{return null;}
 })).toBe('dynamic');
 await page.reload();
  await openSettingsCategory(page,'図形');
 await openSettingsCategory(page,'アニメーション');
 await expect(page.getByLabel('アニメーションプリセット')).toHaveValue('dynamic');
});
