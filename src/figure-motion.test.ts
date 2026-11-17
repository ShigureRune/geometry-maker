import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {generateScene,type Background} from './scene';
import {shapeBounds} from './geometry';
import {Preview} from './Preview';
import {createFigureMotionPlan,figureFlowAt,isMovingBar} from './figure-motion';
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

it('moves whole v4 bars without moving the root pose and spins the dotted secondary arc',()=>{
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
  expect(first[bar!.id].barShift).not.toBe(later[bar!.id].barShift);
  expect(figureFlowAt(plan,0)).toEqual({});
  expect(figureFlowAt(plan,.001)[bar!.id].barShift).toBeGreaterThan(0);
  expect(figureFlowAt(plan,.001)[bar!.id].barShift).toBeLessThan(1);

  const base=renderToStaticMarkup(createElement(Preview,{scene,background}));
  const animated=renderToStaticMarkup(createElement(Preview,{scene,background,flow:first}));
  const laterMarkup=renderToStaticMarkup(createElement(Preview,{scene,background,flow:later}));
  expect(base).not.toContain('data-testid="bar-body-motion"');
  expect(animated).toContain('data-testid="bar-body-motion"');
  expect(animated).not.toContain('data-testid="bar-flow"');
  expect(animated).toContain(`data-bar-shift="${first[bar!.id].barShift}"`);
  expect(laterMarkup).toContain(`data-bar-shift="${later[bar!.id].barShift}"`);
  expect(animated).toContain(`transform="rotate(${first[arc!.id].spin})"`);
  expect(laterMarkup).toContain(`transform="rotate(${later[arc!.id].spin})"`);
  const transforms=(svg:string)=>[...svg.matchAll(/data-shape-id="([^"]+)"[^>]+transform="([^"]+)"/g)]
    .map(m=>[m[1],m[2]]);
  expect(transforms(animated)).toEqual(transforms(base));
  expect(transforms(laterMarkup)).toEqual(transforms(base));
});

it('keeps v5 filled rectangles rigid, and stops bar motion when disabled',()=>{
  const scene=generateScene('v5-bar-moving','16:9','2d-v5');
  // Minimal explicit rectangle guarantees the behavior regardless of seed layouts.
  const rectangle={...scene.shapes[0],id:'test-moving-rectangle',kind:'rectangle' as const,
    role:'support' as const,filled:true,thickness:40,size:160};
  const target={...scene,shapes:[rectangle]};
  const plan=createFigureMotionPlan(target,'v5-bar-moving');
  const first=figureFlowAt(plan,1.3);
  const second=figureFlowAt(plan,3.6);
  expect(plan).toHaveLength(1);
  expect(first[rectangle.id].barShift).not.toBe(second[rectangle.id].barShift);
  const animated=renderToStaticMarkup(createElement(Preview,{scene:target,background,flow:first}));
  expect(animated).toContain('data-testid="bar-body-motion"');
  expect(animated).not.toContain('data-testid="bar-flow"');
  const noMotion=renderToStaticMarkup(createElement(Preview,{scene:target,background,flow:figureFlowAt(plan,2,0)}));
  expect(noMotion).not.toContain('data-testid="bar-body-motion"');
});

it('moves thick and thin bars simultaneously in one fixed direction without reversal',()=>{
  const seed='synchronous-bars';
  const original=generateScene(seed,'16:9','2d-v4');
  const thick={...original.shapes[0],id:'thick-band',kind:'band' as const,
    role:'support' as const,filled:true,size:125,x:370,y:340,rotation:0,thickness:28};
  const thin={...thick,id:'thin-line',kind:'line' as const,
    role:'decoration' as const,filled:false,size:90,x:400,y:450,rotation:95};
  const skinnyRectangle={...thick,id:'tiny-strip',kind:'rectangle' as const,
    role:'decoration' as const,size:25,thickness:6,x:490,y:390};
  const scene={...original,shapes:[thick,thin,skinnyRectangle]};
  expect(isMovingBar(thick)).toBe(true);
  expect(isMovingBar(thin)).toBe(true);
  expect(isMovingBar(skinnyRectangle)).toBe(true);
  const plan=createFigureMotionPlan(scene,seed);
  expect(plan.map(p=>p.id)).toEqual(['thick-band','thin-line','tiny-strip']);
  expect(new Set(plan.map(p=>[p.barDirectionX,p.barDirectionY].join(','))).size).toBe(1);
  const t1=figureFlowAt(plan,1),t2=figureFlowAt(plan,2),t3=figureFlowAt(plan,3);
  for(const item of plan){
    const a=t1[item.id],b=t2[item.id],c=t3[item.id];
    expect(a.barShift).toBeGreaterThan(0);
    expect(b.barShift).toBeGreaterThan(a.barShift);
    expect(c.barShift).toBeGreaterThan(b.barShift);
    expect(b.barDx-a.barDx).toBeCloseTo(item.barSpeed*item.barDirectionX,3);
    expect(b.barDy-a.barDy).toBeCloseTo(item.barSpeed*item.barDirectionY,3);
  }
  expect(t1[thick.id].barDx).toBe(t1[thin.id].barDx);
  expect(t1[thick.id].barDy).toBe(t1[thin.id].barDy);
  expect(t1[thin.id].barDx).toBe(t1[skinnyRectangle.id].barDx);
  const svg=renderToStaticMarkup(createElement(Preview,{scene,background,flow:t2}));
  expect((svg.match(/data-testid="bar-body-motion"/g)??[]).length).toBe(3);
  expect(svg).not.toContain('data-testid="bar-flow"');
  // Even a rotated line receives the same world-space displacement.
  const lineSvg=svg.match(/data-kind="line".*?data-bar-world-x="([^"]+)" data-bar-world-y="([^"]+)"/);
  expect(lineSvg).not.toBeNull();
  expect(Number(lineSvg![1])).toBeCloseTo(t2[thick.id].barDx,3);
  expect(Number(lineSvg![2])).toBeCloseTo(t2[thick.id].barDy,3);
});

