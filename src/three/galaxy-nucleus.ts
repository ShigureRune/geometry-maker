import {seededRandom} from '../scene';
import type {GalaxyData,GalaxySettings} from './galaxy';

/** Tiny three-dimensional nuclear star concentrations, independent of the
 * diffuse gas. No flat disk or camera-facing full-galaxy plane is created. */
export type GalaxyNucleusData={
  count:number;positions:Float32Array;colors:Float32Array;
  sizes:Float32Array;opacities:Float32Array;spins:Float32Array;
  orbitCenters:Float32Array;
  /** World-space nucleus pivots: one per actual stellar bulge. */
  centers:readonly (readonly [number,number])[];
};

const gaussian=(random:()=>number)=>
  random()+random()+random()+random()-2;

export function generateGalaxyNucleus(
  seed:string,options:GalaxySettings,low:boolean,stars:GalaxyData,
):GalaxyNucleusData{
  const groups=new Map<string,{x:number;y:number;count:number;spin:number}>();
  for(let i=0;i<stars.count;i++){
    // Interacting galaxies have two real orbital pivots, even when their
    // sparse bulge stars report only a small .12 core factor. Group ALL
    // stellar orbits there, keeping the two main/companion nuclei separate.
    if(options.galaxyType!=='interacting'&&stars.cores[i]<=.105)continue;
    const x=stars.orbitCenters?.[i*2]??0;
    const y=stars.orbitCenters?.[i*2+1]??0;
    const key=x.toFixed(3)+','+y.toFixed(3);
    const group=groups.get(key);
    if(group){group.count++;group.spin+=stars.spins[i];}
    else groups.set(key,{x,y,count:1,spin:stars.spins[i]});
  }
  // Do not invent a bright nucleus if this seed/type does not have bulge stars.
  const pivots=[...groups.values()].filter(g=>g.count>8)
    .sort((a,b)=>b.count-a.count).slice(0,2);
  const perCore=low?240:520;
  const count=pivots.length*perCore;
  const positions=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const opacities=new Float32Array(count);
  const spins=new Float32Array(count);
  const orbitCenters=new Float32Array(count*2);
  const random=seededRandom('galaxy-nuclear-hotspot-v1:'+seed+':'+options.galaxyType);
  const strength=options.galaxyType==='ring'?.40:
    options.galaxyType==='irregular'?.34:
    options.galaxyType==='elliptical'?.72:1;
  // More high-quality background stars already fill out the bulge.
  // Reduce only the broad nuclear haze at high counts; retain a tiny
  // saturated white center, without washing out surrounding spiral arms.
  const bulgeDensityScale=low?1:
    Math.max(.60,Math.sqrt(12000/Math.max(12000,stars.count)));
  for(let k=0;k<pivots.length;k++){
    const pivot=pivots[k];
    for(let j=0;j<perCore;j++){
      const i=k*perCore+j,p=i*3,q=i*2;
      const pinpoint=j<Math.floor(perCore*.06);
      const hot=j<Math.floor(perCore*.66);
      // The fivefold-wide bulge needs resolved stars, NOT fivefold-larger
      // additive light sprites. Keep only a small central white-hot pinprick.
      // Both extended populations retain real Z depth and their own pivot.
      const spread=options.radius*(pinpoint?.014:hot?.130:.190);
      positions[p]=pivot.x+gaussian(random)*spread;
      positions[p+1]=pivot.y+gaussian(random)*spread;
      positions[p+2]=gaussian(random)*options.radius*(pinpoint?.012:hot?.065:.075);
      orbitCenters[q]=pivot.x;orbitCenters[q+1]=pivot.y;
      const variation=.83+random()*.34;
      // Compact nearly-white center, surrounded by warmer old stars.
      colors[p]=(pinpoint?1.45:hot?1.20:1.04)*variation;
      colors[p+1]=(pinpoint?1.32:hot?.94:.79)*variation;
      colors[p+2]=(pinpoint?1.08:hot?.72:.53)*variation;
      // The central luminosity now comes from the *continuous 3D bulge*.
      // These extra stars become faint details only outside its inner edge.
      sizes[i]=pinpoint?.5+random()*.4:
        hot?.65+random()*.8:.8+random()*1.0;
      const radius=Math.hypot(positions[p]-pivot.x,positions[p+1]-pivot.y)/options.radius;
      const angle=Math.atan2(positions[p+1]-pivot.y,positions[p]-pivot.x);
      // Subtle curved dust shadowing gives the central bulge some structure
      // without a flat image overlay. Avoid spiral lanes in ellipticals/rings.
      const hasDust=options.galaxyType!=='elliptical'&&options.galaxyType!=='ring';
      const lane=Math.cos(2*angle+7.5*Math.log(.034+radius)+
        .28*Math.sin(5*angle+31*radius));
      const dust=hasDust&&!pinpoint?Math.pow(Math.max(0,lane),10):0;
      const shadow=1-(hot?.60:.28)*dust;
      // No visible nuclear particles while zoomed into the smooth light:
      // stars fade in gradually across the outer edge of the warm bulge.
      const resolved=Math.max(0,Math.min(1,(radius-.11)/.11));
      const fade=resolved*resolved*(3-2*resolved);
      opacities[i]=(pinpoint?0:
        hot?.025+random()*.035:
        (.028+random()*.040)*bulgeDensityScale)*strength*shadow*fade;
      spins[i]=pivot.spin/pivot.count;
    }
  }
  return {count,positions,colors,sizes,opacities,spins,orbitCenters,
    centers:pivots.map(p=>[p.x,p.y] as const)};
}
