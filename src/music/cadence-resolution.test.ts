import {describe, expect, it} from 'vitest';
import {generateSong} from './generate';
import {BAR, DEFAULT_CONFIG, GENRES} from './song';

describe('SEED EVOLUTION: chord-aware phrase resolution', () => {
  it('ends four-bar melodic phrases on the active chord root or third across seeds and genres', () => {
    for (const genre of GENRES) for (let seed = 0; seed < 24; seed++) {
      // Epic uses a separate orchestral generator and is covered by its own tests.
      if (genre === 'エピック') continue;
      const config = {...DEFAULT_CONFIG, genre, seed: 'cadence-' + seed, bars: 16 as const};
      const song = generateSong(config);
      const melody = song.tracks.find(track => track.id === 'melody')!.notes;
      const chords = song.tracks.find(track => track.id === 'chords')!.notes;
      expect(melody.length).toBeGreaterThan(0);
      for (const note of melody) {
        expect(note.pitch).toBeGreaterThanOrEqual(56);
        expect(note.pitch).toBeLessThanOrEqual(84);
        expect(note.startTick + note.durationTicks).toBeLessThanOrEqual(song.totalTicks);
      }
      // A full four-bar phrase ending is only checked when the generated
      // section is long enough to contain it; intro/outro can be abbreviated.
      for (const section of song.sections) {
        if (section.bars < 4) continue;
        const bar = section.startBar + 3;
        const phraseNotes = melody.filter(n => Math.floor(n.startTick / BAR) === bar);
        if (!phraseNotes.length || bar === config.bars - 1) continue;
        const last = phraseNotes.at(-1)!;
        const chordPitches = chords.filter(n => Math.floor(n.startTick / BAR) === bar)
          .map(n => n.pitch).sort((a,b) => a-b);
        expect(chordPitches.length).toBeGreaterThanOrEqual(3);
        expect([chordPitches[0]%12,chordPitches[2]%12]).toContain(last.pitch%12);
      }
      if (seed < 3) expect(generateSong(config)).toEqual(song);
    }
  }, 20_000);
});
