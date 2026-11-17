import {seededRandom,type Scene} from './scene';

export type FigureMotionPlan={
  id:string;x:number;y:number;floatX:number;floatY:number;spin:number;
  frequency:number;phaseX:number;phaseY:number;phaseSpin:number;
};

/** Generate once per scene/seed. This never modifies a generated v4/v5
 * composition, its IDs or any contours, so saved seed artwork is unchanged.
 * All motion is an external SVG group transform around the original center.
 */
export function createFigureMotionPlan(scene:Scene,seed:string):FigureMotionPlan[]{
  const canvas=Math.min(scene.width,scene.height);
  const classic=scene.version==='2d-v4';
  return scene.shapes.map(shape=>{
    const random=seededRandom('finished-2d-motion:'+seed+':'+shape.id);
    const role=shape.role==='hero'?1.1:shape.role==='support'?1:shape.role==='accent'?.8:.55;
    const magnitude=classic?1.25:1;
    const base=Math.min(canvas*.012,shape.size*.085)*role*magnitude;
    return {
      id:shape.id,x:shape.x,y:shape.y,
      floatX:base*(.6+.5*random()),
      floatY:base*(.6+.5*random()),
      spin:(shape.role==='hero'?4.2:shape.role==='support'?3.2:2.1)*magnitude,
      frequency:(shape.role==='hero'?.31:.47)*(.75+random()*.6),
      phaseX:random()*Math.PI*2,
      phaseY:random()*Math.PI*2,
      phaseSpin:random()*Math.PI*2,
    };
  });
}
const rounded=(number:number)=>Number(number.toFixed(4));

/** Pure seconds -> transform mapping, shared by live preview and video.
 * Ease in from the exact completed static pose; no teleport at 100%, no
 * accumulated float error, and no mutation when paused or seeking.
 */
export function figureMotionAt(
  plan:readonly FigureMotionPlan[],seconds:number,strength=100,speed=1,
):Record<string,string>{
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(strength)||
    strength<=0||!Number.isFinite(speed)||speed<=0)return {};
  const elapsed=Math.max(0,seconds)*speed;
  const enter=Math.min(1,elapsed/1.4);
  const ramp=enter*enter*(3-2*enter);
  const power=Math.min(2,Math.max(0,strength/100))*ramp;
  const transforms:Record<string,string>={};
  for(const item of plan){
    const wave=elapsed*item.frequency;
    const dx=rounded(item.floatX*power*Math.sin(wave+item.phaseX));
    const dy=rounded(item.floatY*power*Math.sin(wave*.83+item.phaseY));
    const angle=rounded(item.spin*power*Math.sin(wave*.7+item.phaseSpin));
    transforms[item.id]=`translate(${dx} ${dy}) rotate(${angle} ${item.x} ${item.y})`;
  }
  return transforms;
}
