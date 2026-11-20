import {PPQ, clamp, musicRandom, playableTracks, secToTick, tickToSec, type Instrument, type Song} from './song';
import {nearestGrandPianoPitch,type PianoSamples} from './piano-samples';

export const AUDIO_TAIL = .48;
const CYCLE = 1024;
const tones: Record<Exclude<Instrument,'Drum Kit'>,{harmonics:number[];attack:number;release:number;level:number}> = {
  Piano:{harmonics:[1,.47,.23,.13,.07],attack:.004,release:.22,level:.38},
  'Electric Piano':{harmonics:[1,.18,.38,.05,.09],attack:.009,release:.32,level:.42},
  'Synth Lead':{harmonics:[1,.35,.26,.19,.13,.1],attack:.023,release:.15,level:.35},
  'Synth Pluck':{harmonics:[1,.52,.32,.19,.1],attack:.005,release:.13,level:.36},
  'Synth Bass':{harmonics:[1,.35,.1],attack:.013,release:.15,level:.43},
  Pad:{harmonics:[1,.14,.24,.13,.04],attack:.19,release:.44,level:.35},
  '8-bit Lead':{harmonics:[1,0,.333,0,.2,0,.143,0,.111],attack:.003,release:.04,level:.30},
};
type Event = {at:number; duration:number; pitch:number; gain:number; instrument:Instrument; route:string};
export type AudioPlan = ReturnType<typeof audioPlan>;
export function audioPlan(song: Song, metronome = false) {
  const tracks = playableTracks(song);
  const events: Event[] = tracks.flatMap(track => track.notes.map(note => ({
    at:tickToSec(note.startTick,song.bpm), duration:tickToSec(note.durationTicks,song.bpm),
    pitch:note.pitch, gain:clamp(Math.round(note.velocity*track.velocityScale),1,127)/127,
    instrument:track.instrument,route:track.id,
  })));
  if (metronome) for (let tick = 0; tick < song.totalTicks; tick += PPQ) {
    events.push({at:tickToSec(tick,song.bpm),duration:.047,pitch:tick%(PPQ*4)===0?88:81,
      gain:.34,instrument:'Synth Pluck',route:'click'});
  }
  events.sort((a,b)=>a.at-b.at);
  return {events,tracks,mixer:song.mixer,maxVoiceSpan:events.reduce((max,event)=>Math.max(max,event.duration+AUDIO_TAIL),AUDIO_TAIL)};
}

function atEnvelope(points: number[][], time: number) {
  for (let i = 1; i < points.length; i++) {
    const [end,value] = points[i], [start,from] = points[i-1];
    if (time <= end) return end === start ? value : from + (value-from) * (time-start)/(end-start);
  }
  return 0;
}
function patch(event: Event, limit: number) {
  if (event.instrument === 'Drum Kit') {
    const end = Math.min(limit,event.duration+.04,event.pitch===46?.34:event.pitch===36?.29:.17);
    return {duration:end, points:[[0,0],[Math.min(.002,end/3),.6*event.gain],[end,0]]};
  }
  const tone = tones[event.instrument], held = event.duration;
  const attack = Math.min(tone.attack,held*.45), release = tone.release;
  const level = tone.level*event.gain, end = held+release;
  const decaying = ['Piano','Electric Piano','Synth Pluck'].includes(event.instrument);
  const decayTime = Math.min(held,attack+.24);
  const sustain = level*(decaying?.34:.76);
  const points = [[0,0],[attack,level],[decayTime,sustain],[held,sustain],[end,0]];
  if (limit >= end) return {duration:end,points};
  const fall = Math.max(0,limit-.005);
  return {duration:limit,points:[...points.filter(([time])=>time<fall),[fall,atEnvelope(points,fall)],[limit,0]]};
}

export class MusicSynth {
  private buffers = new Map<string,AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private outputs = new Map<string,AudioNode>();
  readonly meter: AnalyserNode | null;

