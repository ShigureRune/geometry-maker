import type {Note, Part} from './song';

/** Collision lanes are computed for the entire song, never from a changing visible window.
 * This prevents notes jumping sideways as the playhead moves or the roll is scrubbed. */
export type FallingLane = {index:number;count:number};
export type FallingLaneInput = {part:Part;note:Note};
export const fallingLaneKey = (part:Part,id:string) => part + ':' + id;

export function layoutFallingLanes(notes: readonly FallingLaneInput[]): Map<string,FallingLane> {
  const byPitch=new Map<number,FallingLaneInput[]>();
  for (const item of notes) {
    const row=byPitch.get(item.note.pitch);
    if (row) row.push(item);
    else byPitch.set(item.note.pitch,[item]);
  }
  const result=new Map<string,FallingLane>();
  for (const row of byPitch.values()) {
    row.sort((a,b)=>a.note.startTick-b.note.startTick ||
      a.note.durationTicks-b.note.durationTicks ||
      a.part.localeCompare(b.part) || a.note.id.localeCompare(b.note.id));
    let active:{end:number;lane:number}[]=[];
    let component:{item:FallingLaneInput;lane:number}[]=[];
    let maxConcurrent=0;
    const commit=()=>{
      for (const {item,lane} of component)
        result.set(fallingLaneKey(item.part,item.note.id),{index:lane,count:maxConcurrent});
      component=[];maxConcurrent=0;
    };
    for (const item of row) {
      const start=item.note.startTick;
      active=active.filter(voice=>voice.end>start);
      if (!active.length && component.length) commit();
      const used=new Set(active.map(voice=>voice.lane));
      let lane=0;
      while (used.has(lane)) lane++;
      active.push({end:start+item.note.durationTicks,lane});
      component.push({item,lane});
      maxConcurrent=Math.max(maxConcurrent,maxConcurrent ? lane+1 : 1,active.length);
    }
    if (component.length) commit();
  }
  return result;
}

export function fallingLaneRect(
  keyLeft:number,keyWidth:number,lane:FallingLane|undefined,separate:boolean,
) {
  const count=separate ? Math.max(1,lane?.count??1) : 1;
  const index=separate ? (lane?.index??0) : 0;
  const padding=Math.min(1.1,keyWidth*.08);
  const usable=Math.max(.25,keyWidth-2*padding);
  const slot=usable/count;
  const width=Math.max(.25,slot*.90);
  const x=keyLeft+padding+slot*index+(slot-width)*.5;
  return {x,width};
}
