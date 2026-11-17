import { memo, useId, useMemo, type ReactNode } from 'react';
import { contoursOf, pathData, radians, shapeBounds, worldPoint, trimContour } from './geometry';
import { gradientEndpoints, type Background, type Point, type Scene, type Shape, NEW_SHAPE_KINDS } from './scene';
import { backgroundVector, inkAt, paintFor } from './paint';
import { GridBackground } from './GridBackground';
import { TextOverlay } from './TextOverlay';
import type {TextOverlaySettings} from './text-overlay';
import {MAGIC_ALGORITHM_VERSION} from './magic-circle';
import {isMovingBar,type FigureFlowState} from './figure-motion';

// All strokes and glow radii use scene units. Pixel-fixed strokes become thinner
// when a high-resolution export is displayed at the preview size.
function GeometryImpl({ shape, finalFillOpacity, progress=1, magic=false, spin=0 }: { shape: Shape; finalFillOpacity:number; progress?:number;magic?:boolean;spin?:number }) {
  const modern=magic||(NEW_SHAPE_KINDS as readonly string[]).includes(shape.kind);
  const contours=useMemo(()=>contoursOf(shape),[shape]);
  return <>{contours.map((contour,i)=>{
    const start=contour.growthStart??0,end=contour.growthEnd??1;
    const t=modern?Math.max(0,Math.min(1,(progress-start)/(end-start))):progress;
    if(t<=0)return null;
    const c=contour.dashed&&t<1?trimContour(contour,t):contour;
    const scale=shape.kind==='star'?t:undefined;
    if(c.circle) {
      const expand=shape.kind!=='concentric'&&!magic;
      const factor=Math.max(0,Math.min(1,progress*1.4-i*.025));
      return <circle key={i} cx={c.circle.x} cy={c.circle.y} r={c.circle.radius}
        pathLength={!expand&&t<1?1:undefined}
        style={t<1?expand?{transform:`scale(${modern?t:factor})`,transformBox:'fill-box',transformOrigin:'center'}:{strokeDasharray:1,strokeDashoffset:1-t}:undefined}
        opacity={c.opacity}
        stroke={['circle','concentric'].includes(shape.kind)?undefined:'none'}/>;
    }
    return <path key={i} pathLength={t<1&&!contour.dashed?1:undefined}
      style={t<1?{...(contour.dashed?{}:{strokeDasharray:1,strokeDashoffset:1-t}),fillOpacity:finalFillOpacity*t,...(scale===undefined?{}:{transform:`scale(${scale})`})}:undefined}
      d={pathData(c)}
      transform={shape.kind==='arc'&&contour.dashed&&spin!==0?`rotate(${spin})`:undefined}
      fill={shape.filled&&c.closed?undefined:'none'} opacity={c.opacity}
      strokeDasharray={contour.dashed?`${shape.size*.065} ${shape.size*.06}`:undefined}/>;
  })}</>;
}
const Geometry=memo(GeometryImpl);

/** Moving highlights follow the ORIGINAL path contours; base fills, position,
 * rotation and stroke geometry never change. Works equally in browser SVG
 * and deterministic, time-seeked video frames. */
const FlowGeometry=memo(function FlowGeometry({shape,flow,ink,lineWidth}:{
  shape:Shape;flow:FigureFlowState;ink:string;lineWidth:number;
}){
  const contours=useMemo(()=>contoursOf(shape),[shape]);
  const tailDash=`${flow.tailLength} ${1-flow.tailLength}`;
  const headDash=`${flow.headLength} ${1-flow.headLength}`;
  return <g data-testid="figure-flow" data-flow-offset={flow.offset}
    data-flow-opacity={flow.opacity} fill="none" pointerEvents="none"
    strokeLinecap="round" opacity={flow.opacity}>
    {contours.map((c,i)=>{
      const offset=Number((flow.offset-i*.17).toFixed(5));
      // Multiple concentric paths acquire staggered signal phases.
      if(c.circle)return <g key={i}>
        <circle cx={c.circle.x} cy={c.circle.y} r={c.circle.radius}
          pathLength={1} stroke={ink} strokeWidth={lineWidth*2}
          opacity={.55*(c.opacity??1)} strokeDasharray={tailDash} strokeDashoffset={offset}/>
        <circle cx={c.circle.x} cy={c.circle.y} r={c.circle.radius}
          pathLength={1} stroke="#f4fbff" strokeWidth={lineWidth*1.2}
          opacity={c.opacity??1} strokeDasharray={headDash} strokeDashoffset={offset}/>
      </g>;
      return <g key={i} transform={shape.kind==='arc'&&c.dashed?`rotate(${flow.spin})`:undefined}>
        <path d={pathData(c)} pathLength={1} stroke={ink}
          strokeWidth={lineWidth*2} opacity={.55*(c.opacity??1)}
          strokeDasharray={tailDash} strokeDashoffset={offset}/>
        <path d={pathData(c)} pathLength={1} stroke="#f4fbff"
          strokeWidth={lineWidth*1.2} opacity={c.opacity??1}
          strokeDasharray={headDash} strokeDashoffset={offset}/>
      </g>;
    })}

  </g>;
});
/** Soft LCD-style specular sweep on the MOVING bar. Never edits the authored
 * scene or the separately rendered (stationary) accent-role highlights.
 * Both the feathered ends and moving white sheen live inside the bar's own
 * translated group, so the original one-way travel remains unchanged. */
