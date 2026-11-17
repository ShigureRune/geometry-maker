import {describe,expect,it} from 'vitest';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import {generateVoidParticles} from './void-particle';
import {snapshotVoidSeedFrame,voidSeedBurst,voidSeedMix} from './void-seed-morph';

const background:Background={mode:'solid',solid:'#050719',
  colors:['#08051d','#091024','#031422'],angle:0,
  figureColors:{primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'}};
const node:ThreeObject={id:'cube',kind:'cube',role:'primary',
  position:[0,0,0],rotation:[0,0,0],radius:1,startDensity:5,phase:0,
  spin:[0,0,0],floatRate:0};
const old=generateVoidParticles([node],[],'previous-seed',background,1500,true);
const frame=(overrides:Partial<Parameters<typeof snapshotVoidSeedFrame>[2]>={})=>({
  time:3,duration:2,swirl:1,direction:1,jitter:false,morph:null,progress:-1,...overrides,
});

describe('cosmic web GPU seed morph snapshots',()=>{
  it('preserves settled visible positions and colors when changing seed',()=>{
    const snap=snapshotVoidSeedFrame(old,old.count,frame());
    expect(snap.positions).toEqual(old.targets);
    expect(snap.colors).toEqual(old.colors);
    expect(snap.nodes.every(x=>x===1)).toBe(true);
    expect(snapshotVoidSeedFrame(old,old.count,frame())).toEqual(snap);
  });

  it('samples the actual unformed previous frame and survives a density change',()=>{
    const snap=snapshotVoidSeedFrame(old,800,frame({time:0}));
    expect(snap.positions.length).toBe(800*3);
    expect(snap.colors.length).toBe(800*3);
    expect(snap.nodes.length).toBe(800);
    expect(snap.positions.every(Number.isFinite)).toBe(true);
    expect(snap.positions).not.toEqual(old.targets.slice(0,800*3));
    expect(snapshotVoidSeedFrame(old,0,frame()).positions.length).toBe(0);
  });

  it('snapshots an interrupted seed morph without jumping back to older targets',()=>{
    const start=snapshotVoidSeedFrame(old,old.count,frame());
    const previousMorph={...start,duration:2};
    const half=snapshotVoidSeedFrame(old,old.count,frame({
      time:1,progress:.5,morph:previousMorph,swirl:0,
    }));
    expect(voidSeedMix(0)).toBe(0);
    expect(voidSeedMix(.5)).toBe(.5);
    expect(voidSeedMix(1)).toBe(1);
    expect(voidSeedBurst(0)).toBeCloseTo(0);
    expect(voidSeedBurst(.5)).toBeCloseTo(1);
    expect(voidSeedBurst(1)).toBeCloseTo(0);
    expect(half.positions.every(Number.isFinite)).toBe(true);
    expect(half.colors.every(Number.isFinite)).toBe(true);
    expect(half.positions).not.toEqual(old.targets);
    const end=snapshotVoidSeedFrame(old,old.count,frame({
      time:2,progress:1,morph:previousMorph,swirl:0,
    }));
    expect(end.positions).toEqual(old.targets);
    expect(end.colors).toEqual(old.colors);
    expect(end.nodes.every(x=>x===1)).toBe(true);
  });

  it('maps both earlier and later particle budgets without allocation overflow',()=>{
    for(const count of [1,100,1500,3500]){
      const snap=snapshotVoidSeedFrame(old,count,frame());
      expect(snap.positions.length).toBe(count*3);
      expect(snap.colors.length).toBe(count*3);
      expect(snap.nodes.length).toBe(count);
      expect(snap.positions.every(Number.isFinite)).toBe(true);
    }
  });
});
