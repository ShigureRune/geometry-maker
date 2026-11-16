import {seededRandom} from '../../scene';
import type {GalaxyData,GalaxySettings} from '../galaxy';

/** Deterministic sub-stars around the *actual* generated stellar disk.
 * These are only revealed within the camera's near-field LOD range.
 * Positions and orbit pivots remain fixed while the viewer moves, so
 * zoom never creates a screen-space star pattern or random popping. */
export type GalaxyDetailData={
  count:number;positions:Float32Array;colors:Float32Array;
  sizes:Float32Array;opacities:Float32Array;
  spins:Float32Array;orbitCenters:Float32Array;
};
const gaussian=(random:()=>number)=>
  random()+random()+random()+random()-2;

export function generateGalaxyDetailStars(
  seed:string,options:GalaxySettings,low:boolean,stars:GalaxyData,
):GalaxyDetailData{
  // A separate LOD budget keeps saved star counts intact and respects mobile.
  const budget=low?16000:95000;
  const target=Math.min(budget,Math.max(low?4000:16000,
    Math.floor(stars.count*(low?4:6))));
  const eligible:number[]=[];
  for(let i=0;i<stars.count;i++){
    if(stars.kinds[i]>.5||stars.cores[i]>.18)continue;
    const p=i*3,q=i*2;
    const cx=stars.orbitCenters?.[q]??0;
    const cy=stars.orbitCenters?.[q+1]??0;
    const radial=Math.hypot(stars.positions[p]-cx,stars.positions[p+1]-cy);
    const minRadius=options.galaxyType==='irregular'?.06:.18;
    const scale=options.galaxyType==='interacting'&&cx>0
      ?Math.max(.35,options.companionSize):1;
    // The white/yellow center stays an *unresolved* volume. Only the
    // disk and outer bulge have additional individually resolved stars.
    if(radial<options.radius*minRadius*scale)continue;
    eligible.push(i);
  }
  const count=eligible.length?target:0;
  const positions=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const opacities=new Float32Array(count);
  const spins=new Float32Array(count);
  const orbitCenters=new Float32Array(count*2);
  const random=seededRandom('galaxy-nearby-stars-lod-v1:'+seed+':'+options.galaxyType);
  for(let i=0;i<count;i++){
    const source=eligible[Math.floor(random()*eligible.length)];
    const src=source*3,dst=i*3,srcPivot=source*2,dstPivot=i*2;
    const scale=options.galaxyType==='interacting'&&
      (stars.orbitCenters?.[srcPivot]??0)>0
      ?Math.max(.35,options.companionSize):1;
    const spread=options.radius*scale*
      (options.galaxyType==='elliptical'?.009:.0045);
    const height=options.radius*scale*
      (options.galaxyType==='elliptical'?.008:.0025);
    positions[dst]=stars.positions[src]+gaussian(random)*spread;
    positions[dst+1]=stars.positions[src+1]+gaussian(random)*spread;
    positions[dst+2]=stars.positions[src+2]+gaussian(random)*height;
    // The near-field population inherits its parent's color, orbit,
    // angular velocity and actual 3D stellar layer.
    const luminosity=.65+random()*.60;
    colors[dst]=Math.min(1.45,stars.colors[src]*luminosity);
    colors[dst+1]=Math.min(1.45,stars.colors[src+1]*luminosity);
    colors[dst+2]=Math.min(1.45,stars.colors[src+2]*luminosity);
    // The former .65-1.20px, .24-.69 opacity stars became nearly invisible
    // inside dense gas when the camera got close. Keep them small, but give
    // each resolved star a readable luminous center during deep zoom.
    sizes[i]=.85+random()*.70;
    opacities[i]=.46+random()*.37;
    spins[i]=stars.spins[source];
    orbitCenters[dstPivot]=stars.orbitCenters?.[srcPivot]??0;
    orbitCenters[dstPivot+1]=stars.orbitCenters?.[srcPivot+1]??0;
  }
  return {count,positions,colors,sizes,opacities,spins,orbitCenters};
}
