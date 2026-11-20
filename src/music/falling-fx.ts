/** Purely visual, seek-safe Canvas effects. These never alter song notes or playback. */
export type FallingQuality = 'low'|'medium'|'high';
export type FallingDrawStyle = {
  shape:'square'|'round'|'glow';
  trails:boolean;
  sparks:boolean;
  glowStrength:number;
  trailStrength:number;
  hitFlash:boolean;
  ripple:boolean;
  sustain:boolean;
  quality:FallingQuality;
};
type FallingBar = {x:number;y:number;w:number;h:number;color:string;alpha:number;tick:number;style:FallingDrawStyle;long:boolean};
export const FALLING_HIT_SECONDS = .32;

export function drawFallingBar(ctx:CanvasRenderingContext2D,bar:FallingBar) {
  const {x,y,w,h,color,alpha,style,tick,long}=bar;
  if (w<=0 || h<=0) return;
  ctx.save();
  if (style.trails && style.trailStrength>0 && style.quality!=='low') {
    const length=Math.max(12,Math.min(100,16+h*.42)*style.trailStrength);
    const gradient=ctx.createLinearGradient(0,y-length,0,y);
    gradient.addColorStop(0,'transparent');
    gradient.addColorStop(1,color);
    ctx.globalAlpha=alpha*style.trailStrength*.29;
    ctx.fillStyle=gradient;
    ctx.fillRect(x+w*.13,y-length,w*.74,length);
  }
  ctx.globalAlpha=alpha;
  ctx.fillStyle=color;
  const strength=Math.max(style.glowStrength,style.shape==='glow'?.65:0);
  if (strength && style.quality!=='low') {
    ctx.shadowColor=color;
    ctx.shadowBlur=(style.quality==='high'?18:10)*strength;
  }
  ctx.beginPath();
  ctx.roundRect(x,y,w,Math.max(2,h),style.shape==='square'?0:Math.min(w/2,4));
  ctx.fill();
  ctx.shadowBlur=0;
  if (long && style.sustain && h>5) {
    const pulse=.5+.5*Math.sin(tick/120+x*.09);
    ctx.fillStyle='#ffffff';
    ctx.globalAlpha=alpha*(.09+pulse*.17);
    ctx.fillRect(x+w*.28,y+1,Math.max(.3,w*.13),Math.max(1,h-2));
  }
  ctx.restore();
}

export type FallingImpact = {
  x:number;y:number;keyWidth:number;ageSec:number;color:string;velocity:number;style:FallingDrawStyle;
};
export function drawFallingImpact(ctx:CanvasRenderingContext2D,impact:FallingImpact) {
  const {x,y,keyWidth,ageSec,color,velocity,style}=impact;
  if (ageSec<0 || ageSec>FALLING_HIT_SECONDS) return;
  const progress=ageSec/FALLING_HIT_SECONDS;
  const energy=(1-progress)*(.45+.55*velocity/127);
  ctx.save();
  if (style.hitFlash) {
    ctx.fillStyle=color;
    ctx.globalAlpha=.53*energy;
    ctx.fillRect(x-Math.max(1,keyWidth*.46),y-7-progress*12,Math.max(1,keyWidth*.92),11+progress*12);
  }
  if (style.ripple && style.quality!=='low') {
    ctx.strokeStyle=color;
    ctx.globalAlpha=.65*energy;
    ctx.lineWidth=style.quality==='high'?2:1;
    ctx.beginPath();
    ctx.ellipse(x,y,Math.max(3,keyWidth*.38)+progress*15,2+progress*7,0,0,Math.PI*2);
    ctx.stroke();
  }
  if (style.sparks && style.quality!=='low') {
    const count=style.quality==='high'?7:3;
    ctx.fillStyle=color;
    ctx.globalAlpha=.85*energy;
    for (let i=0;i<count;i++) {
      const angle=Math.PI*1.05 + Math.PI*.9*i/Math.max(1,count-1);
      const distance=(4+progress*23)*(i%2?.8:1.1);
      const size=style.quality==='high'?2.1:1.6;
      ctx.fillRect(x+Math.cos(angle)*distance,y+Math.sin(angle)*distance,size,size);
    }
  }
  ctx.restore();
}