it('wraps bars only when FULLY outside the viewport and never reverses visibly',()=>{
  const seed='invisible-offscreen-wrap',scene0=generateScene(seed,'16:9','2d-v4');
  const shape={...scene0.shapes[0],id:'edge-band',kind:'band' as const,
    role:'support' as const,filled:true,x:700,y:420,size:170,rotation:13,thickness:38};
  const scene={...scene0,shapes:[shape]};
  const plan=createFigureMotionPlan(scene,seed);
  expect(plan).toHaveLength(1);
  const item=plan[0],bounds=shapeBounds(shape);
  const outside=(s:number)=> {
    const x=s*item.barDirectionX,y=s*item.barDirectionY;
    return bounds.x+x>scene.width||bounds.x+bounds.width+x<0||
      bounds.y+y>scene.height||bounds.y+bounds.height+y<0;
  };
  // Entry and exit positions overlap in time only while both are invisible.
  expect(outside(item.barExit-.001)).toBe(true);
  expect(outside(-item.barEntry+.001)).toBe(true);
  const before=figureFlowAt(plan,(item.barExit-.001)/item.barSpeed)[shape.id];
  const after=figureFlowAt(plan,(item.barExit+.001)/item.barSpeed)[shape.id];
  expect(before.barShift).toBeCloseTo(item.barExit-.001,3);
  expect(after.barShift).toBeCloseTo(-item.barEntry+.001,3);
  expect(outside(before.barShift)).toBe(true);
  expect(outside(after.barShift)).toBe(true);
  // A single duration-scaled clock controls video and live preview identically.
  expect(figureFlowAt(plan,2,100,2)).toEqual(figureFlowAt(plan,4,100,1));
  expect(figureFlowAt(plan,3,0)).toEqual({});
});

it('keeps overlay highlight lines and arcs static while ordinary thin bars move',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
    const seed='stationary-highlight-'+version;
    const original=generateScene(seed,'16:9',version);
    const bar={...original.shapes[0],id:'moving-thick',kind:'band' as const,
      role:'support' as const,filled:true,x:400,y:380,size:140,rotation:20,thickness:38};
    const fine={...bar,id:'moving-thin',kind:'line' as const,
      role:'support' as const,filled:false,size:100,rotation:70};
    const highlight={...bar,id:'overlay-highlight-line',kind:'line' as const,
      role:'accent' as const,layer:'foreground' as const,glow:true,
      filled:false,size:110,points:[{x:0,y:0},{x:100,y:0}]};
    const highlightArc={...highlight,id:'overlay-highlight-arc',kind:'arc' as const,
      points:undefined,arcStart:-120,arcSweep:80,rings:1};
    const scene={...original,shapes:[bar,fine,highlight,highlightArc]};
    expect(isMovingBar(bar)).toBe(true);
    expect(isMovingBar(fine)).toBe(true);
    expect(isMovingBar(highlight)).toBe(false);
    expect(isMovingBar(highlightArc)).toBe(false);
    const plan=createFigureMotionPlan(scene,seed);
    expect(plan.map(p=>p.id)).toEqual(['moving-thick','moving-thin']);
    const flow1=figureFlowAt(plan,1.5),flow2=figureFlowAt(plan,3);
    const base=renderToStaticMarkup(createElement(Preview,{scene,background}));
    const animated=renderToStaticMarkup(createElement(Preview,{scene,background,flow:flow1}));
    const later=renderToStaticMarkup(createElement(Preview,{scene,background,flow:flow2}));
    expect((animated.match(/data-testid="bar-body-motion"/g)??[]).length).toBe(2);
    const transformOf=(markup:string,id:string)=>markup.match(new RegExp(
      'data-shape-id="'+id+'"[^>]*transform="([^"]+)"'))?.[1];
    for(const h of [highlight,highlightArc]){
      expect(flow1[h.id]).toBeUndefined();
      expect(transformOf(animated,h.id)).toBe(transformOf(base,h.id));
      expect(transformOf(later,h.id)).toBe(transformOf(base,h.id));
      const start=animated.indexOf('data-shape-id="'+h.id+'"');
      expect(start).toBeGreaterThan(-1);
      const fragment=animated.slice(start,animated.indexOf('</g>',start)+4);
      expect(fragment).not.toContain('data-testid="bar-body-motion"');
      expect(fragment).not.toContain('data-testid="figure-flow"');
    }
    expect(flow2[bar.id].barShift).toBeGreaterThan(flow1[bar.id].barShift);
    expect(flow2[fine.id].barShift).toBeGreaterThan(flow1[fine.id].barShift);
  }
});

