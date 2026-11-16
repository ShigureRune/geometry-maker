import {seededRandom} from '../../scene';
import {galaxyAppearance,type GalaxyData,type GalaxySettings} from '../galaxy';

/** Actual 3D gas clouds. Each point is a camera-facing soft cloudlet at
 * a 3D position: there is no fullscreen/galaxy-sized XY plane or UV disk.
 * Gas is seeded directly from the matching stellar distribution, so gas and
 * stars share both the arm positions and the orbital angular velocities. */
export type GalaxyGasData={
  count:number;
  positions:Float32Array;
  colors:Float32Array;
  sizes:Float32Array;
  opacities:Float32Array;
  spins:Float32Array;
  phases:Float32Array;
  orbitCenters:Float32Array;
};

const gaussian=(random:()=>number)=>
  random()+random()+random()+random()-2;
function span(random:()=>number,start:number,end:number):number{
  return start+Math.floor(random()*Math.max(1,end-start));
}
function pickStar(random:()=>number,stars:GalaxyData,options:GalaxySettings):number{
  const n=stars.count,t=random(),type=options.galaxyType;
  if(type==='grand_design'||type==='barred_spiral'){
    const bulgeEnd=Math.floor(n*.105);
    const diskEnd=bulgeEnd+Math.floor(n*.305);
    const knotEnd=diskEnd+Math.floor(n*.12);
    const cloudStart=n-Math.floor(n*(.025+options.dust/60*.055));
    // Weighted toward the SAME well-defined arms/knots as the real stars.
    if(t<.65)return span(random,knotEnd,cloudStart);
    if(t<.91)return span(random,diskEnd,knotEnd);
    if(t<.96)return span(random,cloudStart,n);
    return span(random,0,bulgeEnd);
  }
  if(type==='ring')
    return t<.93?span(random,Math.floor(n*.19),n):span(random,0,Math.floor(n*.075));
  if(type==='flocculent')
    return t<.92?span(random,Math.floor(n*.32),n):span(random,0,Math.floor(n*.10));
  if(type==='interacting'){
    if(t<.18)return span(random,Math.floor(n*.90),n);
    if(t<.65)return span(random,0,Math.floor(n*.68));
    return span(random,Math.floor(n*.68),Math.floor(n*.90));
  }
  return span(random,0,n);
}
export function generateGalaxyGas(
  seed:string,options:GalaxySettings,low:boolean,stars:GalaxyData,
):GalaxyGasData{
  const r=seededRandom('galaxy-gas-volumetric-v1:'+seed+':'+options.galaxyType);
  // 3D transparency costs more than point stars. Cap separately for mobile.
  const target=Math.floor(stars.count*(low?.34:.17));
  const count=Math.max(340,Math.min(low?1600:4200,target));
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count),opacities=new Float32Array(count);
  const spins=new Float32Array(count),phases=new Float32Array(count);
  const orbitCenters=new Float32Array(count*2);
  const type=options.galaxyType;
  const R=options.radius;
  const palette=galaxyAppearance(seed,options.palette).colors;
  const thickness=type==='elliptical'?.19:
    type==='irregular'?.12:type==='interacting'?.085:.090;
  const spread=type==='elliptical'?.08:type==='irregular'?.056:
    type==='flocculent'?.038:type==='ring'?.024:.029;
  let anchor=0,remaining=0,cloudGroup=0;
  for(let i=0;i<count;i++){
    if(remaining<=0){
      anchor=pickStar(r,stars,options);
      remaining=3+Math.floor(r()*10);
      cloudGroup=r();
    }
    remaining--;
    const source=anchor*3,pos=i*3,center=i*2;
    const isCore=stars.cores[anchor]>.16;
    const isElliptical=type==='elliptical';
    const isPink=!isElliptical&&!isCore&&(r()<(.10+options.clumpiness*.13));
    const base=isCore?palette.bulge:isElliptical?palette.disk:
      isPink?palette.hii:r()<.66?palette.young:palette.cloud;
    const falloff=.65+r()*.35;
    colors[pos]=base[0]*falloff;
    colors[pos+1]=base[1]*falloff;
    colors[pos+2]=base[2]*falloff;
    const jitter=R*spread*(.55+r()*.9);
    positions[pos]=stars.positions[source]+gaussian(r)*jitter;
    positions[pos+1]=stars.positions[source+1]+gaussian(r)*jitter;
    // Real 3D distribution. Inclining the galaxy reveals distinct cloud
    // heights and parallax, instead of a flat sheet seen edge-on.
    positions[pos+2]=stars.positions[source+2]+gaussian(r)*R*thickness;
    orbitCenters[center]=stars.orbitCenters?.[anchor*2]??0;
    orbitCenters[center+1]=stars.orbitCenters?.[anchor*2+1]??0;
    spins[i]=stars.spins[anchor];
    phases[i]=r()*Math.PI*2;
    sizes[i]=(isElliptical?10:12)+(r()*16)+(cloudGroup*.6*8);
    const typeOpacity=isElliptical?.24:type==='irregular'?.70:.90;
    opacities[i]=(.12+r()*.26)*typeOpacity*
      (isCore?.60:1)*
      (1-options.dust/145)*(.78+cloudGroup*.44);
  }
  return {count,positions,colors,sizes,opacities,spins,phases,orbitCenters};
}
