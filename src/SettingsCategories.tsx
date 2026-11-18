export const categories = [
  {id:'shapes',label:'図形',icon:'M12 2 22 12 12 22 2 12Z'},
  {id:'background',label:'背景',icon:'M3 4H21V20H3Z M3 15 8 10 13 15 17 11 21 15'},
  {id:'colors',label:'カラー',icon:'M17 8A5 5 0 1 1 7 8A5 5 0 1 1 17 8Z M11 16A5 5 0 1 1 1 16A5 5 0 1 1 11 16Z M23 16A5 5 0 1 1 13 16A5 5 0 1 1 23 16Z'},
  {id:'text',label:'文字',icon:'M4 5H20 M12 5V20 M7 20H17'},
  {id:'decoration',label:'装飾',icon:'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z'},
  {id:'animation',label:'アニメーション',icon:'M8 3 21 12 8 21Z M3 4V20'},
  {id:'export',label:'書き出し',icon:'M12 2V16 M6 10 12 16 18 10 M3 16V22H21V16'},
] as const;

export type Category=typeof categories[number]['id'];

export function SettingsCategories({active,onChange,disabled=[]}:{active:Category|null;onChange:(value:Category|null)=>void;disabled?:readonly Category[]}){
  const current=categories.find(item=>item.id===active);
  if(current)return <div className="settings-detail-navigation" key={current.id}>
    <button type="button" className="settings-detail-back" onClick={()=>onChange(null)} aria-label="設定一覧に戻る">
      <span aria-hidden="true">←</span> 設定一覧に戻る
    </button>
    <label className="settings-detail-current" htmlFor="settings-current-toggle">
      <strong id={`category-${current.id}`}>{current.label}の設定</strong>
      <input id="settings-current-toggle" type="checkbox" checked
        aria-label={`${current.label}の設定画面を閉じる`} onChange={()=>onChange(null)}/>
    </label>
  </div>;

  return <nav className="category-navigation" aria-label="設定カテゴリー">
    <div className="settings-menu-heading"><strong>設定一覧</strong><span>項目を選ぶと専用の設定画面が開きます</span></div>
    {categories.map(item=><label key={item.id} id={`category-${item.id}`}
      className="settings-menu-item" htmlFor={`settings-option-${item.id}`}
      title={disabled.includes(item.id)?'このモードでは利用できません':undefined}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={item.icon}/>
      </svg>
      <span className="settings-menu-item-label">{item.label}</span>
      <input id={`settings-option-${item.id}`} type="checkbox" checked={false}
        disabled={disabled.includes(item.id)} aria-controls={`panel-${item.id}`}
        aria-label={`${item.label}の設定画面を開く`}
        onChange={event=>{if(event.target.checked)onChange(item.id);}}/>
    </label>)}
  </nav>;
}
