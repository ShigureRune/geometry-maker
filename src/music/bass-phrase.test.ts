import {describe,expect,it} from 'vitest';
import {bassPhrase} from './bass-phrase';
import {generateSong} from './generate';
import {validateNotes} from './project';
import {BAR,DEFAULT_CONFIG,GENRES,PPQ} from './song';

describe('SEED EVOLUTION — harmonic bass groove',()=>{
  it('has distinct reproducible four-bar rhythmic patterns across 192 seeds',()=>{
    const rhythms=new Set<string>(),figures=new Set<string>();
    for(let i=0;i<192;i++){
      const config={...DEFAULT_CONFIG,genre:'ファンク' as const,seed:'bass-evolution-'+i,density:70,complexity:60};
      const a=bassPhrase(config,'A'),again=bassPhrase(config,'A');
      expect(a).toEqual(again);
      expect(a).toHaveLength(4);
      for(const bar of a){
        expect(bar.length).toBeGreaterThan(0);
        expect(bar[0].step).toBe(0);
        expect(bar.every((beat,index)=>beat.step>=0&&beat.step<8&&
          (index===0||beat.step>bar[index-1].step))).toBe(true);
      }
      rhythms.add(a.map(bar=>bar.map(beat=>beat.step).join(',')).join('|'));
      figures.add(JSON.stringify(a));
    }
    expect(rhythms.size).toBeGreaterThan(75);
    expect(figures.size).toBeGreaterThan(185);
  });

  it('keeps 11 genres rhythmically valid and root-focussed across 64 varied seeds',()=>{
    const rhythms=new Set<string>();
    for(const genre of GENRES){
      for(let i=0;i<64;i++){
        const config={...DEFAULT_CONFIG,genre,seed:'bass-harmony-'+i,
          bars:16 as const,density:84,complexity:83,swing:100};
        const song=generateSong(config);
        const bass=song.tracks.find(track=>track.id==='bass')!.notes;
        expect(bass.length).toBeGreaterThan(0);
        expect(()=>validateNotes(bass,song.totalTicks)).not.toThrow();
        const chords=song.tracks.find(track=>track.id==='chords')!.notes;
        // Each bass pitch class is a currently sounding harmony tone.
        for(const note of bass){
          const chord=chords.filter(chord=>chord.startTick<=note.startTick &&
            chord.startTick+chord.durationTicks>note.startTick);
          if(chord.length)expect(chord.some(chord=>chord.pitch%12===note.pitch%12)).toBe(true);
        }
        expect(bass.every(note=>note.pitch>=34&&note.pitch<=59)).toBe(true);
        const last=bass.find(note=>note.startTick===(config.bars-1)*BAR);
        expect(last).toBeDefined();
        expect(last!.pitch%12).toBe(config.key%12);
        const until=new Map<number,number>();
        for(const note of bass){
          expect(note.startTick).toBeGreaterThanOrEqual(until.get(note.pitch)??0);
          until.set(note.pitch,note.startTick+note.durationTicks);
        }
        if(i<12 && genre!=='エピック')
          expect(generateSong(config).tracks[2].notes).toEqual(bass);
        if(genre==='ファンク'&&i<64)
          rhythms.add(bass.slice(0,25).map(n=>[n.startTick/PPQ,n.pitch].join(':')).join('|'));
      }
    }
    expect(rhythms.size).toBeGreaterThan(58);
  });

  it('keeps A and A′ groove families related and rerolls bass independently',()=>{
    const config={...DEFAULT_CONFIG,genre:'Lo-fi' as const,seed:'bass-reroll-suite',
      bars:32 as const,trackCount:8 as const};
    expect(bassPhrase(config,'A')).toEqual(bassPhrase(config,'A'));
    expect(bassPhrase(config,'A')).not.toEqual(bassPhrase(config,'B'));
    const original=generateSong(config);
    const after=generateSong(config,{previous:original,reroll:'bass'});
    expect(after.tracks[2].notes).not.toEqual(original.tracks[2].notes);
    expect(after.tracks[1].notes).toEqual(original.tracks[1].notes);
    expect(after.tracks[0].notes).toEqual(original.tracks[0].notes);
  });
});
