import {describe,expect,it} from 'vitest';
import {generateVoidWeb} from './void-web';
import {voidEdges} from './void-graph';
import {visibleVoidObjects} from './void-web-runtime';
import {
  VOID_PARTICLE_LOW_LIMIT,VOID_PARTICLE_HIGH_LIMIT,
  VOID_PARTICLE_DEFAULT,VOID_PARTICLE_NODE_SHARE_DEFAULT,
  effectiveVoidParticleCount,generateVoidParticles,
} from './void-particle';
import type {Background} from '../scene';
import type {ThreeObject} from './model';

const background:Background={mode:'solid',solid:'#050719',
  colors:['#08051d','#091024','#031422'],angle:0,
  figureColors:{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}};

describe('particle mode on cosmic web',()=>{
  const scene=generateVoidWeb('particles-cosmic-web','16:9');
  const lowObjects=visibleVoidObjects(scene,100,undefined,2800,true);
  const fullObjects=visibleVoidObjects(scene,100,undefined,2800,false);

  it('covers the existing actual web nodes and filament edges deterministically',()=>{
    const edges=voidEdges(scene,lowObjects);
    const a=generateVoidParticles(lowObjects,edges,'same-seed',background,80000,true);
    const b=generateVoidParticles(lowObjects,edges,'same-seed',background,80000,true);
    const c=generateVoidParticles(lowObjects,edges,'other-seed',background,80000,true);
    expect(a.count).toBe(VOID_PARTICLE_LOW_LIMIT);
    expect(a.nodeParticles+a.filamentParticles).toBe(a.count);
    expect(VOID_PARTICLE_NODE_SHARE_DEFAULT).toBe(90);
    expect(a.nodeParticles).toBe(72000);
    expect(a.filamentParticles).toBe(8000);
    expect(a.nodeFlags.length).toBe(a.count);
    expect(a.nodeFlags.slice(0,a.nodeParticles).every(x=>x===1)).toBe(true);
    expect(a.nodeFlags.slice(a.nodeParticles).every(x=>x===0)).toBe(true);
    expect(a.nodeFlags).toEqual(b.nodeFlags);
    expect(a.nodeParticles).toBeGreaterThan(500);
    expect(a.filamentParticles).toBeGreaterThan(300);
    expect(a.targets).toEqual(b.targets);
    expect(a.colors).toEqual(b.colors);
    expect(a.scatter).toEqual(b.scatter);
    expect(a.phases).toEqual(b.phases);
    expect(a.targets).not.toEqual(c.targets);
    expect(a.targets.every(Number.isFinite)).toBe(true);
    expect(a.colors.every(x=>Number.isFinite(x)&&x>=0&&x<=1)).toBe(true);
    // A sample of output filament points must actually lie on the preserved
    // web segments, rather than forming an unrelated fake random dust field.
    const byId=new Map(lowObjects.map(o=>[o.id,o]));
    for(let i=a.nodeParticles;i<a.count;i+=Math.max(1,
      Math.floor(a.filamentParticles/20))){
      const p=i*3;
      let near=Infinity;
      for(const edge of edges){
        const x=byId.get(edge.a)!.position,y=byId.get(edge.b)!.position;
        const dx=y[0]-x[0],dy=y[1]-x[1],dz=y[2]-x[2];
        const t=Math.max(0,Math.min(1,(
          (a.targets[p]-x[0])*dx+(a.targets[p+1]-x[1])*dy+
          (a.targets[p+2]-x[2])*dz)/
          Math.max(1e-6,dx*dx+dy*dy+dz*dz)));
        near=Math.min(near,Math.hypot(
          a.targets[p]-x[0]-dx*t,
          a.targets[p+1]-x[1]-dy*t,
          a.targets[p+2]-x[2]-dz*t));
      }
      expect(near).toBeLessThan(.25);
    }
  });

  it('caps full-web particles separately from its 2800 existing nodes',()=>{
    const edges=voidEdges(scene,fullObjects);
    const high=generateVoidParticles(fullObjects,edges,'max-web',
      background,500000,false);
    const low=generateVoidParticles(lowObjects,voidEdges(scene,lowObjects),
      'max-web',background,500000,true);
    expect(fullObjects.length).toBeGreaterThan(2000);
    expect(high.count).toBe(VOID_PARTICLE_HIGH_LIMIT);
    expect(low.count).toBe(VOID_PARTICLE_LOW_LIMIT);
    expect(high.targets.length).toBe(VOID_PARTICLE_HIGH_LIMIT*3);
    expect(high.colors.length).toBe(high.targets.length);
    expect(high.scatter.length).toBe(high.targets.length);
    expect(high.phases.length).toBe(high.count);
    expect(high.nodeParticles).toBe(450000);
    expect(high.filamentParticles).toBe(50000);
    expect(high.nodeFlags.length).toBe(high.count);
  });

  it('can dedicate 100% of points to actual figures while leaving edges intact',()=>{
    const edges=voidEdges(scene,lowObjects);
    expect(edges.length).toBeGreaterThan(0);
    const allShapes=generateVoidParticles(lowObjects,edges,'all-nodes',
      background,12000,true,1.4,1.2,100);
    const balanced=generateVoidParticles(lowObjects,edges,'all-nodes',
      background,12000,true,1.4,1.2,65);
    expect(allShapes.nodeParticles).toBe(12000);
    expect(allShapes.filamentParticles).toBe(0);
    expect(allShapes.nodeFlags.every(x=>x===1)).toBe(true);
    expect(balanced.nodeParticles).toBe(7800);
    expect(balanced.filamentParticles).toBe(4200);
    expect(balanced.nodeFlags.slice(7800).every(x=>x===0)).toBe(true);
    expect(balanced.targets).not.toEqual(allShapes.targets);
    const emptyEdges=generateVoidParticles(lowObjects,[],'no-wires',
      background,500,true,1.4,1.2,65);
    expect(emptyEdges.nodeParticles).toBe(500);
    expect(emptyEdges.filamentParticles).toBe(0);
  });

  it('fills all six cube faces uniformly, not just its twelve edges',()=>{
    const base:ThreeObject={...lowObjects[0],kind:'cube',position:[0,0,0],
      rotation:[0,0,0],radius:1};
    const data=generateVoidParticles([base],[],'cube-uniform-faces',
      background,12000,true,1.4,1.2,100);
    const half=1/Math.sqrt(3),faceCounts=[0,0,0,0,0,0];
    let faceInteriors=0;
    for(let i=0;i<data.count;i++){
      const xyz=[data.targets[i*3],data.targets[i*3+1],data.targets[i*3+2]];
      expect(xyz.every(x=>Math.abs(x)<=half+.0001)).toBe(true);
      const face=xyz.findIndex(x=>Math.abs(Math.abs(x)-half)<.0001);
      expect(face).toBeGreaterThanOrEqual(0);
      faceCounts[face*2+(xyz[face]>0?0:1)]++;
      if(xyz.filter(x=>Math.abs(Math.abs(x)-half)<.0001).length===1)faceInteriors++;
    }
    expect(faceInteriors).toBeGreaterThan(11900);
    for(const face of faceCounts){
      // With equal surface areas, each face gets roughly one sixth.
      expect(face).toBeGreaterThan(1650);
      expect(face).toBeLessThan(2350);
    }
  });

  it('keeps polygon surface coordinates in the saved object rotation',()=>{
    const angle=Math.PI/5;
    const cube:ThreeObject={...lowObjects[0],kind:'cube',position:[0,0,0],
      rotation:[0,0,angle],radius:1};
    const data=generateVoidParticles([cube],[],'cube-rotated-faces',
      background,1500,true,1.4,1.2,100);
    const half=1/Math.sqrt(3);
    let interiors=0;
    for(let i=0;i<data.count;i++){
      const x=data.targets[i*3],y=data.targets[i*3+1],z=data.targets[i*3+2];
      const local=[Math.cos(angle)*x+Math.sin(angle)*y,
        -Math.sin(angle)*x+Math.cos(angle)*y,z];
      expect(local.every(v=>Math.abs(v)<=half+.0001)).toBe(true);
      const nearFace=local.filter(v=>Math.abs(Math.abs(v)-half)<.0001).length;
      expect(nearFace).toBeGreaterThanOrEqual(1);
      if(nearFace===1)interiors++;
    }
    expect(interiors).toBeGreaterThan(1450);
  });

  it('distributes particles across the torus tube while keeping its hole',()=>{
    const torus:ThreeObject={...lowObjects[0],kind:'torus',position:[2,-1,3],
      rotation:[0,0,0],radius:1};
    const data=generateVoidParticles([torus],[],'torus-full-surface',
      background,7000,true,1.4,1.2,100);
    const quadrants=[0,0,0,0];
    let top=0,bottom=0;
    for(let i=0;i<data.count;i++){
      const x=data.targets[i*3]-2,y=data.targets[i*3+1]+1,z=data.targets[i*3+2]-3;
      const major=Math.hypot(x,y);
      expect(major).toBeGreaterThan(.43);
      expect(major).toBeLessThan(.98);
      // The low-quality mesh has flat tube/major-radius facets, so it
      // deviates slightly from the ideal continuous torus equation.
      expect(Math.abs((major-.72)**2+z*z-.23**2)).toBeLessThan(.035);
      quadrants[(x>=0?0:1)+(y>=0?0:2)]++;
      if(z>.08)top++;
      if(z<-.08)bottom++;
    }
    for(const n of quadrants){expect(n).toBeGreaterThan(1350);expect(n).toBeLessThan(2150);}
    expect(top).toBeGreaterThan(1300);
    expect(bottom).toBeGreaterThan(1300);
  });

  it('does not overpopulate finely tessellated triangles on a box face',()=>{
    // Two equal physical areas with different subdivisions should have equal
    // probability; no edge or triangle-count weighting is allowed.
    const cube:ThreeObject={...lowObjects[0],kind:'cube',position:[0,0,0],
      rotation:[0,0,0],radius:1};
    const data=generateVoidParticles([cube],[],'cube-surface-coverage',
      background,10000,true);
    let inside=0;
    for(let i=0;i<data.count;i++){
      const x=data.targets[i*3],y=data.targets[i*3+1],z=data.targets[i*3+2];
      // Face interior means 2 coordinates lie strictly inside the face.
      const half=1/Math.sqrt(3);
      if([x,y,z].filter(v=>Math.abs(v)<half-.05).length>=2)inside++;
    }
    expect(inside).toBeGreaterThan(7500);
  });

  it('allocates more surface samples to large figures than tiny leaves',()=>{
    const large:ThreeObject={...lowObjects[0],id:'large',kind:'cube',
      role:'primary',position:[0,0,0],rotation:[0,0,0],radius:1};
    const leaf:ThreeObject={...large,id:'tiny',role:'accent',
      position:[8,0,0],radius:.1};
    const points=generateVoidParticles([large,leaf],[],'size-weighted',
      background,10000,true,1.4,1.2,100);
    let tinyCount=0;
    for(let i=0;i<points.count;i++)if(points.targets[i*3]>4)tinyCount++;
    expect(tinyCount).toBeGreaterThan(30);
    expect(tinyCount).toBeLessThan(250); // ~1%, not 50%
    expect(points.count).toBe(10000);
  });

  it('budgets huge density independently for mobile, software, low and high',()=>{
    expect(VOID_PARTICLE_DEFAULT).toBe(200000);
    expect(effectiveVoidParticleCount(500000,false)).toBe(VOID_PARTICLE_HIGH_LIMIT);
    expect(effectiveVoidParticleCount(120000,true)).toBe(VOID_PARTICLE_LOW_LIMIT);
    // No hidden mobile/software cap: the existing 3D quality choice wins.
    expect(effectiveVoidParticleCount(120000,false)).toBe(120000);
    expect(effectiveVoidParticleCount(120000,true)).toBe(VOID_PARTICLE_LOW_LIMIT);
    expect(effectiveVoidParticleCount(Infinity,false)).toBe(0);
    expect(effectiveVoidParticleCount(-1,false)).toBe(0);
    expect(effectiveVoidParticleCount(2500.8,false)).toBe(2500);
  });

  it('handles no objects, no edges, and min settings without allocation blowups',()=>{
    const empty=generateVoidParticles([],[], 'none',background,12000,false);
    expect(empty.count).toBe(0);
    expect(empty.targets.length).toBe(0);
    expect(empty.nodeFlags.length).toBe(0);
    const nodes=generateVoidParticles(lowObjects,[],'isolated',background,500,true);
    expect(nodes.count).toBe(500);
    expect(nodes.filamentParticles).toBe(0);
    expect(nodes.nodeParticles).toBe(500);
    expect(nodes.targets.every(Number.isFinite)).toBe(true);
    const zero=generateVoidParticles(lowObjects,[],'zero',background,0,true);
    expect(zero.count).toBe(0);
  });
});
