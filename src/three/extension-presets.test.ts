import {describe,expect,it} from 'vitest';
import {threeDefaults,validateThreeSettings} from './settings';
import {voidDefaults,voidWebDefaults,VOID_WEB_VERSION,validateVoidSettings} from './void-settings';
import {validateParticleSettings} from './particle';
import {galaxyDefaults,validateGalaxySettings} from './galaxy';
import {GALAXY_PRESETS,galaxyWithPreset} from './galaxy-presets';
import {VOID_PRESETS,PARTICLE_PRESETS,voidWithPreset,particleWithPreset} from './extension-presets';

describe('3D creative presets',()=>{
  it('all VOID looks enable a valid large cosmic web without changing the supplied settings',()=>{
    const current={...voidDefaults,network:{...voidDefaults.network,customColor:'#ff8822'}};
    const initial=JSON.stringify(current);
    for(const id of Object.keys(VOID_PRESETS) as (keyof typeof VOID_PRESETS)[]){
      const next=voidWithPreset(current,id);
      expect(next.enabled).toBe(true);
      expect(next.version).toBe(VOID_WEB_VERSION);
      expect(next.objectLimit).toBe(VOID_PRESETS[id].objectLimit);
      expect(next.depthFade).toBe(VOID_PRESETS[id].depthFade);
      expect(next.network.customColor).toBe('#ff8822');
      expect(validateVoidSettings(next)).toEqual(next);
    }
    expect(JSON.stringify(current)).toBe(initial);
    expect(validateVoidSettings(voidWebDefaults)).toEqual(voidWebDefaults);
  });

  it('PARTICLE looks preserve global scene settings and disable GALAXY',()=>{
    const original={...threeDefaults,quality:'low' as const,spacingPercent:175,
      galaxy:{...galaxyDefaults,enabled:true}};
    for(const id of Object.keys(PARTICLE_PRESETS) as (keyof typeof PARTICLE_PRESETS)[]){
      const next=particleWithPreset(original,id);
      expect(next.quality).toBe('low');
      expect(next.spacingPercent).toBe(175);
      expect(next.enabledKinds).toEqual(threeDefaults.enabledKinds);
      expect(next.particle?.enabled).toBe(true);
      expect(next.particle?.swirl).toBe(PARTICLE_PRESETS[id].overrides.swirl);
      expect(next.galaxy?.enabled).toBe(false);
      expect(validateThreeSettings(next)).toMatchObject(next);
      expect(validateParticleSettings(next.particle)).toEqual(next.particle);
    }
    expect(original.galaxy.enabled).toBe(true);
  });

  it('large VOID + PARTICLE preset adjusts only the saved cloud budget and ratio',()=>{
    const original={...threeDefaults,voidMode:{...voidWebDefaults,enabled:true,objectLimit:2400}};
    for(const id of Object.keys(PARTICLE_PRESETS) as (keyof typeof PARTICLE_PRESETS)[]){
      const next=particleWithPreset(original,id);
      expect(next.voidMode).toMatchObject({
        enabled:true,version:VOID_WEB_VERSION,
        objectLimit:2400,particleCount:PARTICLE_PRESETS[id].webCount,
        nodeShare:PARTICLE_PRESETS[id].nodeShare,
      });
      expect(validateThreeSettings(next)).toMatchObject(next);
    }
    expect(original.voidMode.particleCount).toBe(voidWebDefaults.particleCount);
  });

  it('all cinematic and legacy GALAXY presets remain valid without mutating defaults',()=>{
    for(const id of Object.keys(GALAXY_PRESETS) as (keyof typeof GALAXY_PRESETS)[]){
      const next=galaxyWithPreset(galaxyDefaults,id);
      expect(next.enabled).toBe(true);
      expect(validateGalaxySettings(next)).toEqual(next);
    }
    expect(galaxyDefaults.enabled).toBe(false);
  });
});
