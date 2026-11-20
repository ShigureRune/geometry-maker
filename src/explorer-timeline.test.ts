import {describe,it,expect} from 'vitest';
import {startExplorerTimeline,pushExplorerTimeline,undoExplorerTimeline,redoExplorerTimeline,EXPLORER_UNDO_LIMIT} from './explorer-timeline';
import type {ExplorerSet} from './seed-explorer';
const batch=(n:number):ExplorerSet=>({seeds:['seed-'+n],source:'source',mode:'related'});
describe('explorer timeline',()=>{
  it('supports multiple undo and redo steps without changing source snapshots',()=>{
    const original=startExplorerTimeline(batch(0));
    let t=pushExplorerTimeline(pushExplorerTimeline(original,batch(1)),batch(2));
    expect(undoExplorerTimeline(undoExplorerTimeline(t)).present.seeds).toEqual(['seed-0']);
    t=undoExplorerTimeline(t);
    expect(redoExplorerTimeline(t).present.seeds).toEqual(['seed-2']);
    expect(original.present.seeds).toEqual(['seed-0']);
  });
  it('invalidates redo after branching and ignores duplicate batches',()=>{
    let t=startExplorerTimeline(batch(0));
    t=pushExplorerTimeline(t,batch(1));
    t=undoExplorerTimeline(t);
    t=pushExplorerTimeline(t,batch(3));
    expect(t.future).toEqual([]);
    expect(redoExplorerTimeline(t)).toBe(t);
    expect(pushExplorerTimeline(t,batch(3))).toBe(t);
  });
  it('keeps at most twelve previous batches',()=>{
    let t=startExplorerTimeline(batch(0));
    for(let n=1;n<=30;n++)t=pushExplorerTimeline(t,batch(n));
    expect(t.past).toHaveLength(EXPLORER_UNDO_LIMIT);
    for(let n=0;n<20;n++)t=undoExplorerTimeline(t);
    expect(t.present.seeds).toEqual(['seed-18']);
    expect(t.future).toHaveLength(12);
  });
});
