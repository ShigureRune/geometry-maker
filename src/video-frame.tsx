import {createFigureColorCache} from './scroll-figure-colors';
import {createScrollWorld} from './scroll-world';
import { AmbientView } from './AmbientView';
import {figureScrollAngle,type AmbientInput} from './ambient';
import { renderToStaticMarkup } from 'react-dom/server';
import { Preview } from './Preview';
import {progressAt,schedule,motionPresetParameters,type AnimationSettings} from './animation';
import {createFigureMotionPlan,figureFlowAt} from './figure-motion';
import { serializeArtwork } from './export';
import type { Background, Scene, Shape } from './scene';
import type {TextOverlaySettings} from './text-overlay';
import {MAGIC_ALGORITHM_VERSION,magicCircleMotion,type MagicCircleSettings} from './magic-circle';
export type VideoArtwork = { textOverlay?:TextOverlaySettings; magicSettings?:MagicCircleSettings; ambient?:AmbientInput; scene: Scene; candidates: Shape[]; seed: string; background: Background; animation: AnimationSettings };
/** Stateless time-based rendering, shared with Preview; never reads playback position. */
export function createVideoRenderer(input: VideoArtwork) {
  const { scene, candidates, seed, background, animation, ambient, textOverlay, magicSettings } = structuredClone(input);
  const world=ambient?.settings.mode==='scroll'&&ambient.settings.loop==='evolving'?createScrollWorld(ambient):undefined;
  const figureCache=createFigureColorCache();
  const cues = schedule(candidates, seed, scene.version);
  const postGrowthPlan=createFigureMotionPlan(scene,seed);
  const growthEnd=animation.animationDuration/animation.playbackSpeed;
  return (seconds: number, width: number, height: number) => {
    const time = seconds >= animation.animationDuration / animation.playbackSpeed ? 1 : Math.max(0, seconds * animation.playbackSpeed / animation.animationDuration);
    const growth = time >= 1 || (scene.version===MAGIC_ALGORITHM_VERSION&&!animation.animationEnabled) || (!animation.animationEnabled && time > 0) ? undefined : Object.fromEntries(scene.shapes.map(shape => [shape.id, progressAt(cues[shape.id], time, animation.easingType)]));
    const after=seconds-growthEnd;
    const motion=magicSettings&&scene.version===MAGIC_ALGORITHM_VERSION
      ?magicCircleMotion(scene,magicSettings,seconds,growthEnd)
      :undefined;
    const motionParams=motionPresetParameters(animation);
    const flow=scene.version!==MAGIC_ALGORITHM_VERSION&&
      animation.animationEnabled&&animation.continuousMotion&&after>0
        ?figureFlowAt(postGrowthPlan,after,
          motionParams.strength,motionParams.speed):undefined;
    const markup = renderToStaticMarkup(ambient?.settings.enabled?<AmbientView input={ambient} seconds={seconds} world={world} figureCache={figureCache}/>:<Preview scene={scene} background={background} growth={growth} motion={motion} flow={flow} textOverlay={textOverlay} textSeconds={seconds} gridSeconds={seconds} gridFigureAngle={ambient?figureScrollAngle(ambient.settings,ambient.ratio):undefined} />);
    const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
    return serializeArtwork(svg, width, height, background.mode === 'solid' ? background.solid : background.colors[0]);
  };
}
export async function drawVideoFrame(context: CanvasRenderingContext2D, svg: string, signal: AbortSignal) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode(); signal.throwIfAborted();
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(image, 0, 0, context.canvas.width, context.canvas.height);
  } finally { URL.revokeObjectURL(url); }
}
