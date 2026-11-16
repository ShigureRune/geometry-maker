import {describe,expect,it} from 'vitest';
import {createStellarSelfGravity} from './galaxy-nbody';

describe('Barnes–Hut stellar self-gravity',()=>{
  it('obeys Newtonian equal-opposite pair forces and excludes its own mass',()=>{
    const radius=5;
    const xyz=new Float32Array([-1,0,0,1,0,0]);
    const solver=createStellarSelfGravity(xyz,radius,2);
    expect(solver.sourceCount).toBe(2);
    expect(solver.updates).toBe(0);
    solver.update(xyz,1);
    expect(solver.updates).toBe(1);
    const eps2=(radius*.055)**2;
    const mass=solver.totalMass/2;
    const expected=2*mass/Math.pow(4+eps2,1.5);
    expect(solver.accelerations[0]).toBeCloseTo(expected,7);
    expect(solver.accelerations[3]).toBeCloseTo(-expected,7);
    expect(solver.accelerations[1]).toBe(0);
    expect(solver.accelerations[2]).toBe(0);
    expect(solver.accelerations[4]).toBe(0);
    expect(solver.accelerations[5]).toBe(0);
    // If the node containing the target were approximated, its own mass
    // would spuriously attract it towards the node center.
    expect(solver.accelerationAt(-1,0,0,0)[0]).toBeCloseTo(expected,7);
  });
  it('approximates a direct all-pairs 3D field within Barnes–Hut tolerance',()=>{
    const n=120,radius=6;
    const positions=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const p=i*3,t=i*2.3999632,rad=radius*
        Math.sqrt((i+.5)/n);
      positions[p]=Math.cos(t)*rad;
      positions[p+1]=Math.sin(t)*rad;
      positions[p+2]=.02*Math.sin(i*1.71);
    }
    const solver=createStellarSelfGravity(positions,radius,n,.52);
    solver.update(positions,1);
    const mass=solver.totalMass/n;
    const eps2=(radius*.055)**2;
    let meanRelativeError=0;
    for(let i=0;i<n;i++){
      const p=i*3,x=positions[p],y=positions[p+1],z=positions[p+2];
      let ax=0,ay=0,az=0;
      for(let j=0;j<n;j++){
        if(i===j)continue;
        const q=j*3,dx=positions[q]-x,dy=positions[q+1]-y,
          dz=positions[q+2]-z;
        const d=dx*dx+dy*dy+dz*dz+eps2;
        const a=mass/(d*Math.sqrt(d));
        ax+=dx*a;ay+=dy*a;az+=dz*a;
      }
      const actual=solver.accelerations;
      meanRelativeError+=Math.hypot(actual[p]-ax,
        actual[p+1]-ay,actual[p+2]-az)/
        Math.max(.01,Math.hypot(ax,ay,az));
    }
    expect(solver.nodeCount).toBeGreaterThan(10);
    expect(meanRelativeError/n).toBeLessThan(.07);
  });
  it('is deterministic, bounds work on large point clouds and has no NaNs',()=>{
    const n=3600,radius=5.5;
    const positions=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const j=i*3,t=i*1.61803398;
      positions[j]=Math.cos(t)*radius*((i%487)/487);
      positions[j+1]=Math.sin(t)*radius*((i%487)/487);
      positions[j+2]=Math.sin(t*1.1)*.05;
    }
    const a=createStellarSelfGravity(positions,radius,512);
    const b=createStellarSelfGravity(positions,radius,512);
    a.update(positions,.8);b.update(positions,.8);
    expect(a.sourceCount).toBe(512);
    expect(a.particleCount).toBe(n);
    expect(a.nodeCount).toBeGreaterThan(20);
    expect(a.accelerations).toEqual(b.accelerations);
    expect(a.accelerations.every(Number.isFinite)).toBe(true);
    expect(a.accelerations.some(x=>Math.abs(x)>1e-7)).toBe(true);
    a.update(positions,0);
    expect(a.accelerations.every(x=>x===0)).toBe(true);
    expect(createStellarSelfGravity(positions,radius,100000).sourceCount)
      .toBe(2048);
  });
});
