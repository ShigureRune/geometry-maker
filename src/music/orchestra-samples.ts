/**
 * VSCO 2 Community Edition: public-domain (CC0) real orchestral recordings.
 * Original recordings: Versilian Studios (Sam Gossner, Simon Dalzell).
 * Optimized MP3 excerpts are served by orOS Sounds (koulaxizis/oros-sounds).
 * https://github.com/sgossner/VSCO-2-CE
 * https://github.com/koulaxizis/oros-sounds
 *
 * Deliberately load only a small set of pitch anchors instead of the multi-GB
 * full library. Files are fetched on the user's explicit "Epic orchestra" click.
 */
export const ORCHESTRA_CREDIT = 'VSCO 2 Community Edition — Versilian Studios (CC0 1.0)';
const BASE = 'https://koulaxizis.github.io/oros-sounds/packs/';
export type OrchestralRole = 'strings'|'horn'|'cello'|'percussion';
export type OrchestraSample = {root:number;buffer:AudioBuffer;gain:number};
export type OrchestraSamples = ReadonlyMap<OrchestralRole,readonly OrchestraSample[]>;
type Source = readonly [number,string];
const SOURCES:Record<OrchestralRole,readonly Source[]> = {
  strings:[
    [55,'vsco-violins/vlnens_susvib_g2_v2.mp3'],
    [62,'vsco-violins/vlnens_susvib_d3_v2.mp3'],
    [69,'vsco-violins/vlnens_susvib_a3_v2.mp3'],
    [76,'vsco-violins/vlnens_susvib_e4_v2.mp3'],
    [83,'vsco-violins/vlnens_susvib_b4_v2.mp3'],
    [86,'vsco-violins/vlnens_susvib_d5_v2.mp3'],
  ],
  cello:[
    [36,'vsco-cellos/susvib_c1_v3_1.mp3'],
    [43,'vsco-cellos/susvib_g1_v3_1.mp3'],
    [50,'vsco-cellos/susvib_d2_v3_1.mp3'],
    [57,'vsco-cellos/susvib_a2_v3_1.mp3'],
    [64,'vsco-cellos/susvib_e3_v3_1.mp3'],
    [71,'vsco-cellos/susvib_b3_v3_1.mp3'],
  ],
  horn:[
    [36,'vsco-horn/mohorn_sus_c1_v3_1.mp3'],
    [46,'vsco-horn/mohorn_sus_as1_v3_1.mp3'],
    [53,'vsco-horn/mohorn_sus_f2_v3_1.mp3'],
    [60,'vsco-horn/mohorn_sus_c3_v4_1.mp3'],
    [74,'vsco-horn/mohorn_sus_d4_v1_1.mp3'],
  ],
  percussion:[
    [36,'vsco-percussion/bdrumnewhit_v7_rr1_sum.mp3'],
    [38,'vsco-percussion/snare2-hitsn_v9_rr1_sum.mp3'],
    [42,'vsco-percussion/snare2-taps_v4_rr1_sum.mp3'],
    [46,'vsco-percussion/cymbal-crash1_ff_rr1.mp3'],
  ],
};
export function orchestraRole(route:string):OrchestralRole|undefined {
  switch(route){
    case 'melody': case 'counter': return 'horn';
    case 'chords': case 'arp': case 'pad': return 'strings';
    case 'bass': case 'pulse': return 'cello';
    case 'drums': return 'percussion';
    default: return undefined; // metronome remains the local synthetic click
  }
}
export function nearestOrchestraRoot(role:OrchestralRole,pitch:number,roots:readonly number[]):number|undefined {
  if(role==='percussion')return roots.includes(pitch)?pitch:undefined;
  let found:number|undefined;
  for(const root of roots)if(found===undefined||Math.abs(pitch-root)<Math.abs(pitch-found))found=root;
  return found;
}
export function pickOrchestraSample(samples:OrchestraSamples,route:string,pitch:number):OrchestraSample|undefined {
  const role=orchestraRole(route),bank=role&&samples.get(role);
  if(!role||!bank?.length)return undefined;
  const root=nearestOrchestraRoot(role,pitch,bank.map(sample=>sample.root));
  return bank.find(sample=>sample.root===root);
}
let cached:Promise<OrchestraSamples>|undefined;
export function loadOrchestraSamples(progress?:(loaded:number,total:number)=>void):Promise<OrchestraSamples>{
  if(cached)return cached;
  cached=(async()=>{
    if(!globalThis.OfflineAudioContext)throw new Error('このブラウザは録音オーケストラ音源に対応していません。');
    const decoder=new OfflineAudioContext(1,1,44100);
    const tasks=(Object.entries(SOURCES) as [OrchestralRole,readonly Source[]][])
      .flatMap(([role,sources])=>sources.map(([root,path])=>({role,root,path})));
    const sounds=new Map<OrchestralRole,OrchestraSample[]>();
    for(let index=0;index<tasks.length;index+=3){
      const batch=tasks.slice(index,index+3);
      const ready=await Promise.all(batch.map(async ({role,root,path})=>{
        const response=await fetch(BASE+path);
        if(!response.ok)throw new Error(path+': HTTP '+response.status);
        const bytes=await response.arrayBuffer();
        const buffer=await decoder.decodeAudioData(bytes);
        // Normalize each real recording conservatively, preserving transient shape.
        // Samples are already velocity-scaled in the composition, so avoid
        // unpredictable +/-20 dB variations between original instruments.
        let peak=0;
        for(let channel=0;channel<buffer.numberOfChannels;channel++){
          const pcm=buffer.getChannelData(channel);
          for(let i=0;i<pcm.length;i+=32)peak=Math.max(peak,Math.abs(pcm[i]));
        }
        const gain=Math.min(6,Math.max(.4,.42/Math.max(.025,peak)));
        return {role,root,buffer,gain};
      }));
      for(const {role,root,buffer,gain} of ready){
        if(!sounds.has(role))sounds.set(role,[]);
        sounds.get(role)!.push({root,buffer,gain});
      }
      progress?.(Math.min(index+batch.length,tasks.length),tasks.length);
    }
    return sounds as OrchestraSamples;
  })().catch((error:unknown)=>{
    cached=undefined; // allow retry after network errors
    throw new Error('オーケストラ音源を取得できませんでした。ネット接続または配布元の状態を確認してください。',{cause:error});
  });
  return cached;
}
