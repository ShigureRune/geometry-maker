import {contoursOf,shapeBounds,worldPoint} from './geometry';
import {seededRandom,type Scene,type Shape} from './scene';

/** Thick bands, ordinary thin line strokes and narrow rectangular strips move
 * as whole shapes in ONE common direction after growth. Accent-role figures
 * are static highlights painted ON TOP of other geometry: never move them. */
export const isMovingBar=(shape:Shape):boolean=>
  shape.role!=='accent' &&
  (shape.kind==='band'||shape.kind==='line'||shape.kind==='rectangle');

/** Spin only self-contained figures; connectors, sliding bars and fixed
 * accent marks must retain their original world-space positions. */
const ROTOR_KINDS:ReadonlySet<Shape['kind']>=new Set([
  'frame','arc','triangle','diamond','circle','gear','hexagon','pentagon',
  'octagon','star','concentric','shield','compound','sector','crescent','linked',
]);
export const isCoupledRotor=(shape:Shape):boolean=>
  (shape.role==='hero'||(shape.role==='support'&&
    (shape.layer!=='background'||shape.kind==='arc')))&&ROTOR_KINDS.has(shape.kind);

/** Authored hero circuits are synchronized within a small seeded fan-out.
 * A real connector still carries each pulse to its existing child. */
