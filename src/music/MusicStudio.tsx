import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ChangeEvent,type KeyboardEvent} from 'react';
import {MusicTransport,type Loop} from './audio';
import {generateSong} from './generate';
import {exportMidi} from './midi';
import {Check,GeneratorPanel,MusicPanel,Range,Select,TrackInspector,TransportControls} from './MusicPanels';
import {PianoRoll,type RollOptions} from './PianoRoll';
import {musicFilename,musicProjectText,parseMusicProject,saveMusicFile,validateConfig,validateNotes} from './project';
import {BAR,DEFAULT_CONFIG,PPQ,clamp,noteOrder,randomMusicSeed,type Note,type Part,type Song} from './song';
import type {Mp3Options} from './mp3';
import './music.css';

const defaults: RollOptions = {
  view:'horizontal', zoom:146, scroll:'follow', grid:PPQ/4,
  fall:{speed:1,keys:'auto',color:'track',shape:'round',background:'#11182b',labels:true,light:true,trails:false,sparks:false},
};
const storageKey='geometry-maker-music-v1';
function initialSong() {
  try {
    const raw=localStorage.getItem(storageKey);
    if(raw)return parseMusicProject(raw);
  } catch { /* A failed local draft does not prevent opening the studio. */ }
  return generateSong(DEFAULT_CONFIG);
}

