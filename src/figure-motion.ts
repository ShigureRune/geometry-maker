import {shapeBounds} from './geometry';
import {seededRandom,type Scene,type Shape} from './scene';

/** Thick bands, ordinary thin line strokes and narrow rectangular strips move
 * as whole shapes in ONE common direction after growth. Accent-role figures
 * are static highlights painted ON TOP of other geometry: never move them. */
export const isMovingBar=(shape:Shape):boolean=>
  shape.role!=='accent' &&
  (shape.kind==='band'||shape.kind==='line'||shape.kind==='rectangle');

/** A real parent/child connection: energy is emitted at the hero-side start,
 * travels down the authored circuit, then illuminates the terminal and its
 * actual child figure. Every route has a deterministic seeded timing phase. */
export type EnergyRelay={
  sourceId:string;targetId?:string;period:number;phase:number;
};
export type FigureMotionPlan={
  id:string;phase:number;frequency:number;tailLength:number;headLength:number;
  intensity:number;
  spinSpeed:number;
  barSpeed:number;barExit:number;barEntry:number;barDirectionX:number;barDirectionY:number;
  relay?:EnergyRelay;arrival?:EnergyRelay;
};
export type FigureFlowState={
  offset:number;tailLength:number;headLength:number;opacity:number;
  spin:number;
  barShift:number;barDx:number;barDy:number;
  relayEnabled?:boolean;relayProgress?:number;relaySource?:number;relayArrival?:number;arrivalPulse?:number;
};
const rounded=(n:number)=>Number(n.toFixed(5));

/** Distance required to move an entire bounding box beyond ANY viewport edge
 * in the given direction. Padding hides stroke and blur before the wrap.
 * Wrapping only occurs while the shape is fully outside the viewBox. */
function outOfViewDistance(
  bounds:ReturnType<typeof shapeBounds>,width:number,height:number,
  dx:number,dy:number,padding:number,
):number {
  const exitDistances:number[]=[];
  if(dx>1e-6)exitDistances.push((width+padding-bounds.x)/dx);
  else if(dx< -1e-6)exitDistances.push((bounds.x+bounds.width+padding)/-dx);
  if(dy>1e-6)exitDistances.push((height+padding-bounds.y)/dy);
  else if(dy< -1e-6)exitDistances.push((bounds.y+bounds.height+padding)/-dy);
  return Math.max(0.1,Math.min(...exitDistances));
}

export function createFigureMotionPlan(scene:Scene,seed:string):FigureMotionPlan[]{
  const angle=scene.composition.direction*Math.PI/180;
  // One world-space direction and velocity for thick AND thin bars, regardless
  // of each shape's own rotation. No individual randomized backward motion.
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const barSpeed=Math.min(scene.width,scene.height)*(scene.version==='2d-v4'?.11:.09);
  const padding=Math.min(scene.width,scene.height)*.09;
  // Use ONLY the scene's real parent relationships. No imaginary connecting
  // segments and no mutation of the generated art. Cap each hero's routes so
  // dense v5 scenes do not add dozens of animated filters.
  const relays=new Map<string,EnergyRelay>();
  const arrivals=new Map<string,EnergyRelay>();
  for(const hero of scene.shapes.filter(s=>s.role==='hero')){
    const connections=scene.shapes.filter(s=>s.parent===hero.id &&
      (s.kind==='circuit'||s.kind==='branch-circuit') && s.role!=='accent')
      .sort((a,b)=>a.id.localeCompare(b.id)).slice(0,6);
    const random=seededRandom('2d-energy-relay:'+seed+':'+hero.id);
    const period=4.8+random()*1.8;
    connections.forEach((connector,i)=>{
      const child=scene.shapes.filter(s=>s.parent===connector.id &&
        s.role!=='accent').sort((a,b)=>a.id.localeCompare(b.id))[0];
      const relay:EnergyRelay={
        sourceId:hero.id,targetId:child?.id,period,
        phase:(i/connections.length*.82+random()*.08)%1,
      };
      relays.set(connector.id,relay);
      if(child)arrivals.set(child.id,relay);
    });
  }
  return scene.shapes.flatMap(shape=>{
    // Highlight lines/arcs are separate overlay shapes with role=accent.
    // They must keep their original world position as the rods pass beneath.
    if(shape.role==='accent')return [];
    const bar=isMovingBar(shape);
    // Even decoration-classified thin strips move, but skip other tiny
    // decorations to avoid hundreds of useless glowing tracer elements.
    if(!bar&&!arrivals.has(shape.id)&&(shape.role==='decoration'||['dot','dots','accent'].includes(shape.kind)))
      return [];
    const random=seededRandom('finished-2d-flow:'+seed+':'+shape.id);
    const classic=scene.version==='2d-v4';
    const role=shape.role==='hero'?1:shape.role==='support'?.85:.72;
    const bounds=bar?shapeBounds(shape):undefined;
    return [{
      id:shape.id,
      phase:random(),
      frequency:(classic?.43:.32)*(.75+random()*.7),
      tailLength:(classic?.18:.14)+random()*.085,
      headLength:.035+random()*.025,
      intensity:role,
      spinSpeed:(classic?17:12)*(0.75+random()*.5)*(random()>.5?1:-1),
      barSpeed:bar?barSpeed:0,
      barExit:bounds?outOfViewDistance(bounds,scene.width,scene.height,dx,dy,padding):0,
      barEntry:bounds?outOfViewDistance(bounds,scene.width,scene.height,-dx,-dy,padding):0,
      barDirectionX:dx,barDirectionY:dy,
      relay:relays.get(shape.id),arrival:arrivals.get(shape.id),
    }];
  });
}

