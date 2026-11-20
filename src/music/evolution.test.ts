import {describe, expect, it} from 'vitest';
import {generateSong} from './generate';
import {BAR, DEFAULT_CONFIG, GENRES} from './song';

describe('SEED EVOLUTION harmonic diversity', () => {
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

});
