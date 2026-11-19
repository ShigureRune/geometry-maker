import {useEffect,useMemo,useRef,useState} from 'react';
import {filterCommands,normalizeCommandIds,type CommandView} from './command-workspaces';

export type StudioCommand={id:string;title:string;description:string;keywords?:string;shortcut?:string;run:()=>void};

const FAVORITES_KEY='geometry-studio-command-favorites';
const RECENT_KEY='geometry-studio-command-recents';
function readCommandIds(key:string):string[]{
  try{
    if(typeof window==='undefined')return [];
    const stored=JSON.parse(window.localStorage.getItem(key)??'[]');
    return normalizeCommandIds(stored);
  }catch{return [];}
}
function saveCommandIds(key:string,ids:string[]){
  try{window.localStorage.setItem(key,JSON.stringify(ids));}catch{}
}


export function StudioCommandPalette({open,onClose,commands}:{
  open:boolean;onClose:()=>void;commands:readonly StudioCommand[];
}){
  const [query,setQuery]=useState('');
  const [view,setView]=useState<CommandView>('all');
  const [activeIndex,setActiveIndex]=useState(0);
  const [favorites,setFavorites]=useState(()=>readCommandIds(FAVORITES_KEY));
  const [recent,setRecent]=useState(()=>readCommandIds(RECENT_KEY));
  const input=useRef<HTMLInputElement>(null);
  const results=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    setQuery('');
    setView('all');
    setActiveIndex(0);
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const frame=requestAnimationFrame(()=>input.current?.focus());
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        // Focus stays within this small, modal command surface.
        const panel=input.current?.closest('[role=dialog]');
        const focusable=Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown',key);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key);previous?.focus();};
  },[open,onClose]);
  const filtered=useMemo(()=>filterCommands(commands,query,view,favorites,recent),
    [commands,query,view,favorites,recent]);
  const selectView=(next:CommandView)=>{setView(next);setActiveIndex(0);};
  const clearRecents=()=>{
    setRecent([]);saveCommandIds(RECENT_KEY,[]);setActiveIndex(0);
    input.current?.focus();
  };
  useEffect(()=>{
    if(!open||!filtered.length)return;
    const index=Math.min(activeIndex,filtered.length-1);
    (results.current?.children.item(index) as HTMLElement|null)?.scrollIntoView({block:'nearest'});
  },[open,filtered,activeIndex]);
  if(!open)return null;
  const execute=(command:StudioCommand)=>{
    const next=[command.id,...recent.filter(id=>id!==command.id)].slice(0,8);
    setRecent(next);saveCommandIds(RECENT_KEY,next);
    command.run();onClose();
  };
  const toggleFavorite=(id:string)=>{
    const next=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];
    setFavorites(next);saveCommandIds(FAVORITES_KEY,next);
    input.current?.focus();
  };
  const selectedIndex=Math.min(activeIndex,Math.max(0,filtered.length-1));
  return <div className="studio-command-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget)onClose();
  }}>
    <section className="studio-command-panel" role="dialog" aria-modal="true"
      aria-labelledby="studio-command-title" aria-describedby="studio-command-description">
      <div className="studio-command-top">
        <span className="studio-command-icon" aria-hidden="true">⌘</span>
        <div><h2 id="studio-command-title">クイックコマンド</h2>
          <p id="studio-command-description">設定・操作をまとめて検索</p></div>
        <button type="button" onClick={onClose} aria-label="コマンド検索を閉じる">✕</button>
      </div>
      <label htmlFor="studio-command-search" className="sr-only">コマンドを検索</label>
      <input ref={input} id="studio-command-search" type="search" value={query}
        placeholder="例：背景 / 3D / 書き出し / シード…" autoComplete="off" aria-controls="studio-command-results"
        aria-activedescendant={filtered.length?`studio-command-option-${filtered[selectedIndex].id}`:undefined}
        onChange={event=>{setQuery(event.target.value);setActiveIndex(0);}}
        onKeyDown={event=>{
          if(event.key==='ArrowDown'||event.key==='ArrowUp'){
            event.preventDefault();
            if(filtered.length)setActiveIndex(index=>(index+(event.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length);
          }else if(event.key==='Home'||event.key==='End'){
            event.preventDefault();
            if(filtered.length)setActiveIndex(event.key==='Home'?0:filtered.length-1);
          }else if(event.key==='PageDown'||event.key==='PageUp'){
            event.preventDefault();
            if(filtered.length)setActiveIndex(index=>Math.max(0,Math.min(filtered.length-1,
              index+(event.key==='PageDown'?5:-5))));
          }else if(event.key==='Enter'&&filtered[selectedIndex]){
            event.preventDefault();execute(filtered[selectedIndex]);
          }
        }}/>
      <div className="studio-command-workspaces" role="group" aria-label="コマンドの表示範囲">
        {([
          ['all','すべて'],['favorites','★ お気に入り'],['recent','最近使った操作'],
        ] as const).map(([id,label])=><button key={id} type="button"
          aria-pressed={view===id} onClick={()=>selectView(id)}>{label}</button>)}
      </div>
      <div className="studio-command-actions">
        <span>★ {favorites.length} 件のお気に入り · 履歴 {recent.length} 件</span>
        {view==='recent'&&recent.length>0&&<button type="button" onClick={clearRecents}
          aria-label="最近使った操作の履歴を消去">履歴を消去</button>}
        <button type="button" disabled={!filtered.length}
          aria-pressed={filtered.length?favorites.includes(filtered[selectedIndex].id):false}
          onClick={()=>{if(filtered.length)toggleFavorite(filtered[selectedIndex].id);}}>
          {filtered.length&&favorites.includes(filtered[selectedIndex].id)?'★ お気に入り解除':'☆ 選択中をお気に入り'}
        </button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{filtered.length} 件のコマンドが見つかりました</p>
      <div ref={results} id="studio-command-results" className="studio-command-results" role="list">
        {filtered.length?filtered.map(command=><button type="button" key={command.id}
          role="listitem" id={`studio-command-option-${command.id}`}
          aria-current={selectedIndex===filtered.indexOf(command)?'true':undefined}
          onMouseEnter={()=>setActiveIndex(filtered.indexOf(command))}
          onClick={()=>execute(command)} className="studio-command-result">
          <span className="studio-command-result-icon" aria-hidden="true">{favorites.includes(command.id)?'★':'↗'}</span>
          <span className="studio-command-result-label"><strong>{command.title}</strong>
            <small>{command.description}</small></span>
          {command.shortcut&&<kbd>{command.shortcut}</kbd>}
        </button>):<p className="studio-command-empty">{view==='favorites'&&!favorites.length?'お気に入りはまだありません。すべてから★で登録できます。':view==='recent'&&!recent.length?'最近使った操作はまだありません。':'一致する操作がありません。別のキーワードを試してみてね。'}</p>}
      </div>
      <div className="studio-command-footer"><span>↑↓・PageUp/Down・Home/End で選択 · Enter で実行</span><span>Esc で閉じる</span></div>
    </section>
  </div>;
}
