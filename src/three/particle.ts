import {seededRandom} from '../scene';
import {booleanField, numberField, record} from './style-settings';

/** Particle mode is an alternate view of the existing 13 seeded 3D solids. */
export type ParticleSettings = {
  enabled:boolean; count:number; duration:number; swirl:number;
  spread:number; height:number; jitter:boolean;
  seedTransition:boolean; seedDuration:number;
};
export const particleDefaults:ParticleSettings = {
  enabled:false, count:4000, duration:3.2, swirl:1,
  spread:1.4, height:1.2, jitter:true,
  seedTransition:true, seedDuration:3.2,
};
export function validateParticleSettings(value:unknown):ParticleSettings {
  const d={...particleDefaults,...record(value)};
  return {
    enabled:booleanField(d.enabled,'粒子モード'),
    count:numberField(d.count,250,12000,'粒子数',true),
    duration:numberField(d.duration,.5,15,'粒子集合時間'),
    swirl:numberField(d.swirl,0,3,'渦の強さ'),
    spread:numberField(d.spread,.5,3,'粒子の広がり'),
    height:numberField(d.height,.5,3,'粒子の高さ'),
    jitter:booleanField(d.jitter,'粒子の揺らぎ'),
    seedTransition:booleanField(d.seedTransition,'シード切り替え演出'),
    seedDuration:numberField(d.seedDuration,.5,15,'シード切り替え時間'),
  };
}
/** Stable per seed: never use Math.random() during generation or playback. */
export function particleSwirlDirection(seed:string):-1|1 {
  return seededRandom('particle-v1:'+seed+':swirl')()<.5?-1:1;
}
/** Seekable ease-out. At and after duration all particles are on the surface. */
/** Smooth endpoints for seed-to-seed morph; the spiral bulges only in the middle. */
export function particleSeedEnvelope(progress:number):{mix:number;burst:number} {
  const t=Math.min(1,Math.max(0,progress));
  return {mix:t*t*(3-2*t),burst:t===0||t===1?0:Math.sin(Math.PI*t)};
}
export function particleEase(progress:number):number {
  const t=Math.min(1,Math.max(0,progress));
  return 1-(1-t)*(1-t)*(1-t);
}
