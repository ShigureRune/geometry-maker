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
  async function share(target:'general'|'x'){
    if(sharing)return;
    setMessage('');
    try{
      const image=file();
      if(!canShareFile(image))throw new Error('unsupported');
      setSharing(true);
      // The share sheet can pass the actual PNG to X, unlike an X intent URL.
      // The receiving app decides whether to use the accompanying text.
      setMessage(target==='x'
        ? '共有先からXを選んでね！ 投稿前に画像とシード値が入っているか確認してください。'
        : '共有するアプリを選んでください。画像とシード値を渡します。');
      await navigator.share({title:'幾何学メーカーのスクショ',text:shareText,files:[image]});
      setMessage(target==='x'
        ? '共有操作が完了しました。Xでシード値が抜けていたら「投稿文をコピー」で貼り付けてね。'
        : '画像とシード値を共有先に渡しました。');
    }catch(error){
      if(error instanceof DOMException&&error.name==='AbortError'){
        setMessage('共有をキャンセルしました。');
        return;
      }
      setMessage(target==='x'
        ? '画像をXに直接渡せませんでした。「保存」でPNGを保存し、下の「X投稿ページ」で画像を添付してください。'
        : 'この端末では画像を直接共有できません。「保存」して共有アプリに添付してください。');
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
        <button type="button" disabled={sharing} onClick={()=>{void share('general');}}><span aria-hidden="true">↗</span> 共有</button>
        <a className="studio-screenshot-x" href={xIntent}
          target="_blank" rel="noopener noreferrer" aria-label="Xで共有"
          onClick={event=>{
            if(!canShareFile(file()))return; // Browser fallback: X text only.
            event.preventDefault();
            void share('x'); // iPhone share sheet: choose X to attach the PNG.
          }}>
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
        iPhoneの「Xで共有」は共有シートを開きます。<strong>Xを選ぶと画像を添付して共有できます</strong>（X側の対応状況によります）。
        アプリによって投稿文が省略される場合は「投稿文をコピー」でシード値を貼り付けてください。
        Xが共有先に表示されない場合はPNGを保存し、
        <a href={xIntent} target="_blank" rel="noopener noreferrer">X投稿ページを開いて画像を添付</a>できます。
      </p>
      <p className="studio-screenshot-status" role="status" aria-live="polite">{message}</p>
    </div>
  </dialog>;
}
