import type {VoidParticleData} from './void-particle';

export type VoidSeedSnapshot={
  positions:Float32Array;colors:Float32Array;nodes:Float32Array;
};
export type VoidSeedMorph=VoidSeedSnapshot&{duration:number};
export type VoidPreviousFrame={
  time:number;duration:number;swirl:number;direction:number;jitter:boolean;
  morph:VoidSeedMorph|null;progress:number;
};
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
export const voidSeedMix=(progress:number)=>{
  const p=clamp01(progress);
  return p*p*(3-2*p);
};
export const voidSeedBurst=(progress:number)=>Math.sin(Math.PI*clamp01(progress));

/** Snapshot the *last rendered frame*, not just old targets.
 * Computed only when the seed changes (never per animation frame).
 * This preserves continuity across rapid reseeds, partial entrance reveals,
 * and a change in the actual GPU particle budget.
 * The equations intentionally mirror VoidParticleCloud's vertex shader.
 */
export function snapshotVoidSeedFrame(
  previous:VoidParticleData,nextCount:number,frame:VoidPreviousFrame,
):VoidSeedSnapshot{
  const positions=new Float32Array(nextCount*3);
  const colors=new Float32Array(nextCount*3);
  const nodes=new Float32Array(nextCount);
  if(!nextCount||!previous.count)return {positions,colors,nodes};
  const time=frame.time;
  const t=clamp01(time/Math.max(.001,frame.duration));
  const unformed=Math.pow(1-t,3);
  const oldMorph=frame.morph,p=clamp01(frame.progress);
  const blend=voidSeedMix(p),burst=voidSeedBurst(p);
  for(let i=0;i<nextCount;i++){
    const source=Math.min(previous.count-1,Math.floor(i*previous.count/nextCount));
    const k=source*3,into=i*3,phase=previous.phases[source];
    let x:number,y:number,z:number;
    if(oldMorph){
      const dx=previous.targets[k]-oldMorph.positions[k];
      const dy=previous.targets[k+1]-oldMorph.positions[k+1];
      const dz=previous.targets[k+2]-oldMorph.positions[k+2];
      const angle=phase+frame.direction*frame.swirl*Math.PI*4*p;
      const amount=burst*(.45+.05*Math.min(9,Math.hypot(dx,dy,dz)))*
        Math.max(.15,frame.swirl);
      x=oldMorph.positions[k]+dx*blend+Math.cos(angle)*amount;
      y=oldMorph.positions[k+1]+dy*blend+
        Math.sin(angle*.7+phase)*.5*amount;
      z=oldMorph.positions[k+2]+dz*blend+Math.sin(angle)*amount;
      colors[into]=oldMorph.colors[k]*(1-blend)+previous.colors[k]*blend;
      colors[into+1]=oldMorph.colors[k+1]*(1-blend)+previous.colors[k+1]*blend;
      colors[into+2]=oldMorph.colors[k+2]*(1-blend)+previous.colors[k+2]*blend;
      nodes[i]=oldMorph.nodes[source]*(1-blend)+previous.nodeFlags[source]*blend;
      if(frame.jitter){
        x+=Math.sin(time*3.7+phase)*.025*.3*blend;
        y+=Math.cos(time*3.1+phase)*.025*.3*blend;
      }
    }else{
      const angle=phase+frame.direction*frame.swirl*Math.PI*4*t;
      x=previous.targets[k]+Math.cos(angle)*previous.scatter[k]*unformed;
      y=previous.targets[k+1]+previous.scatter[k+1]*unformed;
      z=previous.targets[k+2]+Math.sin(angle)*previous.scatter[k+2]*unformed;
      if(frame.jitter){
        const shimmer=.025*(.3+.7*unformed);
        x+=Math.sin(time*3.7+phase)*shimmer;
        y+=Math.cos(time*3.1+phase)*shimmer;
      }
      colors[into]=previous.colors[k];
      colors[into+1]=previous.colors[k+1];
      colors[into+2]=previous.colors[k+2];
      nodes[i]=previous.nodeFlags[source];
    }
    positions[into]=x;positions[into+1]=y;positions[into+2]=z;
  }
  return {positions,colors,nodes};
}
