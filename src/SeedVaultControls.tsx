import {useRef,useState,type ChangeEvent} from 'react';
import {
  SEED_HISTORY_LIMIT,SEED_LABEL_LIMIT,SEED_VAULT_LIMIT,
  deleteBookmark,exportSeedCollection,importSeedCollection,isUsableSeed,
  renameBookmark,saveBookmark,browseBookmarks,exportSelectedSeedCollection,searchSeedHistory,seedShareUrl,
  type BookmarkOrder,
  type SeedVault,
} from './seed-vault';

type Props={
  seed:string;
  vault:SeedVault;
  disabled:boolean;
  onChange:(next:SeedVault)=>void;
  onSelect:(seed:string)=>void;
  onHistoryIndex:(index:number)=>void;
  onNavigate:(direction:-1|1)=>void;
};
export function SeedVaultControls({
  seed,vault,disabled,onChange,onSelect,onHistoryIndex,onNavigate,
}:Props){
  const [name,setName]=useState('');
  const [query,setQuery]=useState('');
  const [order,setOrder]=useState<BookmarkOrder>('recent');
  const [selected,setSelected]=useState<string[]>([]);
  const [historyQuery,setHistoryQuery]=useState('');
  const [renaming,setRenaming]=useState<string|null>(null);
  const [renameText,setRenameText]=useState('');
  const [message,setMessage]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const matches=browseBookmarks(vault,query,order);
  const validSelection=selected.filter(value=>vault.bookmarks.some(item=>item.seed===value));
  const historyMatches=searchSeedHistory(vault,historyQuery);
  const bookmarked=vault.bookmarks.some(item=>item.seed===seed);

  function saveCurrent(){
    try{
      const label=name.trim()||(bookmarked?vault.bookmarks.find(item=>item.seed===seed)!.name:seed.slice(0,SEED_LABEL_LIMIT));
      onChange(saveBookmark(vault,seed,label));
      setName('');setMessage('現在のシードを保存しました。');
    }catch(error){setMessage(error instanceof Error?error.message:'シードを保存できませんでした。');}
  }
  function commitRename(value:string){
    try{
      onChange(renameBookmark(vault,value,renameText));
      setRenaming(null);setRenameText('');
      setMessage('シード名を変更しました。');
    }catch(error){setMessage(error instanceof Error?error.message:'名前を変更できませんでした。');}
  }
  function downloadCollection(selectedOnly=false){
    const collection=selectedOnly?exportSelectedSeedCollection(vault,new Set(validSelection)):exportSeedCollection(vault);
    const blob=new Blob([JSON.stringify(collection,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=selectedOnly?'geometry-maker-selected-seeds.json':'geometry-maker-seeds.json';anchor.style.display='none';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),0);
    setMessage(collection.bookmarks.length+'件のシードをJSONに保存しました。');
  }
  async function importCollection(event:ChangeEvent<HTMLInputElement>){
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file)return;
    try{
      if(file.size>65536)throw new Error('64KB以下のシード一覧JSONを選んでください。');
      const parsed:unknown=JSON.parse(await file.text());
      const merged=importSeedCollection(vault,parsed);
      onChange(merged.vault);
      setMessage(merged.added+'件を追加、'+merged.skipped+'件をスキップしました。');
    }catch(error){
      setMessage(error instanceof Error?error.message:'シード一覧を読み込めませんでした。');
    }
  }
  async function copyShareLink(){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('clipboard');
      await navigator.clipboard.writeText(seedShareUrl(window.location.href,seed));
      setMessage('シード共有リンクをコピーしました。リンクにはシードのみ含まれます。');
    }catch{
      setMessage('リンクをコピーできませんでした。クリップボードの権限を確認してください。');
    }
  }
  return <section className="control-section seed-vault" aria-labelledby="seed-vault-heading">
    <h3 id="seed-vault-heading">シード保管庫</h3>
    <p className="help">気に入った構図のシードを、この端末に名前付きで保存できます。配色などの作品設定は保存しません。</p>
    <div className="seed-vault-navigation" role="group" aria-label="シード履歴の移動">
      <button type="button" disabled={disabled||vault.cursor<=0} onClick={()=>onNavigate(-1)}>← 前のシード</button>
      <span aria-label="履歴の位置">{vault.cursor+1} / {vault.history.length}</span>
      <button type="button" disabled={disabled||vault.cursor>=vault.history.length-1} onClick={()=>onNavigate(1)}>次のシード →</button>
    </div>
    <details className="seed-vault-history">
      <summary>シード履歴を探す（{vault.history.length} / 最大{SEED_HISTORY_LIMIT}件）</summary>
      <div className="seed-vault-history-tools">
        <label htmlFor="seed-vault-history-search">履歴を検索</label>
        <input id="seed-vault-history-search" type="search" value={historyQuery}
          placeholder="シード名の一部で検索" onChange={event=>setHistoryQuery(event.target.value)}/>
        <span role="status">{historyMatches.length}件表示 · 新しい順</span>
      </div>
      <ol className="seed-vault-history-results">
        {historyMatches.map(item=>{
          const saved=vault.bookmarks.some(bookmark=>bookmark.seed===item.seed);
          return <li key={item.index} className="seed-vault-history-entry">
            <button type="button" className="seed-vault-history-recall" disabled={disabled}
              aria-current={item.index===vault.cursor?'true':undefined}
              aria-label={item.seed+'の履歴を呼び出す'}
              onClick={()=>onHistoryIndex(item.index)} title={item.seed}>
              <span>{item.seed}</span>
              {item.index===vault.cursor&&<small>現在</small>}
            </button>
            <button type="button" className="seed-vault-history-save"
              disabled={disabled||(!saved&&vault.bookmarks.length>=SEED_VAULT_LIMIT)}
              aria-label={item.seed+'をお気に入りに保存'}
              title={saved?'保存済みのシード':'この履歴をお気に入りに保存'}
              onClick={()=>{
                try{
                  if(saved){setMessage('このシードはすでにお気に入りに保存されています。');return;}
                  onChange(saveBookmark(vault,item.seed,item.seed.slice(0,SEED_LABEL_LIMIT)));
                  setMessage('履歴のシードをお気に入りに保存しました。現在の作品は変更していません。');
                }catch(error){setMessage(error instanceof Error?error.message:'履歴を保存できませんでした。');}
              }}>{saved?'★':'☆ 保存'}</button>
          </li>;
        })}
        {!historyMatches.length&&<li className="seed-vault-empty">一致する履歴がありません。</li>}
      </ol>
    </details>
    <div className="seed-vault-save">
      <label htmlFor="seed-vault-name">お気に入りの名前</label>
      <input id="seed-vault-name" value={name} maxLength={SEED_LABEL_LIMIT}
        placeholder="例：青い魔法陣" onChange={event=>setName(event.target.value)}/>
      <button type="button" onClick={saveCurrent}
        disabled={disabled||!isUsableSeed(seed)||(!bookmarked&&vault.bookmarks.length>=SEED_VAULT_LIMIT)}>
        {bookmarked?'★ 保存名を更新':'☆ 現在のシードを保存'}
      </button>
    </div>
    <div className="seed-vault-list-header">
      <strong>保存済み {vault.bookmarks.length} / {SEED_VAULT_LIMIT}件</strong>
      <label htmlFor="seed-vault-search" className="sr-only">保存済みシードを検索</label>
      <input id="seed-vault-search" type="search" placeholder="名前・シードで検索" value={query}
        onChange={event=>setQuery(event.target.value)} aria-label="保存済みシードを検索"/>
    </div>
    <div className="seed-vault-library-tools">
      <label htmlFor="seed-vault-sort">表示順</label>
      <select id="seed-vault-sort" aria-label="お気に入りの表示順" value={order}
        onChange={event=>setOrder(event.target.value as BookmarkOrder)}>
        <option value="recent">保存した順</option>
        <option value="name">名前順</option>
        <option value="seed">シード順</option>
      </select>
      <span role="status">{matches.length}件表示 · {validSelection.length}件選択</span>
      <button type="button" disabled={!matches.some(item=>!validSelection.includes(item.seed))}
        onClick={()=>setSelected(current=>[...new Set([...current,...matches.map(item=>item.seed)])])}>表示中を選択</button>
      <button type="button" disabled={!validSelection.length} onClick={()=>setSelected([])}>選択解除</button>
      <button type="button" disabled={!validSelection.length}
        onClick={()=>downloadCollection(true)}>選択したシードをJSON保存</button>
    </div>
    <ul className="seed-vault-bookmarks">
      {matches.map(item=><li key={item.seed}>
        <label className="seed-vault-batch-select">
          <input type="checkbox" aria-label={item.name+'を一括書き出し対象に選択'}
            checked={validSelection.includes(item.seed)}
            onChange={event=>setSelected(current=>event.target.checked
              ?[...new Set([...current,item.seed])]
              :current.filter(value=>value!==item.seed))}/>
          <span className="sr-only">書き出し対象</span>
        </label>
        {renaming===item.seed?
          <div className="seed-vault-rename">
            <input aria-label="新しいシード名" maxLength={SEED_LABEL_LIMIT} value={renameText}
              onChange={event=>setRenameText(event.target.value)}
              onKeyDown={event=>{if(event.key==='Enter')commitRename(item.seed);else if(event.key==='Escape')setRenaming(null);}}/>
            <button type="button" disabled={disabled} onClick={()=>commitRename(item.seed)}>保存</button>
            <button type="button" onClick={()=>setRenaming(null)}>取消</button>
          </div>:
          <div className="seed-vault-entry">
            <button type="button" className="seed-vault-select" disabled={disabled}
              onClick={()=>onSelect(item.seed)} title={item.seed} aria-label={item.name+'を呼び出す'}>
              <strong>{item.name}</strong><small>{item.seed}</small>
            </button>
            <button type="button" disabled={disabled} aria-label={item.name+'の名前を変更'}
              onClick={()=>{setRenaming(item.seed);setRenameText(item.name);}}>名前</button>
            <button type="button" disabled={disabled} aria-label={item.name+'を削除'}
              onClick={()=>{onChange(deleteBookmark(vault,item.seed));setMessage('シードを保存一覧から削除しました。');}}>
              削除
            </button>
          </div>}
      </li>)}
      {!matches.length&&<li className="seed-vault-empty">{query?'一致する保存済みシードがありません。':'まだ保存済みシードがありません。'}</li>}
    </ul>
    <div className="seed-vault-transfer">
      <button type="button" disabled={disabled||!isUsableSeed(seed)}
        onClick={()=>void copyShareLink()}>共有リンクをコピー</button>
      <button type="button" disabled={disabled} onClick={()=>downloadCollection(false)}>一覧をJSON保存</button>
      <label htmlFor="seed-vault-import">一覧を読み込む</label>
      <input ref={fileInput} id="seed-vault-import" aria-label="シード一覧JSONを読み込む"
        type="file" accept=".json,application/json" disabled={disabled}
        onChange={event=>void importCollection(event)}/>
    </div>
    {message&&<p className="seed-vault-message" role="status" aria-live="polite">{message}</p>}
    <p className="help">共有リンクはシードだけを含み、開くとそのシードで生成します。JSONはお気に入り一覧だけをエクスポートし、読み込みは既存の作品・履歴を上書きしません。</p>
  </section>;
}
