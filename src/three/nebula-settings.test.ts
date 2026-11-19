import {describe,it,expect} from 'vitest';
import {nebulaDefaults,NEBULA_PRESET_IDS,NEBULA_PRESETS,nebulaWithPreset,validateNebulaSettings} from './nebula-settings';
import {threeDefaults,validateThreeSettings} from './settings';

describe('NEBULA settings and backwards compatibility',()=>{
  it('keeps NEBULA off by default and restores old 3D projects without a nebula field',()=>{
    expect(nebulaDefaults.enabled).toBe(false);
    const old={...threeDefaults};
    delete old.nebula;
    const restored=validateThreeSettings(old);
    expect(restored.nebula).toEqual(nebulaDefaults);
  });
  it('each preset is valid and changes only the nebula settings without mutating inputs',()=>{
    const input={...nebulaDefaults,enabled:false,animation:false};
    const snapshot=JSON.stringify(input);
    for(const id of NEBULA_PRESET_IDS){
      const next=nebulaWithPreset(input,id);
      expect(next).toMatchObject({enabled:true,preset:id,...NEBULA_PRESETS[id].values});
      expect(next.animation).toBe(false);
      expect(validateNebulaSettings(next)).toEqual(next);
      const full=validateThreeSettings({...threeDefaults,nebula:next});
      expect(full.nebula).toEqual(next);
      expect(full.galaxy).toEqual(threeDefaults.galaxy);
      expect(full.particle).toEqual(threeDefaults.particle);
    }
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('rejects invalid color, unknown preset and unbounded GPU values',()=>{
    expect(()=>validateNebulaSettings({...nebulaDefaults,colorA:'red'})).toThrow();
    expect(()=>validateNebulaSettings({...nebulaDefaults,preset:'mystery'})).toThrow();
    expect(()=>validateNebulaSettings({...nebulaDefaults,scale:1000})).toThrow();
    expect(()=>validateNebulaSettings({...nebulaDefaults,driftSpeed:-1})).toThrow();
    expect(validateNebulaSettings({...nebulaDefaults,preset:'custom',colorB:'#112233'}).colorB).toBe('#112233');
  });
});
