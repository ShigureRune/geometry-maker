import {Midi} from '@tonejs/midi';
import {describe,expect,it} from 'vitest';
import {chordPhrase,voicedChord} from './chord-phrase';
import {generateSong} from './generate';
import {exportMidi} from './midi';
import {validateNotes} from './project';
import {BAR,DEFAULT_CONFIG,GENRES} from './song';

describe('SEED EVOLUTION: chord accompaniment and voice-leading',()=>{
  it('produces stable, rhythmic four-bar identities with substantial seed variation',()=>{
    const identities=new Set<string>();
    const config={...DEFAULT_CONFIG,genre:'Lo-fi' as const,density:80};
    for(let seed=0;seed<256;seed++){
      const item={...config,seed:'chord-groove-'+seed};
      const phrase=chordPhrase(item,'A');
      expect(chordPhrase(item,'A')).toEqual(phrase);
      expect(phrase.bars).toHaveLength(4);
      for(const bar of phrase.bars){
        expect(bar.length).toBeGreaterThan(0);
        for(let i=0;i<bar.length;i++){
          expect(bar[i].step).toBeGreaterThanOrEqual(0);
          expect(bar[i].step).toBeLessThan(8);
          if(i>0)expect(bar[i].step).toBeGreaterThan(bar[i-1].step);
          expect(bar[i].gate).toBeGreaterThanOrEqual(.32);
          expect(bar[i].gate).toBeLessThanOrEqual(.97);
          expect(bar[i].accent).toBeGreaterThan(0);
        }
      }
      identities.add(phrase.bars.map(bar=>bar.map(hit=>hit.step).join(',')).join('|'));
    }
    expect(identities.size).toBeGreaterThan(70);
  });
  it('keeps chord roots and pitch classes, while moving upper voices smoothly',()=>{
    const chords=[[48,52,55],[53,57,60],[57,60,64],[48,52,55]];
    for(const texture of ['compact','open','warm'] as const){
      let previous:number[]|undefined;
      for(const chord of chords){
        const result=voicedChord(chord,previous,texture);
        expect(result).toHaveLength(chord.length);
        expect(result[0]).toBe(chord[0]);
        expect(result.map(p=>p%12)).toEqual(chord.map(p=>p%12));
        expect(result.every(p=>p>=45&&p<=84)).toBe(true);
        previous=result;
      }
    }
  });
  it('keeps every genre playable, in scale and collision-free across a seed population',()=>{
    const signatures=new Set<string>();
    for(const genre of GENRES){
      for(let seed=0;seed<12;seed++){
        const config={...DEFAULT_CONFIG,genre,seed:'chord-arranged-'+seed,
          bars:16 as const,trackCount:8 as const,density:82,complexity:85,swing:80};
        const song=generateSong(config);
        const chords=song.tracks.find(track=>track.id==='chords')!;
        expect(()=>validateNotes(chords.notes,song.totalTicks)).not.toThrow();
        expect(chords.notes.length).toBeGreaterThan(0);
        expect(chords.notes.every(note=>note.pitch>=0&&note.pitch<=127&&note.velocity>=1&&note.velocity<=127)).toBe(true);
        expect(generateSong(config).tracks.find(track=>track.id==='chords')!.notes).toEqual(chords.notes);
        if(genre==='Lo-fi'){
          signatures.add(chords.notes.slice(0,60).map(n=>[n.startTick,n.durationTicks,n.pitch].join(':')).join('|'));
        }
        // Converting the score to MIDI must preserve all chord note events.
        if(seed===0){
          const exported=new Midi(exportMidi(song));
          expect(exported.tracks[1].notes.length).toBe(chords.notes.length);
        }
      }
    }
    expect(signatures.size).toBeGreaterThan(9);
  },30_000);
  it('performs sparse intros, energetic contrasts and a stable final tonic',()=>{
    for(let seed=0;seed<12;seed++){
      const song=generateSong({...DEFAULT_CONFIG,genre:'ファンク',seed:'contrast-chords-'+seed,
        bars:32 as const,trackCount:4 as const});
      const chords=song.tracks.find(track=>track.id==='chords')!.notes;
      const intro=song.sections.find(s=>s.name==='Intro')!;
      const climax=song.sections.find(s=>s.name==='B')!;
      const hits=(section:typeof intro)=>{
        const onsets=new Set(chords.filter(n=>n.startTick>=section.startBar*BAR&&
          n.startTick<(section.startBar+section.bars)*BAR).map(n=>n.startTick));
        return onsets.size/section.bars;
      };
      expect(hits(climax)).toBeGreaterThan(hits(intro));
      const final=chords.filter(n=>n.startTick===(song.config.bars-1)*BAR);
      expect(final.length).toBeGreaterThanOrEqual(3);
      expect(final[0].pitch%12).toBe(song.config.key);
    }
  });
});
