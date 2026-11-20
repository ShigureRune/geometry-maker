import {useState} from 'react';
import type {ColorSettings} from './colors';
import {paletteCss,paletteGpl,paletteSvg,PALETTE_SLOTS} from './palette-export';

function saveText(content:string,name:string,mime:string){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');link.href=url;link.download=name;
    document.body.appendChild(link);link.click();link.remove();
  }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function PaletteExportControls({settings}:{settings:ColorSettings}){
  const [status,setStatus]=useState('');
  async function copyCss(){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('クリップボードが利用できません。');
      await navigator.clipboard.writeText(paletteCss(settings));
      setStatus('CSS変数7色をコピーしました。');
    }catch{setStatus('コピーできませんでした。CSSファイルの保存をご利用ください。');}
  }
  function download(kind:'css'|'gpl'|'svg'){
    try{
      const content=kind==='css'?paletteCss(settings):kind==='gpl'?paletteGpl(settings):paletteSvg(settings);
      saveText(content,`geometry-palette.${kind}`,kind==='svg'?'image/svg+xml;charset=utf-8':'text/plain;charset=utf-8');
      setStatus(`${kind.toUpperCase()}の保存を開始しました。`);
    }catch{setStatus('配色ファイルを作成できませんでした。');}
  }
  return <section className="control-section palette-export" aria-label="配色の持ち出し">
    <h3>配色を他の制作ツールで使う</h3>
    <p className="help">現在の7色をCSS・GIMP互換パレット・SVG色見本として保存。作品や自動保存の設定は変更しません。</p>
    <div className="palette-export-swatches" role="group" aria-label="書き出す7色">
      {PALETTE_SLOTS.map(([slot,label])=><div key={slot} title={`${label} ${settings.slots[slot].color}`}>
        <span style={{backgroundColor:settings.slots[slot].color}} aria-hidden="true"/>
        <small>{label}</small>
      </div>)}
    </div>
    <div className="palette-export-actions">
      <button type="button" onClick={()=>void copyCss()}>CSS変数をコピー</button>
      <button type="button" onClick={()=>download('css')}>CSSを保存</button>
      <button type="button" onClick={()=>download('gpl')}>GIMPパレットを保存</button>
      <button type="button" onClick={()=>download('svg')}>SVG色見本を保存</button>
    </div>
    <p role="status" aria-live="polite" className="help">{status}</p>
  </section>;
}
