import type {Mp3Encoder} from '@breezystack/lamejs';

type Message =
  | {kind:'init'; url:string; rate:number; bitrate:number}
  | {kind:'pcm'; left:Float32Array; right:Float32Array}
  | {kind:'finish'};
let encoder: Mp3Encoder | undefined;
const chunks: Uint8Array<ArrayBuffer>[] = [];
const append = (chunk: Uint8Array) => { if (chunk.length) chunks.push(new Uint8Array(chunk)); };

self.onmessage = async ({data}: MessageEvent<Message>) => {
  try {
    if (data.kind === 'init') {
      const library: typeof import('@breezystack/lamejs') = await import(/* @vite-ignore */ data.url);
      encoder = new library.Mp3Encoder(2,data.rate,data.bitrate);
    } else {
      if (!encoder) throw new Error('MP3エンコーダーを初期化できませんでした。');
      if (data.kind === 'finish') {
        append(encoder.flush());
        const blob = new Blob(chunks,{type:'audio/mpeg'});
        if (!blob.size) throw new Error('MP3エンコーダーは音声を出力しませんでした。');
        self.postMessage({kind:'done',blob});
        return;
      }
      const left = new Int16Array(1152), right = new Int16Array(1152);
      for (let i=0;i<data.left.length;i+=1152) {
        const length = Math.min(1152,data.left.length-i);
        for (let n=0;n<length;n++) {
          left[n] = Math.round(Math.max(-1,Math.min(1,data.left[i+n]))*32767);
          right[n] = Math.round(Math.max(-1,Math.min(1,data.right[i+n]))*32767);
        }
        append(encoder.encodeBuffer(left.subarray(0,length),right.subarray(0,length)));
      }
    }
    self.postMessage({kind:'ready'});
  } catch (error) {
    self.postMessage({kind:'error',message:error instanceof Error?error.message:String(error)});
  }
};