export type EnergyRelay={
  sourceId:string;targetId?:string;period:number;phase:number;branchCount?:number;
};
export type FigureMotionPlan={
  id:string;phase:number;frequency:number;tailLength:number;headLength:number;
  intensity:number;
  spinSpeed:number;coupledSpinSpeed?:number;
  barSpeed:number;barExit:number;barEntry:number;barDirectionX:number;barDirectionY:number;
  relay?:EnergyRelay;arrival?:EnergyRelay;mergeRelays?:readonly EnergyRelay[];
};
export type FigureFlowState={
  offset:number;tailLength:number;headLength:number;opacity:number;
  spin:number;coupledSpin?:number;
  barShift:number;barDx:number;barDy:number;
  relayEnabled?:boolean;relayProgress?:number;relaySource?:number;relayArrival?:number;arrivalPulse?:number;
  branchPulse?:number;mergePulse?:number;
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
  // Every connected rotor inherits the SAME seeded hero drive. The orbiting
  // children turn in the opposite direction, scaled by their size like gears.
  // Walk real parent links (including fixed circuits), never guessed proximity.
  const byId=new Map(scene.shapes.map(shape=>[shape.id,shape]));
  const heroDrives=new Map(scene.shapes.filter(shape=>shape.role==='hero').map(hero=>{
    const random=seededRandom('2d-coupled-rotation:'+seed+':'+hero.id);
    return [hero.id,(random()<.5?-1:1)*(8+random()*7)] as const;
  }));
  const connectedHero=(shape:Shape):Shape|undefined=>{
    const visited=new Set<string>();
    let current:Shape|undefined=shape;
    while(current&&!visited.has(current.id)){
      if(current.role==='hero')return current;
      visited.add(current.id);
      current=current.parent?byId.get(current.parent):undefined;
    }
    return undefined;
  };
  // Use ONLY the scene's real parent relationships. No imaginary connecting
  // segments and no mutation of the generated art. Cap each hero's routes so
  // dense v5 scenes do not add dozens of animated filters.
  const relays=new Map<string,EnergyRelay>();
  const arrivals=new Map<string,EnergyRelay>();
  const routes:{shape:Shape;relay:EnergyRelay;end:{x:number;y:number}}[]=[];
  for(const hero of scene.shapes.filter(s=>s.role==='hero')){
    const connections=scene.shapes.filter(s=>s.parent===hero.id &&
      (s.kind==='circuit'||s.kind==='branch-circuit') && s.role!=='accent')
      .sort((a,b)=>a.id.localeCompare(b.id)).slice(0,6);
    const random=seededRandom('2d-energy-relay:'+seed+':'+hero.id);
    const period=4.8+random()*1.8;
    const sharedPhase=random()*.9;
    connections.forEach((connector,i)=>{
      const child=scene.shapes.filter(s=>s.parent===connector.id &&
        s.role!=='accent').sort((a,b)=>a.id.localeCompare(b.id))[0];
      const relay:EnergyRelay={
        sourceId:hero.id,targetId:child?.id,period,
        // Small offsets make simultaneous packets visibly fork instead of
        // sending unrelated pulses down every branch.
        phase:(sharedPhase+i*.012+random()*.004)%1,
        branchCount:connections.length,
      };
      relays.set(connector.id,relay);
      if(child)arrivals.set(child.id,relay);
      const contour=contoursOf(connector)[0];
      if(contour?.points.length)routes.push({
        shape:connector,relay,
        end:worldPoint(connector,contour.points.at(-1)!),
      });
    });
  }
  // A merger exists only when two ORIGINAL circuit endpoints meet. Never
  // synthesize connecting geometry or infer a link from parent IDs alone.
  const merges=new Map<string,readonly EnergyRelay[]>();
  const assigned=new Set<string>();
  const tolerance=Math.min(scene.width,scene.height)*.008;
  for(const route of routes){
    if(assigned.has(route.shape.id))continue;
    const meeting=routes.filter(other=>!assigned.has(other.shape.id)&&
      Math.hypot(other.end.x-route.end.x,other.end.y-route.end.y)<=tolerance);
    if(meeting.length<2)continue;
    meeting.forEach(part=>assigned.add(part.shape.id));
    // Draw the confluence bloom exactly once, attached to the first
    // authored terminal. Each branch retains its own terminal/child pulse.
    merges.set(route.shape.id,meeting.map(part=>part.relay));
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
    const hero=isCoupledRotor(shape)?connectedHero(shape):undefined;
    const drive=hero===undefined?undefined:heroDrives.get(hero.id);
    const coupledSpinSpeed=drive===undefined?undefined:hero!.id===shape.id?drive:
      -drive*Math.min(2.4,Math.max(.75,hero!.size/Math.max(1,shape.size)));
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
      ...(coupledSpinSpeed===undefined?{}:{coupledSpinSpeed}),
      barSpeed:bar?barSpeed:0,
      barExit:bounds?outOfViewDistance(bounds,scene.width,scene.height,dx,dy,padding):0,
      barEntry:bounds?outOfViewDistance(bounds,scene.width,scene.height,-dx,-dy,padding):0,
      barDirectionX:dx,barDirectionY:dy,
      relay:relays.get(shape.id),arrival:arrivals.get(shape.id),
      mergeRelays:merges.get(shape.id),
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
    const arriving=item.mergeRelays?.map(relay=>
      bell(((elapsed/relay.period+relay.phase)%1+1)%1,.72,.94))
      .sort((a,b)=>b-a);
    // A merge bloom requires two actual, simultaneous arrivals. The second
    // brightest packet gates the glow so solitary signals never fake a merge.
    const merge=arriving&&arriving.length>1
      ?Math.min(1,arriving[1]*.8+arriving[0]*.2):undefined;
    return [item.id,{
      offset:rounded(-phase),
      tailLength:rounded(item.tailLength),
      headLength:rounded(item.headLength),
      opacity:rounded(Math.min(1,intensity*fade*item.intensity)),
      spin:rounded((elapsed*item.spinSpeed)%360),
      ...(item.coupledSpinSpeed===undefined?{}:{
        coupledSpin:rounded((elapsed*item.coupledSpinSpeed)%360),
      }),
      barShift:rounded(shift),
      barDx:rounded(shift*item.barDirectionX),
      barDy:rounded(shift*item.barDirectionY),
      ...(source===undefined?{}:{relayEnabled:true,relaySource:rounded(source*intensity*fade)}),
      ...(item.relay&&item.relay.branchCount&&item.relay.branchCount>1
        ?{branchPulse:rounded((source??0)*intensity*fade)}:{}),
      ...(merge===undefined?{}:{mergePulse:rounded(merge*intensity*fade)}),
      ...(progressOnLink===undefined?{}:{relayProgress:rounded(progressOnLink)}),
      ...(terminal===undefined?{}:{relayArrival:rounded(terminal*intensity*fade)}),
      ...(arrival===undefined?{}:{arrivalPulse:rounded(arrival*intensity*fade)}),
    }];
  }));
}
