export const MUSIC_VERSION = 'seed-music-v1';
export const PPQ = 480;
export const BAR = PPQ * 4;
export const PARTS = ['melody', 'chords', 'bass', 'drums', 'arp', 'pad', 'counter', 'pulse'] as const;
export const TRACK_COUNTS = [4, 6, 8] as const;
export const GENRES = ['チップチューン', 'EDM', 'テクノ', 'Lo-fi', 'アンビエント', 'シンセウェーブ', 'ジャズ', 'ファンク', 'ドラムンベース', 'シネマティック'] as const;
export const ARRANGEMENTS = ['標準', 'サビ重視', 'ビルドアップ', 'ループ'] as const;
export const MELODY_STYLES = ['標準', '歌う', '疾走', '跳躍'] as const;
export const SCALES = ['メジャー', 'ナチュラルマイナー', 'メジャーペンタトニック', 'マイナーペンタトニック'] as const;
export const MOODS = ['明るい', '暗い', '幻想的', '緊張感'] as const;
export const KEYS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
export const LENGTHS = [4, 8, 16, 32, 64, 128] as const;
export const INSTRUMENTS = ['Piano', 'Electric Piano', 'Synth Lead', 'Synth Pluck', 'Synth Bass', 'Pad', '8-bit Lead', 'Drum Kit'] as const;
export const PROGRAMS = [0, 4, 81, 11, 38, 89, 80, 0];
export const NAMES = ['メロディー', 'コード', 'ベース', 'ドラム', 'アルペジオ', 'パッド', '副旋律', 'リズムシンセ'];
export const COLORS = ['#bca3ff', '#51cbd6', '#f2b76f', '#ee83a9', '#95d987', '#93b7ff', '#ffc8a0', '#d8a3e8'];

export type Part = typeof PARTS[number];
export type Instrument = typeof INSTRUMENTS[number];
export type Config = {
  seed: string; genre: typeof GENRES[number]; bpm: number; key: number;
  scale: typeof SCALES[number]; bars: typeof LENGTHS[number]; trackCount: typeof TRACK_COUNTS[number]; mood: typeof MOODS[number];
  complexity: number; density: number; swing: number;
  arrangement: typeof ARRANGEMENTS[number]; melodyStyle: typeof MELODY_STYLES[number];
};
export type Note = {id: string; pitch: number; startTick: number; durationTicks: number; velocity: number};
export type Track = {
  id: Part; name: string; type: Part; instrument: Instrument; midiProgram: number; midiChannel: number;
  color: string; volume: number; pan: number; velocityScale: number; muted: boolean; solo: boolean;
  locked: boolean; variation: number; notes: Note[];
};
export type Section = {name: string; startBar: number; bars: number};
export type Song = {
  id: string; title: string; seed: string; generatorVersion: typeof MUSIC_VERSION; config: Config;
  bpm: number; timeSignature: [4, 4]; key: number; scale: Config['scale']; ppq: typeof PPQ;
  totalTicks: number; tracks: Track[]; sections: Section[];
  mixer: {volume: number; muted: boolean; limiter: boolean};
};
export const DEFAULT_CONFIG: Config = {
  seed: 'violet-horizon', genre: 'Lo-fi', bpm: 120, key: 0, scale: 'メジャー', bars: 16, trackCount: 4,
  mood: '幻想的', complexity: 50, density: 55, swing: 20,
  arrangement: '標準', melodyStyle: '標準',
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const tickToSec = (tick: number, bpm: number) => tick / PPQ * 60 / bpm;
export const secToTick = (seconds: number, bpm: number) => seconds * bpm / 60 * PPQ;
export const pitchName = (pitch: number) => KEYS[pitch % 12] + (Math.floor(pitch / 12) - 1);
export const noteOrder = (a: Note, b: Note) => a.startTick - b.startTick || a.pitch - b.pitch || a.id.localeCompare(b.id);
/** Non-destructive piano arrangement for playback and export. */
export function pianoOnlySong(song: Song): Song {
  return {
    ...song,
    tracks: song.tracks.map(track => track.type === 'drums'
      ? {...track,muted:true,solo:false}
      : {...track,instrument:'Piano' as const,midiProgram:0,solo:false}),
  };
}
export function playableTracks(song: Song) {
  const solo = song.tracks.some(track => track.solo);
  return song.tracks.filter(track => !track.muted && (!solo || track.solo));
}
export function randomMusicSeed() {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)), value => value.toString(36)).join('-');
}
export function hashSeed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function musicRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    let n = state = (state + 0x6d2b79f5) | 0;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
