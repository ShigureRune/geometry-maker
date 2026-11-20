import {Midi} from '@tonejs/midi';
import {describe, expect, it} from 'vitest';
import {audioPlan} from './audio';
import {nearestGrandPianoPitch} from './piano-samples';
import {generateSong} from './generate';
import {exportMidi} from './midi';
import {musicProjectText, parseMusicProject, validateNotes} from './project';
import {noteIndex} from './roll-layout';
import {BAR, DEFAULT_CONFIG, GENRES, PPQ, pianoOnlySong, playableTracks, secToTick, tickToSec} from './song';

describe('Seed Music Studio',()=>{
  it('builds a distinct deterministic Epic trailer with rising tension and a climax',()=>{
    const config={...DEFAULT_CONFIG,genre:'エピック' as const,seed:'epic-trailer-suite',bars:32 as const,trackCount:8 as const,
      scale:'ナチュラルマイナー' as const,arrangement:'標準' as const};
    const epic=generateSong(config);
    const cinematic=generateSong({...config,genre:'シネマティック'});
    expect(generateSong(config)).toEqual(epic);
    expect(epic.sections.map(section=>section.name)).toContain('Build');
    expect(epic.sections.map(section=>section.name)).toContain('B′');
    expect(epic.tracks.map(track=>track.notes)).not.toEqual(cinematic.tracks.map(track=>track.notes));
    const drums=epic.tracks.find(track=>track.id==='drums')!;
    const intro=epic.sections.find(section=>section.name==='Intro')!;
    const build=epic.sections.find(section=>section.name==='Build')!;
    const accents=(section:typeof intro)=>drums.notes.filter(note=>
      note.startTick>=section.startBar*BAR && note.startTick<(section.startBar+section.bars)*BAR).length/section.bars;
    expect(accents(build)).toBeGreaterThan(accents(intro));
    expect(drums.notes.some(note=>note.pitch===38 && note.startTick%BAR===4*PPQ/2)).toBe(true);
    expect(epic.tracks.find(track=>track.id==='chords')!.notes.some(note=>note.pitch<48)).toBe(true);
    expect(parseMusicProject(musicProjectText(epic))).toEqual(epic);
  });

  it('maps recorded grand-piano samples to nearest available pitch',()=>{
    const keys=[21,24,30,36,42,48,54,60,66,72,78,84,90,96,102,108];
    expect(nearestGrandPianoPitch(60,keys)).toBe(60);
    expect(nearestGrandPianoPitch(63,keys)).toBe(60);
    expect(nearestGrandPianoPitch(65,keys)).toBe(66);
    expect(nearestGrandPianoPitch(0,keys)).toBe(21);
    expect(nearestGrandPianoPitch(127,keys)).toBe(108);
    expect(nearestGrandPianoPitch(60,[])).toBeUndefined();
  });

  it('renders a piano-only arrangement without changing the source song or seed',()=>{
    const original=generateSong({...DEFAULT_CONFIG,seed:'piano-only-regression',trackCount:8});
    const snapshot=JSON.stringify(original);
    const piano=pianoOnlySong(original);
    expect(piano.tracks).toHaveLength(original.tracks.length);
    expect(piano.tracks.filter(track=>track.type==='drums').every(track=>track.muted)).toBe(true);
    expect(playableTracks(piano).every(track=>track.instrument==='Piano')).toBe(true);
    expect(piano.tracks.filter(track=>track.type!=='drums').every(track=>track.midiProgram===0)).toBe(true);
    expect(piano.tracks.map(track=>track.notes)).toEqual(original.tracks.map(track=>track.notes));
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(audioPlan(piano).events.every(event=>event.instrument==='Piano')).toBe(true);
    const midi=new Midi(exportMidi(piano,true));
    expect(midi.tracks).toHaveLength(original.tracks.length-1);
    expect(midi.tracks.every(track=>track.instrument.number===0)).toBe(true);
  });

  it.each(GENRES)('generates repeatable arrangement, harmony and playable notes for %s',genre=>{
    const config={...DEFAULT_CONFIG,genre,seed:'sample-♯',bars:64 as const,complexity:100,swing:100,density:100,key:11};
    const song=generateSong(config);
    expect(generateSong(config)).toEqual(song);
    expect(generateSong({...config,seed:'other'}).tracks).not.toEqual(song.tracks);
    expect(song.sections.reduce((total,section)=>total+section.bars,0)).toBe(64);
    expect(song.tracks.map(t=>t.type)).toEqual(['melody','chords','bass','drums']);
    for(const t of song.tracks){
      expect(t.notes.length).toBeGreaterThan(64);
      const lastEnd=new Map<number,number>();
      for(const note of t.notes) {
        const end=lastEnd.get(note.pitch)??0;
        expect(end,genre+' / '+t.id+' / '+note.pitch+' / '+note.startTick).toBeLessThanOrEqual(note.startTick);
        lastEnd.set(note.pitch,note.startTick+note.durationTicks);
      }
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

  it('supports reproducible 128-bar songs with eight independent instrument tracks',()=>{
    const config={...DEFAULT_CONFIG,seed:'long-form-polyphony',bars:128 as const,trackCount:8 as const};
    const song=generateSong(config);
    expect(song.totalTicks).toBe(128*BAR);
    expect(song.tracks.map(track=>track.type)).toEqual([
      'melody','chords','bass','drums','arp','pad','counter','pulse',
    ]);
    expect(new Set(song.tracks.map(track=>track.midiChannel)).size).toBe(8);
    expect(song.sections.reduce((sum,section)=>sum+section.bars,0)).toBe(128);
    expect(song.tracks.slice(4).every(track=>track.notes.length>0)).toBe(true);
    expect(generateSong(config)).toEqual(song);
    for(const track of song.tracks) expect(()=>validateNotes(track.notes,song.totalTicks)).not.toThrow();
    expect(parseMusicProject(musicProjectText(song))).toEqual(song);
    const midi=new Midi(exportMidi(song));
    expect(midi.tracks).toHaveLength(8);
    midi.tracks.forEach((track,index)=>{
      expect(track.channel).toBe(song.tracks[index].midiChannel);
      expect(track.notes.length).toBe(song.tracks[index].notes.length);
    });
    expect(audioPlan(song).tracks).toHaveLength(8);
  });

  it('keeps the original four parts unchanged and imports previous JSON with no trackCount',()=>{
    const original=generateSong({...DEFAULT_CONFIG,seed:'legacy-seed'});
    const expanded=generateSong({...original.config,trackCount:8},{previous:original});
    expect(expanded.tracks.slice(0,4).map(track=>track.notes))
      .toEqual(original.tracks.map(track=>track.notes));
    const six=generateSong({...original.config,trackCount:6},{previous:original});
    expect(six.tracks).toHaveLength(6);
    const changed=generateSong(expanded.config,{previous:expanded,reroll:'arp'});
    expect(changed.tracks.find(track=>track.id==='arp')?.notes)
      .not.toEqual(expanded.tracks.find(track=>track.id==='arp')?.notes);
    expect(changed.tracks.find(track=>track.id==='pad'))
      .toBe(expanded.tracks.find(track=>track.id==='pad'));
    const oldProject=JSON.parse(musicProjectText(original)) as {song:{config:Record<string,unknown>}};
    delete oldProject.song.config.trackCount;
    const imported=parseMusicProject(JSON.stringify(oldProject));
    expect(imported.config.trackCount).toBe(4);
    expect(imported.tracks.map(track=>track.notes)).toEqual(original.tracks.map(track=>track.notes));
  });


  it('offers ten distinct genres with valid reproducible exported notes',()=>{
    expect(GENRES).toHaveLength(10);
    const results=GENRES.map(genre=>{
      const config={...DEFAULT_CONFIG,seed:'variety-genre-2026',genre,bars:16 as const,trackCount:8 as const};
      const song=generateSong(config);
      expect(generateSong(config)).toEqual(song);
      expect(song.tracks).toHaveLength(8);
      for (const track of song.tracks) {
        expect(track.notes.length).toBeGreaterThan(0);
        expect(()=>validateNotes(track.notes,song.totalTicks)).not.toThrow();
      }
      const midi=new Midi(exportMidi(song));
      expect(midi.tracks).toHaveLength(8);
      expect(parseMusicProject(musicProjectText(song))).toEqual(song);
      return JSON.stringify(song.tracks.slice(0,4).map(track=>track.notes));
    });
    expect(new Set(results).size).toBe(10);
  });

  it('supports arrangement and melodic variations while migrating old project JSON',()=>{
    const base={...DEFAULT_CONFIG,genre:'シンセウェーブ' as const,
      seed:'expanded-arrangement',bars:32 as const,trackCount:8 as const};
    const arrangements=['標準','サビ重視','ビルドアップ','ループ'] as const;
    const forms=arrangements.map(arrangement=>{
      const config={...base,arrangement};
      const song=generateSong(config);
      expect(song.sections.reduce((total,part)=>total+part.bars,0)).toBe(config.bars);
      expect(parseMusicProject(musicProjectText(song))).toEqual(song);
      return JSON.stringify(song.sections);
    });
    expect(new Set(forms).size).toBe(4);
    const melodicStyles=['標準','歌う','疾走','跳躍'] as const;
    const melodies=melodicStyles.map(melodyStyle=>{
      const config={...base,melodyStyle,arrangement:'ビルドアップ' as const};
      const song=generateSong(config);
      expect(generateSong(config)).toEqual(song);
      expect(()=>validateNotes(song.tracks[0].notes,song.totalTicks)).not.toThrow();
      return song.tracks[0].notes;
    });
    expect(new Set(melodies.map(notes=>JSON.stringify(notes))).size).toBe(4);
    expect(melodies[2].length).toBeGreaterThan(melodies[1].length);
    const old=generateSong({...DEFAULT_CONFIG,seed:'legacy-genre'});
    const project=JSON.parse(musicProjectText(old)) as {song:{config:Record<string,unknown>}};
    delete project.song.config.arrangement;
    delete project.song.config.melodyStyle;
    const imported=parseMusicProject(JSON.stringify(project));
    expect(imported.config.arrangement).toBe('標準');
    expect(imported.config.melodyStyle).toBe('標準');
    expect(imported.tracks).toEqual(old.tracks);
    project.song.config.arrangement='存在しないパターン';
    expect(()=>parseMusicProject(JSON.stringify(project))).toThrow();
  });

});
