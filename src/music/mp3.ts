import encoderUrl from '@breezystack/lamejs?url';
import {AUDIO_TAIL, audioPlan, renderAudioChunk, type Loop} from './audio';
import {tickToSec, type Song} from './song';
import type {PianoSamples} from './piano-samples';
import type {OrchestraSamples} from './orchestra-samples';

export type Mp3Options = {rate:44100|48000; bitrate:128|192|320; range?:Loop};
type WorkerReply = {kind:'ready'} | {kind:'done';blob:Blob} | {kind:'error';message:string};

export async function exportMp3(song: Song, options: Mp3Options, signal: AbortSignal, progress: (value:number)=>void, pianoSamples?:PianoSamples, orchestraSamples?:OrchestraSamples) {
  if (!globalThis.OfflineAudioContext || !globalThis.Worker) throw new Error('このブラウザはオフラインMP3出力に対応していません。');
  const from = options.range?.start ?? 0, to = options.range?.end ?? song.totalTicks;
  if (!(from >= 0 && to <= song.totalTicks && from < to)) throw new Error('書き出し範囲が不正です。');
  const plan = audioPlan(song);
  const {rate,bitrate} = options;
  const worker = new Worker(new URL('./mp3-worker.ts',import.meta.url),{type:'module'});
  const stop = () => worker.terminate();
  signal.addEventListener('abort',stop,{once:true});
  const send = (message:unknown, transfer:Transferable[] = []) => new Promise<WorkerReply>((resolve,reject)=>{
    signal.throwIfAborted();
    function abort() { reject(signal.reason); }
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage = ({data}: MessageEvent<WorkerReply>)=>{
      signal.removeEventListener('abort',abort);
      if (data.kind === 'error') reject(new Error(data.message));
      else resolve(data);
    };
    worker.onerror = event=>{
      signal.removeEventListener('abort',abort);
      reject(new Error(event.message || 'MP3エンコーダーを読み込めませんでした。'));
    };
    worker.postMessage(message,transfer);
  });
  try {
    await send({kind:'init',url:new URL(encoderUrl,location.href).href,rate,bitrate});
    const end = tickToSec(to,song.bpm);
    const first = Math.round(tickToSec(from,song.bpm)*rate);
    const total = Math.ceil((end+AUDIO_TAIL)*rate)-first;
    const chunk = 1152*Math.floor(6*rate/1152);
    let scale = 1;
    const scan = !song.mixer.limiter && !song.mixer.muted;
    if (scan) {
      // Preserve dynamics with one gain for the whole file, even with the
      // preview limiter disabled. The scan keeps only one PCM chunk in memory.
      let peak = 0;
      for (let offset=0;offset<total;offset+=chunk) {
        signal.throwIfAborted();
        const count = Math.min(chunk,total-offset);
        const pcm = await renderAudioChunk(plan,rate,first+offset,count,end,pianoSamples,orchestraSamples);
        for (let channel=0;channel<2;channel++) {
          for (const sample of pcm.getChannelData(channel)) peak=Math.max(peak,Math.abs(sample));
        }
        signal.throwIfAborted();
        progress(.5*(offset+count)/total);
      }
      if (peak>.98) scale=.98/peak;
    }
    for (let offset=0;offset<total;offset+=chunk) {
      signal.throwIfAborted();
      const count = Math.min(chunk,total-offset);
      const pcm = await renderAudioChunk(plan,rate,first+offset,count,end,pianoSamples,orchestraSamples);
      signal.throwIfAborted();
      const left = new Float32Array(pcm.getChannelData(0)), right = new Float32Array(pcm.getChannelData(1));
      if (scale!==1) for (let i=0;i<count;i++) {
        left[i]*=scale;right[i]*=scale;
      }
      await send({kind:'pcm',left,right},[left.buffer,right.buffer]);
      const encoded=(offset+count)/total;
      progress(Math.min(.99,scan?.5+.5*encoded:encoded));
    }
    const result = await send({kind:'finish'});
    if (result.kind !== 'done' || !result.blob.size) throw new Error('MP3データを受け取れませんでした。');
    progress(1);
    return result.blob;
  } finally {
    signal.removeEventListener('abort',stop);
    stop();
  }
}
