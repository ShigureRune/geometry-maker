import {seededRandom} from './scene';
import {isUsableSeed} from './seed-vault';

export type ExplorerMode='related'|'random';
export const EXPLORER_COUNTS=[4,8] as const;
export const EXPLORER_MAX=8;
export type ExplorerSet={seeds:string[];mode:ExplorerMode;source:string};

/** Each derived seed is fully reproducible and independent of render frame order. */
export function relatedSeed(source:string,index:number):string{
  if(!isUsableSeed(source)||!Number.isSafeInteger(index)||index<0)
    throw new Error('派生シードの条件が不正です。');
  const random=seededRandom('geometry-seed-explorer-v1\u0000'+source+'\u0000'+index);
  return Array.from({length:3},()=>Math.floor(random()*4294967296).toString(16).padStart(8,'0')).join('');
}

export function generateExplorerSet(
  source:string,count:4|8,mode:ExplorerMode,randomSeed?:()=>string,
):ExplorerSet{
  if(!isUsableSeed(source)||!EXPLORER_COUNTS.includes(count)||!['related','random'].includes(mode))
    throw new Error('候補生成の条件が不正です。');
  const seeds:string[]=[],seen=new Set([source]);
  for(let index=0;seeds.length<count&&index<128;index++){
    const candidate=mode==='random'?(randomSeed?.()??relatedSeed(source,index)):relatedSeed(source,index);
    if(isUsableSeed(candidate)&&!seen.has(candidate)){
      seeds.push(candidate);seen.add(candidate);
    }
  }
  // A broken random source must never lock the UI in an infinite retry loop.
  for(let index=128;seeds.length<count;index++){
    const candidate=relatedSeed(source,index);
    if(!seen.has(candidate)){seeds.push(candidate);seen.add(candidate);}
  }
  return {seeds,mode,source};
}

/** Toggle the active seed into the current board without duplicating candidates. */
export function withCurrentSeed(seeds:readonly string[],current:string):string[]{
  if(!isUsableSeed(current)||seeds.includes(current))return [...seeds];
  return [current,...seeds].slice(0,EXPLORER_MAX);
}

export function formatExplorerSeeds(seeds:readonly string[]):string{
  return seeds.join('\n');
}

export function explorerSelection(seeds:readonly string[],a:number|null,b:number|null){
  const valid=(index:number|null)=>index!==null&&Number.isInteger(index)&&
    index>=0&&index<seeds.length;
  return {a:valid(a)?seeds[a!]:null,b:valid(b)?seeds[b!]:null};
}