/** Deterministic post-growth clock shared by live preview and video frames.
 * Bar distance only increases, then restarts on the OTHER, invisible side
 * once the complete figure has left the screen. No sine-wave reversal.
 * Starting at t=0 preserves the original generated composition.
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
    const travel=elapsed*item.barSpeed;
    const cycle=item.barExit+item.barEntry;
    // Only wrap after travelling the whole visible forward distance.
    const shift=item.barSpeed===0?0:travel<item.barExit?travel:
      ((travel-item.barExit)%cycle)-item.barEntry;
    const relayPhase=item.relay?
      ((elapsed/item.relay.period+item.relay.phase)%1+1)%1:undefined;
    const arrivalPhase=item.arrival?
      ((elapsed/item.arrival.period+item.arrival.phase)%1+1)%1:undefined;
    const bell=(phase:number,start:number,end:number)=>
      phase>start&&phase<end?Math.sin(Math.PI*(phase-start)/(end-start))**2:0;
    // First the hero-side junction lights up, then the signal crosses the
    // connection, and only AFTER the signal arrives does the terminal pulse.
    const source=relayPhase===undefined?undefined:bell(relayPhase,.12,.31);
    const progressOnLink=relayPhase!==undefined&&relayPhase>=.27&&relayPhase<.74
      ?(relayPhase-.27)/.47:undefined;
    const terminal=relayPhase===undefined?undefined:bell(relayPhase,.72,.94);
    const arrival=arrivalPhase===undefined?undefined:bell(arrivalPhase,.72,.94);
    return [item.id,{
      offset:rounded(-phase),
      tailLength:rounded(item.tailLength),
      headLength:rounded(item.headLength),
      opacity:rounded(Math.min(1,intensity*fade*item.intensity)),
      spin:rounded((elapsed*item.spinSpeed)%360),
      barShift:rounded(shift),
      barDx:rounded(shift*item.barDirectionX),
      barDy:rounded(shift*item.barDirectionY),
      ...(source===undefined?{}:{relayEnabled:true,relaySource:rounded(source*intensity*fade)}),
      ...(progressOnLink===undefined?{}:{relayProgress:rounded(progressOnLink)}),
      ...(terminal===undefined?{}:{relayArrival:rounded(terminal*intensity*fade)}),
      ...(arrival===undefined?{}:{arrivalPulse:rounded(arrival*intensity*fade)}),
    }];
  }));
}
