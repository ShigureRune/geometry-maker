import {useEffect,useMemo,useRef,useState} from 'react';
import {Preview} from './Preview';
import {generateScene,createRandomSeed,type Background,type Ratio,type AlgorithmVersion} from './scene';
import {densityCandidates,visibleScene} from './density';
import {themeScene,type VisualTheme} from './themes';
import {MAGIC_ALGORITHM_VERSION,type MagicCircleSettings} from './magic-circle';
import {magicPaletteById,magicPaletteFromSeed,backgroundForMagic} from './magic-colors';
import {coloredBackground,reseedColors,type ColorSettings} from './colors';
import type {ShapeKind} from './shape-controls';
import {generateExplorerSet,withCurrentSeed,formatExplorerSeeds,explorerSelection,type ExplorerSet,type ExplorerMode} from './seed-explorer';
import {seedShareUrl} from './seed-vault';

type Props={
  activeSeed:string;ratio:Ratio;version:AlgorithmVersion;
  shapeKinds:ShapeKind[];magicSettings:MagicCircleSettings;
  density:number;visualTheme:VisualTheme;
  background:Background;colors:ColorSettings;
  favoriteSeeds:readonly string[];
  onClose:()=>void;
  onSelect:(seed:string)=>void;
  onSave:(seed:string,label:string)=>string;
};
type ThumbnailProps={
  seed:string;ratio:Ratio;version:AlgorithmVersion;shapeKinds:ShapeKind[];
  magicSettings:MagicCircleSettings;density:number;visualTheme:VisualTheme;
  background:Background;colors:ColorSettings;
};

function ExplorerThumbnail(props:ThumbnailProps){
  const {seed,ratio,version,shapeKinds,magicSettings,density,visualTheme,background,colors}=props;
  const scene=useMemo(()=>{
    const base=generateScene(seed,ratio,version,shapeKinds,magicSettings);
    const visible=visibleScene(base,densityCandidates(base,seed),density);
    return version===MAGIC_ALGORITHM_VERSION?visible:themeScene(visible,visualTheme,seed);
  },[seed,ratio,version,shapeKinds,magicSettings,density,visualTheme]);
  const displayBackground=useMemo(()=>{
    if(version===MAGIC_ALGORITHM_VERSION){
      const palette=magicSettings.colorMode==='auto'
        ?magicPaletteFromSeed(seed,magicSettings.paletteReroll)
        :magicSettings.colorMode==='preset'
          ?magicPaletteById(magicSettings.colorPreset):magicSettings.customColors;
      return backgroundForMagic(background,palette);
    }
    return coloredBackground(background,reseedColors(colors,seed));
  },[seed,version,magicSettings,background,colors]);
  return <div className="seed-explorer-thumbnail">
    <Preview scene={scene} background={displayBackground}/>
  </div>;
}

