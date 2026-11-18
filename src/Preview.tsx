import { memo, useId, useMemo } from 'react';
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

/** Luminous streaks travel along ORIGINAL contours without changing shape positions.
 * The main figure gets a softly feathered LCD-like glow; supporting contours
 * retain their existing, lighter tracing. Both SVG and video use this renderer.
 */
const FlowGeometry=memo(function FlowGeometry({shape,flow,ink,lineWidth}:{
  shape:Shape;flow:FigureFlowState;ink:string;lineWidth:number;
}){
  const contours=useMemo(()=>contoursOf(shape),[shape]);
  const haloId='figure-halo-'+useId().replace(/:/g,'');
  const isMain=shape.role==='hero';
  const bounds=useMemo(()=>shapeBounds({...shape,x:0,y:0,rotation:0}),[shape]);
  const outerBlur=Math.max(2.5,lineWidth*2.8);
  const innerBlur=Math.max(1.1,lineWidth*.9);
  const pad=Math.max(outerBlur*5,lineWidth*12);
  const tailDash=`${flow.tailLength} ${1-flow.tailLength}`;
  const headDash=`${flow.headLength} ${1-flow.headLength}`;
  return <g data-testid="figure-flow" data-flow-offset={flow.offset}
    data-flow-opacity={flow.opacity} fill="none" pointerEvents="none"
    strokeLinecap="round" opacity={flow.opacity}>
    {isMain&&<defs>
      {/* Large and small halos soften the end caps of each moving dash. */}
      <filter id={haloId+'-outer'} filterUnits="userSpaceOnUse"
        x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2} height={bounds.height+pad*2}
        colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={outerBlur}/>
      </filter>
      <filter id={haloId+'-inner'} filterUnits="userSpaceOnUse"
        x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2} height={bounds.height+pad*2}
        colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={innerBlur}/>
      </filter>
    </defs>}
    {contours.map((c,i)=>{
      const offset=Number((flow.offset-i*.17).toFixed(5));
      // Circles and curves follow the same luminance pattern and clock.
      const draw=(stroke:string,width:number,dash:string,opacity:number,filter?:string,testId?:string)=>
        c.circle?<circle cx={c.circle.x} cy={c.circle.y} r={c.circle.radius}
          pathLength={1} stroke={stroke} strokeWidth={width}
          opacity={opacity*(c.opacity??1)} strokeDasharray={dash}
          strokeDashoffset={offset} filter={filter} data-testid={testId}/>:
        <path d={pathData(c)} pathLength={1} stroke={stroke} strokeWidth={width}
          opacity={opacity*(c.opacity??1)} strokeDasharray={dash}
          strokeDashoffset={offset} filter={filter} data-testid={testId}/>;
      return <g key={i} transform={shape.kind==='arc'&&c.dashed?`rotate(${flow.spin})`:undefined}>
        {isMain?<>
          {/* Broad tinted trail, diffused white bloom, then a subdued crisp glint.
              No rectangular white segment or abruptly terminated bright trail. */}
          {draw(ink,lineWidth*6.4,tailDash,.62,`url(#${haloId}-outer)`,'main-figure-trail')}
          {draw('#f7fcff',lineWidth*5.4,headDash,.86,`url(#${haloId}-outer)`,'main-figure-halo')}
          {draw('#ffffff',lineWidth*2.1,headDash,.83,`url(#${haloId}-inner)`,'main-figure-soft-core')}
          {draw('#ffffff',lineWidth*.68,headDash,.34,undefined,'main-figure-glint')}
        </>:<>
          {draw(ink,lineWidth*2,tailDash,.55)}
          {draw('#f4fbff',lineWidth*1.2,headDash,1)}
        </>}
      </g>;
    })}
  </g>;
});
/** Exact authored circuit geometry (never a synthetic connection).
 * A soft flash at its hero-side origin hands off a traveling white packet,
 * then its terminal glows, followed by the linked child figure. */
