/** Shared piano geometry for both the DAW roll and the falling-note visualizer.
 * Note coordinates stay chromatic in the editor, while the falling visualizer
 * uses the real seven-white / five-black layout per octave.
 */
export type PianoKeyRect = {
  pitch:number;
  isBlack:boolean;
  x:number;y:number;w:number;h:number;
  centerX:number;centerY:number;
  /** Width-aligned landing lane for falling note bars (separate from the physical key shape). */
  noteX:number;noteWidth:number;
};

export type PianoKeyboardLayout = {
  whites:PianoKeyRect[];
  blacks:PianoKeyRect[];
  byPitch:Map<number,PianoKeyRect>;
  whiteWidth:number;
};

const blackSemitones=new Set([1,3,6,8,10]);
const whiteOrdinals=[0,1,1,2,2,3,4,4,5,5,6,6] as const;

export const isBlackKey=(pitch:number)=>blackSemitones.has(((pitch%12)+12)%12);

function whiteOrdinal(pitch:number) {
  const octave=Math.floor(pitch/12);
  const semitone=((pitch%12)+12)%12;
  return octave*7+whiteOrdinals[semitone];
}

/** Expand auto-sized falling keys to a white key at each edge, avoiding clipped end black keys. */
export function whiteKeyBounds(low:number,high:number):[number,number] {
  let start=Math.max(0,low),end=Math.min(127,high);
  while (isBlackKey(start) && start>0) start--;
  while (isBlackKey(end) && end<127) end++;
  return [start,end];
}

export function buildFallingKeyboardLayout(
  low:number,high:number,width:number,top:number,height:number,
):PianoKeyboardLayout {
  const whites:PianoKeyRect[]=[];
  const blacks:PianoKeyRect[]=[];
  const byPitch=new Map<number,PianoKeyRect>();
  const whitePitches:number[]=[];
  for(let pitch=low;pitch<=high;pitch++)if(!isBlackKey(pitch))whitePitches.push(pitch);
  const whiteWidth=Math.max(0,width)/Math.max(1,whitePitches.length);
  const firstOrdinal=whitePitches.length ? whiteOrdinal(whitePitches[0]) : whiteOrdinal(low);
  for (const pitch of whitePitches) {
    const x=(whiteOrdinal(pitch)-firstOrdinal)*whiteWidth;
    const noteWidth=whiteWidth*.58;
    const centerX=x+whiteWidth/2;
    const key:PianoKeyRect={pitch,isBlack:false,x,y:top,w:whiteWidth,h:height,
      centerX,centerY:top+height/2,noteX:centerX-noteWidth/2,noteWidth};
    whites.push(key);byPitch.set(pitch,key);
  }
  for(let pitch=low;pitch<=high;pitch++) {
    if(!isBlackKey(pitch))continue;
    // Black keys sit at the join between their neighbouring white keys.
    const centerX=(whiteOrdinal(pitch)-firstOrdinal)*whiteWidth;
    const w=whiteWidth*.62;
    const noteWidth=whiteWidth*.35;
    const key:PianoKeyRect={pitch,isBlack:true,x:centerX-w/2,y:top,w,h:height*.65,
      centerX,centerY:top+height*.325,noteX:centerX-noteWidth/2,noteWidth};
    blacks.push(key);byPitch.set(pitch,key);
  }
  return {whites,blacks,byPitch,whiteWidth};
}

/** The horizontal view must keep fixed semitone-height editing rows.
 * White key faces span the space between neighbouring natural pitches;
 * raised black key caps overlay them from the timeline-facing side. */
export function buildHorizontalKeyboardLayout(
  low:number,high:number,top:number,rowHeight:number,width:number,
):PianoKeyboardLayout {
  const whites:PianoKeyRect[]=[];
  const blacks:PianoKeyRect[]=[];
  const byPitch=new Map<number,PianoKeyRect>();
  const natural:number[]=[];
  for(let pitch=high;pitch>=low;pitch--)if(!isBlackKey(pitch))natural.push(pitch);
  const center=(pitch:number)=>top+(high-pitch+.5)*rowHeight;
  const bottom=top+(high-low+1)*rowHeight;
  natural.forEach((pitch,i)=>{
    const y=i ? (center(natural[i-1])+center(pitch))/2 : top;
    const next=i+1<natural.length ? (center(pitch)+center(natural[i+1]))/2 : bottom;
    const h=Math.max(0,next-y);
    const key:PianoKeyRect={pitch,isBlack:false,x:0,y,w:width,h,
      centerX:width/2,centerY:center(pitch),noteX:0,noteWidth:width};
    whites.push(key);byPitch.set(pitch,key);
  });
  for(let pitch=high;pitch>=low;pitch--) {
    if(!isBlackKey(pitch))continue;
    const h=Math.min(rowHeight*1.32,bottom-top);
    const centerY=center(pitch);
    const y=Math.max(top,Math.min(bottom-h,centerY-h/2));
    const x=width*.32,w=width*.66;
    const key:PianoKeyRect={pitch,isBlack:true,x,y,w,h,
      centerX:x+w/2,centerY,noteX:x,noteWidth:w};
    blacks.push(key);byPitch.set(pitch,key);
  }
  return {whites,blacks,byPitch,whiteWidth:width};
}
