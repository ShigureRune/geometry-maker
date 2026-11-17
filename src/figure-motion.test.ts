import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {generateScene,type Background} from './scene';
import {Preview} from './Preview';
import {createFigureMotionPlan,figureFlowAt} from './figure-motion';
import {animationSettings,animationVideoDuration,MOTION_DEFAULTS} from './animation';

const background:Background={
  mode:'solid',solid:'#111526',colors:['#111526','#222e44','#334455'],
  angle:135,lineWidth:125,glowIntensity:40,
};

it('sends repeatable, continuous tracer pulses along classic v4 contours without moving any shape',()=>{
  const seed='v4-flow-classic',scene=generateScene(seed,'16:9','2d-v4');
  const original=JSON.stringify(scene);
  const plan=createFigureMotionPlan(scene,seed);
  expect(plan.length).toBeGreaterThan(3);
  expect(plan.length).toBeLessThanOrEqual(scene.shapes.length);
  expect(createFigureMotionPlan(scene,seed)).toEqual(plan);
  expect(figureFlowAt(plan,0)).toEqual({});
  const early=figureFlowAt(plan,.001),moving=figureFlowAt(plan,3);
  const later=figureFlowAt(plan,6);
  expect(early).not.toEqual(moving);
  expect(moving).not.toEqual(later);
  expect(Object.keys(moving)).toHaveLength(plan.length);
  expect(JSON.stringify(scene)).toBe(original);
  expect(plan.some(p=>p.frequency>.43)).toBe(true);
  for(const p of plan){
    const effect=moving[p.id];
    expect(effect.offset).toBeGreaterThanOrEqual(-1);
    expect(effect.offset).toBeLessThanOrEqual(0);
    expect(effect.tailLength+effect.headLength).toBeLessThan(1);
    expect(effect.opacity).toBeGreaterThan(0);
    expect(effect.opacity).toBeLessThanOrEqual(1);
  }
});

it('renders light streaks over the same base SVG outlines, never changing figure transforms',()=>{
  const seed='render-flow-v4';
  const scene=generateScene(seed,'16:9','2d-v4');
  const plan=createFigureMotionPlan(scene,seed);
  const base=renderToStaticMarkup(createElement(Preview,{scene,background}));
  const animated=renderToStaticMarkup(createElement(Preview,{scene,background,
    flow:figureFlowAt(plan,3)}));
  expect(base).not.toContain('data-testid="figure-flow"');
  expect(animated).toContain('data-testid="figure-flow"');
  expect(animated).toContain('stroke-dashoffset=');
  const transforms=(svg:string)=>[...svg.matchAll(/data-shape-id="([^"]+)"[^>]+transform="([^"]+)"/g)]
    .map(m=>[m[1],m[2]]);
  expect(transforms(animated)).toEqual(transforms(base));
  const baseCount=(base.match(/data-shape-id="/g)??[]).length;
  expect((animated.match(/data-shape-id="/g)??[]).length).toBe(baseCount);
});

it('supports v5, zero intensity, invalid times, speed scaling, and stable scene seed',()=>{
  const scene=generateScene('extended-flow','9:16','2d-v5');
  const plan=createFigureMotionPlan(scene,'extended-flow');
  expect(figureFlowAt(plan,1,0)).toEqual({});
  expect(figureFlowAt(plan,NaN)).toEqual({});
  expect(figureFlowAt(plan,-3)).toEqual({});
  expect(figureFlowAt(plan,2,100,2)).toEqual(figureFlowAt(plan,4,100,1));
  expect(figureFlowAt(plan,3)).toEqual(figureFlowAt(plan,3));
  expect(createFigureMotionPlan(scene,'different-seed')).not.toEqual(plan);
  expect(figureFlowAt(plan,2,200)).not.toEqual(figureFlowAt(plan,2,100));
  expect(figureFlowAt(plan,0.01)[plan[0].id].opacity)
    .toBeLessThan(figureFlowAt(plan,3)[plan[0].id].opacity);
});

it('keeps legacy settings intact and bounds post-growth video duration',()=>{
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

it('animates filled v4 bars internally and spins just the dotted secondary arc',()=>{
  const seed='postgrowth-bar-and-arc';
  const scene=generateScene(seed,'16:9','2d-v4');
  const bar=scene.shapes.find(s=>s.kind==='band'&&s.filled);
  const arc=scene.shapes.find(s=>s.kind==='arc'&&(s.rings??2)>1);
  expect(bar).toBeDefined();
  expect(arc).toBeDefined();
  const plan=createFigureMotionPlan(scene,seed);
  const first=figureFlowAt(plan,2);
  const later=figureFlowAt(plan,4);
  expect(first[bar!.id]).toBeDefined();
  expect(first[arc!.id]).toBeDefined();
  expect(first[arc!.id].spin).not.toBe(later[arc!.id].spin);
  expect(figureFlowAt(plan,.001)[arc!.id].spin).toBeCloseTo(0,1);
  expect(first[bar!.id].offset).not.toBe(later[bar!.id].offset);

  const base=renderToStaticMarkup(createElement(Preview,{scene,background}));
  const animated=renderToStaticMarkup(createElement(Preview,{scene,background,flow:first}));
  const laterMarkup=renderToStaticMarkup(createElement(Preview,{scene,background,flow:later}));
  expect(base).not.toContain('data-testid="bar-flow"');
  expect(animated).toContain('data-testid="bar-flow"');
  expect(animated).toContain(`transform="rotate(${first[arc!.id].spin})"`);
  expect(laterMarkup).toContain(`transform="rotate(${later[arc!.id].spin})"`);
  const transforms=(svg:string)=>[...svg.matchAll(/data-shape-id="([^"]+)"[^>]+transform="([^"]+)"/g)]
    .map(m=>[m[1],m[2]]);
  expect(transforms(animated)).toEqual(transforms(base));
  expect(transforms(laterMarkup)).toEqual(transforms(base));
});