  constructor(private context: BaseAudioContext, plan: AudioPlan, realtime: boolean, private retainBuffers = true, private pianoSamples?:PianoSamples) {
    const master = context.createGain();
    master.gain.value = plan.mixer.muted ? 0 : plan.mixer.volume*.66;
    let output: AudioNode = master;
    if (plan.mixer.limiter) {
      const limiter = context.createWaveShaper();
      limiter.curve = Float32Array.from({length:2049},(_,i)=>Math.tanh((i/1024-1)*1.28)/Math.tanh(1.28)*.94);
      master.connect(limiter);
      output = limiter;
    }
    this.meter = realtime ? context.createAnalyser() : null;
    if (this.meter) {
      this.meter.fftSize = 256;
      output.connect(this.meter);
      this.meter.connect(context.destination);
    } else output.connect(context.destination);
    for (const track of plan.tracks) {
      const volume = context.createGain(), pan = context.createStereoPanner();
      volume.gain.value = track.volume;
      pan.pan.value = track.pan;
      volume.connect(pan).connect(master);
      this.outputs.set(track.id,volume);
    }
    this.outputs.set('click',master);
  }

  private buffer(event: Event) {
    const rate = this.context.sampleRate;
    const pitch = event.pitch;
    const freq = 440*2**((pitch-69)/12);
    const harmonics = Math.max(1,Math.floor(rate*.45/freq));
    const drum = event.instrument === 'Drum Kit';
    const key = drum ? 'drum:'+pitch : event.instrument+':'+Math.min(12,harmonics);
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const buffer = this.context.createBuffer(1,drum?Math.ceil(rate*.48):CYCLE,rate);
    const pcm = buffer.getChannelData(0);
    if (drum) {
      const random = musicRandom('drum-'+pitch);
      let previous = 0;
      for (let i = 0; i < pcm.length; i++) {
        const t = i/rate, white = random()*2-1, bright = (white-previous)*.5;
        previous = white;
        pcm[i] = pitch===36 ? Math.sin(2*Math.PI*(48*t+1.8*(1-Math.exp(-t*42))))*Math.exp(-t*16) :
          pitch===38 || pitch===40 ? (.7*white+.3*Math.sin(2*Math.PI*173*t))*Math.exp(-t*30) :
          bright*Math.exp(-t*(pitch===46?17:48));
      }
    } else {
      const partials = tones[event.instrument as Exclude<Instrument,'Drum Kit'>].harmonics.slice(0,harmonics);
      const normalization = partials.reduce((sum,value)=>sum+Math.abs(value),0);
      for (let i=0;i<pcm.length;i++) pcm[i] = partials.reduce(
        (sum,amp,index)=>sum+amp*Math.sin(2*Math.PI*i*(index+1)/CYCLE),0)/normalization;
    }
    if (this.retainBuffers && this.buffers.size < 150) this.buffers.set(key,buffer);
    return buffer;
  }

  schedule(event: Event, at: number, offset: number, limit: number, horizon = Infinity) {
    const target = this.outputs.get(event.route);
    const shape = patch(event,limit);
    const end = Math.min(shape.duration,offset+horizon);
    if (!target || end <= offset) return;
    const source = this.context.createBufferSource(), envelope = this.context.createGain();
    const sampled = event.instrument==='Piano' && this.pianoSamples?.size ? nearestGrandPianoPitch(event.pitch,this.pianoSamples.keys()) : undefined;
    source.buffer = sampled===undefined ? this.buffer(event) : this.pianoSamples!.get(sampled)!;
    if (sampled!==undefined) {
      source.playbackRate.value=2**((event.pitch-sampled)/12);
    } else if (event.instrument !== 'Drum Kit') {
      source.loop = true;
      source.playbackRate.value = 440*2**((event.pitch-69)/12)*CYCLE/this.context.sampleRate;
    }
    envelope.gain.setValueAtTime(atEnvelope(shape.points,offset),at);
    for (const [t,value] of shape.points) {
      if (t > offset && t < end) envelope.gain.linearRampToValueAtTime(value,at+t-offset);
    }
    envelope.gain.linearRampToValueAtTime(atEnvelope(shape.points,end),at+end-offset);
    source.connect(envelope).connect(target);
    this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();envelope.disconnect();};
    const sourceOffset = offset*source.playbackRate.value;
    // Sample recordings are finite; do not loop piano decay or start beyond the recording.
    if (!source.loop && sourceOffset>=source.buffer.duration) {this.voices.delete(source);source.disconnect();envelope.disconnect();return;}
    source.start(at,source.loop ? sourceOffset%source.buffer.duration : sourceOffset);
    source.stop(at+Math.min(end-offset,(source.buffer.duration-sourceOffset)/source.playbackRate.value));
  }

  stop() {
    for (const source of this.voices) { source.disconnect(); source.stop(); }
    this.voices.clear();
  }
  dispose() {
    this.stop();
    for (const route of this.outputs.values()) route.disconnect();
    this.meter?.disconnect();
  }
}

