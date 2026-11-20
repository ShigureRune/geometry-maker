import {Midi} from '@tonejs/midi';
import {describe, expect, it} from 'vitest';
import {audioPlan} from './audio';
import {generateSong} from './generate';
import {exportMidi} from './midi';
import {musicProjectText, parseMusicProject, validateNotes} from './project';
import {noteIndex} from './roll-layout';
import {BAR, DEFAULT_CONFIG, GENRES, PPQ, secToTick, tickToSec} from './song';

describe('Seed Music Studio',()=>{
  it.each(GENRES)('generates repeatable arrangement, harmony and playable notes for %s',genre=>{
    const config={...DEFAULT_CONFIG,genre,seed:'sample-♯',bars:64 as const,complexity:100,swing:100,density:100,key:11};
    const song=generateSong(config);
    expect(generateSong(config)).toEqual(song);
    expect(generateSong({...config,seed:'other'}).tracks).not.toEqual(song.tracks);
    expect(song.sections.reduce((total,section)=>total+section.bars,0)).toBe(64);
    expect(song.tracks.map(t=>t.type)).toEqual(['melody','chords','bass','drums']);
    for(const t of song.tracks){
      expect(t.notes.length).toBeGreaterThan(64);
      expect(()=>validateNotes(t.notes,song.totalTicks)).not.toThrow();
    }
    expect(parseMusicProject(musicProjectText(song))).toEqual(song);
  });

  it('distinguishes genre rhythm patterns and keeps harmony-related rerolls opt-in',()=>{
    const defaults=GENRES.map(genre=>generateSong({...DEFAULT_CONFIG,genre}));
    expect(new Set(defaults.map(s=>JSON.stringify(s.tracks[3].notes))).size).toBe(GENRES.length);
    const song=defaults[0];
    song.tracks[0].locked=true;
    const replacement=generateSong(song.config,{previous:song,reroll:'chords',regenerateDependents:true});
    expect(replacement.tracks[0]).toBe(song.tracks[0]);
    expect(replacement.tracks[2].variation).toBe(1);
    expect(replacement.tracks[3]).toBe(song.tracks[3]);
    const held=generateSong(song.config,{previous:song,reroll:'chords',regenerateDependents:false});
    expect(held.tracks[2]).toBe(song.tracks[2]);
    expect(held.tracks[1].notes).not.toEqual(song.tracks[1].notes);
  });

  it('preserves edits in JSON and rejects inconsistent timestamps and channels',()=>{
    const song=generateSong(DEFAULT_CONFIG);
    song.tracks[0].notes[0]={id:'manual-1',pitch:111,startTick:12,durationTicks:117,velocity:116};
    expect(parseMusicProject(musicProjectText(song))).toEqual(song);
    song.tracks[0].notes[0].durationTicks=song.totalTicks+1;
    expect(()=>parseMusicProject(musicProjectText(song))).toThrow();
    song.tracks[0].notes[0].durationTicks=117;
    song.tracks[3].midiChannel=0;
    expect(()=>parseMusicProject(musicProjectText(song))).toThrow();
  });

  it('round trips edited notes and timing through a separate MIDI parser',()=>{
    const song=generateSong({...DEFAULT_CONFIG,bpm:138});
    song.tracks[0].notes[0]={id:'manual-1',pitch:105,startTick:12,durationTicks:117,velocity:116};
    song.tracks[1].muted=true;
    const bytes=exportMidi(song);
    expect([...bytes.slice(8,14)]).toEqual([0,1,0,5,1,224]);
    const midi=new Midi(bytes);
    expect(midi.header.ppq).toBe(PPQ);
    expect(midi.header.tempos[0].bpm).toBeCloseTo(song.bpm,3);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4,4]);
    midi.tracks.forEach((track,index)=>{
      const original=song.tracks[index];
      expect(track.channel).toBe(original.midiChannel);
      expect(track.instrument.number).toBe(original.midiProgram);
      expect(track.notes.map(n=>[n.ticks,n.durationTicks,n.midi,Math.round(n.velocity*127)]))
        .toEqual(original.notes.map(n=>[n.startTick,n.durationTicks,n.pitch,n.velocity]));
    });
    expect(new Midi(exportMidi(song,true)).tracks).toHaveLength(3);
  });

  it('uses PPQ consistently in the audio plan and keeps sustained offscreen notes queryable',()=>{
    const song=generateSong(DEFAULT_CONFIG);
    song.tracks[2].solo=true;
    const plan=audioPlan(song);
    expect(plan.events).toHaveLength(song.tracks[2].notes.length);
    const last=plan.events.at(-1)!;
    expect(secToTick(last.at,song.bpm)).toBeCloseTo(song.tracks[2].notes.at(-1)!.startTick);
    expect(tickToSec(BAR,120)).toBe(2);
    const long={id:'long',startTick:4,durationTicks:BAR*3,pitch:64,velocity:75};
    const ended={...long,id:'ended',durationTicks:10};
    expect(noteIndex([ended,long])(BAR,BAR*2)).toEqual([long]);
  });
});
