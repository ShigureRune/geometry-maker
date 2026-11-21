import {describe, expect, it} from 'vitest';
import {generateSong} from './generate';
import {melodyBlueprint} from './melody-phrase';
import {validateNotes} from './project';
import {BAR, DEFAULT_CONFIG, GENRES} from './song';

describe('SEED EVOLUTION harmonic diversity', () => {
  it('keeps seeded directional contours repeatable, bounded, and varied across seeds', () => {
    const shapes=new Set<string>();
    for(let i=0;i<256;i++){
      const config={...DEFAULT_CONFIG,seed:'contour-shape-'+i};
      const first=melodyBlueprint(config,'A');
      const repeat=melodyBlueprint(config,'A');
      expect(first.contour).toEqual(repeat.contour);
      expect(first.contour).toHaveLength(12);
      expect(first.contour[0]).toBe(0);
      expect(first.contour.every(value=>Number.isInteger(value)&&value>=-3&&value<=3)).toBe(true);
      shapes.add(first.contour.join(','));
    }
    expect(shapes.size).toBeGreaterThan(200);
  });

  it('creates seed-distinct musical phrases with valid syncopation and cadential breathing', () => {
    const rhythms=new Set<string>(),identities=new Set<string>();
    for(let i=0;i<256;i++){
      const config={...DEFAULT_CONFIG,seed:'phrase-diversity-'+i,bars:32 as const,density:72};
      const phrase=melodyBlueprint(config,'A');
      const repeat=melodyBlueprint(config,'A');
      expect(phrase).toEqual(repeat);
      expect(phrase.bars).toHaveLength(4);
      for(const steps of phrase.bars){
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.every((step,index)=>step>=0&&step<8&&(index===0||step>steps[index-1]))).toBe(true);
      }
      const rhythm=phrase.bars.map(steps=>steps.join(',')).join('|');
      rhythms.add(rhythm);
      identities.add(rhythm+'|'+phrase.contour.join(',')+'|'+phrase.register);
    }
    // A large fraction of different seeds have distinct *rhythmic* identities
    // even without comparing pitch, key or the generated harmony.
    expect(rhythms.size).toBeGreaterThan(115);
    expect(identities.size).toBeGreaterThan(245);
  });

  it('keeps 256 full scores reproducible, bounded and harmonically coherent',()=>{
    const identities=new Set<string>();
    for(let i=0;i<256;i++){
      const config={...DEFAULT_CONFIG,genre:'シネマティック' as const,
        seed:'full-phrase-'+i,bars:16 as const,trackCount:8 as const,
        density:65,complexity:72,swing:80};
      const song=generateSong(config);
      const melody=song.tracks.find(track=>track.id==='melody')!.notes;
      expect(()=>validateNotes(melody,song.totalTicks)).not.toThrow();
      expect(melody.every(note=>note.pitch>=56&&note.pitch<=84)).toBe(true);
      const chords=song.tracks.find(track=>track.id==='chords')!.notes;
      const last=melody.at(-1)!;
      expect(last.pitch%12).toBe(config.key);
      expect(chords.some(note=>note.startTick===15*BAR&&note.pitch%12===config.key)).toBe(true);
      const signature=melody.slice(0,32).map(note=>
        [Math.round(note.startTick/120),note.pitch].join(':')).join('|');
      identities.add(signature);
      if(i<16)expect(generateSong(config).tracks[0].notes).toEqual(melody);
    }
    expect(identities.size).toBeGreaterThan(245);
  });

  it('distinguishes lyrical and fast-paced rhythmic phrasing for the same seed',()=>{
    const common={...DEFAULT_CONFIG,seed:'style-identity',bars:16 as const};
    const lyrical=melodyBlueprint({...common,melodyStyle:'歌う'},'A');
    const fast=melodyBlueprint({...common,melodyStyle:'疾走'},'A');
    expect(fast.bars.flat().length).toBeGreaterThan(lyrical.bars.flat().length*2);
    expect(fast).not.toEqual(lyrical);
  });

  it('reproduces the same score exactly for the same seed across genres', () => {
    for (const genre of GENRES) {
      const config = {...DEFAULT_CONFIG, genre, seed: 'repeatable-evolution', bars: 32 as const};
      expect(generateSong(config)).toEqual(generateSong(config));
    }
  });

  it('creates varied chord sequences across a seed population while preserving a tonic ending', () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 128; i++) {
      const config = {...DEFAULT_CONFIG, seed: 'evolution-' + i, bars: 32 as const};
      const song = generateSong(config);
      const chordNotes = song.tracks.find(track => track.id === 'chords')!.notes;
      const roots = Array.from({length: config.bars}, (_, bar) => {
        const notes = chordNotes.filter(note => note.startTick === bar * BAR);
        expect(notes.length).toBeGreaterThan(0);
        return Math.min(...notes.map(note => note.pitch)) % 12;
      });
      expect(roots[roots.length - 1]).toBe(config.key);
      fingerprints.add(roots.join(','));
      for (const track of song.tracks) for (const note of track.notes) {
        expect(note.startTick).toBeGreaterThanOrEqual(0);
        expect(note.startTick + note.durationTicks).toBeLessThanOrEqual(song.totalTicks);
        expect(note.pitch).toBeGreaterThanOrEqual(0);
        expect(note.pitch).toBeLessThanOrEqual(127);
      }
    }
    expect(fingerprints.size).toBeGreaterThan(32);
  });
  it('varies melodic fingerprints between seeds while keeping repeated A motifs coherent', () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 96; i++) {
      const config = {...DEFAULT_CONFIG, seed: 'melodic-evolution-' + i, bars: 32 as const};
      const song = generateSong(config);
      const melody = song.tracks.find(track => track.id === 'melody')!.notes;
      const fingerprint = melody.slice(0, 24).map(note =>
        [note.startTick, note.pitch, note.durationTicks]).join('|');
      fingerprints.add(fingerprint);
      expect(melody.length).toBeGreaterThan(0);
      expect(melody.every(note => note.pitch >= 56 && note.pitch <= 84)).toBe(true);
      expect(generateSong(config).tracks.find(track => track.id === 'melody')!.notes).toEqual(melody);
    }
    expect(fingerprints.size).toBeGreaterThan(80);
  });

  it('keeps seed-specific rhythmic fingerprints distinct and every melody note inside its bar', () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 160; i++) {
      const config = {...DEFAULT_CONFIG, genre: 'ファンク' as const, seed: 'rhythm-evolution-' + i, bars: 32 as const};
      const melody = generateSong(config).tracks.find(track => track.id === 'melody')!.notes;
      const rhythm = melody.filter(note => note.startTick < 16 * BAR)
        .map(note => note.startTick % BAR).join(',');
      fingerprints.add(rhythm);
      expect(melody.every(note => note.durationTicks > 0 &&
        note.startTick + note.durationTicks <= (Math.floor(note.startTick / BAR) + 1) * BAR)).toBe(true);
      expect(melody.every(note => note.pitch >= 56 && note.pitch <= 84)).toBe(true);
    }
    expect(fingerprints.size).toBeGreaterThan(100);
  });

  it('varies seeded drum grooves without losing the backbeat or deterministic output', () => {
    const fingerprints = new Set<string>();
    for (let i = 0; i < 96; i++) {
      const config = {...DEFAULT_CONFIG, genre: 'ファンク' as const,
        seed: 'groove-evolution-' + i, bars: 32 as const, density: 80};
      const song = generateSong(config);
      const drums = song.tracks.find(track => track.id === 'drums')!.notes;
      const repeat = generateSong(config).tracks.find(track => track.id === 'drums')!.notes;
      expect(drums).toEqual(repeat);
      const backbeats = drums.filter(note => note.pitch === 38 &&
        [2, 6].includes(Math.floor((note.startTick % BAR) / (BAR / 8))) &&
        note.startTick < 31 * BAR);
      expect(backbeats.length).toBeGreaterThan(30);
      expect(drums.every(note => note.startTick >= 0 &&
        note.startTick + note.durationTicks <= song.totalTicks)).toBe(true);
      fingerprints.add(drums.filter(note => note.startTick < 16 * BAR)
        .map(note => [note.pitch, note.startTick, note.velocity].join(':')).join('|'));
    }
    expect(fingerprints.size).toBeGreaterThan(80);
  });

  it('varies long-form section order by seed without losing opening, ending or coverage', () => {
    const forms = new Set<string>();
    for (let i = 0; i < 128; i++) {
      const config = {...DEFAULT_CONFIG, seed: 'form-evolution-' + i, bars: 64 as const};
      const song = generateSong(config);
      expect(song.sections[0].name).toBe('Intro');
      expect(song.sections[song.sections.length - 1].name).toBe('Outro');
      expect(song.sections.reduce((total, section) => total + section.bars, 0)).toBe(64);
      expect(song.sections.every(section => section.bars > 0)).toBe(true);
      expect(song.sections.map(section => section.name)).toEqual(generateSong(config).sections.map(section => section.name));
      forms.add(song.sections.map(section => section.name).join(','));
    }
    expect(forms.size).toBeGreaterThan(1);
  });

});
