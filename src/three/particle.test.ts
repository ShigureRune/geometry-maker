import {describe,expect,it} from 'vitest';
import {particleDefaults,particleEase,particleSwirlDirection,validateParticleSettings} from './particle';
import {threeDefaults,validateThreeSettings} from './settings';

describe('3D particle mode',()=>{
  it('defaults to opt-in and preserves earlier saved 3D settings',()=>{
    expect(particleDefaults).toMatchObject({enabled:false,count:4000,duration:3.2,swirl:1,spread:1.4,height:1.2,jitter:true});
    expect(validateThreeSettings({...threeDefaults,particle:undefined}).particle).toEqual(particleDefaults);
  });
  it('round-trips all particle options via 3D validation',()=>{
    const p={enabled:true,count:6500,duration:4.5,swirl:2,spread:1.8,height:.9,jitter:false};
    expect(validateThreeSettings({...threeDefaults,particle:p}).particle).toEqual(p);
    expect(validateParticleSettings(p)).toEqual(p);
  });
  it('rejects malformed or excessive settings from JSON',()=>{
    expect(()=>validateParticleSettings({enabled:true,count:12001})).toThrow();
    expect(()=>validateParticleSettings({enabled:true,duration:0})).toThrow();
    expect(()=>validateParticleSettings({enabled:true,jitter:'yes'})).toThrow();
  });
  it('has stable seed direction and finishes on its target',()=>{
    expect(particleSwirlDirection('同じシード')).toBe(particleSwirlDirection('同じシード'));
    expect([-1,1]).toContain(particleSwirlDirection('A'));
    expect(particleEase(-1)).toBe(0);
    expect(particleEase(0)).toBe(0);
    expect(particleEase(1)).toBe(1);
    expect(particleEase(4)).toBe(1);
    expect(particleEase(.75)).toBeGreaterThan(particleEase(.25));
  });
});
