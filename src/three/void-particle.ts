import {seededRandom,type Background} from '../scene';
import {Euler,Matrix4} from 'three';
import {shapeSurface} from './shape-surface';
import type {ThreeObject} from './model';
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

export type VoidParticleData={
  count:number;nodeParticles:number;filamentParticles:number;
  targets:Float32Array;colors:Float32Array;
  scatter:Float32Array;phases:Float32Array;nodeFlags:Uint8Array;
};

/** Generate once per seed/configuration. O(particles + visible nodes + edges)
 * in memory and time, never O(nodes * mesh tessellation).
 *
 * Figure points fill the real 13 solid surfaces, not just contours. Every
 * cached triangle is sampled proportional to its area so even a finely
 * tessellated torus or sphere does not develop unnatural dense patches.
 * Larger true surfaces receive more points; tiny leaves receive fewer.
 * Filament dust still populates actual graph edges, and all points remain
 * inside one GPU Points draw call with no per-frame CPU geometry updates.
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
  const weights=objects.map(o=>Math.max(1e-6,o.radius*o.radius*shapeSurface(o.kind,low).area));
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
    // Same 13 meshes as the ordinary PARTICLE MODE, but one cached
    // area-weighted triangle lookup instead of a surface sampler per node.
    if(lastObjectIndex!==objectIndex){
      rotation.makeRotationFromEuler(euler.set(...node.rotation));
      lastObjectIndex=objectIndex;
    }
    const surface=shapeSurface(node.kind,low);
    const distance=random()*surface.area;
    let first=0,last=surface.cumulative.length-1;
    while(first<last){
      const middle=(first+last)>>>1;
      if(distance>surface.cumulative[middle])first=middle+1;
      else last=middle;
    }
    const triangle=first*9;
    // sqrt gives uniform AREA coordinates inside a triangle, not a
    // uniform edge/vertex bias. Every face region receives points.
    const root=Math.sqrt(random()),side=random();
    const w0=1-root,w1=root*(1-side),w2=root*side;
    const x=surface.triangles[triangle]*w0+
      surface.triangles[triangle+3]*w1+surface.triangles[triangle+6]*w2;
    const y=surface.triangles[triangle+1]*w0+
      surface.triangles[triangle+4]*w1+surface.triangles[triangle+7]*w2;
    const z=surface.triangles[triangle+2]*w0+
      surface.triangles[triangle+5]*w1+surface.triangles[triangle+8]*w2;
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
