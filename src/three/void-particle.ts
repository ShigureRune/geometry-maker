import {seededRandom,type Background} from '../scene';
import type {ThreeObject} from './model';
import type {NetworkEdge} from './network';

/** Bounded GPU particle budget: node + filament particles replace thousands of
 * individual surface samplers and instanced solids in the cosmic web. */
export const VOID_PARTICLE_LOW_LIMIT=1200;
export const VOID_PARTICLE_HIGH_LIMIT=6000;

export type VoidParticleData={
  count:number;nodeParticles:number;filamentParticles:number;
  targets:Float32Array;colors:Float32Array;
  scatter:Float32Array;phases:Float32Array;
};

/** Generate once per seed/configuration. O(particles + visible nodes + edges)
 * in memory and time, never O(nodes * mesh tessellation).
 *
 * Node points outline each knot's small sphere. Filament points populate the
 * actual graph segments, rather than a fabricated random cloud. The saved
 * ordinary PARTICLE MODE's geometry sampler is intentionally unchanged.
 */
export function generateVoidParticles(
  objects:readonly ThreeObject[],edges:readonly NetworkEdge[],
  seed:string,background:Background,requested:number,low:boolean,
  spread=1.4,height=1.2,
):VoidParticleData{
  const count=objects.length?Math.min(
    Math.max(0,Math.floor(requested)),
    low?VOID_PARTICLE_LOW_LIMIT:VOID_PARTICLE_HIGH_LIMIT):0;
  const targets=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const scatter=new Float32Array(count*3);
  const phases=new Float32Array(count);
  const empty={count,nodeParticles:0,filamentParticles:0,
    targets,colors,scatter,phases};
  if(!count)return empty;

  const byId=new Map(objects.map(o=>[o.id,o]));
  const visibleEdges=edges.filter(e=>byId.has(e.a)&&byId.has(e.b));
  const nodeParticles=visibleEdges.length?Math.round(count*.60):count;
  const filamentParticles=count-nodeParticles;
  const random=seededRandom('void-web-particle-v1:'+seed);
  const defaultColors={primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'};
  const colorFor=(object:ThreeObject)=>{
    const value=background.figureColors?.[object.role]??defaultColors[object.role];
    return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
  };
  const palette=new Map(objects.map(o=>[o.id,colorFor(o)]));
  function write(i:number,x:number,y:number,z:number,rgb:number[]){
    const p=i*3;
    targets[p]=x;targets[p+1]=y;targets[p+2]=z;
    colors[p]=rgb[0];colors[p+1]=rgb[1];colors[p+2]=rgb[2];
    // The dispersion stays in scene units, NOT multiplied by the huge VOID
    // field radius. The vertex shader completes the swirl on the GPU.
    scatter[p]=(.55+random()*.80)*spread;
    scatter[p+1]=(random()*2-1)*height;
    scatter[p+2]=(.55+random()*.80)*spread;
    phases[i]=random()*Math.PI*2;
  }
  // Stable stratification covers the entire visible web even with a tiny
  // mobile budget; the generator never creates a MeshSurfaceSampler.
  for(let i=0;i<nodeParticles;i++){
    const index=Math.min(objects.length-1,
      Math.floor((i+random()*.45)*objects.length/nodeParticles));
    const node=objects[index],u=random()*2-1,phi=random()*Math.PI*2;
    const h=Math.sqrt(1-u*u);
    const r=node.radius*(.70+random()*.30);
    write(i,node.position[0]+Math.cos(phi)*h*r,
      node.position[1]+Math.sin(phi)*h*r,
      node.position[2]+u*r,palette.get(node.id)!);
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
    write(p,x,y,z,ca.map((v,k)=>v*(1-t)+cb[k]*t));
  }
  return {count,nodeParticles,filamentParticles,targets,colors,scatter,phases};
}
