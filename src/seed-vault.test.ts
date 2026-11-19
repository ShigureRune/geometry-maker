import {describe,expect,it} from 'vitest';
import {
  SEED_HISTORY_LIMIT,SEED_VAULT_KEY,SEED_VAULT_LIMIT,
  deleteBookmark,emptySeedVault,exportSeedCollection,importSeedCollection,
  isUsableSeed,loadSeedVault,moveSeedHistory,parseSeedVault,recordSeed,
  renameBookmark,saveBookmark,saveSeedVault,searchBookmarks,searchSeedHistory,seedFromSearch,seedShareUrl,
} from './seed-vault';

describe('seed vault and shareable seed URLs',()=>{
  it('tracks explicit seed commits with undo/redo and truncates branched history',()=>{
    let v=emptySeedVault('alpha');
    v=recordSeed(v,'beta');v=recordSeed(v,'gamma');v=recordSeed(v,'gamma');
    expect(v.history).toEqual(['alpha','beta','gamma']);
    expect(v.cursor).toBe(2);
    const back=moveSeedHistory(v,-1)!;
    expect(back.seed).toBe('beta');
    expect(back.vault.cursor).toBe(1);
    const forward=moveSeedHistory(back.vault,1)!;
    expect(forward.seed).toBe('gamma');
    expect(moveSeedHistory(v,1)).toBeNull();
    expect(moveSeedHistory(emptySeedVault('a'),-1)).toBeNull();
    v=recordSeed(back.vault,'delta');
    expect(v.history).toEqual(['alpha','beta','delta']);
    expect(v.cursor).toBe(2);
    for(let i=0;i<60;i++)v=recordSeed(v,'s'+i);
    expect(v.history.length).toBe(SEED_HISTORY_LIMIT);
    expect(v.history.at(-1)).toBe('s59');
    expect(v.cursor).toBe(SEED_HISTORY_LIMIT-1);
  });
  it('searches the complete bounded history newest-first without changing cursor or bookmarks',()=>{
    let vault=emptySeedVault('初期');
    for(let i=0;i<39;i++)vault=recordSeed(vault,'Star-'+i);
    const original=JSON.stringify(vault);
    const all=searchSeedHistory(vault,'');
    expect(all).toHaveLength(40);
    expect(all[0]).toEqual({seed:'Star-38',index:39});
    expect(all.at(-1)).toEqual({seed:'初期',index:0});
    expect(searchSeedHistory(vault,'star-1').map(item=>item.seed)).toEqual(
      ['Star-19','Star-18','Star-17','Star-16','Star-15','Star-14','Star-13','Star-12','Star-11','Star-10','Star-1']);
    expect(searchSeedHistory(vault,'STAR 38')).toEqual([{seed:'Star-38',index:39}]);
    expect(searchSeedHistory(vault,'  初期  ')).toEqual([{seed:'初期',index:0}]);
    expect(searchSeedHistory(vault,'not found')).toEqual([]);
    expect(JSON.stringify(vault)).toBe(original);
  });
  it('pins, renames, searches and deletes favorites with a firm capacity',()=>{
    let vault=emptySeedVault('alpha');
    vault=saveBookmark(vault,'alpha','第一候補');
    vault=saveBookmark(vault,'beta','Blue Star');
    vault=saveBookmark(vault,'alpha','  新しい名前  ');
    expect(vault.bookmarks).toHaveLength(2);
    expect(vault.bookmarks[0]).toEqual({seed:'alpha',name:'新しい名前'});
    vault=renameBookmark(vault,'beta','星屑');
    expect(searchBookmarks(vault,'星屑')).toEqual([{seed:'beta',name:'星屑'}]);
    expect(searchBookmarks(vault,'beta 星屑')).toHaveLength(1);
    expect(searchBookmarks(vault,'missing')).toHaveLength(0);
    vault=deleteBookmark(vault,'alpha');
    expect(vault.bookmarks).toEqual([{seed:'beta',name:'星屑'}]);
    expect(()=>saveBookmark(vault,' ','bad')).toThrow();
    expect(()=>saveBookmark(vault,'some','   ')).toThrow();
    expect(()=>renameBookmark(vault,'beta','x'.repeat(41))).toThrow();
    for(let i=0;i<SEED_VAULT_LIMIT-1;i++)vault=saveBookmark(vault,'seed-'+i,'Label '+i);
    expect(vault.bookmarks).toHaveLength(SEED_VAULT_LIMIT);
    expect(()=>saveBookmark(vault,'overflow','Over')).toThrow(/24/);
    expect(saveBookmark(vault,'beta','Updated').bookmarks).toHaveLength(SEED_VAULT_LIMIT);
  });
  it('exports only named favorites, then safely merges without touching the current seed',()=>{
    let original=emptySeedVault('active');
    original=saveBookmark(original,'a','A');
    original=saveBookmark(original,'b','B');
    const exported=exportSeedCollection(original);
    expect(exported).toEqual({format:'geometry-maker-seed-collection',version:1,
      bookmarks:[{seed:'b',name:'B'},{seed:'a',name:'A'}]});
    const next=recordSeed(emptySeedVault('unchanged'),'other');
    const merged=importSeedCollection(next,exported);
    expect(merged.added).toBe(2);
    expect(merged.skipped).toBe(0);
    expect(merged.vault.history).toEqual(['unchanged','other']);
    expect(merged.vault.cursor).toBe(1);
    const duplicate=importSeedCollection(merged.vault,exported);
    expect(duplicate.added).toBe(0);
    expect(duplicate.skipped).toBe(2);
    expect(duplicate.vault.bookmarks).toEqual(merged.vault.bookmarks);
  });
  it('rejects corrupt/oversized JSON and duplicate bookmark entries',()=>{
    let v=emptySeedVault('active');
    for(const invalid of [
      null,[],{format:'wrong',version:1,bookmarks:[]},
      {format:'geometry-maker-seed-collection',version:99,bookmarks:[]},
      {format:'geometry-maker-seed-collection',version:1,bookmarks:[{seed:'abc',name:''}]},
      {format:'geometry-maker-seed-collection',version:1,bookmarks:[{seed:'abc',name:'A'},{seed:'abc',name:'B'}]},
      {format:'geometry-maker-seed-collection',version:1,bookmarks:Array.from({length:101},(_,i)=>({seed:String(i),name:'n'}))},
    ])expect(()=>importSeedCollection(v,invalid)).toThrow();
    for(let i=0;i<SEED_VAULT_LIMIT;i++)v=saveBookmark(v,'seed'+i,'s'+i);
    const full=importSeedCollection(v,{format:'geometry-maker-seed-collection',version:1,
      bookmarks:[{seed:'extra',name:'extra'}]});
    expect(full.vault.bookmarks).toHaveLength(SEED_VAULT_LIMIT);
    expect(full.skipped).toBe(1);
    expect(isUsableSeed('x'.repeat(257))).toBe(false);
    expect(isUsableSeed('  ')).toBe(false);
  });
  it('loads persisted data and ignores malformed or unsupported versions',()=>{
    let value:string|null=null;
    const storage={getItem:(key:string)=>key===SEED_VAULT_KEY?value:null,
      setItem:(key:string,input:string)=>{if(key===SEED_VAULT_KEY)value=input;}};
    const saved=saveBookmark(recordSeed(emptySeedVault('one'),'two'),'one','First');
    expect(saveSeedVault(saved,storage)).toBe(true);
    expect(loadSeedVault('two',storage)).toEqual(saved);
    expect(loadSeedVault('three',storage).history).toEqual(['one','two','three']);
    expect(parseSeedVault(JSON.parse(value!))).toEqual(saved);
    value='not-json';
    expect(loadSeedVault('fresh',storage)).toEqual(emptySeedVault('fresh'));
    value='{"version":2,"history":[],"cursor":-1,"bookmarks":[]}';
    expect(loadSeedVault('fresh',storage)).toEqual(emptySeedVault('fresh'));
    expect(saveSeedVault(saved,{setItem:()=>{throw new Error('quota');}})).toBe(false);
    expect(loadSeedVault('safe',{getItem:()=>{throw new Error('denied');}}))
      .toEqual(emptySeedVault('safe'));
  });
  it('only applies bounded shared seeds and preserves site subpaths and other query values',()=>{
    const link=seedShareUrl('https://example.com/geometry-maker/?v=2#viewer','星と月 / 12');
    const url=new URL(link);
    expect(url.pathname).toBe('/geometry-maker/');
    expect(url.searchParams.get('v')).toBe('2');
    expect(url.searchParams.get('seed')).toBe('星と月 / 12');
    expect(url.hash).toBe('');
    expect(seedFromSearch(url.search)).toBe('星と月 / 12');
    expect(seedFromSearch('?seed='+encodeURIComponent(' '.repeat(3)))).toBeNull();
    expect(seedFromSearch('?seed='+encodeURIComponent('x'.repeat(257)))).toBeNull();
    expect(seedFromSearch('?unrelated=yes')).toBeNull();
    expect(()=>seedShareUrl('https://example.com/geometry-maker/','')).toThrow();
  });
});
