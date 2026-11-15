import {describe,expect,it} from 'vitest';
import {
  GALAXY_LOW_STAR_LIMIT,galaxyDefaults,galaxyMorphEasing,
  generateGalaxy,validateGalaxySettings,
} from './galaxy';
import {threeDefaults,validateThreeSettings} from './settings';

describe('GALAXY MODE',()=>{
  it('is opt-in and old 3D JSON stays in ordinary 3D mode',()=>{
    expect(galaxyDefaults.enabled).toBe(false);
    expect(validateThreeSettings({...threeDefaults,galaxy:undefined}).galaxy).toEqual(galaxyDefaults);
  });
  it('round-trips settings and rejects invalid counts, palettes and arm ranges',()=>{
    const customized={...galaxyDefaults,enabled:true,arms:6,count:24000,palette:'rose' as const,rotationSpeed:1.25};
    expect(validateGalaxySettings(customized)).toEqual(customized);
    expect(validateThreeSettings({...threeDefaults,galaxy:customized}).galaxy).toEqual(customized);
    for(const value of [{count:30001},{count:Infinity},{arms:1},{arms:9},{palette:'unknown'},{radius:100},{coreGlow:-1},{seedTransition:'yes'}]){
      expect(()=>validateGalaxySettings({...galaxyDefaults,...value})).toThrow();
    }
  });
  it('generates identical data for the same seed and settings',()=>{
    const a=generateGalaxy('spiral-seed',galaxyDefaults,false);
    const b=generateGalaxy('spiral-seed',galaxyDefaults,false);
    const c=generateGalaxy('another-seed',galaxyDefaults,false);
    expect(a.count).toBe(12000);
    expect(a.positions).toEqual(b.positions);
    expect(a.colors).toEqual(b.colors);
    expect(a.sizes).toEqual(b.sizes);
    expect(a.positions).not.toEqual(c.positions);
    expect(Array.from(a.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(a.sizes).every(v=>v>0&&Number.isFinite(v))).toBe(true);
  });
  it('caps low-quality stars without altering the saved requested count',()=>{
    const original={...galaxyDefaults,count:30000};
    const mobile=generateGalaxy('same',original,true);
    expect(mobile.count).toBe(GALAXY_LOW_STAR_LIMIT);
    expect(original.count).toBe(30000);
    expect(generateGalaxy('same',original,false).count).toBe(30000);
  });
  it('has a visible 3D depth and a central stellar nucleus',()=>{
    const galaxy=generateGalaxy('depth',galaxyDefaults,true);
    expect(galaxy.positions.some((v,i)=>i%3===2&&Math.abs(v)>.01)).toBe(true);
    expect(galaxy.cores.some(x=>x>.5)).toBe(true);
    expect(galaxy.cores.some(x=>x===0)).toBe(true);
  });
  it('ease is seekable and exact at endpoints',()=>{
    expect(galaxyMorphEasing(-4)).toBe(0);
    expect(galaxyMorphEasing(0)).toBe(0);
    expect(galaxyMorphEasing(.5)).toBe(.5);
    expect(galaxyMorphEasing(1)).toBe(1);
    expect(galaxyMorphEasing(8)).toBe(1);
  });
});