it('does not move actual generated v4/v5 accent highlights regardless of the seed',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
    const seed='postgrowth-bar-and-arc';
    const scene=generateScene(seed,'16:9',version);
    const highlights=scene.shapes.filter(s=>s.role==='accent');
    expect(highlights.length).toBeGreaterThan(0);
    const plan=createFigureMotionPlan(scene,seed);
    const ids=new Set(plan.map(p=>p.id));
    for(const highlight of highlights){
      expect(isMovingBar(highlight)).toBe(false);
      expect(ids.has(highlight.id)).toBe(false);
    }
  }
});

it('adds softly feathered LCD-like white sheen only to moving bars, preserving motion and palette',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
    const seed='soft-white-sheen-'+version;
    const original=generateScene(seed,'16:9',version);
    const thick={...original.shapes[0],id:'thick-soft',kind:'band' as const,
      role:'support' as const,filled:true,size:160,x:400,y:340,rotation:25,thickness:36};
    const thin={...thick,id:'thin-soft',kind:'line' as const,
      role:'support' as const,filled:false,size:110,x:480,y:460,rotation:75};
    const overlay={...thin,id:'fixed-edge-highlight',role:'accent' as const,
      layer:'foreground' as const,glow:true};
    const scene={...original,shapes:[thick,thin,overlay]};
    const plan=createFigureMotionPlan(scene,seed);
    const t1=figureFlowAt(plan,1.5),t2=figureFlowAt(plan,3);
    const base=renderToStaticMarkup(createElement(Preview,{scene,background}));
    const glow1=renderToStaticMarkup(createElement(Preview,{scene,background,flow:t1}));
    const glow2=renderToStaticMarkup(createElement(Preview,{scene,background,flow:t2}));
    expect(base).not.toContain('data-testid="bar-soft-sheen"');
    for(const svg of [glow1,glow2]){
      expect((svg.match(/data-testid="bar-soft-sheen"/g)??[]).length).toBe(2);
      expect((svg.match(/data-testid="bar-soft-feather"/g)??[]).length).toBe(2);
      expect((svg.match(/data-testid="bar-body-motion"/g)??[]).length).toBe(2);
      expect(svg).toContain('feGaussianBlur');
      expect(svg).toContain('stop-color="#ffffff"');
      expect(svg).toContain('stop-opacity="0"');
      expect(svg).toContain('stop-color="black"');
      expect(svg).toContain('data-bar-world-x="');
      const overlayIndex=svg.indexOf('data-shape-id="fixed-edge-highlight"');
      expect(overlayIndex).toBeGreaterThan(0);
      const overlaySection=svg.slice(overlayIndex,svg.indexOf('</g>',overlayIndex)+4);
      expect(overlaySection).not.toContain('bar-soft-sheen');
      expect(overlaySection).not.toContain('bar-body-motion');
    }
    expect(t2[thick.id].barShift).toBeGreaterThan(t1[thick.id].barShift);
    expect(t2[thin.id].barShift).toBeGreaterThan(t1[thin.id].barShift);
    // The moving white gradient progresses independently of the whole-bar translation.
    expect(glow1).not.toBe(glow2);
    const noFlow=renderToStaticMarkup(createElement(Preview,{scene,background,
      flow:figureFlowAt(plan,3,0)}));
    expect(noFlow).not.toContain('data-testid="bar-soft-sheen"');
  }
});
