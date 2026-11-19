import type {ExplorerSet} from './seed-explorer';

export const EXPLORER_UNDO_LIMIT=12;
export type ExplorerTimeline={past:ExplorerSet[];present:ExplorerSet;future:ExplorerSet[]};

/** Transient, bounded exploration history. Does not modify saved projects or seed vaults. */
export function startExplorerTimeline(present:ExplorerSet):ExplorerTimeline{
  return {past:[],present,future:[]};
}
export function pushExplorerTimeline(timeline:ExplorerTimeline,next:ExplorerSet):ExplorerTimeline{
  if(timeline.present.mode===next.mode&&timeline.present.source===next.source&&
    timeline.present.seeds.length===next.seeds.length&&
    timeline.present.seeds.every((seed,i)=>seed===next.seeds[i]))return timeline;
  return {past:[...timeline.past,timeline.present].slice(-EXPLORER_UNDO_LIMIT),
    present:next,future:[]};
}
export function undoExplorerTimeline(timeline:ExplorerTimeline):ExplorerTimeline{
  if(!timeline.past.length)return timeline;
  return {past:timeline.past.slice(0,-1),present:timeline.past[timeline.past.length-1],
    future:[timeline.present,...timeline.future]};
}
export function redoExplorerTimeline(timeline:ExplorerTimeline):ExplorerTimeline{
  if(!timeline.future.length)return timeline;
  return {past:[...timeline.past,timeline.present].slice(-EXPLORER_UNDO_LIMIT),
    present:timeline.future[0],future:timeline.future.slice(1)};
}