const RelayGeometry=memo(function RelayGeometry({shape,flow,lineWidth}:{
  shape:Shape;flow:FigureFlowState;lineWidth:number;
}){
  const id='energy-relay-'+useId().replace(/:/g,'');
  const path=useMemo(()=>contoursOf(shape)[0],[shape]);
  const bounds=useMemo(()=>shapeBounds({...shape,x:0,y:0,rotation:0}),[shape]);
  const start=path.points[0],end=path.points.at(-1)!;
  const pad=Math.max(20,lineWidth*14);
  const radius=Math.max(shape.strokeWidth*4.5,lineWidth*3);
  const visible=flow.relayProgress!==undefined;
  const source=flow.relaySource??0,arrival=flow.relayArrival??0;
  return <g data-testid="energy-relay" fill="none" pointerEvents="none">
    <defs>
      <filter id={id} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"
        x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2}
        height={bounds.height+pad*2}>
        <feGaussianBlur stdDeviation={Math.max(2.2,lineWidth*2.2)}/>
      </filter>
    </defs>
    {source>0&&<g data-testid="energy-source" opacity={source}>
      <circle cx={start.x} cy={start.y} r={radius*1.8} fill="#c5eaff"
        filter={`url(#${id})`}/>
      <circle cx={start.x} cy={start.y} r={radius*.55} fill="#ffffff"/>
    </g>}
    {visible&&<g data-testid="energy-transfer"
      data-energy-progress={flow.relayProgress} strokeLinecap="round">
      <path d={pathData(path)} pathLength={1} stroke="#b9eaff"
        strokeWidth={lineWidth*6} opacity=".82"
        strokeDasharray=".14 .86" strokeDashoffset={-flow.relayProgress!}
        filter={`url(#${id})`}/>
      <path d={pathData(path)} pathLength={1} stroke="#ffffff"
        strokeWidth={lineWidth*1.85} opacity=".94"
        strokeDasharray=".14 .86" strokeDashoffset={-flow.relayProgress!}/>
    </g>}
    {arrival>0&&<g data-testid="energy-terminal" opacity={arrival}>
      <circle cx={end.x} cy={end.y} r={radius*2.1} fill="#b9eaff"
        filter={`url(#${id})`}/>
      <circle cx={end.x} cy={end.y} r={radius*.65} fill="#ffffff"/>
    </g>}
  </g>;
});

/** The destination reacts AFTER the connection is traversed. This glows
 * briefly around the destination's original contours without translating
 * the figure or accidentally animating accent-role highlights. */
const ArrivalGlow=memo(function ArrivalGlow({shape,pulse,lineWidth}:{
  shape:Shape;pulse:number;lineWidth:number;
}){
  const id='energy-arrival-'+useId().replace(/:/g,'');
  const contours=useMemo(()=>contoursOf(shape),[shape]);
  const bounds=useMemo(()=>shapeBounds({...shape,x:0,y:0,rotation:0}),[shape]);
  if(pulse<=0)return null;
  const pad=Math.max(24,lineWidth*15),blur=Math.max(2.5,lineWidth*2.5);
  return <g data-testid="energy-arrival" data-energy-pulse={pulse}
    opacity={pulse} fill="none" pointerEvents="none">
    <defs><filter id={id} filterUnits="userSpaceOnUse"
      x={bounds.x-pad} y={bounds.y-pad} width={bounds.width+pad*2}
      height={bounds.height+pad*2} colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={blur}/>
    </filter></defs>
    {contours.map((contour,i)=><g key={i}>
      {contour.circle?<>
        <circle cx={contour.circle.x} cy={contour.circle.y} r={contour.circle.radius}
          stroke="#b9eaff" strokeWidth={lineWidth*5}
          filter={`url(#${id})`}/>
        <circle cx={contour.circle.x} cy={contour.circle.y} r={contour.circle.radius}
          stroke="#ffffff" strokeWidth={lineWidth*1.5}/>
      </>:<>
        <path d={pathData(contour)} stroke="#b9eaff"
          strokeWidth={lineWidth*5} filter={`url(#${id})`}/>
        <path d={pathData(contour)} stroke="#ffffff"
          strokeWidth={lineWidth*1.5}/>
      </>}
    </g>)}
  </g>;
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
          {flow?.[shape.id]&&!barMotion&&shape.role!=='decoration'&&
            <FlowGeometry shape={shape} flow={flow[shape.id]}
              ink={ink} lineWidth={shape.strokeWidth*(background.lineWidth??100)/100}/>}
          {flow?.[shape.id]&&
            (shape.kind==='circuit'||shape.kind==='branch-circuit')&&
            <RelayGeometry shape={shape} flow={flow[shape.id]}
              lineWidth={shape.strokeWidth*(background.lineWidth??100)/100}/>}
          {!!flow?.[shape.id]?.arrivalPulse&&shape.role!=='accent'&&
            <ArrivalGlow shape={shape} pulse={flow[shape.id].arrivalPulse!}
              lineWidth={shape.strokeWidth*(background.lineWidth??100)/100}/>}
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
                {artwork}
              </g>
            :artwork}
        </g>;
      })}
    </g>
    {textOverlay?.layer==='front'&&<TextOverlay settings={textOverlay} width={width} height={height} background={background} seconds={textSeconds}/>} 
  </svg>;
}
