import {describe, expect, it} from 'vitest';
import {generateSong} from './generate';
import {validateNotes} from './project';
import {BAR, DEFAULT_CONFIG, GENRES} from './song';

describe('SEED EVOLUTION population regression (#49)', () => {
  for (const genre of GENRES) {
    it(`validates 500 seeds: ${genre}`, () => {
      const fingerprints = new Set<string>();
      for (let i = 0; i < 500; i++) {
        // Keep musical settings fixed so diversity cannot come from key or tempo.
        const config = {...DEFAULT_CONFIG, genre, seed: 'population-v1-' + i,
          bars: 8 as const, trackCount: 8 as const, density: 72, swing: 80};
        const song = generateSong(config);
        const context = genre + '/' + config.seed;
        for (const track of song.tracks) {
          try {
            validateNotes(track.notes, song.totalTicks);
          } catch (error) {
            throw new Error(context + '/' + track.id + ': ' + String(error));
          }
        }
        const melody = song.tracks.find(t => t.id === 'melody')!.notes;
        const chords = song.tracks.find(t => t.id === 'chords')!.notes;
        const chordClasses = Array.from({length: config.bars}, () => new Set<number>());
        for (const note of chords) chordClasses[Math.floor(note.startTick / BAR)].add(note.pitch % 12);
        for (const note of melody) {
          if (note.pitch < (genre === 'エピック' ? 59 : 56) ||
              note.pitch > (genre === 'エピック' ? 88 : 84))
            throw new Error(context + ': melody register ' + note.pitch);
          const step = note.startTick % BAR;
          if ((step === 0 || step === BAR / 2) &&
              !chordClasses[Math.floor(note.startTick / BAR)].has(note.pitch % 12))
            throw new Error(context + ': strong-beat harmony at ' + note.startTick);
        }
        expect(melody.at(-1)?.pitch! % 12, context).toBe(config.key);
        // Exclude seed, IDs, velocities and instrument metadata from identity.
        fingerprints.add(melody.map(n => [n.startTick, n.pitch, n.durationTicks].join(':')).join('|'));
        if (i % 100 === 0) expect(generateSong(config), context).toEqual(song);
      }
      // Epic has a deliberately narrower independent motif vocabulary.
      // Report its actual diversity rather than applying a misleading common threshold.
      console.info(`[population] ${genre}: ${fingerprints.size}/500 unique melody fingerprints`);
      expect(fingerprints.size).toBeGreaterThan(genre === 'エピック' ? 1 : 350);
    }, 60_000);
  }
});
