import {useEffect,useRef,useState} from 'react';
import {downloadBlob} from './export';
import {screenshotXIntent,type PreviewScreenshot} from './preview-screenshot';

type Props={screenshot:PreviewScreenshot;onClose:()=>void};

export function PreviewScreenshotDialog({screenshot,onClose}:Props){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const [url,setUrl]=useState('');
  const [message,setMessage]=useState('');
  const [sharing,setSharing]=useState(false);
  useEffect(()=>{
    const url=URL.createObjectURL(screenshot.blob);
    setUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[screenshot.blob]);
  useEffect(()=>{
    if(dialogRef.current&&!dialogRef.current.open)dialogRef.current.showModal();
  },[]);
  const appUrl=typeof window==='undefined'?'https://shugurerune.github.io/geometry-maker/':
    new URL(window.location.pathname,window.location.origin).toString();
  function file(){
    return new File([screenshot.blob],screenshot.filename,{type:'image/png'});
  }
  function save(){
    downloadBlob(screenshot.blob,screenshot.filename);
    setMessage('PNGの保存を開始しました。');
  }
  async function copy(){
    setMessage('');
    try{
      if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')
        throw new Error('このブラウザでは画像コピーに対応していません。');
      await navigator.clipboard.write([new ClipboardItem({'image/png':screenshot.blob})]);
      setMessage('画像をコピーしました。投稿やチャットに貼り付けられます！');
    }catch(error){
      setMessage(error instanceof Error&&error.message.startsWith('このブラウザ')?error.message:
        '画像をコピーできませんでした。ブラウザの許可を確認するか「保存」を使ってください。');
    }
  }
  async function share(){
    if(sharing)return;
    setMessage('');
    try{
      if(!navigator.share)throw new Error('unsupported');
      const image=file();
      if(navigator.canShare&&!navigator.canShare({files:[image]}))
        throw new Error('unsupported');
      setSharing(true);
      // Files, not an image URL: supported apps receive the actual PNG.
      await navigator.share({title:'幾何学メーカーのスクショ',files:[image]});
      setMessage('画像の共有先を選択しました。');
    }catch(error){
      if(error instanceof DOMException&&error.name==='AbortError')return;
      setMessage('この端末では画像を直接共有できません。「保存」して共有アプリに添付してください。');
    }finally{setSharing(false);}
  }
  return <dialog ref={dialogRef} className="studio-screenshot-dialog"
    aria-label="スクショのプレビュー" data-testid="screenshot-dialog"
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="studio-screenshot-content">
      <header className="studio-screenshot-head">
        <div>
          <span className="eyebrow">INSTANT SNAPSHOT</span>
          <h2>📸 スクショが撮れた！</h2>
          <p>{screenshot.mode.toUpperCase()} · {screenshot.ratio} · {screenshot.width} × {screenshot.height} px</p>
        </div>
        <button type="button" className="studio-screenshot-close" aria-label="スクショ画面を閉じる"
          onClick={onClose}>✕</button>
      </header>
      <div className="studio-screenshot-photo" style={{aspectRatio:`${screenshot.width} / ${screenshot.height}`}}>
        {url?<img src={url} alt="撮影したライブプレビューのPNG画像" data-testid="screenshot-image"
          width={screenshot.width} height={screenshot.height}/>:<p role="status">写真を準備しています…</p>}
      </div>
      <div className="studio-screenshot-actions" role="group" aria-label="スクショの操作">
        <button type="button" onClick={save}><span aria-hidden="true">↓</span> 保存</button>
        <button type="button" onClick={()=>{void copy();}}><span aria-hidden="true">▣</span> コピー</button>
        <button type="button" disabled={sharing} onClick={()=>{void share();}}><span aria-hidden="true">↗</span> 共有</button>
        <a className="studio-screenshot-x" href={screenshotXIntent(appUrl)}
          target="_blank" rel="noopener noreferrer" aria-label="Xで共有">
          <span aria-hidden="true">𝕏</span> Xで共有
        </a>
      </div>
      <p className="studio-screenshot-x-hint">Xで共有は投稿画面を開きます。画像の自動添付には対応していないため、保存したPNGを添付するか、コピーして貼り付けてください。端末の「共有」からXを選ぶと画像を渡せる場合もあります。</p>
      <p className="studio-screenshot-status" role="status" aria-live="polite">{message}</p>
    </div>
  </dialog>;
}
