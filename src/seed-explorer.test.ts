import {describe,expect,it} from 'vitest';
import {explorerSelection,formatExplorerSeeds,generateExplorerSet,relatedSeed,withCurrentSeed,planExplorerFavorites} from './seed-explorer';

describe('2D seed explorer selection',()=>{
  it('derives 4 or 8 deterministic distinct seeds from the same source',()=>{
    const a=generateExplorerSet('explorer-test-seed',4,'related');
    const b=generateExplorerSet('explorer-test-seed',4,'related');
    expect(a).toEqual(b);
    expect(a.seeds).toHaveLength(4);
    expect(new Set(a.seeds).size).toBe(4);
    expect(a.seeds).not.toContain('explorer-test-seed');
    expect(a.seeds.every(value=>/^[a-f0-9]{24}$/.test(value))).toBe(true);
    expect(generateExplorerSet('explorer-test-seed',8,'related').seeds.slice(0,4)).toEqual(a.seeds);
    expect(generateExplorerSet('another-seed',4,'related').seeds).not.toEqual(a.seeds);
    expect(relatedSeed('あいうえお',2)).toBe(relatedSeed('あいうえお',2));
  });
  it('accepts a real random generator and safely recovers from duplicates',()=>{
    let calls=0;
    const seq=['same','same','source','unique','other','fourth','fifth'];
    const result=generateExplorerSet('source',4,'random',()=>seq[calls++]??'fallback');
    expect(result.seeds).toEqual(['same','unique','other','fourth']);
    expect(calls).toBe(6);
    let attempts=0;
    const fallback=generateExplorerSet('source',4,'random',()=>{attempts++;return 'source';});
    expect(attempts).toBe(128);
    expect(fallback.seeds).toHaveLength(4);
    expect(new Set(fallback.seeds).size).toBe(4);
    expect(fallback.seeds).not.toContain('source');
  });
  it('bounds selection, current-seed insertion and newline exports',()=>{
    const seeds=generateExplorerSet('source',8,'related').seeds;
    expect(withCurrentSeed(seeds,'source')).toHaveLength(8);
    expect(withCurrentSeed(seeds,'source')[0]).toBe('source');
    expect(withCurrentSeed(seeds,'source').filter(s=>s==='source')).toHaveLength(1);
    expect(withCurrentSeed(seeds,' ')).toEqual(seeds);
    expect(withCurrentSeed(seeds,seeds[2])).toEqual(seeds);
    expect(formatExplorerSeeds(['one','two'])).toBe('one\ntwo');
    expect(explorerSelection(seeds,0,1)).toEqual({a:seeds[0],b:seeds[1]});
    expect(explorerSelection(seeds,-1,99)).toEqual({a:null,b:null});
    expect(explorerSelection([],0,1)).toEqual({a:null,b:null});
  });
  it('rejects empty or malformed candidate request parameters',()=>{
    expect(()=>relatedSeed('',0)).toThrow();
    expect(()=>relatedSeed('valid',-1)).toThrow();
    expect(()=>generateExplorerSet(' ',4,'related')).toThrow();
    expect(()=>generateExplorerSet('valid',10 as 4,'related')).toThrow();
    expect(()=>generateExplorerSet('valid',4,'unknown' as 'related')).toThrow();
  });
});

describe('batch explorer favorites planner',()=>{
  it('preserves gallery order, deduplicates and never mutates input',()=>{
    const candidates=['a','b','b','c','d'];
    const saved=['a'];
    const result=planExplorerFavorites(candidates,new Set(['a','b','c','d']),saved,3);
    expect(result).toEqual({seeds:['b','c'],alreadySaved:2,skippedFull:1});
    expect(candidates).toEqual(['a','b','b','c','d']);
    expect(saved).toEqual(['a']);
  });
  it('respects full capacity, selection and invalid seeds',()=>{
    expect(planExplorerFavorites(['a','b',' '],new Set(['a','b',' ']),['x','y'],2))
      .toEqual({seeds:[],alreadySaved:0,skippedFull:2});
    expect(planExplorerFavorites(['a','b'],new Set(['b']),[],24))
      .toEqual({seeds:['b'],alreadySaved:0,skippedFull:0});
    expect(planExplorerFavorites(['a'],new Set(['a']),[],NaN))
      .toEqual({seeds:[],alreadySaved:0,skippedFull:1});
  });
});
