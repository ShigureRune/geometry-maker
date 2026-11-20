import {RATIOS,type Ratio} from './scene';
import {pngBlob,serializeArtwork} from './export';
import {fileStem} from './settings';

export type PreviewScreenshot={
  blob:Blob;
  width:number;height:number;
  ratio:Ratio;mode:'2d'|'3d';filename:string;
  /** Capture-time seed: later editor changes cannot change the shared caption. */
  seed:string;
};

/** Screenshot proportions always come from the LIVE canvas ratio, never from
 * the separate export panel's custom dimensions. Includes A4 orientations. */
export function previewScreenshotSize(ratio:Ratio):{width:number;height:number}{
  const [width,height]=RATIOS[ratio];
  return {width,height};
}

export function previewScreenshotFilename(seed:string,version:string,ratio:Ratio){
  const {width,height}=previewScreenshotSize(ratio);
  return `${fileStem(seed,version)}_screenshot_${width}x${height}.png`;
}

/** Capture the SVG actually displayed on screen (including current animation
 * state), not the completed/static export used by the main export panel. */
export function captureLiveSvg(svg:SVGSVGElement,ratio:Ratio):Promise<Blob>{
  const {width,height}=previewScreenshotSize(ratio);
  return pngBlob(serializeArtwork(svg,width,height,'#101318'),width,height);
}

/** The exact seed used to generate this PNG should travel with its caption. */
export function screenshotShareCaption(seed:string):string{
  return `幾何学メーカーで作った作品をシェア！ 📸✨\nシード値：${seed||'（空文字）'}`;
}
export function screenshotShareText(seed:string,appUrl:string):string{
  return `${screenshotShareCaption(seed)}\n${appUrl}`;
}
/** Browser X intent can prefill the seed and URL, but cannot attach media. */
export function screenshotXIntent(appUrl:string,seed:string){
  const url=new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text',screenshotShareCaption(seed));
  url.searchParams.set('url',appUrl);
  return url.toString();
}