export default function MusicStudio({active,onGeometry}:{active:boolean;onGeometry:(mode:'2d'|'3d')=>void}){
  const [song,setSong]=useState(initialSong), [draft,setDraft]=useState(song.config);
  const [track,setTrack]=useState<Part>('melody'), [tracks,setTracks]=useState<Part[]>([]);
  const [selection,setSelection]=useState<string[]>([]);
  const [options,setOptions]=useState(defaults);
  const [loop,setLoop]=useState<Loop>({start:0,end:song.totalTicks}), [loopOn,setLoopOn]=useState(false);
  const [metronome,setMetronome]=useState(false), [dependent,setDependent]=useState(true);
  const [message,setMessage]=useState(''), [error,setError]=useState('');
  const [quality,setQuality]=useState<Mp3Options>({rate:44100,bitrate:192});
  const [rangeOnly,setRangeOnly]=useState(false), [audibleMidi,setAudibleMidi]=useState(false);
  const [renderProgress,setProgress]=useState<number|null>(null), [wide,setWide]=useState(false);
  const [history,setHistory]=useState<{past:Song[];next:Song[]}>({past:[],next:[]});
  const clipboard=useRef<Note[]>([]);
  const file=useRef<HTMLInputElement>(null), roll=useRef<HTMLDivElement>(null);
  const job=useRef<AbortController|null>(null);
  const [transport]=useState(()=>new MusicTransport(song));
  const current=song.tracks.find(t=>t.id===track)!;
  const selected=useMemo(()=>current.notes.filter(n=>selection.includes(n.id)),[current,selection]);
  const effectiveLoop=useMemo(()=>({
    start:clamp(loop.start,0,song.totalTicks-BAR),
    end:clamp(loop.end,Math.min(song.totalTicks,loop.start+BAR),song.totalTicks),
  }),[loop,song.totalTicks]);
  useLayoutEffect(()=>{
    transport.configure(song,loopOn?effectiveLoop:null,metronome);
    // A title change is metadata only and should not reschedule audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[transport,song.tracks,song.mixer,song.bpm,song.totalTicks,effectiveLoop,loopOn,metronome]);
  useEffect(()=>{
    if(!active){transport.dispose();setWide(false);}
  },[active,transport]);
  useEffect(()=>()=>{transport.dispose();job.current?.abort();},[transport]);
  useEffect(()=>{
    const save=()=>{try{localStorage.setItem(storageKey,musicProjectText(song));}catch{}};
    const timer=window.setTimeout(save,240);
    window.addEventListener('pagehide',save);
    return ()=>{clearTimeout(timer);window.removeEventListener('pagehide',save);};
  },[song]);

  function report(text:string){setMessage('');setError(text);}
  function info(text:string){setError('');setMessage(text);}
  function failure(value:unknown){report(value instanceof Error?value.message:String(value));}
  function commit(next:Song){
    if(next===song)return;
    setHistory(h=>({past:[...h.past.slice(-29),song],next:[]}));
    setSong(next);setError('');
  }
  function undo(){
    const previous=history.past.at(-1);
    if(!previous)return;
    setHistory({past:history.past.slice(0,-1),next:[song,...history.next]});
    setSong(previous);setDraft(previous.config);setSelection([]);setError('');
    setTrack(id=>previous.tracks.some(t=>t.id===id)?id:'melody');
    setTracks(ids=>ids.filter(id=>previous.tracks.some(t=>t.id===id)));
  }
  function redo(){
    const next=history.next[0];
    if(!next)return;
    setHistory({past:[...history.past,song],next:history.next.slice(1)});
    setSong(next);setDraft(next.config);setSelection([]);setError('');
    setTrack(id=>next.tracks.some(t=>t.id===id)?id:'melody');
    setTracks(ids=>ids.filter(id=>next.tracks.some(t=>t.id===id)));
  }
  function generate(config=draft,mode?:Part|'all'){
    try {
      const partial=mode!==undefined&&mode!=='all';
      const next=generateSong(validateConfig(partial?song.config:config),{previous:song,reroll:mode,regenerateDependents:dependent});
      if(!partial) {
        transport.stop();setDraft(next.config);setLoop({start:0,end:next.totalTicks});
        setTrack(id=>next.tracks.some(t=>t.id===id)?id:'melody');
        setTracks(ids=>ids.filter(id=>next.tracks.some(t=>t.id===id)));
        setSelection([]);
      } else if (mode===track) setSelection([]);
      commit(next);info(partial?'パートを再生成しました。':'楽曲を生成しました。');
    } catch (e) {failure(e);}
  }
  function bpm(value:number){
    commit({...song,bpm:value,config:{...song.config,bpm:value}});
    setDraft(v=>({...v,bpm:value}));
  }
  function updateTrack(next:typeof current){commit({...song,tracks:song.tracks.map(t=>t.id===next.id?next:t)});}
  function updateNotes(part:Part,notes:Note[]){
    try {
      const target=song.tracks.find(t=>t.id===part)!;
      validateNotes(notes,song.totalTicks);
      updateTrack({...target,notes:notes.sort(noteOrder)});
      return true;
    } catch (e) {failure(e);return false;}
  }
  function edit(part:Part,notes:Note[]){
    const byId=new Map(notes.map(n=>[n.id,n]));
    const target=song.tracks.find(t=>t.id===part)!;
    return updateNotes(part,target.notes.map(n=>byId.get(n.id)??n));
  }
  function add(pitch=track==='drums'?36:60,tick=Math.floor(transport.tick())){
    if(options.grid)tick=Math.round(tick/options.grid)*options.grid;
    tick=clamp(tick,0,song.totalTicks-1);
    const note={id:randomMusicSeed(),pitch,startTick:tick,durationTicks:Math.min(song.totalTicks-tick,options.grid||PPQ/4),velocity:90};
    if(updateNotes(track,[...current.notes,note]))setSelection([note.id]);
  }
  function remove(){
    if(!selected.length)return;
    if(updateNotes(track,current.notes.filter(n=>!selection.includes(n.id))))setSelection([]);
  }
  function copyNotes(){
    if(!selected.length)return;
    clipboard.current=selected.map(n=>({...n}));
    info(selected.length+'個の音符をコピーしました。');
  }
  function paste(){
    if(!clipboard.current.length)return;
    const base=Math.min(...clipboard.current.map(n=>n.startTick));
    const span=Math.max(...clipboard.current.map(n=>n.startTick+n.durationTicks))-base;
    const at=clamp(Math.floor(transport.tick()/(options.grid||1))*(options.grid||1),0,song.totalTicks-span);
    const notes=clipboard.current.map(n=>({...n,id:randomMusicSeed(),startTick:at+n.startTick-base}));
    if(updateNotes(track,[...current.notes,...notes]))setSelection(notes.map(n=>n.id));
  }
  function quantize(){
    if(!selected.length)return;
    const grid=options.grid||PPQ/4;
    edit(track,selected.map(n=>({...n,startTick:clamp(Math.round(n.startTick/grid)*grid,0,song.totalTicks-n.durationTicks)})));
  }
  function select(part:Part,id:string,extend:boolean){
    setTrack(part);
    setSelection(existing=>part===track&&extend?existing.includes(id)?existing.filter(v=>v!==id):[...existing,id]:[id]);
  }
  function keys(event:KeyboardEvent<HTMLElement>){
    if(event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,[contenteditable=true]'))return;
    const shortcut=event.ctrlKey||event.metaKey;
    const key=event.key.toLowerCase();
    if(key==='delete'||key==='backspace'){event.preventDefault();remove();}
    else if(shortcut&&key==='c'){event.preventDefault();copyNotes();}
    else if(shortcut&&key==='v'){event.preventDefault();paste();}
    else if(shortcut&&key==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}
    else if(shortcut&&key==='y'){event.preventDefault();redo();}
    else if(key===' '){
      event.preventDefault();
      if(transport.playing)transport.pause();
      else void transport.play().catch(failure);
    }else if(key==='escape'&&wide)setWide(false);
  }
  function saveProject(){saveMusicFile(new Blob([musicProjectText(song)],{type:'application/json'}),musicFilename(song,'json'));}
  async function readProject(event:ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget, source=input.files?.[0];
    input.value='';
    if(!source)return;
    try {
      if(source.size>4_000_000)throw new Error('楽曲JSONは4 MB以下にしてください。');
      const restored=parseMusicProject(await source.text());
      transport.stop();commit(restored);setDraft(restored.config);
      setTrack(id=>restored.tracks.some(t=>t.id===id)?id:'melody');
      setTracks(ids=>ids.filter(id=>restored.tracks.some(t=>t.id===id)));
      setLoop({start:0,end:restored.totalTicks});setSelection([]);
      info('楽曲JSONを読み込みました。');
    }catch(e){failure(e);}
  }
  async function mp3(){
    if(job.current)return;
    const request=new AbortController();
    job.current=request;setProgress(0);info('音声をレンダリングしています。');
    try {
      const {exportMp3}=await import('./mp3');
      const blob=await exportMp3(song,{...quality,range:rangeOnly?effectiveLoop:undefined},request.signal,setProgress);
      request.signal.throwIfAborted();
      saveMusicFile(blob,musicFilename(song,'mp3'));info('MP3の書き出しが完了しました。');
    }catch(e){
      if(request.signal.aborted)info('MP3の書き出しをキャンセルしました。');
      else failure(e);
    }finally{job.current=null;setProgress(null);}
  }
  async function fullscreen(){
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    if(wide){setWide(false);return;}
    try{if(roll.current?.requestFullscreen){await roll.current.requestFullscreen();return;}}catch{}
    setWide(true);
  }
  const setOption=<K extends keyof RollOptions>(key:K,value:RollOptions[K])=>setOptions(o=>({...o,[key]:value}));
  const setFall=<K extends keyof RollOptions['fall']>(key:K,value:RollOptions['fall'][K])=>
    setOptions(o=>({...o,fall:{...o.fall,[key]:value}}));
  return <main className="music-studio" hidden={!active} onKeyDown={keys}>
    <header className="music-header">
      <div className="music-brand"><span aria-hidden="true">♫</span><h1>Seed Music Studio</h1></div>
      <nav aria-label="アプリのモード" className="music-buttons">
        <button onClick={()=>onGeometry('2d')}>2Dモード</button>
        <button onClick={()=>onGeometry('3d')}>3Dモード</button>
        <button aria-pressed="true" disabled>Musicモード</button>
      </nav>
      <label className="music-field music-title">楽曲タイトル<input value={song.title} maxLength={120}
        onChange={e=>setSong({...song,title:e.target.value})}/></label>
      <div className="music-buttons"><button onClick={saveProject}>JSON保存</button>
        <button onClick={()=>file.current?.click()}>JSON読込</button>
        <input ref={file} type="file" accept=".json,application/json" aria-label="楽曲JSONファイル" onChange={readProject} hidden/></div>
    </header>
    <div className="music-workspace">
      <GeneratorPanel config={draft} change={setDraft} generate={()=>generate()} bpm={bpm}
        randomize={()=>{const config={...draft,seed:randomMusicSeed()};setDraft(config);generate(config);}}
        copy={()=>{
          if (!navigator.clipboard) {report('このブラウザではクリップボードを利用できません。');return;}
          void navigator.clipboard.writeText(draft.seed).then(()=>info('シードをコピーしました。')).catch(failure);
        }}
        reroll={()=>generate(draft,'all')} staged={JSON.stringify(draft)!==JSON.stringify(song.config)}/>
      <section className="music-arrangement" aria-label="楽曲編集">
        <div className={'music-roll-panel'+(wide?' is-expanded':'')} ref={roll}>
          <div className="music-roll-toolbar">
            <div className="music-buttons" role="group" aria-label="ピアノロール表示">
              <button aria-pressed={options.view==='horizontal'} onClick={()=>setOption('view','horizontal')}>横スクロール</button>
              <button aria-pressed={options.view==='falling'} onClick={()=>setOption('view','falling')}>落下ノーツ</button>
            </div>
            <button onClick={()=>void fullscreen()}>全画面切替</button>
          </div>
          <div className="music-tracks" aria-label="トラック">
            {song.tracks.map(t=><button key={t.id} style={{borderBottomColor:t.color}} aria-pressed={track===t.id}
              onClick={()=>{if(track!==t.id){setTrack(t.id);setSelection([]);}}}>{t.name}{t.muted?' · M':t.solo?' · S':''}</button>)}
          </div>
          <PianoRoll song={song} active={active} track={track} tracks={tracks} options={options} selection={selection}
            transport={transport} onSelect={select} onEdit={edit} onAdd={add} onSeek={tick=>transport.seek(tick)}/>
          <TransportControls transport={transport} active={active} song={song} loop={effectiveLoop} loopOn={loopOn} setLoop={setLoop}
            setLoopOn={setLoopOn} metronome={metronome} setMetronome={setMetronome} bpm={bpm} report={report}/>
        </div>
        {(message||error)&&<p className={error?'music-error':'music-message'} role={error?'alert':'status'}>{error||message}</p>}
        <div className="music-buttons music-edits" aria-label="音符操作">
          <button onClick={()=>add()}>音符を追加</button>
          <button disabled={!selected.length} onClick={remove}>削除</button>
          <button disabled={!selected.length} onClick={copyNotes}>コピー</button>
          <button disabled={!clipboard.current.length} onClick={paste}>貼り付け</button>
          <button disabled={!selected.length} onClick={quantize}>クオンタイズ</button>
          <button disabled={!history.past.length} onClick={undo}>元に戻す</button>
          <button disabled={!history.next.length} onClick={redo}>やり直す</button>
        </div>
        <details className="music-panel music-roll-options">
          <summary>表示とグリッド</summary>
          <div className="music-panel-body">
            <div className="music-buttons">
              {song.tracks.filter(t=>t.id!==track).map(t=><Check key={t.id} label={t.name+'を重ねて表示'}
                value={tracks.includes(t.id)} change={on=>setTracks(ids=>on?[...ids,t.id]:ids.filter(id=>id!==t.id))}/>)}
            </div>
            <div className="music-columns music-option-grid">
              <Select label="グリッド" value={options.grid} items={[0,60,120,240,480,1920]}
                format={n=>({0:'オフ',60:'32分',120:'16分',240:'8分',480:'4分',1920:'小節'})[n]!} change={v=>setOption('grid',v)}/>
              {options.view==='horizontal'?<>
                <Range label="小節ズーム" value={options.zoom} min={64} max={320} step={2} unit=" px" change={v=>setOption('zoom',v)}/>
                <Select label="スクロール" value={options.scroll} items={['fixed','follow','manual'] as const}
                  format={v=>({fixed:'固定再生ヘッド',follow:'追従再生ヘッド',manual:'手動'})[v]} change={v=>setOption('scroll',v)}/>
              </>:<>
                <Range label="落下速度" value={options.fall.speed} min={.25} max={4} step={.25} unit="倍" change={v=>setFall('speed',v)}/>
                <Select label="鍵盤範囲" value={options.fall.keys} items={['auto','61','88'] as const}
                  format={v=>v==='auto'?'自動':v+'鍵'} change={v=>setFall('keys',v)}/>
                <Select label="ノーツカラー" value={options.fall.color} items={['track','pitch','single'] as const}
                  format={v=>({track:'トラック別',pitch:'音程別',single:'単色'})[v]} change={v=>setFall('color',v)}/>
                <Select label="ノーツ形状" value={options.fall.shape} items={['square','round','glow'] as const}
                  format={v=>({square:'四角',round:'角丸',glow:'発光'})[v]} change={v=>setFall('shape',v)}/>
                <label className="music-field">落下ノーツ背景<input type="color" value={options.fall.background} onChange={e=>setFall('background',e.target.value)}/></label>
                <div className="music-buttons"><button onClick={()=>setFall('background','#000000')}>黒</button>
                  <button onClick={()=>setFall('background','#11182b')}>濃紺</button></div>
                <div className="music-buttons"><Check label="音名" value={options.fall.labels} change={v=>setFall('labels',v)}/>
                  <Check label="鍵盤発光" value={options.fall.light} change={v=>setFall('light',v)}/>
                  <Check label="残像" value={options.fall.trails} change={v=>setFall('trails',v)}/>
                  <Check label="パーティクル" value={options.fall.sparks} change={v=>setFall('sparks',v)}/></div>
              </>}
            </div>
          </div>
        </details>
        <MusicPanel title="書き出し" className="music-export">
          <div className="music-columns music-option-grid">
            <Select label="MP3ビットレート" value={quality.bitrate} items={[128,192,320] as const}
              format={n=>n+' kbps'} change={bitrate=>setQuality(q=>({...q,bitrate}))}/>
            <Select label="サンプルレート" value={quality.rate} items={[44100,48000] as const}
              format={n=>n/1000+' kHz'} change={rate=>setQuality(q=>({...q,rate}))}/>
          </div>
          <div className="music-buttons">
            <Check label="MP3は指定小節のみ" value={rangeOnly} change={setRangeOnly}/>
            <Check label="MIDIは再生対象のみ" value={audibleMidi} change={setAudibleMidi}/>
          </div>
          <div className="music-buttons">
            <button className="music-primary" disabled={renderProgress!==null} onClick={()=>void mp3()}>MP3書き出し</button>
            <button onClick={()=>saveMusicFile(new Blob([exportMidi(song,audibleMidi)],{type:'audio/midi'}),musicFilename(song,'mid'))}>MIDI書き出し</button>
            <button onClick={saveProject}>プロジェクトJSON保存</button>
          </div>
          {renderProgress!==null&&<div className="music-buttons" aria-live="polite">
            <progress aria-label="MP3書き出し進捗" value={renderProgress} max={1}/>
            <span>{Math.round(renderProgress*100)}%</span>
            <button onClick={()=>job.current?.abort()}>キャンセル</button>
          </div>}
          <p className="music-hint">MP3はステレオ。MIDIの音色は読み込み先の音源で変わります。</p>
        </MusicPanel>
      </section>
      <TrackInspector song={song} track={current} note={selected[0]} selected={selected.length}
        update={updateTrack} mixer={value=>commit({...song,mixer:value})}
        edit={n=>edit(track,[n])} reroll={()=>generate(song.config,track)} dependent={dependent} setDependent={setDependent}/>
    </div>
  </main>;
}
