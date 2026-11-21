import {MUSIC_VERSION, musicRandom, type Config} from './song';

/** Four-bar seeded bass phrase. Pitch selections are chord-tone roles, never arbitrary semitones. */
export type BassBeat = {step:number; chordTone:0|1|2; octave:boolean};
export type BassPhrase = readonly (readonly BassBeat[])[];
const GROOVES={
  sparse:[[0],[0,4],[0,3],[0,6]],
  relaxed:[[0,4],[0,3,6],[0,2,4],[0,4,7],[0,2,5]],
  driving:[[0,2,4,6],[0,2,3,4,6],[0,1,4,6],[0,3,4,7],[0,2,4,5,7]],
  syncopated:[[0,1,3,5,7],[0,2,3,5,6],[0,1,4,5,7],[0,3,4,6,7],[0,1,2,4,6,7]],
} as const;

function genreGrooves(genre:Config['genre']):keyof typeof GROOVES{
  if(genre==='アンビエント'||genre==='シネマティック')return 'sparse';
  if(genre==='Lo-fi'||genre==='チップチューン')return 'relaxed';
  if(genre==='ジャズ'||genre==='ファンク')return 'syncopated';
  return 'driving';
}

/**
 * Bar 1 states the rhythm, bar 2 offers an answer, bar 3 returns and bar 4
 * prepares the next chord. The choice is stable per seed and repeated A/A′.
 */
export function bassPhrase(config:Config,family:string,variation=0):BassPhrase{
  const random=musicRandom(JSON.stringify([
    MUSIC_VERSION,'seed-evolution-bass-v1',config.seed,config.genre,
    config.density,config.complexity,family,variation,
  ]));
  const templates=GROOVES[genreGrooves(config.genre)];
  const select=()=>templates[Math.floor(random()*templates.length)];
  const question=select(),answer=select();
  return Array.from({length:4},(_,bar)=>{
    const base=bar===0||bar===2?question:answer;
    const fill=bar===3&&config.density>=50;
    let steps=base.filter((step,i)=>
      i===0||random()<Math.min(.98,.49+config.density*.005+(fill?.08:0)));
    if(fill&&random()<.5&&steps.at(-1)!<7)steps=[...steps,7];
    // Keep the downbeat, and avoid duplicate onsets before quantization.
    steps=[...new Set([0,...steps])].sort((a,b)=>a-b);
    return steps.map((step,i):BassBeat=>({
      step,
      chordTone:i===0||random()>.12+config.complexity*.006
        ? 0
        : random()<.83?2:1,
      octave:i>0&&config.complexity>=45&&random()<.10+config.complexity*.002,
    }));
  });
}
