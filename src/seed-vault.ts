/** A small, independent seed history and named collection.
 * Only the seed is stored here; scene settings remain in the normal project/autosave.
 */
export const SEED_VAULT_KEY='geometry-studio-seed-vault-v1';
export const SEED_VAULT_LIMIT=24;
export const SEED_HISTORY_LIMIT=40;
export const SEED_LABEL_LIMIT=40;
export const SEED_COLLECTION_FORMAT='geometry-maker-seed-collection';

export type SeedBookmark={seed:string;name:string};
export type SeedVault={version:1;history:string[];cursor:number;bookmarks:SeedBookmark[]};
export type SeedCollection={format:typeof SEED_COLLECTION_FORMAT;version:1;bookmarks:SeedBookmark[]};

export function isUsableSeed(value:unknown):value is string{
  return typeof value==='string'&&value.trim().length>0&&value.length<=256;
}
export function isValidSeedName(value:unknown):value is string{
  return typeof value==='string'&&value.trim().length>0&&value.trim().length<=SEED_LABEL_LIMIT;
}
export function emptySeedVault(seed:string):SeedVault{
  const history=isUsableSeed(seed)?[seed]:[];
  return {version:1,history,cursor:history.length-1,bookmarks:[]};
}
function record(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function checkBookmarks(value:unknown,max:number):SeedBookmark[]{
  if(!Array.isArray(value)||value.length>max)throw new Error('シード一覧の件数が多すぎるか、形式が不正です。');
  const seen=new Set<string>(),bookmarks:SeedBookmark[]=[];
  for(const item of value){
    if(!record(item)||!isUsableSeed(item.seed)||!isValidSeedName(item.name))
      throw new Error('保存したシードの名前または値が不正です。');
    if(seen.has(item.seed))throw new Error('重複したシードが含まれています。');
    seen.add(item.seed);
    bookmarks.push({seed:item.seed,name:item.name.trim()});
  }
  return bookmarks;
}
export function parseSeedVault(value:unknown):SeedVault{
  if(!record(value)||value.version!==1||!Array.isArray(value.history)||
    value.history.length>SEED_HISTORY_LIMIT||
    !value.history.every(isUsableSeed)||
    (typeof value.cursor!=='number'||!Number.isInteger(value.cursor))||
    value.cursor< (value.history.length?0:-1)||
    value.cursor>=value.history.length)
    throw new Error('シード保管庫の履歴が不正です。');
  const bookmarks=checkBookmarks(value.bookmarks,SEED_VAULT_LIMIT);
  return {version:1,history:[...value.history],cursor:value.cursor as number,bookmarks};
}
export function loadSeedVault(initialSeed:string,storage?:Pick<Storage,'getItem'>):SeedVault{
  const fresh=emptySeedVault(initialSeed);
  try{
    const reader=storage??(typeof window!=='undefined'?window.localStorage:undefined);
    const raw=reader?.getItem(SEED_VAULT_KEY);
    if(!raw)return fresh;
    const saved=parseSeedVault(JSON.parse(raw));
    // When a project is restored/shared, keep its seed reachable.
    return isUsableSeed(initialSeed)&&saved.history[saved.cursor]!==initialSeed?
      recordSeed(saved,initialSeed):saved;
  }catch{return fresh;}
}
export function saveSeedVault(vault:SeedVault,storage?:Pick<Storage,'setItem'>):boolean{
  try{
    const writer=storage??(typeof window!=='undefined'?window.localStorage:undefined);
    if(!writer)return false;
    writer.setItem(SEED_VAULT_KEY,JSON.stringify(vault));
    return true;
  }catch{return false;}
}
export function recordSeed(vault:SeedVault,seed:string):SeedVault{
  if(!isUsableSeed(seed)||vault.history[vault.cursor]===seed)return vault;
  const updated=[...vault.history.slice(0,vault.cursor+1),seed].slice(-SEED_HISTORY_LIMIT);
  return {...vault,history:updated,cursor:updated.length-1};
}
export function moveSeedHistory(vault:SeedVault,direction:-1|1):{vault:SeedVault;seed:string}|null{
  const cursor=vault.cursor+direction;
  if(cursor<0||cursor>=vault.history.length)return null;
  return {vault:{...vault,cursor},seed:vault.history[cursor]};
}
/** Browse the entire bounded history, newest first, without modifying the cursor.
 * Searches are token-based and match the raw seed, including Japanese text. */
export function searchSeedHistory(vault:SeedVault,query:string):{seed:string;index:number}[]{
  const terms=query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return vault.history.map((seed,index)=>({seed,index})).reverse()
    .filter(item=>terms.every(term=>item.seed.toLocaleLowerCase().includes(term)));
}

export function saveBookmark(vault:SeedVault,seed:string,name:string):SeedVault{
  if(!isUsableSeed(seed)||!isValidSeedName(name))throw new Error('シードと名前を確認してください。');
  const existing=vault.bookmarks.find(item=>item.seed===seed);
  if(!existing&&vault.bookmarks.length>=SEED_VAULT_LIMIT)
    throw new Error('保存できるシードは24件までです。');
  const bookmarks=[
    {seed,name:name.trim()},
    ...vault.bookmarks.filter(item=>item.seed!==seed),
  ];
  return {...vault,bookmarks};
}
export function renameBookmark(vault:SeedVault,seed:string,name:string):SeedVault{
  if(!isValidSeedName(name))throw new Error('名前は1〜40文字で入力してください。');
  return {...vault,bookmarks:vault.bookmarks.map(item=>item.seed===seed?{...item,name:name.trim()}:item)};
}
export function deleteBookmark(vault:SeedVault,seed:string):SeedVault{
  return {...vault,bookmarks:vault.bookmarks.filter(item=>item.seed!==seed)};
}
export function searchBookmarks(vault:SeedVault,query:string):SeedBookmark[]{
  const terms=query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return vault.bookmarks.filter(item=>{
    const text=(item.name+' '+item.seed).toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  });
}
/** View-only ordering: persisted bookmarks remain newest-first and unchanged. */
export type BookmarkOrder='recent'|'name'|'seed';
export function browseBookmarks(vault:SeedVault,query:string,order:BookmarkOrder='recent'):SeedBookmark[]{
  const matches=searchBookmarks(vault,query);
  if(order==='recent')return matches;
  const compare=(a:string,b:string)=>a.localeCompare(b,'ja',{numeric:true,sensitivity:'base'});
  return [...matches].sort((a,b)=>order==='name'
    ?compare(a.name,b.name)||compare(a.seed,b.seed)
    :compare(a.seed,b.seed)||compare(a.name,b.name));
}

/** A selected-only export preserves the standard JSON schema and original bookmark order.
 * It never changes the source vault, and cannot export unknown seeds. */
export function exportSelectedSeedCollection(vault:SeedVault,selected:ReadonlySet<string>):SeedCollection{
  return {format:SEED_COLLECTION_FORMAT,version:1,
    bookmarks:vault.bookmarks.filter(item=>selected.has(item.seed))};
}
export function exportSeedCollection(vault:SeedVault):SeedCollection{
  return {format:SEED_COLLECTION_FORMAT,version:1,bookmarks:[...vault.bookmarks]};
}
/** Import adds unique saved seeds only; never changes the active scene or history. */
export function importSeedCollection(vault:SeedVault,input:unknown):{vault:SeedVault;added:number;skipped:number}{
  if(!record(input)||input.format!==SEED_COLLECTION_FORMAT||input.version!==1)
    throw new Error('幾何学メーカーのシード一覧JSONを選んでください。');
  const imported=checkBookmarks(input.bookmarks,100);
  const bookmarks=[...vault.bookmarks],known=new Set(bookmarks.map(item=>item.seed));
  let added=0,skipped=0;
  for(const item of imported){
    if(known.has(item.seed)||bookmarks.length>=SEED_VAULT_LIMIT){skipped++;continue;}
    bookmarks.push(item);known.add(item.seed);added++;
  }
  return {vault:{...vault,bookmarks},added,skipped};
}
export function seedFromSearch(search:string):string|null{
  try{
    const value=new URLSearchParams(search).get('seed');
    return isUsableSeed(value)?value:null;
  }catch{return null;}
}
/** Preserve the current host and GitHub Pages subpath without uploading project data. */
export function seedShareUrl(currentUrl:string,seed:string):string{
  if(!isUsableSeed(seed))throw new Error('共有するシードが不正です。');
  const url=new URL(currentUrl);
  url.searchParams.set('seed',seed);
  url.hash='';
  return url.toString();
}
