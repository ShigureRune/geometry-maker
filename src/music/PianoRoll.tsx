import {useLayoutEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import type {MusicTransport} from './audio';
import {noteIndex} from './roll-layout';
import {fallingLaneKey,fallingLaneRect,layoutFallingLanes} from './falling-layout';
import {FALLING_HIT_SECONDS,drawFallingBar,drawFallingImpact,type FallingDrawStyle,type FallingImpact} from './falling-fx';
import {BAR,PPQ,clamp,pitchName,playableTracks,secToTick,type Note,type Part,type Song} from './song';

export type FallOptions = FallingDrawStyle & {
  speed:number; keys:'auto'|'61'|'88'; color:'track'|'pitch'|'single';
  background:string; labels:boolean; light:boolean; showAll:boolean; separate:boolean;
};
export type RollOptions = {
  view:'horizontal'|'falling'; zoom:number; scroll:'fixed'|'follow'|'manual'; grid:number; fall:FallOptions;
};
type Box = {x:number;y:number;w:number;h:number};
type Hit = Box & {note:Note;part:Part};
type Drag = {x:number;y:number;scroll:number;hit?:Hit;resize:boolean;notes:Note[];canPan:boolean;shift:boolean;moved:boolean};
type Props = {
  song:Song; track:Part; tracks:Part[]; options:RollOptions; selection:string[];
  transport:MusicTransport; active:boolean; onSelect:(part:Part,id:string,extend:boolean)=>void;
  onEdit:(part:Part,notes:Note[])=>void; onAdd:(pitch:number,tick:number)=>void; onSeek:(tick:number)=>void;
};

const HEADER=31, KEYBOARD=56, KEYS_HEIGHT=40;
const blackKey = (pitch:number) => [1,3,6,8,10].includes(pitch%12);
const includes = (box:Box,x:number,y:number) => x>=box.x && x<=box.x+box.w && y>=box.y && y<=box.y+box.h;

export function PianoRoll(props:Props) {
  const canvas=useRef<HTMLCanvasElement>(null), scroll=useRef<HTMLDivElement>(null);
  const pointer=useRef<Drag|null>(null), draft=useRef<Note[]>([]);
  const hits=useRef<Hit[]>([]), cursor=useRef({width:0,height:0,left:0,unit:0,row:0,low:0,high:0});
  const drawNow=useRef<()=>void>(()=>{});
  const [viewWidth,setWidth]=useState(0);
  const {song,track,tracks,options,selection,transport,active}=props;
  const {view,zoom,fall}=options, horizontal=view==='horizontal';
  const startPadding=horizontal && options.scroll==='fixed' ? Math.round(viewWidth*.32) : 0;
  const unit=zoom/BAR;
  const timelineWidth=horizontal?Math.max(viewWidth,Math.ceil(song.totalTicks*unit+startPadding+KEYBOARD+viewWidth)):viewWidth;
  const indexed=useMemo(()=>{
    const selected=!horizontal && fall.showAll ? song.tracks :
      song.tracks.filter(t=>tracks.includes(t.id)||t.id===track);
    const indices=selected.map(t=>({track:t,query:noteIndex(t.notes)}));
    let min=Infinity,max=-Infinity;
    for (const t of selected) for (const note of t.notes) {
      min=Math.min(min,note.pitch);max=Math.max(max,note.pitch);
    }
    if (!Number.isFinite(min)) {min=48;max=72;}
    const low=clamp(min-3,0,108), high=clamp(Math.max(max+3,low+19),low+19,127);
    return {indices,low,high};
  },[song.tracks,tracks,track,horizontal,fall.showAll]);
  const fallingLanes=useMemo(()=>horizontal ? new Map() : layoutFallingLanes(indexed.indices.flatMap(entry=>
    entry.track.notes.map(note=>({part:entry.track.id,note})))),[horizontal,indexed]);
  const selectedIds=useMemo(()=>new Set(selection),[selection]);
  const audible=useMemo(()=>new Set(playableTracks(song).map(t=>t.id)),[song]);
  const resize=useRef<()=>void>(()=>{});

  useLayoutEffect(()=>{
    if (!active || !scroll.current) return;
    const observer=new ResizeObserver(()=>resize.current());
    observer.observe(scroll.current);
    resize.current();
    return ()=>observer.disconnect();
  },[active]);
  useLayoutEffect(()=>{
    if (!active) return;
    const surface=canvas.current!, scroller=scroll.current!, ctx=surface.getContext('2d');
    if (!ctx) return;
    let width=0,height=0,frame=0,lastTick=-1;
    const setSize=()=>{
      width=scroller.clientWidth;
      height=surface.clientHeight;
      setWidth(width);
      const dpr=Math.min(devicePixelRatio||1,2);
      surface.width=Math.max(1,Math.round(width*dpr));
      surface.height=Math.max(1,Math.round(height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      draw();
    };
    function draw() {
      if (!ctx || width<=0 || height<=0) return;
      const tick=transport.tick();
      const repaint: Hit[]=[];
      let {low,high}=indexed;
      if (!horizontal && fall.keys==='61') {low=36;high=96;}
      if (!horizontal && fall.keys==='88') {low=21;high=108;}
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle=horizontal?'#131929':fall.background;
      ctx.fillRect(0,0,width,height);
      ctx.font='11px system-ui';
      if (horizontal) {
        const head=KEYBOARD+startPadding+tick*unit;
        if ((transport.playing || tick!==lastTick) && !pointer.current) {
          if (options.scroll==='fixed') scroller.scrollLeft=head-KEYBOARD-startPadding;
          if (options.scroll==='follow' && (head-scroller.scrollLeft>width*.91 || head-scroller.scrollLeft<KEYBOARD))
            scroller.scrollLeft=Math.max(0,head-width*.24);
        }
        lastTick=tick;
        const left=KEYBOARD+startPadding-scroller.scrollLeft;
        const row=(height-HEADER)/(high-low+1);
        cursor.current={width,height,left,unit,row,low,high};
        const visibleFrom=Math.max(0,(KEYBOARD-left)/unit), visibleTo=Math.min(song.totalTicks,(width-left)/unit);
        for (let pitch=low;pitch<=high;pitch++) {
          const y=HEADER+(high-pitch)*row;
          ctx.fillStyle=blackKey(pitch)?'#171d30':'#20283b';
          ctx.fillRect(KEYBOARD,y,width-KEYBOARD,row-.4);
        }
        for (let t=Math.max(0,Math.floor(visibleFrom/PPQ)*PPQ);t<=visibleTo;t+=PPQ) {
          const x=left+t*unit;
          if (x<KEYBOARD-.5) continue;
          ctx.fillStyle=t%BAR===0?'#61728b':'#343d54';
          ctx.fillRect(x,0,1,height);
          ctx.fillStyle='#c0c9e5';
          if (t%BAR===0) ctx.fillText(String(t/BAR+1),x+4,19);
          else if (zoom>=160) ctx.fillText(String(t%BAR/PPQ+1),x+4,19);
        }
        for (const section of song.sections) {
          const x=left+section.startBar*BAR*unit;
          if (x>=KEYBOARD && x<width-42) {
            ctx.fillStyle='#a797d5';
            ctx.fillText(section.name,x+25,19);
          }
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(KEYBOARD,HEADER,width-KEYBOARD,height-HEADER); ctx.clip();
        for (const entry of indexed.indices) {
          const t=entry.track;
          const edits=t.id===track?new Map(draft.current.map(n=>[n.id,n])):null;
          const notes=entry.query(visibleFrom,visibleTo).filter(n=>!edits?.has(n.id));
          if (edits) notes.push(...edits.values());
          for (const note of notes) {
            const x=left+note.startTick*unit, y=HEADER+(high-note.pitch)*row+1;
            const box={x,y,w:Math.max(3,note.durationTicks*unit),h:Math.max(2,row-2)};
            if (x+box.w<KEYBOARD || x>width || note.pitch<low || note.pitch>high) continue;
            const chosen=t.id===track && selectedIds.has(note.id);
            ctx.globalAlpha=chosen?1:audible.has(t.id)?.83:.35;
            ctx.fillStyle=t.color;
            ctx.fillRect(x,y,box.w,box.h);
            if (chosen) {ctx.strokeStyle='#fff';ctx.strokeRect(x+.5,y+.5,Math.max(1,box.w-1),Math.max(1,box.h-1));}
            repaint.push({...box,note,part:t.id});
          }
        }
        ctx.restore();
        const x=left+tick*unit;
        if (x>=KEYBOARD && x<width) {ctx.fillStyle='#fce1a8';ctx.fillRect(x,0,1.5,height);}
        ctx.fillStyle='#171d30';ctx.fillRect(0,0,KEYBOARD,height);
        const playingNotes=new Set(indexed.indices.flatMap(entry=>audible.has(entry.track.id)?entry.query(tick,tick)
          .filter(n=>n.startTick+n.durationTicks>tick).map(n=>n.pitch):[]));
        for (let pitch=low;pitch<=high;pitch++) {
          const y=HEADER+(high-pitch)*row, isBlack=blackKey(pitch);
          ctx.fillStyle=transport.playing&&playingNotes.has(pitch)?'#bca3ff':isBlack?'#303954':'#c7d0e5';
          ctx.fillRect(0,y,isBlack?43:KEYBOARD-2,row-.6);
          if (row>=10 || pitch%12===0) {
            ctx.fillStyle=isBlack?'#fff':'#1d2639';ctx.fillText(pitchName(pitch),5,y+Math.min(row-1,11));
          }
        }
      } else {
        const keyboardY=height-KEYS_HEIGHT;
        const keyWidth=width/(high-low+1);
        const distance=keyboardY/secToTick(4/fall.speed,song.bpm);
        const future=tick+keyboardY/distance;
        const hitWindowTicks=secToTick(FALLING_HIT_SECONDS,song.bpm);
        const lit=new Map<number,string[]>();
        const impacts:FallingImpact[]=[];
        for (let pitch=low;pitch<=high;pitch++) {
          const x=(pitch-low)*keyWidth;
          ctx.fillStyle=blackKey(pitch)?'#ffffff05':'#ffffff0b';
          ctx.fillRect(x,0,Math.max(.2,keyWidth-1),keyboardY);
        }
        ctx.save();ctx.beginPath();ctx.rect(0,0,width,keyboardY);ctx.clip();
        for (const entry of indexed.indices) for (const note of entry.query(Math.max(0,tick-hitWindowTicks),future)) {
          if (note.pitch<low || note.pitch>high) continue;
          const color=fall.color==='track'?entry.track.color:fall.color==='pitch'?
            'hsl('+((note.pitch%12)*30+195)+' 75% 66%)':'#a595f7';
          const keyLeft=(note.pitch-low)*keyWidth;
          const lane=fallingLanes.get(fallingLaneKey(entry.track.id,note.id));
          const {x,width:w}=fallingLaneRect(keyLeft,keyWidth,lane,fall.separate);
          const audibleNote=audible.has(entry.track.id);
          const sounding=transport.playing && audibleNote && note.startTick<=tick && note.startTick+note.durationTicks>tick;
          if (sounding) lit.set(note.pitch,[...(lit.get(note.pitch)??[]),color]);
          const ageSec=(tick-note.startTick)/PPQ*60/song.bpm;
          if (transport.playing && audibleNote && ageSec>=0 && ageSec<=FALLING_HIT_SECONDS && impacts.length<150) {
            impacts.push({x:x+w/2,y:keyboardY,keyWidth,ageSec,color,velocity:note.velocity,style:fall});
          }
          if (note.startTick+note.durationTicks<=tick) continue;
          const y=keyboardY-(note.startTick+note.durationTicks-tick)*distance;
          const h=note.durationTicks*distance;
          drawFallingBar(ctx,{x,y,w,h,color,alpha:audibleNote?.9:.34,tick,style:fall,long:note.durationTicks>=PPQ});
          if (entry.track.id===track && selectedIds.has(note.id)) {
            ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=1;
            ctx.strokeRect(x+.5,y+.5,Math.max(.5,w-1),Math.max(1,h-1));
            ctx.restore();
          }
          repaint.push({note,part:entry.track.id,x,y,w,h:Math.min(h,keyboardY-y)});
        }
        ctx.restore();
        for (let pitch=low;pitch<=high;pitch++) {
          const x=(pitch-low)*keyWidth, sharp=blackKey(pitch);
          const colors=fall.light ? lit.get(pitch) : undefined;
          ctx.fillStyle=sharp?'#343f5c':'#e6e9f1';
          ctx.fillRect(x,keyboardY,Math.max(.2,keyWidth-1),KEYS_HEIGHT);
          colors?.forEach((color,i)=>{
            ctx.fillStyle=color;
            ctx.fillRect(x+i*Math.max(.2,keyWidth-1)/colors.length,keyboardY,
              Math.max(.2,keyWidth-1)/colors.length,KEYS_HEIGHT);
          });
          if (fall.labels && !sharp && (keyWidth>=22 || pitch%12===0)) {
            ctx.fillStyle='#1c263d';ctx.font='10px system-ui';
            ctx.fillText(pitchName(pitch),x+2,height-8);
          }
        }
        // Derived from the playhead; seeking never leaves stale particles behind.
        for (const impact of impacts) drawFallingImpact(ctx,impact);

      }
      hits.current=repaint;
    }
    resize.current=setSize;
    drawNow.current=draw;
    const update=()=>{
      draw();
      frame=transport.playing?requestAnimationFrame(update):0;
    };
    const refresh=()=>{if (!frame) update();};
    setSize();
    const unsubscribe=transport.subscribe(refresh);
    refresh();
    return ()=>{unsubscribe();cancelAnimationFrame(frame);drawNow.current=()=>{};resize.current=()=>{};};
  },[active,transport,horizontal,song,indexed,unit,startPadding,selectedIds,audible,options.scroll,fall,track]);

  const coords=(e:{clientX:number;clientY:number})=>{
    const rect=canvas.current!.getBoundingClientRect();
    return {x:e.clientX-rect.left,y:e.clientY-rect.top};
  };
  const snap=(ticks:number)=>options.grid?Math.round(ticks/options.grid)*options.grid:Math.round(ticks);
  function down(event:PointerEvent<HTMLCanvasElement>) {
    if (event.button!==0) return;
    const {x,y}=coords(event);
    if (horizontal && x>=KEYBOARD && y<HEADER) {
      props.onSeek(clamp(snap((x-cursor.current.left)/unit),0,song.totalTicks));
      drawNow.current();return;
    }
    if (!horizontal && transport.playing) return;
    const hit=[...hits.current].reverse().find(box=>includes(box,x,y) && (!horizontal || (x>=KEYBOARD&&y>=HEADER)));
    const shift=event.shiftKey||event.ctrlKey||event.metaKey;
    const notes=hit? song.tracks.find(t=>t.id===hit.part)!.notes.filter(n=>
      hit.part===track && selectedIds.has(hit.note.id) ? selectedIds.has(n.id):n.id===hit.note.id):[];
    pointer.current={x,y,scroll:scroll.current!.scrollLeft,hit,notes,
      resize:!!hit && horizontal && hit.w>=7 && x>=hit.x+hit.w-Math.min(9,hit.w*.32),
      canPan:horizontal&&!hit,shift,moved:false};
    canvas.current!.setPointerCapture(event.pointerId);
  }
  function move(event:PointerEvent<HTMLCanvasElement>) {
    const drag=pointer.current;
    if (!drag || !horizontal) return;
    const {x,y}=coords(event), {row}=cursor.current;
    if (Math.abs(x-drag.x)+Math.abs(y-drag.y)<4&&!drag.moved) return;
    drag.moved=true;
    if (drag.canPan) {scroll.current!.scrollLeft=drag.scroll-(x-drag.x);drawNow.current();return;}
    if (!drag.hit || drag.shift) return;
    const anchor=drag.hit.note;
    const tickDelta=snap((drag.resize?anchor.durationTicks:anchor.startTick)+(x-drag.x)/unit)-
      (drag.resize?anchor.durationTicks:anchor.startTick);
    const minimum=drag.resize?1-Math.min(...drag.notes.map(n=>n.durationTicks)):-Math.min(...drag.notes.map(n=>n.startTick));
    const maximum=song.totalTicks-Math.max(...drag.notes.map(n=>n.startTick+n.durationTicks));
    const delta=clamp(tickDelta,minimum,maximum);
    const pitchDelta=drag.resize?0:clamp(Math.round((drag.y-y)/row),
      -Math.min(...drag.notes.map(n=>n.pitch)),127-Math.max(...drag.notes.map(n=>n.pitch)));
    draft.current=drag.notes.map(n=>({...n,pitch:n.pitch+pitchDelta,startTick:n.startTick+(drag.resize?0:delta),
      durationTicks:n.durationTicks+(drag.resize?delta:0)}));
    drawNow.current();
  }
  function up() {
    const drag=pointer.current;
    if (!drag) return;
    pointer.current=null;
    const edits=draft.current;draft.current=[];
    if (drag.hit) {
      if (!drag.moved || drag.hit.part!==track || !selectedIds.has(drag.hit.note.id))
        props.onSelect(drag.hit.part,drag.hit.note.id,drag.shift);
      if (edits.length) props.onEdit(drag.hit.part,edits);
    }
    drawNow.current();
  }
  function cancel() {pointer.current=null;draft.current=[];drawNow.current();}
  return <div className="music-roll-scroll" ref={scroll} onScroll={()=>drawNow.current()}>
    <div style={{width:timelineWidth||'100%'}}>
      <canvas className="music-roll-canvas" style={{width:viewWidth||'100%'}} ref={canvas} tabIndex={0}
        aria-label={horizontal?'横スクロール型ピアノロール':'落下ノーツ型ピアノロール'}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
        onDoubleClick={event=>{
          if (!horizontal) return;
          const {x,y}=coords(event), {left,row,high,low}=cursor.current;
          if (x<KEYBOARD || y<HEADER || hits.current.some(box=>includes(box,x,y))) return;
          props.onAdd(clamp(high-Math.floor((y-HEADER)/row),low,high),clamp(snap((x-left)/unit),0,song.totalTicks-1));
        }}/>
    </div>
  </div>;
}
