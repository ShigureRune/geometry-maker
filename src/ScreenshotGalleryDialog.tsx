import {useEffect,useMemo,useRef,useState} from 'react';
import {downloadBlob} from './export';
import type {PreviewScreenshot} from './preview-screenshot';
import {
  clearScreenshotGallery,deleteScreenshotFromGallery,listScreenshotGallery,
  SCREENSHOT_GALLERY_MAX,type ScreenshotGalleryItem,
} from './screenshot-gallery';

type Props={
  onClose:()=>void;
  onOpen:(image:PreviewScreenshot)=>void;
  revision:number;
};

function GalleryPhoto({item}: {item:ScreenshotGalleryItem}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    const value=URL.createObjectURL(item.blob);
    setUrl(value);
    return ()=>URL.revokeObjectURL(value);
  },[item.blob]);
  return <div className="studio-gallery-photo" style={{aspectRatio:`${item.width} / ${item.height}`}}>
    {url?<img src={url} loading="lazy" alt={`${item.mode.toUpperCase()}作品 ${item.ratio} シード ${item.seed||'空文字'}`}/>:null}
  </div>;
}

export function ScreenshotGalleryDialog({onClose,onOpen,revision}:Props){
  const ref=useRef<HTMLDialogElement>(null);
  const [items,setItems]=useState<ScreenshotGalleryItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState<'all'|'2d'|'3d'>('all');
  const [query,setQuery]=useState('');
  const [confirmClear,setConfirmClear]=useState(false);

  useEffect(()=>{
    if(ref.current&&!ref.current.open)ref.current.showModal();
  },[]);
  useEffect(()=>{
    let alive=true;
    setLoading(true);
    void listScreenshotGallery().then(rows=>{
      if(alive){setItems(rows);setLoading(false);}
    }).catch(()=>{
      if(alive){setMessage('ギャラリーを開けませんでした。ブラウザの保存設定を確認してください。');setLoading(false);}
    });
    return ()=>{alive=false;};
  },[revision]);

  const filtered=useMemo(()=>items.filter(item=>
    (filter==='all'||item.mode===filter)&&
    (!query||item.seed.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())||
      item.filename.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))),
    [items,filter,query]);

  async function remove(id:string){
    try{
      await deleteScreenshotFromGallery(id);
      setItems(current=>current.filter(item=>item.id!==id));
      setMessage('ギャラリーから削除しました（編集データは変更されません）。');
      setConfirmClear(false);
    }catch{setMessage('削除できませんでした。');}
  }
  async function removeAll(){
    try{
      await clearScreenshotGallery();
      setItems([]);
      setMessage('スクショ履歴をすべて削除しました。');
      setConfirmClear(false);
    }catch{setMessage('履歴を削除できませんでした。');}
  }
  return <dialog ref={ref} className="studio-gallery-dialog"
    aria-label="スクショ作品ギャラリー" data-testid="screenshot-gallery-dialog"
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="studio-gallery-content">
      <header className="studio-gallery-head">
        <div>
          <span className="eyebrow">PHOTO ARCHIVE</span>
          <h2>🖼️ スクショ作品ギャラリー</h2>
          <p>直近{SCREENSHOT_GALLERY_MAX}枚を、このブラウザに保存。撮った画像はあとから再共有できるよ！</p>
        </div>
        <button type="button" aria-label="ギャラリーを閉じる" className="studio-screenshot-close" onClick={onClose}>✕</button>
      </header>
      <div className="studio-gallery-toolbar">
        <div className="studio-gallery-filters" role="group" aria-label="作品のモード">
          {(['all','2d','3d'] as const).map(mode=><button key={mode} type="button"
            aria-pressed={filter===mode} onClick={()=>setFilter(mode)}>{mode==='all'?'すべて':mode.toUpperCase()}</button>)}
        </div>
        <input type="search" aria-label="スクショをシード値で検索" value={query}
          onChange={event=>setQuery(event.target.value)} placeholder="シード値で検索…"/>
      </div>
      {loading?<p role="status" className="studio-gallery-empty">作品を読み込んでいます…</p>:
        !items.length?<p className="studio-gallery-empty" data-testid="gallery-empty">
          まだ作品がないよ！ ライブプレビューの「📸 スクショ」を押すと、ここに自動保存されます。
        </p>:!filtered.length?<p className="studio-gallery-empty">条件に合うスクショがありません。</p>:
        <div className="studio-gallery-grid" data-testid="gallery-grid">
          {filtered.map(item=><article className="studio-gallery-item" key={item.id} data-testid="gallery-item">
            <GalleryPhoto item={item}/>
            <div className="studio-gallery-meta">
              <span>{item.mode.toUpperCase()} · {item.ratio} · {item.width}×{item.height}</span>
              <time dateTime={new Date(item.createdAt).toISOString()}>
                {new Date(item.createdAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
              </time>
            </div>
            <p className="studio-gallery-seed" title={item.seed}>シード：{item.seed||'（空文字）'}</p>
            <div className="studio-gallery-item-actions">
              <button type="button" onClick={()=>onOpen(item)}>写真を開く</button>
              <button type="button" onClick={()=>downloadBlob(item.blob,item.filename)}>PNG保存</button>
              <button type="button" className="danger" aria-label={`スクショを削除：${item.seed||'空文字'}`}
                onClick={()=>{void remove(item.id);}}>削除</button>
            </div>
          </article>)}
        </div>}
      <footer className="studio-gallery-foot">
        <span>{filtered.length} / {items.length} 件 · 上限{SCREENSHOT_GALLERY_MAX}件 · 端末内保存</span>
        {items.length>0&&(confirmClear?
          <div className="studio-gallery-confirm">
            <span>本当に全件削除する？</span>
            <button type="button" onClick={()=>{void removeAll();}}>全件削除する</button>
            <button type="button" onClick={()=>setConfirmClear(false)}>キャンセル</button>
          </div>:
          <button type="button" className="studio-gallery-clear" onClick={()=>setConfirmClear(true)}>履歴をすべて削除</button>)}
      </footer>
      <p role="status" aria-live="polite" className="studio-gallery-status">{message}</p>
      <p className="studio-gallery-note">端末やブラウザを変えると履歴は引き継がれません。ブラウザデータを消すと作品も消えます。大切な作品は必ず「PNG保存」してね。</p>
    </div>
  </dialog>;
}
