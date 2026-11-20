import {useEffect,useState,type ReactNode} from 'react';
import type {Loop,MusicTransport} from './audio';
import {ARRANGEMENTS,BAR,GENRES,INSTRUMENTS,KEYS,LENGTHS,MELODY_STYLES,MOODS,PPQ,PROGRAMS,SCALES,TRACK_COUNTS,clamp,pitchName,tickToSec,type Config,type Note,type Song,type Track} from './song';

export function Select<T extends string|number>({label,value,items,change,format=String}:{
  label:string; value:T; items:readonly T[]; change:(value:T)=>void; format?:(value:T)=>string;
}){
  return <label className="music-field">{label}<select aria-label={label} value={String(value)} onChange={event=>{
    const item=items.find(option=>String(option)===event.target.value);
    if (item!==undefined) change(item);
  }}>{items.map(item=><option key={item} value={String(item)}>{format(item)}</option>)}</select></label>;
}
export function Range({label,value,min,max,step=1,unit='',change}:{
  label:string;value:number;min:number;max:number;step?:number;unit?:string;change:(value:number)=>void;
}){
  return <label className="music-field music-range"><span>{label}<output>{value}{unit}</output></span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>change(+e.target.value)}/></label>;
}
export function NumberField({label,value,min,max,change}:{
  label:string;value:number;min:number;max:number;change:(value:number)=>void|boolean;
}){
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{
    const n=draft.trim()===''?value:clamp(Math.round(Number(draft)||0),min,max);
    setDraft(String(n));
    if(n!==value&&change(n)===false)setDraft(String(value));
  };
  return <label className="music-field">{label}<input aria-label={label} type="number" value={draft} min={min} max={max}
    onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export function Check({label,value,change}:{label:string;value:boolean;change:(value:boolean)=>void}){
  return <label className="music-check"><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)}/>{label}</label>;
}
export function MusicPanel({title,children,className=''}:{title:string;children:ReactNode;className?:string}){
  const [open,setOpen]=useState(()=>!matchMedia('(max-width: 880px)').matches);
  return <details className={'music-panel '+className} open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>{title}</summary><div className="music-panel-body">{children}</div>
  </details>;
}
const durationLabel = (bars:number,bpm:number) => {
  const seconds=Math.round(bars*4*60/bpm);
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};
export function GeneratorPanel({config,change,generate,randomize,copy,reroll,staged,bpm}:{
  config:Config;change:(config:Config)=>void;generate:()=>void;randomize:()=>void;copy:()=>void;reroll:()=>void;staged:boolean;bpm:(value:number)=>void;
}){
  const edit=<K extends keyof Config>(key:K,value:Config[K])=>change({...config,[key]:value});
  return <MusicPanel title="作曲設定" className="music-generator">
    <label className="music-field">音楽シード<input value={config.seed} maxLength={256}
      onChange={e=>edit('seed',e.target.value)} onKeyDown={e=>{if(e.key==='Enter')generate();}}/></label>
    <div className="music-buttons"><button onClick={randomize}>ランダム</button><button onClick={copy}>シードをコピー</button></div>
    <Select label="ジャンル" value={config.genre} items={GENRES} change={value=>edit('genre',value)}/>
    {config.genre==='エピック'&&<div className="music-buttons">
      <button onClick={()=>change({...config,bpm:140,scale:'ナチュラルマイナー',bars:32,
        trackCount:8,mood:'緊張感',arrangement:'標準',complexity:70,density:75,swing:0})}>
        🎬 Epic向け推奨設定
      </button>
      <span className="music-hint">32小節・マイナー・後半に大きな盛り上がり。ドラムも聴くなら「通常編成」に切り替えてください。</span>
    </div>}
    <NumberField label="作曲BPM" value={config.bpm} min={60} max={200} change={bpm}/>
    <Select label="雰囲気" value={config.mood} items={MOODS} change={value=>edit('mood',value)}/>
    <div className="music-columns">
      <Select label="曲構成" value={config.arrangement} items={ARRANGEMENTS}
        change={value=>edit('arrangement',value)}/>
      <Select label="メロディーの動き" value={config.melodyStyle} items={MELODY_STYLES}
        change={value=>edit('melodyStyle',value)}/>
    </div>
    <p className="music-hint">曲構成で展開の盛り上がりを、メロディーの動きで音符の密度・音域の跳躍・音のつながりを変えられます。標準は従来の生成方式です。</p>
    <div className="music-columns">
      <Select label="キー" value={config.key} items={KEYS.map((_,i)=>i)} format={i=>KEYS[i]} change={value=>edit('key',value)}/>
      <Select label="長さ" value={config.bars} items={LENGTHS} format={n=>n+'小節（'+durationLabel(n,config.bpm)+'）'} change={value=>edit('bars',value)}/>
    </div>
    <Select label="同時演奏パート数" value={config.trackCount} items={TRACK_COUNTS}
      format={n=>n+'パート'} change={value=>edit('trackCount',value)}/>
    <p className="music-hint">4パート：基本編成 / 6パート：アルペジオ・パッド追加 / 8パート：副旋律・リズムシンセも追加。長尺ではMP3の処理時間が増えます。</p>
    <Select label="スケール" value={config.scale} items={SCALES} change={value=>edit('scale',value)}/>
    <Range label="複雑さ" value={config.complexity} min={0} max={100} change={value=>edit('complexity',value)}/>
    <Range label="音数" value={config.density} min={0} max={100} change={value=>edit('density',value)}/>
    <Range label="スウィング" value={config.swing} min={0} max={100} unit="%" change={value=>edit('swing',value)}/>
    <button className="music-primary" onClick={generate}>シードから生成</button>
    <button onClick={reroll}>全曲再生成</button>
    <p className="music-hint">{staged?'未適用の作曲設定があります。':'拍子 4/4 · パートの固定を保持します。'}</p>
  </MusicPanel>;
}
export function TrackInspector({song,track,selected,note,update,mixer,edit,reroll,dependent,setDependent}:{
  song:Song;track:Track;selected:number;note?:Note;update:(track:Track)=>void;mixer:(mixer:Song['mixer'])=>void;
  edit:(note:Note)=>boolean;reroll:()=>void;dependent:boolean;setDependent:(value:boolean)=>void;
}){
  const change=(fields:Partial<Track>)=>update({...track,...fields});
  const instrumentOptions=track.type==='drums'?['Drum Kit'] as const:INSTRUMENTS.filter(i=>i!=='Drum Kit');
  return <MusicPanel title="トラックと音符" className="music-inspector">
    <div className="music-columns">
      <Select label="音色" value={track.instrument} items={instrumentOptions} change={instrument=>change({instrument,midiProgram:PROGRAMS[INSTRUMENTS.indexOf(instrument)]})}/>
      <label className="music-field music-color">トラック色<input type="color" value={track.color} onChange={e=>change({color:e.target.value})}/></label>
    </div>
    <div className="music-buttons">
      <Check label="ミュート" value={track.muted} change={muted=>change({muted})}/>
      <Check label="ソロ" value={track.solo} change={solo=>change({solo})}/>
      <Check label="パート固定" value={track.locked} change={locked=>change({locked})}/>
    </div>
    <Range label="トラック音量" value={Math.round(track.volume*100)} min={0} max={100} unit="%" change={volume=>change({volume:volume/100})}/>
    <Range label="パン" value={Math.round(track.pan*100)} min={-100} max={100} change={pan=>change({pan:pan/100})}/>
    <Range label="ベロシティ倍率" value={Math.round(track.velocityScale*100)} min={25} max={200} unit="%" change={velocityScale=>change({velocityScale:velocityScale/100})}/>
    <div className="music-buttons"><button onClick={reroll} disabled={track.locked}>パート再生成</button>
      <span className="music-variant">変奏 {track.variation}</span></div>
    {track.type==='chords'&&<Check label="メロディーとベースも再生成" value={dependent} change={setDependent}/>}
    <section className="music-subpanel" aria-label="音符編集">
      <h3>選択音符 {selected>1&&<small>（{selected}個）</small>}</h3>
      {note?<div className="music-columns" key={note.id}>
        <NumberField label={'音程（'+pitchName(note.pitch)+'）'} value={note.pitch} min={0} max={127} change={pitch=>edit({...note,pitch})}/>
        <NumberField label="ベロシティ" value={note.velocity} min={1} max={127} change={velocity=>edit({...note,velocity})}/>
        <NumberField label="開始（tick）" value={note.startTick} min={0} max={song.totalTicks-note.durationTicks} change={startTick=>edit({...note,startTick})}/>
        <NumberField label="長さ（tick）" value={note.durationTicks} min={1} max={song.totalTicks-note.startTick} change={durationTicks=>edit({...note,durationTicks})}/>
      </div>:<p className="music-hint">ロールで音符を選択すると編集できます。</p>}
    </section>
    <section className="music-subpanel" aria-label="マスターミキサー"><h3>マスター</h3>
      <Range label="マスター音量" value={Math.round(song.mixer.volume*100)} min={0} max={100} unit="%" change={v=>mixer({...song.mixer,volume:v/100})}/>
      <div className="music-buttons">
        <Check label="全体ミュート" value={song.mixer.muted} change={muted=>mixer({...song.mixer,muted})}/>
        <Check label="リミッター" value={song.mixer.limiter} change={limiter=>mixer({...song.mixer,limiter})}/>
      </div>
    </section>
  </MusicPanel>;
}

