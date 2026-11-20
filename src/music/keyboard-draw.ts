import {pitchName} from './song';
import {buildHorizontalKeyboardLayout,type PianoKeyboardLayout,type PianoKeyRect} from './keyboard-layout';

function paintLitKeys(ctx:CanvasRenderingContext2D,key:PianoKeyRect,colors:string[]|undefined,black:boolean) {
  if (!colors?.length) return;
  ctx.save();
  ctx.beginPath();
  if (black) ctx.roundRect(key.x,key.y,key.w,key.h,Math.min(2.5,key.w*.15));
  else ctx.rect(key.x,key.y,key.w,key.h);
  ctx.clip();
  ctx.globalAlpha=black?.76:.58;
  const segment=key.w/colors.length;
  colors.forEach((color,index)=>{
    ctx.fillStyle=color;
    ctx.fillRect(key.x+index*segment,key.y,segment+.1,key.h);
  });
  ctx.restore();
}

function whiteFace(ctx:CanvasRenderingContext2D,key:PianoKeyRect) {
  const grad=ctx.createLinearGradient(key.x,key.y,key.x+key.w,key.y+key.h);
  grad.addColorStop(0,'#f8faff');
  grad.addColorStop(.62,'#dce3ef');
  grad.addColorStop(1,'#b6c1d1');
  ctx.fillStyle=grad;
  ctx.fillRect(key.x,key.y,key.w,key.h);
  ctx.lineWidth=.75;
  ctx.strokeStyle='#627187';
  ctx.strokeRect(key.x+.4,key.y+.4,Math.max(0,key.w-.8),Math.max(0,key.h-.8));
}

function blackFace(ctx:CanvasRenderingContext2D,key:PianoKeyRect) {
  const grad=ctx.createLinearGradient(key.x,key.y,key.x+key.w,key.y+key.h);
  grad.addColorStop(0,'#44516b');
  grad.addColorStop(.24,'#202b40');
  grad.addColorStop(1,'#090e1b');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.roundRect(key.x,key.y,key.w,key.h,Math.min(2.5,key.w*.15));
  ctx.fill();
  ctx.strokeStyle='#0a101b';
  ctx.lineWidth=.9;
  ctx.stroke();
  ctx.fillStyle='#ffffff24';
  ctx.fillRect(key.x+Math.max(.7,key.w*.12),key.y+Math.min(2,key.h*.1),
    Math.max(.4,key.w*.11),Math.max(.4,key.h*.40));
}

/** Draws DAW-style raised black keys over realistic natural-key faces.
 * The chromatic note grid and editing hit testing stay untouched. */
export function drawHorizontalPianoKeyboard(
  ctx:CanvasRenderingContext2D,low:number,high:number,top:number,row:number,
  width:number,playingNotes:ReadonlySet<number>,
) {
  const layout=buildHorizontalKeyboardLayout(low,high,top,row,width);
  const lit=new Map<number,string[]>();
  for (const pitch of playingNotes) lit.set(pitch,['#b69aff']);
  ctx.save();
  ctx.fillStyle='#101729';
  ctx.fillRect(0,0,width,top+(high-low+1)*row);
  for (const key of layout.whites) {
    whiteFace(ctx,key);
    paintLitKeys(ctx,key,lit.get(key.pitch),false);
  }
  for (const key of layout.blacks) {
    blackFace(ctx,key);
    paintLitKeys(ctx,key,lit.get(key.pitch),true);
  }
  ctx.font='10px system-ui';
  ctx.textBaseline='middle';
  for (const key of layout.whites) {
    if (key.pitch%12!==0 && row<12) continue;
    ctx.fillStyle='#1c2941';
    ctx.fillText(pitchName(key.pitch),5,key.centerY,Math.max(0,width*.52-4));
  }
  ctx.fillStyle='#687793';
  ctx.fillRect(width-1,0,1,top+(high-low+1)*row);
  ctx.restore();
}

/** A real piano face: broad ivory white keys first, raised narrow black keys second.
 * Note effects use the same map to land exactly on the corresponding key. */
export function drawFallingPianoKeyboard(
  ctx:CanvasRenderingContext2D,layout:PianoKeyboardLayout,
  lit:ReadonlyMap<number,string[]>,labels:boolean,
) {
  ctx.save();
  for (const key of layout.whites) {
    whiteFace(ctx,key);
    paintLitKeys(ctx,key,lit.get(key.pitch),false);
    if(labels && layout.whiteWidth>=11 && (key.pitch%12===0 || layout.whiteWidth>=33)) {
      ctx.fillStyle='#1a2940';
      ctx.textBaseline='alphabetic';
      ctx.font=layout.whiteWidth>=22?'10px system-ui':'8px system-ui';
      ctx.fillText(pitchName(key.pitch),key.x+Math.max(1,key.w*.10),
        key.y+key.h-6,Math.max(1,key.w-2));
    }
  }
  for (const key of layout.blacks) {
    blackFace(ctx,key);
    paintLitKeys(ctx,key,lit.get(key.pitch),true);
  }
  ctx.restore();
}
