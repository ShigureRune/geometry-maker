import {describe,expect,it} from 'vitest';
import {generateVoidWeb} from './void-web';
import {voidEdges} from './void-graph';
import {visibleVoidObjects} from './void-web-runtime';
import {
  VOID_PARTICLE_LOW_LIMIT,VOID_PARTICLE_HIGH_LIMIT,generateVoidParticles,
} from './void-particle';
import type {Background} from '../scene';

const background:Background={mode:'solid',solid:'#050719',
  colors:['#08051d','#091024'],angle:0,
  figureColors:{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}};

describe('particle mode on cosmic web',()=>{
  const scene=generateVoidWeb('particles-cosmic-web','16:9');
  const lowObjects=visibleVoidObjects(scene,100,undefined,2800,true);
  const fullObjects=visibleVoidObjects(scene,100,undefined,2800,false);

  it('covers the existing actual web nodes and filament edges deterministically',()=>{
    const edges=voidEdges(scene,lowObjects);
    const a=generateVoidParticles(lowObjects,edges,'same-seed',background,4000,true);
    const b=generateVoidParticles(lowObjects,edges,'same-seed',background,4000,true);
    const c=generateVoidParticles(lowObjects,edges,'other-seed',background,4000,true);
    expect(a.count).toBe(VOID_PARTICLE_LOW_LIMIT);
    expect(a.nodeParticles+a.filamentParticles).toBe(a.count);
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
      background,12000,false);
    const low=generateVoidParticles(lowObjects,voidEdges(scene,lowObjects),
      'max-web',background,12000,true);
    expect(fullObjects.length).toBeGreaterThan(2000);
    expect(high.count).toBe(VOID_PARTICLE_HIGH_LIMIT);
    expect(low.count).toBe(VOID_PARTICLE_LOW_LIMIT);
    expect(high.targets.length).toBe(VOID_PARTICLE_HIGH_LIMIT*3);
    expect(high.colors.length).toBe(high.targets.length);
    expect(high.scatter.length).toBe(high.targets.length);
    expect(high.phases.length).toBe(high.count);
  });

  it('handles no objects, no edges, and min settings without allocation blowups',()=>{
    const empty=generateVoidParticles([],[], 'none',background,12000,false);
    expect(empty.count).toBe(0);
    expect(empty.targets.length).toBe(0);
    const nodes=generateVoidParticles(lowObjects,[],'isolated',background,500,true);
    expect(nodes.count).toBe(500);
    expect(nodes.filamentParticles).toBe(0);
    expect(nodes.nodeParticles).toBe(500);
    expect(nodes.targets.every(Number.isFinite)).toBe(true);
    const zero=generateVoidParticles(lowObjects,[],'zero',background,0,true);
    expect(zero.count).toBe(0);
  });
});
