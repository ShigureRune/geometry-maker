/**
 * Salamander Grand Piano V3 (Yamaha C5), recorded by Alexander Holm.
 * Sample recordings: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/
 * MP3 hosting: https://tonejs.github.io/audio/salamander/
 * Original source: https://github.com/sfzinstruments/SalamanderGrandPiano
 *
 * Samples are fetched only after the user enables the recorded piano;
 * they are not embedded in the project JSON or the application bundle.
 */
export const GRAND_PIANO_CREDIT = 'Salamander Grand Piano V3 — Alexander Holm (CC BY 3.0)';
const BASE = 'https://tonejs.github.io/audio/salamander/';
const SOURCES = [
  [21,'A0'],[24,'C1'],[30,'Fs1'],[36,'C2'],[42,'Fs2'],
  [48,'C3'],[54,'Fs3'],[60,'C4'],[66,'Fs4'],
  [72,'C5'],[78,'Fs5'],[84,'C6'],[90,'Fs6'],
  [96,'C7'],[102,'Fs7'],[108,'C8'],
] as const;
export type PianoSamples = ReadonlyMap<number,AudioBuffer>;

export function nearestGrandPianoPitch(pitch:number, available:Iterable<number>):number|undefined {
  let nearest:number|undefined;
  for (const candidate of available) {
    if (nearest===undefined || Math.abs(pitch-candidate)<Math.abs(pitch-nearest))
      nearest=candidate;
  }
  return nearest;
}

let pending:Promise<PianoSamples>|undefined;
/** Cache decoded buffers so playback and MP3 export share the same recorded notes. */
export function loadGrandPianoSamples():Promise<PianoSamples> {
  if (pending)return pending;
  pending=(async()=>{
    if (!globalThis.OfflineAudioContext) throw new Error('このブラウザは録音ピアノの音源読み込みに対応していません。');
    const decoder=new OfflineAudioContext(1,1,44100);
    const samples=new Map<number,AudioBuffer>();
    // Keep network concurrency bounded on mobile Safari.
    for (let i=0;i<SOURCES.length;i+=4) {
      const group=SOURCES.slice(i,i+4);
      const loaded=await Promise.all(group.map(async([pitch,file])=>{
        const response=await fetch(BASE+file+'.mp3');
        if(!response.ok)throw new Error('ピアノ音源を取得できませんでした（HTTP '+response.status+'）。');
        const encoded=await response.arrayBuffer();
        return [pitch,await decoder.decodeAudioData(encoded)] as const;
      }));
      for(const [pitch,buffer] of loaded)samples.set(pitch,buffer);
    }
    return samples;
  })().catch(error=>{
    pending=undefined; // retry after transient offline/CORS failures
    throw new Error('録音ピアノの読み込みに失敗しました。ネット接続を確認して再試行してください。', {cause:error});
  });
  return pending;
}
