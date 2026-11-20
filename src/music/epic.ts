import {BAR, MUSIC_VERSION, PPQ, clamp, musicRandom, noteOrder,
  type Config, type Note, type Part, type Section} from './song';

/**
 * Epic uses an independent, phrase-led arranger.
 * The other genres retain their original note generation.
 *
 * The early bars are intentionally sparse; drums and ostinati enter in stages.
 * The B sections contain the recurring heroic theme, with a heavier second pass.
 */
export function generateEpicNotes(part:Part,config:Config,sections:Section[],variation:number,chords:number[][]):Note[] {
  const random=musicRandom(JSON.stringify([MUSIC_VERSION,'epic-theme-v2',config.seed,part,variation]));
  const notes:Note[]=[];
  const seen=new Set<string>();
  const stepTicks=PPQ/2;
  const add=(bar:number,step:number,pitch:number,length:number,velocity:number)=>{
    const startTick=bar*BAR+Math.round(step*stepTicks);
    if(startTick>=config.bars*BAR)return;
    const midi=clamp(Math.round(pitch),0,127);
    const key=startTick+':'+midi;
    if(seen.has(key))return;
    seen.add(key);
    notes.push({id:part+'-'+notes.length,pitch:midi,startTick,
      durationTicks:Math.max(1,Math.min(Math.round(length),config.bars*BAR-startTick)),
      velocity:clamp(Math.round(velocity),1,127)});
  };
  const motifVariants=[[0,2,1,3],[0,1,2,3],[1,2,0,3]];
  const motif=motifVariants[Math.floor(random()*motifVariants.length)];
  const sectionsByBar=Array.from({length:config.bars},(_,bar)=>
    sections.find(s=>bar>=s.startBar && bar<s.startBar+s.bars)!);

  for(let bar=0;bar<config.bars;bar++){
    const section=sectionsByBar[bar],name=section.name;
    const intro=name==='Intro',outro=name==='Outro',build=name==='Build',
      climax=name.startsWith('B'),second=name==='B′';
    const last=bar===config.bars-1;
    const within=(bar-section.startBar)/Math.max(1,section.bars-1);
    const progression=bar/Math.max(1,config.bars-1);
    const active=intro?.24 : outro?.43 : build?.48+.52*within : climax?(second?1.20:1.06) : .56+.10*progression;
    const velocity=(base:number)=>clamp(Math.round(base*active+(random()-.5)*5),1,127);
    const harmony=chords[bar];
    const root=harmony[0],third=harmony[1]??root+3,fifth=harmony[2]??root+7;
    const phrase=(bar-section.startBar)%4;
    const pulse=[0,2,4,6];
    // Finale: one clear tonic resolution instead of another loop.
    if(last){
      if(part==='melody')add(bar,0,config.key+72,BAR-80,98);
      if(part==='chords')for(const note of harmony.slice(0,3))add(bar,0,note,BAR-80,98);
      if(part==='bass')add(bar,0,config.key+36,BAR-80,108);
      if(part==='drums')add(bar,0,36,185,112);
      if(part==='pad')for(const note of harmony.slice(0,3))add(bar,0,note+12,BAR-80,75);
      continue;
    }

    if(part==='melody'){
      // The motif repeats as a recognizable statement, not randomized eighth notes.
      // First 4-8 bars leave silence and long notes; climax uses wider, higher phrases.
      if(intro && bar%2===1)continue;
      const tones=[root+12,third+12,fifth+12,root+24];
      const phraseOrder=[motif[phrase],motif[(phrase+2)%4],motif[(phrase+1)%4],motif[(phrase+3)%4]];
      const steps=intro?[0]:climax?[0,3,4,6]:build?[0,4,6]:outro?[0,4]:[0,4];
      steps.forEach((step,index)=>{
        const tone=tones[phraseOrder[index]]+(climax && index===0?0:0);
        const length=(steps[index+1]??8)*stepTicks-step*stepTicks-(climax?45:65);
        const accent=(index===0?12:0)+(climax?8:0);
        add(bar,step,clamp(tone,59,88),length,velocity(66+accent));
      });
    }else if(part==='chords'){
      // Sustained, low-register stacks replace the staccato two-beat piano stabs.
      const strikes=intro||outro?[0]:build&&within>.62?[0,4]:climax?[0,4]:[0];
      strikes.forEach((step,index)=>{
        const duration=(strikes[index+1]??8)*stepTicks-step*stepTicks-42;
        [root,third,fifth].forEach((pitch,i)=>add(bar,step,pitch,duration,velocity(58+(i===0?7:0))));
        if(climax)add(bar,step,root+12,duration,velocity(63));
      });
    }else if(part==='bass'){
      const strikes=intro||outro?[0]:build?[0,4,6]:climax?pulse:[0,4];
      strikes.forEach((step,index)=>{
        const duration=Math.min((strikes[index+1]??8)*stepTicks-step*stepTicks-35,climax?435:880);
        add(bar,step,root-12,duration,velocity(83+(step===0?9:0)));
        if(climax&&step===0)add(bar,step,root,duration,velocity(72));
      });
    }else if(part==='drums'){
      if(intro){
        if(bar===section.startBar || bar===section.startBar+section.bars-1)
          add(bar,0,36,180,velocity(92));
      }else if(outro){
        add(bar,0,36,180,velocity(85));
      }else{
        for(const step of climax?[0,2,4,6]:build?[0,4]:[0])
          add(bar,step,36,175,velocity(climax?106:95));
        add(bar,4,38,160,velocity(climax?104:88));
        if(climax||build){
          for(const step of climax?[0,1,2,3,4,5,6,7]:within>.5?[0,2,4,5,6,7]:[0,2,4,6]){
            // Kick/snare and hat are different pitches; no same-note collisions.
            add(bar,step,step===7 && (phrase===3 || second)?46:42,110,velocity(63));
          }
        }
        if(build&&within>.65 || second && phrase===3)add(bar,7,46,110,velocity(98));
      }
    }else if(part==='arp'){
      // Pulsing strings start with the build, never tinkle over the quiet piano intro.
      if(!build&&!climax)continue;
      const steps=climax?[0,2,4,6]:within>.5?[0,2,4,5,6,7]:[0,4];
      steps.forEach((step,i)=>{
        const pitch=[root,third,fifth,third][(i+phrase)%4]+12;
        add(bar,step,pitch,Math.min(220,(steps[i+1]??8)*stepTicks-step*stepTicks-20),velocity(69));
      });
    }else if(part==='pad'){
      if(intro&&bar%2)continue;
      for(const pitch of [root,third,fifth])
        add(bar,0,pitch+12,BAR-70,velocity(climax?68:48));
    }else if(part==='counter'){
      // High answer only in the payoff; no competing lead during the setup.
      if(!climax)continue;
      const tone=phrase%2===0?fifth+12:third+12;
      add(bar,4,tone,3*stepTicks+120,velocity(64));
    }else if(part==='pulse'){
      if(intro||outro)continue;
      const steps=build&&within>.65?[0,1,2,3,4,5,6,7]:climax?[0,2,4,6]:[0,4];
      steps.forEach((step,index)=>{
        add(bar,step,root,Math.min(225,(steps[index+1]??8)*stepTicks-step*stepTicks-20),velocity(66));
      });
    }
  }
  // Notes of the same pitch may not overlap in a project or exported MIDI.
  notes.sort(noteOrder);
  const nextStart=new Map<number,number>();
  for(let i=notes.length-1;i>=0;i--){
    const note=notes[i],next=nextStart.get(note.pitch);
    if(next!==undefined)note.durationTicks=Math.max(1,Math.min(note.durationTicks,next-note.startTick));
    nextStart.set(note.pitch,note.startTick);
  }
  return notes;
}
