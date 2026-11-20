import {clamp, playableTracks, type Song} from './song';

const ascii = (text: string) => [...new TextEncoder().encode(text)];
const u32 = (value: number) => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

function variableLength(value: number) {
  const bytes = [value & 127];
  for (value >>>= 7; value; value >>>= 7) bytes.unshift((value & 127) | 128);
  return bytes;
}
const meta = (type: number, data: number[]) => [255,type,...variableLength(data.length),...data];
const chunk = (name: string, data: number[]) => [...ascii(name), ...u32(data.length), ...data];

export function exportMidi(song: Song, audibleOnly = false): Uint8Array<ArrayBuffer> {
  const tempo = Math.round(60_000_000 / song.bpm);
  const conductor = chunk('MTrk',[
    0,...meta(3,ascii(song.title)),
    0,...meta(81,[(tempo >> 16)&255,(tempo >> 8)&255,tempo&255]),
    0,...meta(88,[song.timeSignature[0],Math.log2(song.timeSignature[1]),24,8]),
    ...variableLength(song.totalTicks),...meta(47,[]),
  ]);
  const tracks = (audibleOnly ? (song.mixer.muted ? [] : playableTracks(song)) : song.tracks).map(track => {
    const ch = track.midiChannel;
    const events = track.notes.flatMap(note => [
      {tick:note.startTick,off:false,pitch:note.pitch,velocity:clamp(Math.round(note.velocity*track.velocityScale),1,127)},
      {tick:note.startTick+note.durationTicks,off:true,pitch:note.pitch,velocity:0},
    ]).sort((a,b)=>a.tick-b.tick || Number(b.off)-Number(a.off) || a.pitch-b.pitch);
    const bytes = [
      0,...meta(3,ascii(track.name)),
      0,192|ch,track.midiProgram,
      0,176|ch,7,Math.round(track.volume*127),
      0,176|ch,10,Math.round((track.pan+1)*63.5),
    ];
    let last = 0;
    for (const event of events) {
      bytes.push(...variableLength(event.tick-last),(event.off ? 128 : 144)|ch,event.pitch,event.velocity);
      last = event.tick;
    }
    bytes.push(...variableLength(song.totalTicks-last),...meta(47,[]));
    return chunk('MTrk',bytes);
  });
  const data = chunk('MThd',[0,1,0,tracks.length+1,song.ppq>>8,song.ppq&255]).concat(conductor,...tracks);
  return new Uint8Array(data);
}
