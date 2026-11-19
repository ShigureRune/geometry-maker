import type {GalaxySettings} from './galaxy';
import type {GalaxyType} from './galaxy';

export const GALAXY_PRESETS={
  m51:{label:'M51風・2本腕',type:'grand_design',overrides:{
    arms:2,twist:1.5,armWidth:1.35,dust:40,coreGlow:85,palette:'blue',inclination:17}},
  ngc1300:{label:'NGC 1300風・棒渦巻',type:'barred_spiral',overrides:{
    arms:2,twist:1.1,armWidth:1.1,dust:32,barred:true,coreGlow:80,inclination:15}},
  milkyway:{label:'天の川風・棒渦巻',type:'barred_spiral',overrides:{
    arms:4,twist:1.65,armWidth:1.45,dust:44,barred:true,coreGlow:62,inclination:20}},
  clouds:{label:'雲状の小腕・フロキュレント',type:'flocculent',overrides:{
    arms:5,clumpiness:.85,branchiness:.82,armWidth:1.70,coreGlow:45}},
  ring:{label:'リング銀河風',type:'ring',overrides:{
    ringRadius:.65,ringWidth:.085,dust:22,coreGlow:40,inclination:14}},
  elliptical:{label:'古い黄色の楕円銀河',type:'elliptical',overrides:{
    ellipticity:.53,coreGlow:95,palette:'gold',dust:0,inclination:12}},
  irregular:{label:'不規則な星形成銀河',type:'irregular',overrides:{
    irregularity:.87,coreGlow:25,dust:18,palette:'rose'}},
  interaction:{label:'相互作用・潮汐の尾',type:'interacting',overrides:{
    companionDistance:1.08,companionSize:.45,tidalStrength:.9,coreGlow:75}},
  blueNight:{label:'青の深宇宙・シネマ',type:'grand_design',overrides:{
    arms:3,twist:2.1,armWidth:.95,dust:25,coreGlow:110,palette:'blue',
    radius:7.5,inclination:32,rotationSpeed:.4}},
  roseBloom:{label:'ローズ星雲・光る星団',type:'flocculent',overrides:{
    arms:6,clumpiness:.92,branchiness:.9,armWidth:1.9,dust:18,
    coreGlow:60,palette:'rose',radius:6.5,inclination:18}},
  goldenRing:{label:'黄金リング・幻想宇宙',type:'ring',overrides:{
    ringRadius:.72,ringWidth:.07,dust:8,coreGlow:120,
    palette:'gold',radius:7,inclination:34}},
} as const satisfies Record<string,{label:string;type:GalaxyType;overrides:Partial<GalaxySettings>}>;
export type GalaxyPreset=keyof typeof GALAXY_PRESETS;
export function galaxyWithPreset(settings:GalaxySettings,key:GalaxyPreset):GalaxySettings{
  const preset=GALAXY_PRESETS[key];
  return {...settings,...preset.overrides,galaxyType:preset.type,
    barred:preset.type==='barred_spiral',enabled:true};
}
