import {seededRandom,type Background} from '../scene';
import {Euler,Matrix4} from 'three';
import {outlineSegments} from './outline-geometry';
import type {ThreeKind,ThreeObject} from './model';
import type {NetworkEdge} from './network';

/** Bounded GPU particle budget: node + filament particles replace thousands of
 * individual surface samplers and instanced solids in the cosmic web. */
export const VOID_PARTICLE_LOW_LIMIT=80000;
export const VOID_PARTICLE_HIGH_LIMIT=500000;
export const VOID_PARTICLE_DEFAULT=200000;
/** Percentage of the point budget assigned to the actual 3D figures (not wires). */
export const VOID_PARTICLE_NODE_SHARE_DEFAULT=90;

/** The existing 3D quality setting alone determines the cosmic-web budget.
 * Auto quality already chooses Low on mobile/software renderers, while a
 * deliberate High override is honored on every device. Never silently apply
 * a second device-type cap after the user's explicit quality choice. */
export function effectiveVoidParticleCount(requested:number,low:boolean):number{
  const cap=low?VOID_PARTICLE_LOW_LIMIT:VOID_PARTICLE_HIGH_LIMIT;
  return Number.isFinite(requested)?Math.min(Math.max(0,Math.floor(requested)),cap):0;
}

type ShapeOutline={
  segments:Float32Array; cumulative:Float64Array; length:number;
};
const outlineCache=new Map<string,ShapeOutline>();

/** Reuse the exact contours drawn by the existing 3D outline renderer.
 * A template is made once per kind/quality, never once per web node.
 * Cumulative segment lengths allow unbiased O(log segments) point lookup. */
function shapeOutline(kind:ThreeKind,low:boolean):ShapeOutline{
  const key=(low?'low:':'high:')+kind;
  const cached=outlineCache.get(key);
  if(cached)return cached;
  const segments=outlineSegments(kind,low),cumulative=new Float64Array(segments.length/6);
  let length=0;
  for(let i=0;i<cumulative.length;i++){
    const p=i*6;
    length+=Math.hypot(segments[p+3]-segments[p],segments[p+4]-segments[p+1],
      segments[p+5]-segments[p+2]);
    cumulative[i]=length;
  }
  const result={segments,cumulative,length};
  outlineCache.set(key,result);
  return result;
}

export type VoidParticleData={
  count:number;nodeParticles:number;filamentParticles:number;
  targets:Float32Array;colors:Float32Array;
  scatter:Float32Array;phases:Float32Array;nodeFlags:Uint8Array;
};

/** Generate once per seed/configuration. O(particles + visible nodes + edges)
 * in memory and time, never O(nodes * mesh tessellation).
 *
 * Figure points follow each node's real 3D outline (cube edges, torus rings,
 * cone silhouette, etc.) with its radius and rotation. A radius-squared budget
 * makes large figures legible instead of spending an equal count on tiny leaves.
 * Filament dust still populates the real graph edges. This shares the existing
 * outline templates without any per-node meshes or per-frame CPU point updates.
 * The ordinary PARTICLE MODE's geometry sampler is unchanged.
 */