export function SeedExplorerBoard(props:Props){
  const {activeSeed,ratio,version,shapeKinds,magicSettings,density,visualTheme,
    background,colors,favoriteSeeds,onClose,onSelect,onSave}=props;
  const [set,setSet]=useState<ExplorerSet>(()=>generateExplorerSet(activeSeed,4,'related'));
  const [previous,setPrevious]=useState<ExplorerSet|null>(null);
  const [compareA,setCompareA]=useState<number|null>(0);
  const [compareB,setCompareB]=useState<number|null>(1);
  const [message,setMessage]=useState('');
  const closeRef=useRef<HTMLButtonElement>(null);
  const selected=explorerSelection(set.seeds,compareA,compareB);

  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const frame=requestAnimationFrame(()=>closeRef.current?.focus());
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key==='Tab'){
        const focusable=Array.from(document.querySelectorAll<HTMLElement>(
          '.seed-explorer-dialog button:not(:disabled),.seed-explorer-dialog select:not(:disabled)'));
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    window.addEventListener('keydown',key);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key);previousFocus?.focus();};
  },[onClose]);

  function generate(count:4|8,mode:ExplorerMode){
    setPrevious(set);
    setSet(generateExplorerSet(activeSeed,count,mode,createRandomSeed));
    setCompareA(0);setCompareB(1);
    setMessage(mode==='related'?count+'件の派生案を生成しました。':count+'件のランダム案を生成しました。');
  }
  function restorePrevious(){
    if(!previous)return;
    const current=set;setSet(previous);setPrevious(current);
    setCompareA(0);setCompareB(1);setMessage('前の候補セットに戻りました。');
  }
  function addActive(){
    setSet(current=>({...current,seeds:withCurrentSeed(current.seeds,activeSeed)}));
    setCompareA(0);setCompareB(1);
    setMessage('現在のシードを候補に追加しました。');
  }
  async function copyText(text:string,success:string){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('clipboard');
      await navigator.clipboard.writeText(text);setMessage(success);
    }catch{setMessage('コピーできませんでした。ブラウザの権限を確認してください。');}
  }
  function exportText(){
    const blob=new Blob([formatExplorerSeeds(set.seeds)],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download='geometry-maker-candidates.txt';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),0);
    setMessage(set.seeds.length+'件のシードをテキストで保存しました。');
  }
  function bookmark(seed:string,index:number){
    const message=onSave(seed,'探索案 '+(index+1));
    setMessage(message);
  }

  return <div className="seed-explorer-backdrop" onMouseDown={event=>{
    if(event.currentTarget===event.target)onClose();
  }}>
    <section className="seed-explorer-dialog" role="dialog" aria-modal="true"
      aria-labelledby="seed-explorer-heading" aria-describedby="seed-explorer-help">
      <header className="seed-explorer-header">
        <div><h2 id="seed-explorer-heading">構図探索ボード</h2>
          <p id="seed-explorer-help">候補を静止画で比較。採用した案だけを現在の作品に反映します。</p></div>
        <button ref={closeRef} type="button" aria-label="探索ボードを閉じる" onClick={onClose}>✕ 閉じる</button>
      </header>
      <div className="seed-explorer-tools" role="group" aria-label="探索候補の生成">
        <button type="button" onClick={()=>generate(4,'related')}>派生案を4件</button>
        <button type="button" onClick={()=>generate(8,'related')}>派生案を8件</button>
        <button type="button" onClick={()=>generate(4,'random')}>ランダム案を4件</button>
        <button type="button" onClick={()=>generate(8,'random')}>ランダム案を8件</button>
        <button type="button" onClick={addActive}>現在のシードを追加</button>
        <button type="button" onClick={restorePrevious} disabled={!previous}>前の候補セット</button>
      </div>
      <p className="seed-explorer-caption" aria-live="polite">
        {set.seeds.length}件の候補 / {set.mode==='related'?'現在のシードから派生':'独立したランダム案'}
        <span>・比率 {ratio}・密度 {density}%・生成 {version}</span>
      </p>
      <div className="seed-explorer-compare" aria-label="選択した2案の拡大比較">
        <h3>2案を拡大比較</h3>
        <div className="seed-explorer-compare-grid">
          {([['A',selected.a],['B',selected.b]] as const).map(([label,candidate])=>
            <div key={label} className="seed-explorer-compare-tile">
              <strong>比較 {label}</strong>
              {candidate?<ExplorerThumbnail seed={candidate} ratio={ratio} version={version}
                shapeKinds={shapeKinds} magicSettings={magicSettings} density={density}
                visualTheme={visualTheme} background={background} colors={colors}/>:
                <p>下の候補で「比較{label}」を選んでください。</p>}
            </div>)}
        </div>
      </div>
      <div className="seed-explorer-grid">
        {set.seeds.map((candidate,index)=>
          <article key={candidate} className="seed-explorer-card">
            <div className="seed-explorer-card-top">
              <strong>候補 {index+1}</strong>
              <span>{favoriteSeeds.includes(candidate)?'★ 保存済み':'未保存'}</span>
            </div>
            <ExplorerThumbnail seed={candidate} ratio={ratio} version={version}
              shapeKinds={shapeKinds} magicSettings={magicSettings} density={density}
              visualTheme={visualTheme} background={background} colors={colors}/>
            <code title={candidate}>{candidate}</code>
            <div className="seed-explorer-card-compare">
              <button type="button" aria-pressed={compareA===index}
                aria-label={`候補 ${index+1} を比較Aに指定`}
                onClick={()=>setCompareA(index)}>比較A</button>
              <button type="button" aria-pressed={compareB===index}
                aria-label={`候補 ${index+1} を比較Bに指定`}
                onClick={()=>setCompareB(index)}>比較B</button>
            </div>
            <div className="seed-explorer-card-actions">
              <button type="button" className="seed-explorer-choose"
                aria-label={`候補 ${index+1} を採用`} onClick={()=>onSelect(candidate)}>採用</button>
              <button type="button" disabled={favoriteSeeds.includes(candidate)}
                aria-label={`候補 ${index+1} をお気に入り保存`}
                onClick={()=>bookmark(candidate,index)}>{favoriteSeeds.includes(candidate)?'★ 保存済':'☆ 保存'}</button>
              <button type="button" aria-label={`候補 ${index+1} のシードをコピー`}
                onClick={()=>void copyText(candidate,'候補 '+(index+1)+'のシードをコピーしました。')}>コピー</button>
              <button type="button" aria-label={`候補 ${index+1} の共有リンクをコピー`}
                onClick={()=>void copyText(seedShareUrl(window.location.href,candidate),
                  '候補 '+(index+1)+'の共有リンクをコピーしました。')}>共有</button>
            </div>
          </article>)}
      </div>
      <footer className="seed-explorer-footer">
        <div className="seed-explorer-batch-actions">
          <button type="button" onClick={()=>void copyText(formatExplorerSeeds(set.seeds),
            set.seeds.length+'件のシードを一括コピーしました。')}>全候補のシードをコピー</button>
          <button type="button" onClick={exportText}>全候補をTXT保存</button>
        </div>
        {message&&<p role="status" aria-live="polite">{message}</p>}
      </footer>
    </section>
  </div>;
}
