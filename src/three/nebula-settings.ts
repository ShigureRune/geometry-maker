import {booleanField,enumField,hexField,numberField,record} from './style-settings';

/** A single low-cost, camera-space gas layer that can coexist with all 3D modes. */
export const NEBULA_PRESET_IDS=[
  'violet_dream','deep_blue','pink_bloom','emerald_mist','golden_dust',
] as const;
export type NebulaPreset=typeof NEBULA_PRESET_IDS[number]|'custom';
export type NebulaSettings={
  enabled:boolean;preset:NebulaPreset;
  colorA:string;colorB:string;colorC:string;
  density:number;brightness:number;glow:number;opacity:number;
  scale:number;noise:number;swirl:number;thickness:number;
  animation:boolean;driftSpeed:number;
};
export const nebulaDefaults:NebulaSettings={
  enabled:false,preset:'violet_dream',
  colorA:'#7b5cff',colorB:'#46c7ff',colorC:'#ff66cc',
  density:55,brightness:110,glow:95,opacity:48,
  scale:1.4,noise:55,swirl:40,thickness:50,
  animation:true,driftSpeed:.35,
};
type NebulaLook={label:string;detail:string;values:Pick<NebulaSettings,
  'colorA'|'colorB'|'colorC'|'density'|'brightness'|'glow'|'opacity'|
  'scale'|'noise'|'swirl'|'thickness'|'driftSpeed'>};
export const NEBULA_PRESETS={
  violet_dream:{label:'紫の幻想星雲',detail:'紫と青の柔らかいガス雲',values:{
    colorA:'#7b5cff',colorB:'#46c7ff',colorC:'#ff66cc',
    density:55,brightness:110,glow:95,opacity:48,scale:1.4,noise:55,swirl:40,thickness:50,driftSpeed:.35,
  }},
  deep_blue:{label:'青い深宇宙',detail:'青白い星間ガスと奥行き',values:{
    colorA:'#183a8a',colorB:'#29b6ff',colorC:'#89d7ff',
    density:45,brightness:90,glow:70,opacity:40,scale:1.8,noise:65,swirl:25,thickness:65,driftSpeed:.20,
  }},
  pink_bloom:{label:'ピンク星雲',detail:'鮮やかなピンクの星形成領域',values:{
    colorA:'#ff5ecf',colorB:'#b04dff',colorC:'#ffd2f4',
    density:65,brightness:135,glow:115,opacity:52,scale:1.25,noise:45,swirl:52,thickness:55,driftSpeed:.42,
  }},
  emerald_mist:{label:'エメラルド霧',detail:'緑とシアンのSF風星雲',values:{
    colorA:'#22d3a6',colorB:'#34c3ff',colorC:'#b2fff1',
    density:50,brightness:110,glow:85,opacity:43,scale:1.6,noise:62,swirl:35,thickness:60,driftSpeed:.30,
  }},
  golden_dust:{label:'黄金の宇宙塵',detail:'温かい金色の雲と光の筋',values:{
    colorA:'#ffb347',colorB:'#ffd86b',colorC:'#fff2c7',
    density:52,brightness:120,glow:105,opacity:46,scale:1.5,noise:70,swirl:28,thickness:48,driftSpeed:.26,
  }},
} as const satisfies Record<typeof NEBULA_PRESET_IDS[number],NebulaLook>;
export function nebulaWithPreset(current:NebulaSettings,key:typeof NEBULA_PRESET_IDS[number]):NebulaSettings{
  return {...current,...NEBULA_PRESETS[key].values,enabled:true,preset:key};
}
export function validateNebulaSettings(value:unknown):NebulaSettings{
  const d={...nebulaDefaults,...record(value)};
  return {
    enabled:booleanField(d.enabled,'星雲モード'),
    preset:enumField(d.preset,[...NEBULA_PRESET_IDS,'custom'],'星雲プリセット'),
    colorA:hexField(d.colorA),colorB:hexField(d.colorB),colorC:hexField(d.colorC),
    density:numberField(d.density,0,100,'星雲の濃さ'),
    brightness:numberField(d.brightness,0,200,'星雲の明るさ'),
    glow:numberField(d.glow,0,200,'星雲の発光'),
    opacity:numberField(d.opacity,0,100,'星雲の透明度'),
    scale:numberField(d.scale,.2,5,'星雲の広がり'),
    noise:numberField(d.noise,0,100,'星雲のノイズ'),
    swirl:numberField(d.swirl,0,100,'星雲の渦'),
    thickness:numberField(d.thickness,0,100,'星雲の層の厚さ'),
    animation:booleanField(d.animation,'星雲のアニメーション'),
    driftSpeed:numberField(d.driftSpeed,0,5,'星雲の流れる速さ'),
  };
}