export function generateVoidParticles(
  objects:readonly ThreeObject[],edges:readonly NetworkEdge[],
  seed:string,background:Background,requested:number,low:boolean,
  spread=1.4,height=1.2,nodeShare=VOID_PARTICLE_NODE_SHARE_DEFAULT,
):VoidParticleData{
  const count=objects.length?effectiveVoidParticleCount(requested,low):0;
  const targets=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const scatter=new Float32Array(count*3);
  const phases=new Float32Array(count);
  const nodeFlags=new Uint8Array(count);
  const empty={count,nodeParticles:0,filamentParticles:0,
    targets,colors,scatter,phases,nodeFlags};
  if(!count)return empty;

  const byId=new Map(objects.map(o=>[o.id,o]));
  const visibleEdges=edges.filter(e=>byId.has(e.a)&&byId.has(e.b));
  // Keep the node geometry visibly dense: wires have a small, adjustable
  // share and no longer swallow most of the GPU particle budget.
  const safeShare=Number.isFinite(nodeShare)?Math.max(50,Math.min(100,nodeShare)):VOID_PARTICLE_NODE_SHARE_DEFAULT;
  const nodeParticles=visibleEdges.length?Math.round(count*safeShare/100):count;
  const filamentParticles=count-nodeParticles;
  nodeFlags.fill(1,0,nodeParticles);
  const random=seededRandom('void-web-particle-v1:'+seed);
  const defaultColors={primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'};
  const colorFor=(object:ThreeObject)=>{
    const value=background.figureColors?.[object.role]??defaultColors[object.role];
    return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
  };
  const palette=new Map(objects.map(o=>[o.id,colorFor(o)]));
  function write(i:number,x:number,y:number,z:number,r:number,g:number,b:number){
    const p=i*3;
    targets[p]=x;targets[p+1]=y;targets[p+2]=z;
    colors[p]=r;colors[p+1]=g;colors[p+2]=b;
    // The dispersion stays in scene units, NOT multiplied by the huge VOID
    // field radius. The vertex shader completes the swirl on the GPU.
    scatter[p]=(.55+random()*.80)*spread;
    scatter[p+1]=(random()*2-1)*height;
    scatter[p+2]=(.55+random()*.80)*spread;
    phases[i]=random()*Math.PI*2;
  }
  // Allocate by visible figure area rather than evenly across all nodes:
  // a tiny accent leaf must not consume the same particle budget as a large
  // primary knot. Stable stratification still reaches all parts of the web.
  const weights=objects.map(o=>Math.max(1e-6,o.radius*o.radius));
  const weightTotal=weights.reduce((total,w)=>total+w,0);
  let objectIndex=0,weightEdge=weights[0],lastObjectIndex=-1;
  const rotation=new Matrix4(),euler=new Euler();
  for(let i=0;i<nodeParticles;i++){
    const rank=(i+random()*.45)*weightTotal/nodeParticles;
    while(objectIndex<objects.length-1&&rank>=weightEdge){
      objectIndex++;
      weightEdge+=weights[objectIndex];
    }
    const node=objects[objectIndex];
    // The same 13 outline templates are used for solids and particles.
    // A single rotation matrix is reused while sampling each object's points.
    if(lastObjectIndex!==objectIndex){
      rotation.makeRotationFromEuler(euler.set(...node.rotation));
      lastObjectIndex=objectIndex;
    }
    const template=shapeOutline(node.kind,low);
    const distance=random()*template.length;
    let first=0,last=template.cumulative.length-1;
    while(first<last){
      const middle=(first+last)>>>1;
      if(distance>template.cumulative[middle])first=middle+1;
      else last=middle;
    }
    const segment=first*6,previous=first?template.cumulative[first-1]:0;
    const fraction=(distance-previous)/
      Math.max(1e-10,template.cumulative[first]-previous);
    const x=template.segments[segment]+
      (template.segments[segment+3]-template.segments[segment])*fraction;
    const y=template.segments[segment+1]+
      (template.segments[segment+4]-template.segments[segment+1])*fraction;
    const z=template.segments[segment+2]+
      (template.segments[segment+5]-template.segments[segment+2])*fraction;
    const m=rotation.elements,r=node.radius,rgb=palette.get(node.id)!;
    write(i,node.position[0]+r*(m[0]*x+m[4]*y+m[8]*z),
      node.position[1]+r*(m[1]*x+m[5]*y+m[9]*z),
      node.position[2]+r*(m[2]*x+m[6]*y+m[10]*z),
      rgb[0],rgb[1],rgb[2]);
  }
  for(let i=0;i<filamentParticles;i++){
    const index=Math.min(visibleEdges.length-1,
      Math.floor((i+random()*.45)*visibleEdges.length/filamentParticles));
    const edge=visibleEdges[index],a=byId.get(edge.a)!,b=byId.get(edge.b)!;
    const t=random(),p=nodeParticles+i;
    // Sparse, slightly irregular dust along the actual 3D filament.
    const jitter=(.015+random()*.045)*Math.min(1.5,edge.distance);
    const x=a.position[0]*(1-t)+b.position[0]*t+(random()-.5)*jitter;
    const y=a.position[1]*(1-t)+b.position[1]*t+(random()-.5)*jitter;
    const z=a.position[2]*(1-t)+b.position[2]*t+(random()-.5)*jitter;
    const ca=palette.get(a.id)!,cb=palette.get(b.id)!;
    write(p,x,y,z,ca[0]*(1-t)+cb[0]*t,ca[1]*(1-t)+cb[1]*t,
      ca[2]*(1-t)+cb[2]*t);
  }
  return {count,nodeParticles,filamentParticles,targets,colors,scatter,phases,nodeFlags};
}