export function TransportControls({transport,song,active,loop,loopOn,setLoop,setLoopOn,metronome,setMetronome,bpm,report}:{
  transport:MusicTransport;song:Song;active:boolean;loop:Loop;loopOn:boolean;setLoop:(loop:Loop)=>void;setLoopOn:(v:boolean)=>void;
  metronome:boolean;setMetronome:(v:boolean)=>void;bpm:(v:number)=>void;report:(message:string)=>void;
}){
  const [readout,setReadout]=useState(()=>({tick:transport.tick(),level:0,playing:false}));
  useEffect(()=>{
    if (!active) return;
    let timer:number|undefined;
    const poll=()=>{
      setReadout({tick:transport.tick(),level:transport.level(),playing:transport.playing});
      if(transport.playing&&timer===undefined)timer=window.setInterval(poll,80);
      else if(!transport.playing&&timer!==undefined){clearInterval(timer);timer=undefined;}
    };
    const unsubscribe=transport.subscribe(poll);
    poll();
    return ()=>{unsubscribe();if(timer!==undefined)clearInterval(timer);};
  },[active,transport]);
  const bar=Math.min(song.config.bars,Math.floor(readout.tick/BAR)+1);
  const beat=readout.tick>=song.totalTicks?4:Math.floor(readout.tick%BAR/PPQ)+1;
  return <section className="music-transport" aria-label="再生操作">
    <div className="music-transport-row">
      <div className="music-buttons">
        <button title="先頭に戻る" aria-label="先頭に戻る" onClick={()=>transport.seek(0)}>⏮</button>
        <button className="music-primary" disabled={readout.playing} onClick={()=>void transport.play().catch(error=>report(error.message))}>▶ 再生</button>
        <button disabled={!readout.playing} onClick={()=>transport.pause()}>一時停止</button>
        <button onClick={()=>transport.stop()}>■ 停止</button>
      </div>
      <output className="music-position">{bar}.{beat} <span>{tickToSec(readout.tick,song.bpm).toFixed(1)} 秒</span></output>
      <NumberField label="BPM" value={song.bpm} min={60} max={200} change={bpm}/>
      <meter aria-label="出力レベル" min={0} max={1} value={readout.level}/>
    </div>
    <input aria-label="再生位置" type="range" min={0} max={song.totalTicks} step={1}
      value={Math.round(readout.tick)} onChange={e=>transport.seek(+e.target.value)}/>
    <div className="music-transport-row">
      <Check label="範囲ループ" value={loopOn} change={setLoopOn}/>
      <Check label="メトロノーム" value={metronome} change={setMetronome}/>
      <NumberField label="開始小節" value={loop.start/BAR+1} min={1} max={loop.end/BAR} change={v=>setLoop({...loop,start:(v-1)*BAR})}/>
      <NumberField label="終了小節" value={loop.end/BAR} min={loop.start/BAR+1} max={song.config.bars} change={v=>setLoop({...loop,end:v*BAR})}/>
    </div>
  </section>;
}
