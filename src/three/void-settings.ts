import {networkDefaults,neonDefaults,record,numberField,validateNetwork,validateNeon,type NetworkSettings,type NeonSettings} from './style-settings';
import type {ThreeSettings} from './settings';
import {entranceDefaults} from './entrance';
import {VOID_PARTICLE_DEFAULT,VOID_PARTICLE_HIGH_LIMIT,VOID_PARTICLE_NODE_SHARE_DEFAULT} from './void-particle';

export const VOID_ALGORITHM_VERSION='void-filaments-v1';
export const VOID_WEB_VERSION='void-web-v2';
export const VOID_WEB_LIMIT=1400,VOID_WEB_MAX=2800,VOID_MOBILE_LIMIT=640;
export type VoidVersion=typeof VOID_ALGORITHM_VERSION|typeof VOID_WEB_VERSION;
export type VoidSettings={enabled:boolean;version:VoidVersion;objectLimit?:number;depthFade?:number;particleCount?:number;nodeShare?:number;network:NetworkSettings;neon:NeonSettings};
export const voidDefaults:VoidSettings={enabled:false,version:VOID_ALGORITHM_VERSION,
  network:{...networkDefaults,enabled:true,mode:'neural',animation:'signal',contrast:true},
  neon:{...neonDefaults,enabled:true,display:'surface',glow:110,contrast:true}};
/** New sessions opt into the web; v1 JSON retains the exact prototype. */
export const voidWebDefaults:VoidSettings={...voidDefaults,version:VOID_WEB_VERSION,objectLimit:VOID_WEB_LIMIT,depthFade:80,particleCount:VOID_PARTICLE_DEFAULT,nodeShare:VOID_PARTICLE_NODE_SHARE_DEFAULT,
  neon:{...voidDefaults.neon,display:'transparent',glow:85,width:.8,faceOpacity:.16}};
export function validateVoidSettings(value:unknown):VoidSettings{
  const source=record(value),d={...(source.version===VOID_WEB_VERSION?voidWebDefaults:voidDefaults),...source};
  if(typeof d.enabled!=='boolean'||![VOID_ALGORITHM_VERSION,VOID_WEB_VERSION].includes(d.version as VoidVersion))throw new Error('VOIDの設定／版が不正です。');
  const network=validateNetwork(d.network);
  if(network.mode!=='neural')throw new Error('VOIDの配線はフィラメント固定です。');
  return {enabled:d.enabled,version:d.version as VoidVersion,network,neon:validateNeon(d.neon),
    ...(d.version===VOID_WEB_VERSION?{objectLimit:numberField(d.objectLimit??VOID_WEB_LIMIT,600,VOID_WEB_MAX,'VOID描画上限',true),depthFade:numberField(d.depthFade??80,0,100,'VOID奥行きの減衰'),
      particleCount:numberField(d.particleCount??VOID_PARTICLE_DEFAULT,500,VOID_PARTICLE_HIGH_LIMIT,'VOID粒子数',true),
      nodeShare:numberField(d.nodeShare??VOID_PARTICLE_NODE_SHARE_DEFAULT,50,100,'図形への粒子配分',true)}:{})};
}
/** Never mutate the saved ordinary-3D styles. Slow drift protects the cavities. */
export function voidRenderSettings(settings:ThreeSettings):ThreeSettings{
  if(!settings.voidMode?.enabled)return settings;
  return {...settings,floatAmount:settings.floatAmount*.18,
    entrance:{...(settings.entrance??entranceDefaults),mode:'neural-grow'},
    network:{...settings.voidMode.network,mode:'neural'},neon:settings.voidMode.neon};
}
