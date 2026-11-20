import {describe,expect,it} from 'vitest';
import {fallingLaneKey,fallingLaneRect,layoutFallingLanes,type FallingLaneInput} from './falling-layout';
import type {Part} from './song';

const make=(part:Part,id:string,startTick:number,durationTicks:number,pitch=60):FallingLaneInput=>({
  part,note:{id,startTick,durationTicks,pitch,velocity:90},
});

describe('Falling notes collision layout',()=>{
  it('separates concurrent voices of the same pitch, independent of input order',()=>{
    const notes=[
      make('melody','m',0,480),
      make('chords','c',0,960),
      make('pad','p',120,480),
    ];
    const layout=layoutFallingLanes(notes);
    const reversed=layoutFallingLanes([...notes].reverse());
    expect([...layout].sort()).toEqual([...reversed].sort());
    expect(new Set(notes.map(n=>layout.get(fallingLaneKey(n.part,n.note.id))?.index)).size).toBe(3);
    expect(notes.map(n=>layout.get(fallingLaneKey(n.part,n.note.id))?.count)).toEqual([3,3,3]);
    const rects=notes.map(n=>fallingLaneRect(100,36,layout.get(fallingLaneKey(n.part,n.note.id)),true));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)
      expect(rects[i].x+rects[i].width<=rects[j].x || rects[j].x+rects[j].width<=rects[i].x).toBe(true);
  });

  it('reuses a key lane when earlier notes end and keeps slots stable while seeking',()=>{
    const notes=[
      make('melody','m1',0,120),
      make('chords','c',60,500),
      make('melody','m2',120,140),
      make('pad','p',900,120),
      make('pulse','otherPitch',0,960,62),
    ];
    const lanes=layoutFallingLanes(notes);
    const at=(part:Part,id:string)=>lanes.get(fallingLaneKey(part,id));
    expect(at('melody','m1')?.index).toBe(0);
    expect(at('chords','c')?.index).toBe(1);
    expect(at('melody','m2')?.index).toBe(0);
    expect(at('pad','p')).toEqual({index:0,count:1});
    expect(at('pulse','otherPitch')).toEqual({index:0,count:1});
    expect(at('melody','m2')?.count).toBe(2);
  });

  it('can draw without separation and remains within tiny mobile keys',()=>{
    const samePitch=[make('melody','one',0,480),make('chords','two',0,480)];
    const lanes=layoutFallingLanes(samePitch);
    const overlapping=samePitch.map(n=>fallingLaneRect(0,3.4,lanes.get(fallingLaneKey(n.part,n.note.id)),true));
    expect(overlapping[0].x+overlapping[0].width).toBeLessThanOrEqual(overlapping[1].x);
    expect(overlapping.every(rect=>rect.width>0&&rect.x>=0&&rect.x+rect.width<3.4)).toBe(true);
    expect(fallingLaneRect(2,6,lanes.get('melody:one'),false))
      .toEqual(fallingLaneRect(2,6,lanes.get('chords:two'),false));
  });
});
