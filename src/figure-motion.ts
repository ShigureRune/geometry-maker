import {seededRandom,type Scene} from './scene';

/** The completed figures keep their original coordinates. A seeded luminous
 * pulse travels along each SVG contour, never moving the figure itself.
 * The plan is computed once per scene, not once per animation frame.
 */
export type FigureMotionPlan={
  id:string;phase:number;frequency:number;tailLength:number;headLength:number;
  intensity:number;
  spinSpeed:number; // degrees per second; rotating dashed arc stays inside its own figure
};
export type FigureFlowState={
  offset:number;tailLength:number;headLength:number;opacity:number;
  spin:number; // starts at zero so dashed arcs never jump after growth
};
const rounded=(n:number)=>Number(n.toFixed(5));
export function createFigureMotionPlan(scene:Scene,seed:string):FigureMotionPlan[]{
  return scene.shapes.flatMap(shape=>{
    // Dots have no visible stroke to follow. Tiny decorations would turn
    // into noise when hundreds of elements flash at once.
    if(shape.role==='decoration'||['dot','dots','accent'].includes(shape.kind))
      return [];
    const random=seededRandom('finished-2d-flow:'+seed+':'+shape.id);
    const classic=scene.version==='2d-v4';
    const role=shape.role==='hero'?1:shape.role==='support'?.85:.72;
    return [{
      id:shape.id,
      phase:random(),
      frequency:(classic?.43:.32)*(.75+random()*.7),
      tailLength:(classic?.18:.14)+random()*.085,
      headLength:.035+random()*.025,
      intensity:role,
      spinSpeed:(classic?17:12)*(0.75+random()*.5)*(random()>.5?1:-1),
    }];
  });
}

/** Pure time -> seamless dash progress, shared by SVG preview and video.
 * A one-second phase means one complete closed-path traversal. Negative
 * dash offsets travel forward; the modulo is seamless because the dash
 * pattern has a total normalized length of exactly 1.
 * Fade in from the original completed pose, with no jump at growth=100%.
 */
export function figureFlowAt(
  plan:readonly FigureMotionPlan[],seconds:number,strength=100,speed=1,
):Record<string,FigureFlowState>{
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(strength)||
    strength<=0||!Number.isFinite(speed)||speed<=0)return {};
  const elapsed=seconds*speed;
  const progress=Math.min(1,seconds/1.2);
  const fade=progress*progress*(3-2*progress);
  const intensity=Math.min(2,Math.max(0,strength/100));
  return Object.fromEntries(plan.map(item=>{
    const phase=((elapsed*item.frequency+item.phase)%1+1)%1;
    return [item.id,{
      offset:rounded(-phase),
      tailLength:rounded(item.tailLength),
      headLength:rounded(item.headLength),
      opacity:rounded(Math.min(1,intensity*fade*item.intensity)),
      spin:rounded((elapsed*item.spinSpeed)%360),
    }];
  }));
}
