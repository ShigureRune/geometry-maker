import {seededRandom} from '../../scene';
import type {GalaxyData,GalaxySettings} from '../galaxy';

/** Deterministic sub-stars around the *actual* generated stellar disk.
 * These are only revealed within the camera's near-field LOD range.
 * Positions and orbit pivots remain fixed while the viewer moves, so
 * zoom never creates a screen-space star pattern or random popping. */
export type GalaxyDetailData={
  count:number;positions:Float32Array;colors:Float32Array;
  sizes:Float32Array;opacities:Float32Array;highlights:Float32Array;
  spins:Float32Array;orbitCenters:Float32Array;
};
const gaussian=(random:()=>number)=>
  random()+random()+random()+random()-2;

export function generateGalaxyDetailStars(
  seed:string,options:GalaxySettings,low:boolean,stars:GalaxyData,
):GalaxyDetailData{
  // A separate LOD budget keeps saved star counts intact and respects mobile.
  const budget=low?16000:65000;
  const target=Math.min(budget,Math.max(low?4000:16000,
    Math.floor(stars.count*(low?4:6))));
  const eligible:number[]=[];
  const innerEligible:number[]=[],outerEligible:number[]=[];
  for(let i=0;i<stars.count;i++){
    if(stars.kinds[i]>.5)continue;
    const p=i*3,q=i*2;
    const cx=stars.orbitCenters?.[q]??0;
    const cy=stars.orbitCenters?.[q+1]??0;
    const radial=Math.hypot(stars.positions[p]-cx,stars.positions[p+1]-cy);
    // Keep the innermost light smooth, but allow genuine old stars on the
    // *shoulder* of the bulge rather than carving a dark 0.18R hole.
    const minRadius=options.galaxyType==='ring'?.12:
      options.galaxyType==='elliptical'?.075:.095;
    const scale=options.galaxyType==='interacting'&&cx>0
      ?Math.max(.35,options.companionSize):1;
    // The white/yellow center stays an *unresolved* volume. Only the
    // disk and outer bulge have additional individually resolved stars.
    if(radial<options.radius*minRadius*scale)continue;
    eligible.push(i);
    // Reserve a dedicated near-bulge population. Uniform random selection
    // from the whole spiral used to put most LOD stars far from the center.
    if(radial/(options.radius*scale)<.32)innerEligible.push(i);
    else outerEligible.push(i);
  }
  const count=eligible.length?target:0;
  const innerShare=(options.galaxyType==='grand_design'||
    options.galaxyType==='barred_spiral')?.34:.27;
  const positions=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const opacities=new Float32Array(count);
  const highlights=new Float32Array(count);
  const spins=new Float32Array(count);
  const orbitCenters=new Float32Array(count*2);
  const random=seededRandom('galaxy-nearby-stars-lod-v1:'+seed+':'+options.galaxyType);
  for(let i=0;i<count;i++){
    // Redistribute the same finite star budget: more fine, old stars near
    // the bulge without increasing overall exposure or mobile GPU cost.
    const pool=i<Math.floor(count*innerShare)&&innerEligible.length
      ?innerEligible:outerEligible.length?outerEligible:eligible;
    const source=pool[Math.floor(random()*pool.length)];
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
    // Most faint stars preserve the blue/pink/amber photographic colors;
    // a sparse bright subset supplies recognizable individual pinpoints.
    // Making all 95k detail stars bright was bleaching the spiral arms.
    const pivotX=stars.orbitCenters?.[srcPivot]??0;
    const pivotY=stars.orbitCenters?.[srcPivot+1]??0;
    const localRadius=Math.hypot(positions[dst]-pivotX,
      positions[dst+1]-pivotY)/(options.radius*scale);
    // Do not resolve the tiny central nucleus, but reveal individual stars
    // as soon as the camera moves out to its stellar shoulder.
    const ramp=Math.max(0,Math.min(1,(localRadius-.055)/.105));
    const innerFade=ramp*ramp*(3-2*ramp);
    const innerRim=localRadius<.32;
    const bright=random()<(innerRim?.12:.105);
    highlights[i]=bright?1:0;
    sizes[i]=bright?1.00+random()*.40:.63+random()*.39;
    // Inner stars are NUMEROUS rather than each being over-bright. Keep
    // sparse clear pinpoints within the warm glow without white-out.
    opacities[i]=(bright?.43+random()*.22:
      .12+random()*.16)*innerFade*(innerRim?.64:1);
    spins[i]=stars.spins[source];
    orbitCenters[dstPivot]=stars.orbitCenters?.[srcPivot]??0;
    orbitCenters[dstPivot+1]=stars.orbitCenters?.[srcPivot+1]??0;
  }
  return {count,positions,colors,sizes,opacities,highlights,spins,orbitCenters};
}
