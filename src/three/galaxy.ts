import {seededRandom} from '../scene';
import {booleanField,enumField,numberField,record} from './style-settings';

export const GALAXY_PALETTES=['violet','blue','rose','gold'] as const;
export type GalaxyPalette=typeof GALAXY_PALETTES[number];
export type GalaxySettings={
  enabled:boolean;count:number;arms:number;twist:number;radius:number;
  coreGlow:number;dust:number;rotationSpeed:number;palette:GalaxyPalette;
  seedTransition:boolean;transitionSeconds:number;
};
export const galaxyDefaults:GalaxySettings={
  enabled:false,count:12000,arms:4,twist:2.1,radius:5.5,
  coreGlow:130,dust:20,rotationSpeed:.6,palette:'violet',
  seedTransition:true,transitionSeconds:3.5,
};
export const GALAXY_LOW_STAR_LIMIT=3600, GALAXY_HIGH_STAR_LIMIT=30000;
export function validateGalaxySettings(value:unknown):GalaxySettings{
  const d={...galaxyDefaults,...record(value)};
  return {
    enabled:booleanField(d.enabled,'銀河モード'),
    count:numberField(d.count,1000,GALAXY_HIGH_STAR_LIMIT,'星の数',true),
    arms:numberField(d.arms,2,8,'銀河腕',true),
    twist:numberField(d.twist,.4,4,'螺旋の巻き込み'),
    radius:numberField(d.radius,3,10,'銀河の広がり'),
    coreGlow:numberField(d.coreGlow,0,200,'中心核の明るさ'),
    dust:numberField(d.dust,0,60,'ダストの割合',true),
    rotationSpeed:numberField(d.rotationSpeed,0,2,'銀河の回転'),
    palette:enumField(d.palette,GALAXY_PALETTES,'銀河の配色'),
    seedTransition:booleanField(d.seedTransition,'銀河のシード切替演出'),
    transitionSeconds:numberField(d.transitionSeconds,.5,15,'銀河の切替時間'),
  };
}
export type GalaxyData={
  count:number;positions:Float32Array;colors:Float32Array;
  sizes:Float32Array;spins:Float32Array;phases:Float32Array;
  cores:Float32Array;
};
const PALETTE:Record<GalaxyPalette,readonly [string,string,string,string]>={
  violet:['#ffe8ba','#b6c7ff','#9d80ff','#f89bff'],
  blue:['#fef7df','#a8e9ff','#568bff','#a7bdff'],
  rose:['#fff2cc','#ffc1db','#ef7abc','#9c8dea'],
  gold:['#fff7dc','#ffe19b','#ffb773','#ffcdb5'],
};
function hexColor(value:string):[number,number,number]{
  return [1,3,5].map(k=>parseInt(value.slice(k,k+2),16)/255) as [number,number,number];
}
function tint(a:readonly number[],b:readonly number[],factor:number):[number,number,number]{
  const t=Math.max(0,Math.min(1,factor));
  return [a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t];
}
/** All seeded random choices are made exactly once on configuration changes.
 * Camera, render quality and animation time never alter retained star IDs. */
export function generateGalaxy(seed:string,options:GalaxySettings,low:boolean):GalaxyData{
  const count=Math.min(options.count,low?GALAXY_LOW_STAR_LIMIT:GALAXY_HIGH_STAR_LIMIT);
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count),spins=new Float32Array(count);
  const phases=new Float32Array(count),cores=new Float32Array(count);
  const rng=seededRandom('galaxy-v1:'+seed);
  const palette=PALETTE[options.palette].map(hexColor);
  const orientation=rng()*Math.PI*2;
  const handed=rng()<.5?-1:1;
  const armOffsets=Array.from({length:options.arms},()=> (rng()-.5)*.12);
  const coreCount=Math.floor(count*.19);
  const dustCount=Math.round(count*options.dust/100);
  const armEnd=count-dustCount;
  for(let i=0;i<count;i++){
    const core=i<coreCount,dust=i>=armEnd;
    const phase=rng()*Math.PI*2;
    const r=core?Math.pow(rng(),1.85)*options.radius*.28:
      dust?Math.sqrt(rng())*options.radius*1.13:
      (.07+.91*Math.sqrt(rng()))*options.radius;
    const norm=Math.min(1,r/options.radius);
    const armIndex=i%options.arms;
    const armPhase=orientation+(armIndex+armOffsets[armIndex])*(Math.PI*2/options.arms);
    const spiral=handed*options.twist*norm*Math.PI*1.45;
    const width=core?Math.PI*2:dust?Math.PI*2:(.09+norm*.20);
    const angle=(core||dust?phase:armPhase+spiral+(rng()-.5)*width);
    const spread=dust?(0.15+.22*rng()):(.028+.065*norm);
    const x=Math.cos(angle)*r+(rng()-.5)*spread;
    const y=Math.sin(angle)*r+(rng()-.5)*spread;
    const z=(rng()+rng()+rng()-1.5)*(core?.38:.12+norm*.20);
    const p=i*3;
    positions[p]=x;positions[p+1]=y;positions[p+2]=z;
    const bright=core?Math.pow(1-norm,2):0;
    const mix=core?tint(palette[0],palette[1],norm*1.4):
      dust?tint(palette[2],palette[3],rng()):
        tint(palette[1],palette[2],norm*.90);
    const color=tint(mix,palette[0],rng()*.18);
    const luminance=.62+rng()*.65;
    colors[p]=color[0]*luminance;colors[p+1]=color[1]*luminance;colors[p+2]=color[2]*luminance;
    cores[i]=bright;
    sizes[i]=(core?2.0:rng()<.025?2.4:.9)*(0.65+rng()*1.15)*(dust?.75:1);
    spins[i]=handed*(.035+.105/(.32+norm*1.3));
    phases[i]=phase;
  }
  return {count,positions,colors,sizes,spins,phases,cores};
}
export function galaxyMorphEasing(value:number):number{
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}
