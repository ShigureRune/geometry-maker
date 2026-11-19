import {describe,expect,it} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {
  generateNebulaVolume,NEBULA_LOW_CLOUDLETS,NEBULA_HIGH_CLOUDLETS,
} from './nebula-volume';

describe('world-space NEBULA gas',()=>{
  it('generates deterministic real XYZ cloudlets, not a fullscreen plane',()=>{
    for(const low of [true,false]){
      const a=generateNebulaVolume('nebula-example',low);
      const b=generateNebulaVolume('nebula-example',low);
      expect(a.count).toBe(low?NEBULA_LOW_CLOUDLETS:NEBULA_HIGH_CLOUDLETS);
      expect(a.positions.length).toBe(a.count*3);
      expect(a.positions).toEqual(b.positions);
      expect(a.tints).toEqual(b.tints);
      expect(a.maxDepth-a.minDepth).toBeGreaterThan(16);
      expect(a.minDepth).toBeLessThan(-18);
      expect(a.maxDepth).toBeGreaterThan(-7);
      expect(a.positions.every(Number.isFinite)).toBe(true);
      expect(a.sizes.every(n=>Number.isFinite(n)&&n>0)).toBe(true);
    }
  });

  it('keeps a stable world-space composition across mode or camera changes',()=>{
    const a=generateNebulaVolume('unchanged-seed',true);
    const changed=generateNebulaVolume('different-seed',true);
    expect(changed.positions).not.toEqual(a.positions);
    const distance=(i:number,j:number)=>{
      const p=i*3,q=j*3;
      return Math.hypot(a.positions[p]-a.positions[q],
        a.positions[p+1]-a.positions[q+1],a.positions[p+2]-a.positions[q+2]);
    };
    expect(distance(0,1)).toBeGreaterThan(.1);
    // Distances are 3D, rather than every cloudlet sharing the same Z.
    expect(Math.abs(a.positions[2]-a.positions[5])).toBeGreaterThan(.01);
  });

  it('shows camera parallax: near and far gas projected from two viewpoints shift differently',()=>{
    const cloud=generateNebulaVolume('parallax-proof',true);
    const near=new PerspectiveCamera(40,16/9,.1,1200);
    near.position.set(0,1,18);near.lookAt(0,0,-10);near.updateMatrixWorld();
    const side=new PerspectiveCamera(40,16/9,.1,1200);
    side.position.set(8,2,16);side.lookAt(0,0,-10);side.updateMatrixWorld();
    const project=(camera:PerspectiveCamera,i:number)=>{
      const p=i*3;
      return new Vector3(cloud.positions[p],cloud.positions[p+1],
        cloud.positions[p+2]).project(camera);
    };
    const displacements=Array.from({length:100},(_,i)=>{
      const p=project(near,i),q=project(side,i);
      return Math.hypot(p.x-q.x,p.y-q.y);
    });
    expect(displacements.some(delta=>delta>.01)).toBe(true);
    expect(Math.max(...displacements)-Math.min(...displacements)).toBeGreaterThan(.005);
  });
});
