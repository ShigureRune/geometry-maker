import {
  BAR, GENRES, INSTRUMENTS, KEYS, LENGTHS, MOODS, MUSIC_VERSION, PARTS, PPQ, PROGRAMS, SCALES,
  noteOrder, type Config, type Note, type Section, type Song, type Track,
} from './song';

function invalid(field: string): never {
  throw new Error('楽曲JSONの項目が不正です: ' + field);
}
function object(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('オブジェクト');
  return value as Record<string, unknown>;
}
function str(value: unknown, field: string, max = 256) {
  return typeof value === 'string' && value.length <= max ? value : invalid(field);
}
function num(value: unknown, field: string, min: number, max: number, integer = true) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max &&
    (!integer || Number.isInteger(value)) ? value : invalid(field);
}
function bool(value: unknown, field: string) {
  return typeof value === 'boolean' ? value : invalid(field);
}
function choice<T>(value: unknown, choices: readonly T[], field: string) {
  return choices.includes(value as T) ? value as T : invalid(field);
}

export function validateConfig(value: unknown): Config {
  const v = object(value);
  return {
    seed: str(v.seed,'seed'), genre: choice(v.genre,GENRES,'genre'), bpm: num(v.bpm,'bpm',60,200),
    key: num(v.key,'key',0,KEYS.length-1), scale: choice(v.scale,SCALES,'scale'), bars: choice(v.bars,LENGTHS,'bars'),
    mood: choice(v.mood,MOODS,'mood'), complexity: num(v.complexity,'complexity',0,100),
    density: num(v.density,'density',0,100), swing: num(v.swing,'swing',0,100),
  };
}

/** MIDI channels cannot distinguish overlapping voices of the same pitch.
 * Different tracks can play the same pitch concurrently. */
export function validateNotes(notes: Note[], totalTicks: number) {
  const ids = new Set<string>();
  const ends = new Map<number, number>();
  if (notes.length > 4096) throw new Error('1トラックの音符は4,096個までです。');
  for (const n of [...notes].sort(noteOrder)) {
    if (!n.id || ids.has(n.id)) invalid('note.id');
    ids.add(n.id);
    num(n.pitch,'pitch',0,127);
    num(n.startTick,'startTick',0,totalTicks-1);
    num(n.durationTicks,'durationTicks',1,totalTicks-n.startTick);
    num(n.velocity,'velocity',1,127);
    if ((ends.get(n.pitch) ?? 0) > n.startTick)
      throw new Error('同じトラックの同じ音程では音符を重ねられません。');
    ends.set(n.pitch,n.startTick+n.durationTicks);
  }
}

export function musicProjectText(song: Song) {
  return JSON.stringify({kind:'geometry-maker-music', schemaVersion:1, song}, null, 2);
}
export function parseMusicProject(text: string): Song {
  if (text.length > 4_000_000) throw new Error('楽曲JSONは4 MB以下にしてください。');
  const root = object(JSON.parse(text) as unknown);
  if (root.kind !== 'geometry-maker-music' || root.schemaVersion !== 1) invalid('schemaVersion');
  const v = object(root.song);
  if (v.generatorVersion !== MUSIC_VERSION || v.ppq !== PPQ ||
    !Array.isArray(v.timeSignature) || v.timeSignature.length !== 2 || v.timeSignature.some(x => x !== 4))
    invalid('generatorVersion / 拍子');
  const config = validateConfig(v.config), totalTicks = config.bars * BAR;
  if (v.bpm !== config.bpm || v.seed !== config.seed || v.key !== config.key ||
    v.scale !== config.scale || v.totalTicks !== totalTicks) invalid('作曲設定と曲の長さ');
  const sections: Section[] = [];
  if (!Array.isArray(v.sections) || !v.sections.length || v.sections.length > 64) invalid('sections');
  let nextBar = 0;
  for (const value of v.sections) {
    const s = object(value);
    if (s.startBar !== nextBar) invalid('section.startBar');
    const bars = num(s.bars,'section.bars',1,config.bars-nextBar);
    sections.push({name:str(s.name,'section.name',40),startBar:nextBar,bars});
    nextBar += bars;
  }
  if (nextBar !== config.bars || !Array.isArray(v.tracks) || v.tracks.length !== PARTS.length) invalid('sections / tracks');
  const rows = v.tracks;
  const tracks: Track[] = PARTS.map((part,index) => {
    const t = object(rows.find((row: unknown) => object(row).id === part));
    const instrument = choice(t.instrument,INSTRUMENTS,'instrument');
    const channel = part === 'drums' ? 9 : index;
    if (t.type !== part || t.midiChannel !== channel || t.midiProgram !== PROGRAMS[INSTRUMENTS.indexOf(instrument)] ||
      (instrument === 'Drum Kit') !== (part === 'drums')) invalid('MIDIトラック');
    if (!Array.isArray(t.notes) || t.notes.length > 4096) invalid('notes');
    const notes: Note[] = t.notes.map(value => {
      const n = object(value);
      return {id:str(n.id,'note.id',100),pitch:num(n.pitch,'pitch',0,127),
        startTick:num(n.startTick,'startTick',0,totalTicks-1),durationTicks:num(n.durationTicks,'durationTicks',1,totalTicks),
        velocity:num(n.velocity,'velocity',1,127)};
    });
    validateNotes(notes,totalTicks);
    const color = str(t.color,'color',7);
    if (!/^#[\da-f]{6}$/i.test(color)) invalid('color');
    return {id:part,type:part,name:str(t.name,'track.name',60),instrument,midiChannel:channel,midiProgram:PROGRAMS[INSTRUMENTS.indexOf(instrument)],
      volume:num(t.volume,'volume',0,1,false),pan:num(t.pan,'pan',-1,1,false),
      velocityScale:num(t.velocityScale,'velocityScale',.25,2,false),color,
      muted:bool(t.muted,'muted'),solo:bool(t.solo,'solo'),locked:bool(t.locked,'locked'),
      variation:num(t.variation,'variation',0,Number.MAX_SAFE_INTEGER-1),notes:notes.sort(noteOrder)};
  });
  const m = object(v.mixer);
  return {
    id:str(v.id,'song.id',100), title:str(v.title,'title',120), seed:config.seed, generatorVersion:MUSIC_VERSION,
    config, bpm:config.bpm, timeSignature:[4,4], key:config.key, scale:config.scale, ppq:PPQ,
    totalTicks, tracks, sections, mixer:{volume:num(m.volume,'master.volume',0,1,false),
      muted:bool(m.muted,'master.muted'),limiter:bool(m.limiter,'limiter')},
  };
}

export function musicFilename(song: Song, extension: string) {
  const clean = (text: string) => Array.from(text.trim().replace(/[^\p{L}\p{N}_.-]+/gu,'-')).slice(0,45).join('');
  return (clean(song.title) || 'Seed-Music') + '_seed-' + (clean(song.seed) || 'empty') + '.' + extension;
}
export function saveMusicFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