const LuminousBar=memo(function LuminousBar({shape,flow,unit,bounds,artwork,lineWidth}:{
  shape:Shape;flow:FigureFlowState;unit:number;
  bounds:{x:number;y:number;width:number;height:number};
  artwork:ReactNode;lineWidth:number;
}){
  const id='moving-bar-light-'+useId().replace(/:/g,'');
  const contour=useMemo(()=>contoursOf(shape)[0],[shape]);
  const d=useMemo(()=>pathData(contour),[contour]);
  const start=shape.kind==='line'&&contour.points.length>1?contour.points[0]:{x:-shape.size,y:0};
  const end=shape.kind==='line'&&contour.points.length>1?contour.points.at(-1)!:{x:shape.size,y:0};
  const sample=(t:number)=>({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t});
  // The spot begins and ends OUTSIDE the bar: the reset cannot create a
  // hard bright seam. The fade mask also softens both ends of the bar body.
  const phase=(((-flow.offset)%1)+1)%1;
  const center=-.26+1.52*phase, radius=.22;
  const from=sample(center-radius),to=sample(center+radius);
  const filled=shape.filled&&contour.closed;
  const strokeWidth=shape.strokeWidth*lineWidth/100;
  const width=filled?0:Math.max(strokeWidth*1.55,unit*.0026);
  const glowWidth=filled?0:Math.max(width*3,unit*.009);
  const blur=Math.max(unit*.002,Math.min(unit*.009,(shape.thickness??unit*.016)*.26));
  const pad=Math.max(unit*.06,blur*6,glowWidth*2);
  return <>
    <defs>
      <linearGradient id={id+'-feather'} gradientUnits="userSpaceOnUse"
        x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
        <stop offset="0%" stopColor="black"/>
        <stop offset="11%" stopColor="white" stopOpacity=".85"/>
        <stop offset="20%" stopColor="white"/>
        <stop offset="80%" stopColor="white"/>
        <stop offset="89%" stopColor="white" stopOpacity=".85"/>
        <stop offset="100%" stopColor="black"/>
      </linearGradient>
      <mask id={id+'-mask'} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
        x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2} height={bounds.height+pad*2}>
        <rect x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2}
          height={bounds.height+pad*2} fill={`url(#${id}-feather)`}/>
      </mask>
      <linearGradient id={id+'-sheen'} gradientUnits="userSpaceOnUse"
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
        <stop offset="0%" stopColor="#f5fbff" stopOpacity="0"/>
        <stop offset="17%" stopColor="#f5fbff" stopOpacity=".08"/>
        <stop offset="36%" stopColor="#ffffff" stopOpacity=".34"/>
        <stop offset="50%" stopColor="#ffffff" stopOpacity=".85"/>
        <stop offset="64%" stopColor="#ffffff" stopOpacity=".34"/>
        <stop offset="83%" stopColor="#f5fbff" stopOpacity=".08"/>
        <stop offset="100%" stopColor="#f5fbff" stopOpacity="0"/>
      </linearGradient>
      <filter id={id+'-bloom'} filterUnits="userSpaceOnUse"
        x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2} height={bounds.height+pad*2}
        colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={blur}/>
      </filter>
    </defs>
    <g data-testid="bar-soft-feather" mask={`url(#${id}-mask)`}>
      {artwork}
      <g data-testid="bar-soft-sheen" fill="none" pointerEvents="none"
        strokeLinecap="round" opacity={Math.min(1,flow.opacity*1.15)}>
        {/* Blurred halo plus a subdued sharp white specular core. */}
        <path d={d} fill={filled?`url(#${id}-sheen)`:'none'}
          stroke={filled?'none':`url(#${id}-sheen)`} strokeWidth={glowWidth}
          filter={`url(#${id}-bloom)`} opacity=".78"/>
        <path d={d} fill={filled?`url(#${id}-sheen)`:'none'}
          stroke={filled?'none':`url(#${id}-sheen)`} strokeWidth={width}
          opacity=".82"/>
      </g>
    </g>
  </>;
});
function localPoint(shape: Shape, p: Point): Point {
  const dx = p.x - shape.x, dy = p.y - shape.y, angle = radians(-shape.rotation);
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function Preview({ scene, background, growth, motion, flow, transparent=false, shapeColors, backgroundBlend, textOverlay, textSeconds, gridSeconds, gridFigureAngle }: { scene: Scene; background: Background; growth?:Record<string,number>; motion?:Record<string,string>; flow?:Record<string,FigureFlowState>; transparent?:boolean; shapeColors?:Record<string,string>; backgroundBlend?:{next:Background;opacity:number}; textOverlay?:TextOverlaySettings; textSeconds?:number; gridSeconds?:number; gridFigureAngle?:number }) {
  const gradientId = `background-${useId().replace(/:/g, '')}`;
  const { width, height } = scene;
  const unit = Math.min(width, height);
  const isMagic=scene.version===MAGIC_ALGORITHM_VERSION;
  const roleColor=(shape:Shape)=>shapeColors?.[shape.id]??background.figureColors?.[shape.role==='hero'?'primary':shape.role==='accent'?'accent':'support'];
  const colorAt = (shape: Shape, point: Point) => roleColor(shape) ?? inkAt(shape.tone, background, point, width, height);
  const vector = backgroundVector(background, width, height);
  const localBounds=useMemo(()=>new Map(scene.shapes.map(shape=>[shape.id,shapeBounds({...shape,x:0,y:0,rotation:0})])),[scene]);
  // Static gradients and bounds do not need recomputing on every animation frame.
  const definitions=useMemo(()=>scene.shapes.map(shape => {
        const start = localPoint(shape, vector.start), end = localPoint(shape, vector.end);
        const paint = {...paintFor(shape, background, width, height), color: colorAt(shape, shape),...(isMagic&&!shape.glow?{glow:false}:{})};
        const bounds = localBounds.get(shape.id)!;
        return <g key={shape.id}>
          {background.mode === 'gradient' && !(isMagic||(transparent&&roleColor(shape))) && <linearGradient id={`${gradientId}-ink-${shape.id}`} gradientUnits="userSpaceOnUse"
            x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            {[0, 0.25, 0.5, 0.75, 1].map(t => <stop key={t} offset={`${t * 100}%`}
              stopColor={colorAt(shape, { x: vector.start.x + (vector.end.x - vector.start.x) * t,
                y: vector.start.y + (vector.end.y - vector.start.y) * t })} />)}
          </linearGradient>}
          {shape.filled && <linearGradient id={`${gradientId}-fill-${shape.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAt(shape, worldPoint(shape, { x: -shape.size, y: -shape.size }))} stopOpacity="0.95" />
            <stop offset="100%" stopColor={paint.color} stopOpacity="0.05" />
          </linearGradient>}
          {paint.glow && <filter id={`${gradientId}-glow-${shape.id}`} filterUnits="userSpaceOnUse"
            x={bounds.x - unit * 0.035} y={bounds.y - unit * 0.035} width={bounds.width + unit * 0.07} height={bounds.height + unit * 0.07} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={paint.blur} />
            {background.glowIntensity!==undefined&&<feComponentTransfer><feFuncA type="linear" slope={1+background.glowIntensity/50}/></feComponentTransfer>}
          </filter>}
        </g>;
      }),[scene,background,gradientId,localBounds,transparent,shapeColors,isMagic]);
  return <svg className="artwork" data-testid="preview" role="img" aria-label={isMagic?'生成した2D魔法陣':'生成した2D幾何学模様'}
    data-algorithm={scene.version} data-composition={scene.composition.type} data-transparent={transparent?'true':'false'} viewBox={`0 0 ${width} ${height}`}
    xmlns="http://www.w3.org/2000/svg" overflow={transparent?"visible":"hidden"}>
    {background.mode === 'gradient' && <defs>
      <linearGradient data-testid="background-gradient" id={gradientId} {...gradientEndpoints(background.angle)}>
        {background.colors.map((color, i) => <stop key={i} offset={`${i * 50}%`} stopColor={color} />)}
      </linearGradient>
    </defs>}
    {backgroundBlend?.next.mode==='gradient'&&<defs>
      <linearGradient data-testid="transition-background-gradient" id={`${gradientId}-next`} {...gradientEndpoints(backgroundBlend.next.angle)}>
        {backgroundBlend.next.colors.map((color,i)=><stop key={i} offset={`${i*50}%`} stopColor={color}/>)}
      </linearGradient>
    </defs>}
    <defs>{definitions}</defs>
    {!transparent&&<rect data-testid="background" width={width} height={height} fill={background.mode === 'solid' ? background.solid : `url(#${gradientId})`} />}
    {/* Blend background colors behind the figures, not over their strokes. */}
    {!transparent&&backgroundBlend&&<rect data-testid="transition-background" width={width} height={height}
      fill={backgroundBlend.next.mode==='solid'?backgroundBlend.next.solid:`url(#${gradientId}-next)`}
      opacity={backgroundBlend.opacity}/>} 
    {!transparent&&<GridBackground background={background} width={width} height={height} seconds={gridSeconds} figureAngle={gridFigureAngle}/> }
    {textOverlay?.layer==='back'&&<TextOverlay settings={textOverlay} width={width} height={height} background={background} seconds={textSeconds}/>} 
    <g data-testid="shapes" strokeLinejoin="miter" strokeLinecap="round">
      {scene.shapes.filter(s=>!growth || growth[s.id]>0).map(shape => {
        const paint = {...paintFor(shape, background, width, height), color: colorAt(shape, shape),...(isMagic&&!shape.glow?{glow:false}:{})};
        const solidFill = ['dot', 'dots', 'accent'].includes(shape.kind);
        const finalFillOpacity=solidFill || ['circuit','branch-circuit'].includes(shape.kind)?1:shape.fillOpacity;
        const ink = background.mode === 'gradient' && !(isMagic||(transparent&&roleColor(shape))) ? `url(#${gradientId}-ink-${shape.id})` : paint.color;
        // Move thick bands and thin lines together in one GLOBAL direction.
        // Translate their whole geometry (including strokes and glow) in local
        // coordinates, leaving the parent shape transform/seed untouched.
        const barMotion=isMovingBar(shape)?flow?.[shape.id]:undefined;
        const angle=radians(shape.rotation);
        const localBarX=barMotion?barMotion.barDx*Math.cos(angle)+barMotion.barDy*Math.sin(angle):0;
        const localBarY=barMotion?-barMotion.barDx*Math.sin(angle)+barMotion.barDy*Math.cos(angle):0;
        const artwork=<>
          {paint.glow && <g filter={`url(#${gradientId}-glow-${shape.id})`} opacity={paint.glowOpacity} fill={background.glowIntensity===undefined?undefined:solidFill||['circuit','branch-circuit'].includes(shape.kind)?ink:"none"}><Geometry shape={shape} finalFillOpacity={finalFillOpacity} progress={growth?.[shape.id]} magic={isMagic} spin={shape.kind==='arc'?flow?.[shape.id]?.spin:undefined} /></g>}
          <Geometry shape={shape} finalFillOpacity={finalFillOpacity} progress={growth?.[shape.id]} magic={isMagic} spin={shape.kind==='arc'?flow?.[shape.id]?.spin:undefined} />
          {flow?.[shape.id]&&!barMotion&&<FlowGeometry shape={shape} flow={flow[shape.id]}
            ink={ink} lineWidth={shape.strokeWidth*(background.lineWidth??100)/100}/>}
        </>;
        return <g key={shape.id} data-shape-id={shape.id} data-layer={shape.layer} data-role={shape.role} data-kind={shape.kind}
          data-group={shape.group} data-parent={shape.parent} data-glow={paint.glow || undefined}
          transform={`${motion?.[shape.id]??''} translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
          stroke={ink} strokeWidth={shape.strokeWidth * (background.lineWidth ?? 100) / 100} opacity={paint.opacity}
          fill={shape.filled || ['circuit','branch-circuit'].includes(shape.kind) ? solidFill || ['circuit','branch-circuit'].includes(shape.kind) ? ink : `url(#${gradientId}-fill-${shape.id})` : 'none'}
          fillOpacity={finalFillOpacity}>
          {barMotion
            ?<g data-testid="bar-body-motion" data-bar-shift={barMotion.barShift}
                data-bar-world-x={barMotion.barDx} data-bar-world-y={barMotion.barDy}
                transform={`translate(${Number(localBarX.toFixed(5))} ${Number(localBarY.toFixed(5))})`}>
                <LuminousBar shape={shape} flow={barMotion} unit={unit}
                  bounds={localBounds.get(shape.id)!} artwork={artwork}
                  lineWidth={background.lineWidth??100}/>
              </g>
            :artwork}
        </g>;
      })}
    </g>
    {textOverlay?.layer==='front'&&<TextOverlay settings={textOverlay} width={width} height={height} background={background} seconds={textSeconds}/>} 
  </svg>;
}
