import {MUSIC_VERSION, musicRandom, type Config} from './song';

/**
 * Four-bar accompaniment identities. Each seed chooses how the harmony is
 * actually performed, not merely which chords are used. A and A′ remember the
 * same groove; B develops a different answer. All onsets stay on a musical grid.
 */
export type ChordBeat={step:number; gate:number; accent:number};
export type ChordPhrase={
  bars:readonly (readonly ChordBeat[])[];
  texture:'compact'|'open'|'warm';
};

const GROOVES={
  sustained:[[0],[0],[0],[0,4]],
  soft:[[0,4],[0,3],[0,4,6],[0,2,4]],
  swung:[[0,3,5.5],[0,3.5,6],[0,2.5,5.5],[0,4,6.5]],
  pulse:[[0,2,4,6],[0,2,3.5,4,6],[0,1.5,4,6],[0,2,4,5.5,7]],
  offbeat:[[1,3,5,7],[1,3.5,5,7],[0,2.5,5.5,7],[1,4,5.5,7]],
  driving:[[0,3,4,6],[0,2,4,6.5],[0,2,3.5,5.5],[0,1.5,4,5.5,7]],
} as const;

type Groove=keyof typeof GROOVES;
function palette(genre:Config['genre']):readonly Groove[]{
  if(genre==='アンビエント'||genre==='シネマティック')return ['sustained','soft'];
  if(genre==='Lo-fi'||genre==='ジャズ')return ['soft','swung'];
  if(genre==='ファンク')return ['offbeat','swung'];
  if(genre==='テクノ')return ['offbeat','pulse'];
  if(genre==='EDM'||genre==='ドラムンベース')return ['pulse','driving'];
  if(genre==='シンセウェーブ')return ['pulse','soft','driving'];
  return ['soft','pulse','driving'];
}

function baseGate(genre:Config['genre']){
  if(genre==='アンビエント'||genre==='シネマティック')return .93;
  if(genre==='ファンク'||genre==='テクノ')return .48;
  if(genre==='Lo-fi'||genre==='ジャズ')return .70;
  return .68;
}

export function chordPhrase(config:Config,family:string,variation=0):ChordPhrase{
  const rand=musicRandom(JSON.stringify([
    MUSIC_VERSION,'seed-evolution-chord-accompaniment-v1',config.seed,config.genre,
    family,variation,config.density,config.complexity,
  ]));
  const kinds=palette(config.genre);
  const choose=()=>GROOVES[kinds[Math.floor(rand()*kinds.length)]];
  const question=choose()[Math.floor(rand()*4)];
  const answer=choose()[Math.floor(rand()*4)];
  const texture=(['compact','open','warm'] as const)[Math.floor(rand()*3)];
  const sustain=baseGate(config.genre);
  const bars=Array.from({length:4},(_,phraseBar):ChordBeat[]=>{
    const source=phraseBar%2===0?question:answer;
    let steps:number[]=[...source];
    if(phraseBar===2 && steps.length>2 && rand()<.4)
      steps=steps.filter((_,i)=>i!==steps.length-1);
    if(phraseBar===3 && config.density>55 && steps.length<6 && rand()<.6){
      const pickup=steps.at(-1)!<6?6.5:7;
      steps.push(pickup);
    }
    steps=[...new Set(steps)].sort((a,b)=>a-b);
    // The groove itself belongs to the phrase, while note velocities can
    // gently shape a question vs. an answer inside the same four-bar cell.
    return steps.map((step,i)=>({
      step,
      gate:Math.max(.32,Math.min(.97,sustain+(rand()-.5)*.12)),
      accent:i===0?1:step%4===0?.85:.72,
    }));
  });
  return {bars,texture};
}

/**
 * Maintain a root-position harmonic foundation while moving upper voices
 * between nearby octave choices. No arbitrary chromatic notes or collisions.
 */
export function voicedChord(harmony:readonly number[],previous:readonly number[]|undefined,
  texture:ChordPhrase['texture']):number[]{
  const root=harmony[0];
  return harmony.map((pitch,voice)=>{
    if(voice===0)return pitch;
    const choices=[pitch-12,pitch,pitch+12]
      .filter(p=>p>=root && p>=45 && p<=84);
    if(choices.length===0)return pitch;
    const color=texture==='open'&&voice>=2?8:texture==='warm'&&voice>=2?-5:0;
    const desired=pitch+color;
    const anchor=previous?.[voice];
    const best=choices.slice().sort((a,b)=>{
      const score=(p:number)=>(anchor===undefined?0:Math.abs(anchor-p)*.68)
        +Math.abs(desired-p)*.32+(p<root?24:0);
      return score(a)-score(b)||a-b;
    });
    return best[0];
  });
}
