import {seededRandom} from '../scene';

/** A seeded cloud of true world-space 3D positions, independent of the camera.
 * The shader draws each point as a soft gas wisp; orbiting the camera changes
 * which wisps overlap and how distant they appear.
 *
 * Low/high quality change only GPU work, not the existing seed or project JSON.
 */
export type NebulaVolumeData={
  count:number;
  positions:Float32Array;
  sizes:Float32Array;
  strengths:Float32Array;
  tints:Float32Array;
  phases:Float32Array;
  minDepth:number;maxDepth:number;
};

export const NEBULA_LOW_CLOUDLETS=1600;
export const NEBULA_HIGH_CLOUDLETS=4400;

const gaussian=(r:()=>number)=>
  r()+r()+r()+r()+r()+r()-3;

export function generateNebulaVolume(seed:string,low:boolean):NebulaVolumeData{
  const r=seededRandom('nebula-worldspace-3d-v2:'+seed);
  const count=low?NEBULA_LOW_CLOUDLETS:NEBULA_HIGH_CLOUDLETS;
  const positions=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const strengths=new Float32Array(count);
  const tints=new Float32Array(count);
  const phases=new Float32Array(count);
  // Three genuinely separate pockets with substantial thickness in Z.
  // All of them remain at fixed world coordinates while the camera moves.
  const pockets=[
    [-5.5,2.1,-8.0,4.7,3.0,5.2],
    [4.0,-1.6,-11.0,4.5,3.1,5.7],
    [0.5,3.0,-17.0,4.8,3.0,5.5],
  ] as const;
  let minDepth=Infinity,maxDepth=-Infinity;
  for(let i=0;i<count;i++){
    const pocket=pockets[Math.floor(r()*pockets.length)];
    const x=gaussian(r),y=gaussian(r),z=gaussian(r);
    // Locally correlated folds resemble curved clouds, not a random box.
    const worldX=pocket[0]+x*pocket[3]+Math.sin(z*1.9+y)*1.25;
    const worldY=pocket[1]+y*pocket[4]+Math.cos(x*1.35+z)*.95;
    const worldZ=pocket[2]+z*pocket[5]+Math.sin(x*1.7+y)*1.0;
    positions[i*3]=worldX;positions[i*3+1]=worldY;positions[i*3+2]=worldZ;
    minDepth=Math.min(minDepth,worldZ);maxDepth=Math.max(maxDepth,worldZ);
    sizes[i]=16+r()*18;
    strengths[i]=.5+r()*.65;
    tints[i]=Math.min(1,Math.max(0,(i%pockets.length)/2*.56+r()*.46));
    phases[i]=r()*Math.PI*2;
  }
  return {count,positions,sizes,strengths,tints,phases,minDepth,maxDepth};
}