export type Loop = {start: number; end: number};
function firstEvent(events: Event[], time: number) {
  let low = 0, high = events.length;
  while (low < high) {
    const mid = (low+high)>>>1;
    if (events[mid].at < time) low = mid+1;
    else high = mid;
  }
  return low;
}

/** A single audio-clock transport with a short lookahead independent of RAF. */
export class MusicTransport {
  private context?: AudioContext;
  private synth?: MusicSynth;
  private timer?: number;
  private origin = 0;
  private originPosition = 0;
  private stoppedTick = 0;
  private scheduleUntil = 0;
  private generation = 0;
  private plan: AudioPlan;
  private pianoSamples?:PianoSamples;
  private meterData = new Float32Array(256);
  private listeners = new Set<()=>void>();
  private readonly onAudioStateChange = () => {
    // iOS Safari can interrupt an AudioContext when the app loses audio focus.
    // Do not leave the UI stuck in the "playing" state with a silent context.
    if (this.playing && this.context?.state !== 'running') this.pause();
  };
  playing = false;

  setPianoSamples(samples?:PianoSamples) {
    if(this.pianoSamples===samples)return;
    this.pianoSamples=samples;
    const playing=this.playing;
    this.pause();
    if(playing && this.context?.state==='running')this.start();
  }
  subscribe(listener:()=>void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private notify() { for (const listener of this.listeners) listener(); }

  constructor(private song: Song, private loop: Loop | null = null, metronome = false) {
    this.plan = audioPlan(song,metronome);
  }
  private get range() {
    return {start:tickToSec(this.loop?.start ?? 0,this.song.bpm),end:tickToSec(this.loop?.end ?? this.song.totalTicks,this.song.bpm)};
  }
  private position(elapsed: number) {
    const {start,end} = this.range;
    const position = this.originPosition+Math.max(0,elapsed);
    if (!this.loop || position < end) return Math.min(position,end);
    return start + (position-end) % (end-start);
  }
  tick() {
    return this.playing && this.context ? secToTick(this.position(this.context.currentTime-this.origin),this.song.bpm) : this.stoppedTick;
  }
  level() {
    if (!this.playing || !this.synth?.meter) return 0;
    this.synth.meter.getFloatTimeDomainData(this.meterData);
    return this.meterData.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0);
  }
  async play() {
    if (this.playing) {
      if (this.context?.state === 'running') return;
      this.pause();
    }
    const generation = ++this.generation;
    // A previously closed context cannot be resumed. This can happen after
    // an app/tab switch or when the OS reclaims the audio session.
    if (!this.context || this.context.state === 'closed') {
      this.context?.removeEventListener('statechange',this.onAudioStateChange);
      this.context = new AudioContext();
      this.context.addEventListener('statechange',this.onAudioStateChange);
    }
    const context = this.context;
    try { await context.resume(); }
    catch (error) {
      if (generation !== this.generation) return;
      throw error;
    }
    if (generation !== this.generation || this.playing || this.context !== context || context.state !== 'running') return;
    this.start();
  }
  private start() {
    const context = this.context!;
    const {start,end} = this.range;
    const position = tickToSec(this.stoppedTick,this.song.bpm);
    this.originPosition = position < start || position >= end ? start : position;
    this.origin = context.currentTime + .02;
    this.scheduleUntil = this.origin;
    this.synth = new MusicSynth(context,this.plan,true,true,this.pianoSamples);
    this.playing = true;
    this.schedule();
    this.timer = window.setInterval(()=>this.schedule(),25);
    this.notify();
  }
  private schedule() {
    const context = this.context!, synth = this.synth!;
    const now = context.currentTime, {end,start} = this.range;
    if (!this.loop && now >= this.origin+(end-this.originPosition)+AUDIO_TAIL) {
      this.pause();
      return;
    }
    const target = now+.12;
    let next = this.scheduleUntil;
    // Handle clock drift and browser timer throttling without firing stale events.
    let resume = next === this.origin || next < now-.015;
    if (next < now-.015) {synth.stop();next=now;}
    while (next < target) {
      const elapsed = next-this.origin;
      if (!this.loop && this.originPosition+elapsed >= end-1e-8) break;
      const cycleDuration = end-start, firstDuration = end-this.originPosition;
      const cycle = this.loop && elapsed >= firstDuration-1e-8 ? Math.max(0,Math.floor((elapsed-firstDuration+1e-8)/cycleDuration)) : -1;
      const base = cycle < 0 ? this.origin : this.origin+firstDuration+cycle*cycleDuration;
      const basePosition = cycle < 0 ? this.originPosition : start;
      const position = basePosition+Math.max(0,next-base);
      const boundary = base + end-basePosition;
      const until = Math.min(target,boundary);
      if (until <= next+1e-9) break;
      const initial = resume || Math.abs(next-base)<1e-8;
      const lookback = initial ? this.plan.maxVoiceSpan : 0;
      const events = this.plan.events;
      for (let i=firstEvent(events,position-lookback-1e-8);i<events.length;i++) {
        const e = events[i];
        if (e.at >= position+until-next-1e-9) break;
        const offset = Math.max(0,position-e.at);
        synth.schedule(e,next+Math.max(0,e.at-position),offset,this.loop?end-e.at:Infinity);
      }
      resume = false;
      next = until;
    }
    this.scheduleUntil = Math.max(this.scheduleUntil,next);
  }
  pause() {
    this.generation++;
    this.stoppedTick = this.tick();
    this.playing = false;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.synth?.dispose();
    this.synth = undefined;
    this.notify();
  }
  seek(tick: number) {
    const wasPlaying = this.playing;
    this.pause();
    this.stoppedTick = clamp(tick,0,this.song.totalTicks);
    if (wasPlaying && this.context?.state === 'running') this.start();
    else this.notify();
  }
  stop() { this.pause(); this.stoppedTick = 0; this.notify(); }
  configure(song: Song, loop: Loop | null, metronome: boolean) {
    const tick = this.tick(), wasPlaying = this.playing;
    this.pause();
    this.song = song; this.loop = loop; this.plan = audioPlan(song,metronome);
    this.stoppedTick = clamp(tick,0,song.totalTicks);
    if (wasPlaying && this.context?.state === 'running') this.start();
    else this.notify();
  }
  /** Release the browser audio session while keeping the current song position. */
  background() {
    const wasPlaying = this.playing;
    this.dispose();
    return wasPlaying;
  }
  dispose() {
    this.pause();
    const context = this.context;
    this.context = undefined;
    if (context) {
      context.removeEventListener('statechange',this.onAudioStateChange);
      if (context.state !== 'closed') void context.close().catch(()=>{});
    }
  }
}

/** Bounded stereo chunks with phase and envelope continuity across boundaries. */
export async function renderAudioChunk(plan: AudioPlan, rate: number, frame: number, count: number, rangeEnd: number, pianoSamples?:PianoSamples) {
  const context = new OfflineAudioContext(2,count,rate);
  const synth = new MusicSynth(context,plan,false,true,pianoSamples);
  const start = frame/rate, end = (frame+count)/rate;
  for (let i=firstEvent(plan.events,start-plan.maxVoiceSpan);i<plan.events.length;i++) {
    const event = plan.events[i];
    if (event.at >= Math.min(end,rangeEnd)) break;
    synth.schedule(event,Math.max(0,event.at-start),Math.max(0,start-event.at),
      rangeEnd-event.at+((event.at+event.duration<=rangeEnd)?AUDIO_TAIL:0),end-Math.max(start,event.at));
  }
  return context.startRendering();
}
