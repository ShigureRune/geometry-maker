import {it,expect} from 'vitest';
import {EASINGS,ease,schedule,progressAt,animationSettings,MOTION_PRESETS,motionPresetParameters} from './animation';
import {generateScene} from './scene';
import {densityCandidates} from './density';
it('easing is continuous, monotonic and has correct endpoints',()=>{for(const e of EASINGS){expect(ease(0,e)).toBe(0);expect(ease(1,e)).toBe(1);let last=0;for(let i=1;i<=1000;i++){const p=ease(i/1000,e);expect(p).toBeGreaterThanOrEqual(last);expect(p-last).toBeLessThan(.005);last=p;}}expect(ease(.25,'ease-out-in')).toBe(.375);expect(ease(.75,'ease-out-in')).toBe(.625);});
it('growth is deterministic, parent ordered and density independent',()=>{for(const seed of ['neon-city','001','undefined-heartbeat']){const shapes=densityCandidates(generateScene(seed,'16:9'),seed);const a=schedule(shapes,seed);expect(schedule(shapes,seed)).toEqual(a);for(const s of shapes){expect(progressAt(a[s.id],0,'linear')).toBe(0);expect(progressAt(a[s.id],1,'linear')).toBe(1);if(s.parent)expect(a[s.id].start).toBeGreaterThan(a[s.parent].start);}}});
it('validates settings and legacy defaults',()=>{expect(animationSettings({}).animationEnabled).toBe(false);for(const d of [{animationDuration:0},{animationDuration:31},{playbackSpeed:5},{easingType:'bad'},{animationEnabled:'true'}])expect(()=>animationSettings(d)).toThrow();});
it('keeps standard and legacy post-growth motion identical; presets are deterministic',()=>{
 const old=animationSettings({motionStrength:100,motionSpeed:1.5});
 expect(old.motionPreset).toBeUndefined();
 expect(motionPresetParameters(old)).toEqual({strength:100,speed:1.5});
 expect(motionPresetParameters({...old,motionPreset:'standard'})).toEqual({strength:100,speed:1.5});
 expect(MOTION_PRESETS).toEqual(['standard','gentle','dynamic']);
 expect(motionPresetParameters({...old,motionPreset:'gentle'})).toEqual({strength:65,speed:.975});
 expect(motionPresetParameters({...old,motionPreset:'dynamic'})).toEqual({strength:130,speed:2.025});
 expect(motionPresetParameters({...old,motionStrength:200,motionPreset:'dynamic'}).strength).toBe(200);
 expect(motionPresetParameters({...old,motionStrength:0,motionPreset:'gentle'}).strength).toBe(0);
 for(const invalid of ['broken',null,42,false,{}]){
   expect(()=>animationSettings({motionPreset:invalid})).toThrow();
 }
});
