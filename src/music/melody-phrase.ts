import {MUSIC_VERSION, musicRandom, type Config} from './song';

/**
 * A seeded four-bar musical signature. Notes repeat by phrase family so
 * A/A′ retain a recognizable idea while B supplies a contrasting answer.
 * This is deliberately an abstract rhythm/contour blueprint: the composer
 * resolves actual pitches against the current chord on every bar.
 */
export type MelodyBlueprint = {
  bars: readonly (readonly number[])[];
  contour: readonly number[];
  register: number;
  articulation: number;
};

const CELLS:readonly (readonly number[])[] = [
  [0,2,4,6], [0,2,3,6], [0,1,3,5,7], [0,3,4,6],
  [0,1.5,4,6], [0,2,4,5.5,7], [0,1,2.5,4.5,6],
  [0,2,3.5,6], [0,1,4,5,6], [0,1.5,3.5,6],
  [0,2.5,4,6.5], [0,1,2,4,6], [0,3,5,7],
  [0,1.5,4.5,6.5], [0,2,5,7], [0,1,3,4,6.5],
];

/** Pure and repeatable; the same seed+section+settings yield the same motif. */
export function melodyBlueprint(config:Config, family:string, variation=0):MelodyBlueprint {
  const rand=musicRandom(JSON.stringify([
    MUSIC_VERSION,'seed-evolution-phrase-v2',config.seed,config.genre,family,variation,
    config.density,config.complexity,config.melodyStyle,
  ]));
  const pick=()=>CELLS[Math.floor(rand()*CELLS.length)];
  const question=pick(),response=pick();
  const count=config.melodyStyle==='歌う'?2
    : config.melodyStyle==='疾走'?8
    : config.genre==='アンビエント'?2
    : Math.max(2,Math.min(7,Math.round(2+config.density*.043)));
  const bars=Array.from({length:4},(_,phraseBar)=>{
    const source=phraseBar===0||phraseBar===2?question:response;
    let steps:number[];
    if(config.melodyStyle==='疾走')steps=[0,1,2,3,4,5,6,7];
    else {
      // The second half may start with a rest. Ending phrases resolve with
      // one long note rather than mechanically filling every eighth note.
      steps=[...source];
      if(phraseBar===2&&rand()<.55)steps=steps.filter(step=>step>=1);
      if(phraseBar===3)steps=steps.filter(step=>step<6.5);
      if(config.melodyStyle==='歌う'||config.genre==='アンビエント')
        steps=steps.filter((step,i)=>i===0||step>=4);
      if(steps.length>count) {
        const last=steps.at(-1)!;
        const keep=steps.slice(0,Math.max(1,count-1));
        steps=[...new Set([...keep,last])];
      }
      if(steps.length<count && config.density>=65 && config.melodyStyle!=='歌う' && config.genre!=='アンビエント'){
        // A controlled extra offbeat adds energy without randomizing meter.
        const pickup=[1.5,2.5,3.5,5.5,6.5][Math.floor(rand()*5)];
        if(!steps.some(step=>Math.abs(step-pickup)<.6))steps.push(pickup);
      }
    }
    if(phraseBar===3&&config.melodyStyle!=='疾走'&&steps.length>1)
      steps=steps.filter(step=>step<5.5);
    steps.sort((a,b)=>a-b);
    return steps.length?steps:[0];
  });
  // Characterful intervals, but not unrestricted chromatic leaps.
  const contour=Array.from({length:12},(_,i)=>{
    const signed=Math.floor(rand()*7)-3;
    return i===0?0:signed;
  });
  return {
    bars,
    contour,
    register:[-5,-3,-1,0,2,4,6][Math.floor(rand()*7)],
    articulation:.64+rand()*.28,
  };
}
