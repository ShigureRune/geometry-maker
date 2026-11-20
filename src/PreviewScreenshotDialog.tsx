import {useEffect,useRef,useState} from 'react';
import {downloadBlob} from './export';
import {screenshotXIntent,screenshotShareText,type PreviewScreenshot} from './preview-screenshot';

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
  const shareText=screenshotShareText(screenshot.seed,appUrl);
  const xIntent=screenshotXIntent(appUrl,screenshot.seed);
  function file(){
    return new File([screenshot.blob],screenshot.filename,{type:'image/png'});
  }
  function canShareFile(image:File){
    try{return typeof navigator.share==='function'&&
      (typeof navigator.canShare!=='function'||navigator.canShare({files:[image]}));}
    catch{return false;}
  }
  async function copyCaption(){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('unsupported');
      await navigator.clipboard.writeText(shareText);
      setMessage('シード値とURLを含む投稿文をコピーしました。Xの投稿欄に貼り付けられます。');
    }catch{setMessage('投稿文をコピーできませんでした。表示されている文章を選択してコピーしてください。');}
  }
  function save(){
    downloadBlob(screenshot.blob,screenshot.filename);
    setMessage('PNGの保存を開始しました。');
  }
  async function copy(forX=false){
    // Call clipboard.write from the original tap, before any await. On the X
    // link do NOT cancel the normal anchor navigation: iOS may not offer X in
    // the system share sheet, and a delayed window.open would be blocked.
    setMessage(forX?'PNGのコピーを試みています。Xの投稿画面を開きます…':'');
    try{
      if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')
        throw new Error('このブラウザでは画像コピーに対応していません。');
      await navigator.clipboard.write([new ClipboardItem({'image/png':screenshot.blob})]);
      setMessage(forX
        ? 'PNGをコピーしました！ Xで画像を貼り付けてください。貼り付けできない場合はPNGを保存して添付してください。'
        : '画像をコピーしました。投稿やチャットに貼り付けられます！');
    }catch(error){
      setMessage(forX
        ? 'Xの投稿画面は開きますが、画像をコピーできませんでした。「保存」したPNGをXで添付してください。'
        : error instanceof Error&&error.message.startsWith('このブラウザ')?error.message:
          '画像をコピーできませんでした。ブラウザの許可を確認するか「保存」を使ってください。');
    }
  }
  async function share(){
    if(sharing)return;
    setMessage('');
    try{
      const image=file();
      if(!canShareFile(image))throw new Error('unsupported');
      setSharing(true);
      // General sharing still offers the PNG file and seed-filled caption.
      setMessage('共有するアプリを選んでください。画像とシード値を渡します。');
      await navigator.share({title:'幾何学メーカーのスクショ',text:shareText,files:[image]});
      setMessage('画像とシード値を共有先に渡しました。');
    }catch(error){
      if(error instanceof DOMException&&error.name==='AbortError'){
        setMessage('共有をキャンセルしました。');
        return;
      }
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
        <a className="studio-screenshot-x" href={xIntent}
          target="_blank" rel="noopener noreferrer" aria-label="Xで共有"
          onClick={()=>{void copy(true);}}>
          <span aria-hidden="true">𝕏</span> Xで共有
        </a>
      </div>
      <div className="studio-screenshot-caption">
        <div className="studio-screenshot-caption-header">
          <strong>投稿文プレビュー</strong>
          <button type="button" onClick={()=>{void copyCaption();}}>投稿文をコピー</button>
        </div>
        <p data-testid="screenshot-share-text">{shareText}</p>
      </div>
      <p className="studio-screenshot-x-hint">
        「Xで共有」は<strong>画像をクリップボードにコピーし、シード値入りのX投稿画面を別タブで開きます</strong>。
        Xの投稿画面で画像を貼り付けてください。X側で画像の貼り付けに対応していない場合は
        「保存」でPNGを保存してから添付してください。コピーが許可されなくてもXは開きます。
        <a href={xIntent} target="_blank" rel="noopener noreferrer">Xの投稿画面だけ開く</a>
      </p>
      <p className="studio-screenshot-status" role="status" aria-live="polite">{message}</p>
    </div>
  </dialog>;
}
