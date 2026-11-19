import {MAX_SIZE,MIN_SIZE} from './settings';

export type ResolutionAxis='width'|'height';
export type ExportDimensions={width:number;height:number};

/** Preserve the *current export dimensions* when editing a locked axis.
 * Invalid intermediate input is handled by the form, never coerced to a
 * misleading valid resolution. */
export function resizeLockedResolution(
  current:ExportDimensions,axis:ResolutionAxis,next:number,
):ExportDimensions|null{
  if(![current.width,current.height,next].every(Number.isFinite)||
    current.width<=0||current.height<=0||!Number.isInteger(next))return null;
  const other=axis==='width'
    ?Math.round(next*current.height/current.width)
    :Math.round(next*current.width/current.height);
  if(next<MIN_SIZE||next>MAX_SIZE||other<MIN_SIZE||other>MAX_SIZE)return null;
  return axis==='width'?{width:next,height:other}:{width:other,height:next};
}

/** Portrait/landscape rotation must never modify the composition ratio
 * or alter the saved project until the user actually exports it. */
export function rotateExportResolution({width,height}:ExportDimensions):ExportDimensions{
  return {width:height,height:width};
}

export function exportMegapixels(width:number,height:number):string|null{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  return (width*height/1_000_000).toFixed(2);
}

/** Resize an export in one step, keeping both axes proportional.
 * Return null rather than silently clamping or distorting dimensions. */
export function scaleExportResolution(
  current:ExportDimensions,factor:number,
):ExportDimensions|null{
  if(!Number.isFinite(factor)||factor<=0||
    ![current.width,current.height].every(n=>Number.isInteger(n)&&n>=MIN_SIZE&&n<=MAX_SIZE))return null;
  const width=Math.round(current.width*factor);
  const height=Math.round(current.height*factor);
  if(![width,height].every(n=>Number.isSafeInteger(n)&&n>=MIN_SIZE&&n<=MAX_SIZE))return null;
  return {width,height};
}

/** Find the largest resolution with the current aspect ratio that is safe
 * for PNG. This only reduces oversize exports; it never upscales artwork. */
export function fitExportToPngLimit(
  current:ExportDimensions,maxPixels:number,
):ExportDimensions|null{
  if(![current.width,current.height].every(n=>Number.isInteger(n)&&n>=MIN_SIZE&&n<=MAX_SIZE)||
    !Number.isSafeInteger(maxPixels)||maxPixels<MIN_SIZE*MIN_SIZE)return null;
  if(current.width*current.height<=maxPixels)return {...current};
  // Rounding can push a mathematically fitted size a few pixels over the cap.
  let scale=Math.sqrt(maxPixels/(current.width*current.height));
  for(let attempt=0;attempt<6;attempt++){
    const next=scaleExportResolution(current,scale);
    if(next&&next.width*next.height<=maxPixels)return next;
    scale*=.999;
  }
  return null;
}
