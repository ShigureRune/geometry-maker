import type {ThreeSettings} from './settings';
import {particleDefaults,type ParticleSettings} from './particle';
import {galaxyDefaults} from './galaxy';
import {
  voidWebDefaults,VOID_WEB_VERSION,type VoidSettings,
} from './void-settings';

/** Scene looks, not new project fields. Existing JSON and seed remain unchanged. */
export const VOID_PRESETS={
  soft:{
    label:'軽量・淡いウェブ',
    detail:'少なめの立体と控えめな発光',
    objectLimit:800,depthFade:45,
    network:{enabled:true,width:.8,glow:90,animation:'pulse'},
    neon:{enabled:true,display:'transparent',glow:80,faceOpacity:.12,width:.8},
  },
  depth:{
    label:'深宇宙・空洞を強調',
    detail:'遠くへ消える立体と暗い空洞',
    objectLimit:1800,depthFade:95,
    network:{enabled:true,width:.75,glow:120,animation:'signal'},
    neon:{enabled:true,display:'transparent',glow:115,faceOpacity:.06,width:.8},
  },
  neon:{
    label:'発光フィラメント',
    detail:'網目の輪郭をくっきり光らせる',
    objectLimit:2400,depthFade:65,
    network:{enabled:true,width:1.4,glow:180,animation:'signal'},
    neon:{enabled:true,display:'lines',glow:180,faceOpacity:.08,width:1.2},
  },
} as const satisfies Record<string,{
  label:string;detail:string;objectLimit:number;depthFade:number;
  network:Partial<VoidSettings['network']>;
  neon:Partial<VoidSettings['neon']>;
}>;
export type VoidPreset=keyof typeof VOID_PRESETS;

/** Presets always enter the supported large web; v1 JSON remains untouched
 * until a user explicitly applies one. Preserve unrelated custom styling. */
export function voidWithPreset(current:VoidSettings|undefined,key:VoidPreset):VoidSettings{
  const preset=VOID_PRESETS[key];
  return {
    ...voidWebDefaults,...current,
    enabled:true,version:VOID_WEB_VERSION,
    objectLimit:preset.objectLimit,depthFade:preset.depthFade,
    network:{...voidWebDefaults.network,...current?.network,...preset.network,mode:'neural'},
    neon:{...voidWebDefaults.neon,...current?.neon,...preset.neon},
  };
}

export const PARTICLE_PRESETS={
  stardust:{
    label:'ゆったり星くず',
    detail:'淡く漂ってから静かに集合',
    overrides:{count:1500,duration:5,swirl:.5,spread:1.3,height:1.2,
      jitter:false,seedTransition:true,seedDuration:5},
    webCount:20000,nodeShare:80,
  },
  vortex:{
    label:'大渦巻き',
    detail:'広い空間から勢いよく螺旋集合',
    overrides:{count:6000,duration:3.2,swirl:2.7,spread:2.4,height:1.7,
      jitter:true,seedTransition:true,seedDuration:3.2},
    webCount:80000,nodeShare:90,
  },
  burst:{
    label:'一気に集結',
    detail:'広がった粒子が短時間で集まる',
    overrides:{count:10000,duration:1.3,swirl:1.2,spread:3,height:2.5,
      jitter:true,seedTransition:true,seedDuration:1.3},
    webCount:180000,nodeShare:95,
  },
} as const satisfies Record<string,{
  label:string;detail:string;overrides:Partial<ParticleSettings>;
  webCount:number;nodeShare:number;
}>;
export type ParticlePreset=keyof typeof PARTICLE_PRESETS;

/** Preserve global scene settings and the old mode switching rule:
 * PARTICLE and GALAXY are exclusive, except for large-web + PARTICLE. */
export function particleWithPreset(settings:ThreeSettings,key:ParticlePreset):ThreeSettings{
  const preset=PARTICLE_PRESETS[key];
  const cosmicWeb=settings.voidMode?.enabled&&settings.voidMode.version===VOID_WEB_VERSION;
  return {
    ...settings,
    particle:{...(settings.particle??particleDefaults),...preset.overrides,enabled:true},
    galaxy:{...(settings.galaxy??galaxyDefaults),enabled:false},
    ...(cosmicWeb?{voidMode:{...settings.voidMode!,particleCount:preset.webCount,
      nodeShare:preset.nodeShare}}:{}),
  };
}
