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
  coreFactors:Float32Array; // per-cloud nuclear contribution, kept in 3D
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
  // Many small wisps blend into a continuous veil; fewer giant cloudlets
  // were visible as isolated cotton balls in both face-on and edge-on views.
  const target=Math.floor(stars.count*(low?.34:.23));
  const count=Math.max(340,Math.min(low?1600:4200,target));
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count),opacities=new Float32Array(count);
  const spins=new Float32Array(count),phases=new Float32Array(count);
  const orbitCenters=new Float32Array(count*2);
  const coreFactors=new Float32Array(count);
  const type=options.galaxyType;
  const R=options.radius;
  const palette=galaxyAppearance(seed,options.palette).colors;
  // Spiral dust/gas occupies a genuinely thin 3D midplane. The previous
  // 0.09R vertical scatter made a tall lumpy fog around a needle-thin disk.
  const thickness=type==='elliptical'?.15:
    type==='irregular'?.08:type==='interacting'?.043:.029;
  const spread=type==='elliptical'?.08:type==='irregular'?.056:
    type==='flocculent'?.038:type==='ring'?.024:.029;
  // The retired flat gas plane used to fill the galactic nucleus. With
  // genuinely 3D gas that fill must come from real cloudlets instead.
  // Prefer some of the ORIGINAL stellar nuclei so both galaxies in an
  // interacting pair retain their own cores and orbit pivots.
  const nucleusStars:number[]=[];
  for(let j=0;j<stars.count;j++){
    if(stars.cores[j]>.12)nucleusStars.push(j);
  }
  const coreShare=type==='ring'?.07:type==='irregular'?.08:
    type==='elliptical'?.16:type==='interacting'?.12:.085;
  for(let i=0;i<count;i++){
    // IMPORTANT: do not repeat the same anchor for 3–13 particles.
    // Grouped billboards were becoming disconnected grape-sized clumps
    // and making the center look like a bumpy glowing potato.
    // Independent arm stars produce a continuous three-dimensional haze.
    const anchor=nucleusStars.length&&r()<coreShare
      ?nucleusStars[Math.floor(r()*nucleusStars.length)]
      :pickStar(r,stars,options);
    const source=anchor*3,pos=i*3,center=i*2;
    const isCore=stars.cores[anchor]>.12;
    coreFactors[i]=isCore?Math.min(1,stars.cores[anchor]*1.35):0;
    const isElliptical=type==='elliptical';
    const isPink=!isElliptical&&!isCore&&(r()<(.025+options.clumpiness*.055));
    const base=isCore?palette.bulge:isElliptical?palette.disk:
      isPink?palette.hii:r()<.66?palette.young:palette.cloud;
    // Blend most cloudlets toward a single soft gaseous hue. Rare pink
    // HII knots remain, without speckling every other arm segment.
    const blend=(!isCore&&!isPink&&!isElliptical)?.36:0;
    const falloff=.61+r()*.29;
    colors[pos]=(base[0]*(1-blend)+palette.cloud[0]*blend)*falloff;
    colors[pos+1]=(base[1]*(1-blend)+palette.cloud[1]*blend)*falloff;
    colors[pos+2]=(base[2]*(1-blend)+palette.cloud[2]*blend)*falloff;
    const jitter=R*spread*(.55+r()*.65);
    positions[pos]=stars.positions[source]+gaussian(r)*jitter;
    positions[pos+1]=stars.positions[source+1]+gaussian(r)*jitter;
    // Real 3D distribution. Inclining the galaxy reveals distinct cloud
    // heights and parallax, instead of a flat sheet seen edge-on.
    positions[pos+2]=stars.positions[source+2]+gaussian(r)*R*
      (isCore&&type!=='elliptical'?Math.max(thickness,.042):thickness);
    orbitCenters[center]=stars.orbitCenters?.[anchor*2]??0;
    orbitCenters[center+1]=stars.orbitCenters?.[anchor*2+1]??0;
    spins[i]=stars.spins[anchor];
    phases[i]=r()*Math.PI*2;
    // A many-particle veil is more convincing than a few high-opacity
    // overlapping stamps. Core haze is smaller and smoother than the arms.
    sizes[i]=(isCore?5:isElliptical?9:8)+r()*(isCore?5:isElliptical?8:8);
    const typeOpacity=isElliptical?.52:type==='irregular'?.70:.95;
    opacities[i]=(.095+r()*.14)*typeOpacity*
      (isCore?.72:1)*
      (1-options.dust/145);
  }
  return {count,positions,colors,sizes,opacities,spins,phases,orbitCenters,coreFactors};
}
