import {expect,it} from 'vitest';
import {generateScene} from './scene';
import {createFigureMotionPlan,figureMotionAt} from './figure-motion';
import {animationSettings,animationVideoDuration,MOTION_DEFAULTS} from './animation';

it('animates real v4 classic figures after completion without mutating their seed geometry',()=>{
 const scene=generateScene('v4-motion-classic','16:9','2d-v4');
 const original=JSON.stringify(scene);
 const plan=createFigureMotionPlan(scene,'v4-motion-classic');
 expect(plan.length).toBe(scene.shapes.length);
 expect(createFigureMotionPlan(scene,'v4-motion-classic')).toEqual(plan);
 expect(figureMotionAt(plan,0)).toEqual({});
 const early=figureMotionAt(plan,.001),moving=figureMotionAt(plan,3);
 const later=figureMotionAt(plan,6);
 expect(early).not.toEqual(moving);
 expect(moving).not.toEqual(later);
 expect(Object.keys(moving)).toHaveLength(scene.shapes.length);
 expect(JSON.stringify(scene)).toBe(original);
 expect(plan.some(x=>x.spin>4)).toBe(true); // v4 main motifs are visibly dynamic
 for(const shape of scene.shapes){
   expect(moving[shape.id]).toMatch(/^translate\(-?[\d.]+ -?[\d.]+\) rotate\(-?[\d.]+ -?[\d.]+ -?[\d.]+\)$/);
 }
});

it('also animates v5, with zero-strength, invalid clocks, speed and seed determinism',()=>{
 const scene=generateScene('extended-motion','9:16','2d-v5');
 const plan=createFigureMotionPlan(scene,'extended-motion');
 expect(figureMotionAt(plan,1,0)).toEqual({});
 expect(figureMotionAt(plan,NaN)).toEqual({});
 expect(figureMotionAt(plan,-3)).toEqual({});
 expect(figureMotionAt(plan,1,100,2)).toEqual(figureMotionAt(plan,2,100,1));
 expect(figureMotionAt(plan,3)).toEqual(figureMotionAt(plan,3));
 expect(createFigureMotionPlan(scene,'another-seed')).not.toEqual(plan);
 expect(figureMotionAt(plan,2,200)).not.toEqual(figureMotionAt(plan,2,100));
});

it('limits video capture to finite seconds of motion after growth, preserving old files',()=>{
 const legacy={animationEnabled:true,animationDuration:6,playbackSpeed:2,easingType:'linear' as const};
 const normal=animationSettings(legacy);
 expect(normal).toEqual(legacy);
 expect(animationVideoDuration(normal,'2d-v4')).toBe(3);
 const moving={...normal,...MOTION_DEFAULTS};
 expect(animationVideoDuration(moving,'2d-v4')).toBe(11);
 expect(animationVideoDuration(moving,'2d-v5')).toBe(11);
 expect(animationVideoDuration(moving,'2d-magic-v1')).toBe(3);
 expect(animationVideoDuration({...moving,continuousMotion:false},'2d-v4')).toBe(3);
 expect(animationSettings(moving)).toEqual(moving);
 for(const invalid of [
   {continuousMotion:'yes'},{motionStrength:201},{motionStrength:NaN},
   {motionSpeed:0},{motionSpeed:4},{motionVideoSeconds:31},
   {motionVideoSeconds:-1},
 ])expect(()=>animationSettings(invalid)).toThrow();
});
