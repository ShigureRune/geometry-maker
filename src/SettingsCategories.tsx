export const categories = [
  {id:'shapes',label:'図形',detail:'シード・構図・図形の密度',icon:'M12 2 22 12 12 22 2 12Z'},
  {id:'extensions',label:'拡張',detail:'VOID・銀河・粒子・2D合成',icon:'M12 2V8 M12 16V22 M2 12H8 M16 12H22 M5 5L9 9 M15 15L19 19 M19 5L15 9 M9 15L5 19'},
  {id:'background',label:'背景',detail:'背景色・グラデーション・空間',icon:'M3 4H21V20H3Z M3 15 8 10 13 15 17 11 21 15'},
  {id:'colors',label:'カラー',detail:'配色・パレット・テーマ',icon:'M17 8A5 5 0 1 1 7 8A5 5 0 1 1 17 8Z M11 16A5 5 0 1 1 1 16A5 5 0 1 1 11 16Z M23 16A5 5 0 1 1 13 16A5 5 0 1 1 23 16Z'},
  {id:'text',label:'文字',detail:'文字・レイアウト・登場演出',icon:'M4 5H20 M12 5V20 M7 20H17'},
  {id:'decoration',label:'装飾',detail:'発光・線・エフェクト',icon:'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z'},
  {id:'animation',label:'アニメーション',detail:'再生・動き・待機画面',icon:'M8 3 21 12 8 21Z M3 4V20'},
  {id:'export',label:'書き出し',detail:'画像・動画・設定JSON',icon:'M12 2V16 M6 10 12 16 18 10 M3 16V22H21V16'},
] as const;

export type Category=typeof categories[number]['id'];

/** Normal tabs for top-level categories; checkbox drill-down belongs to fine settings. */
export function SettingsCategories({active,onChange,disabled=[],variant='checklist',showExtensions=false}:{
  active:Category|null;
  onChange:(value:Category|null)=>void;
  disabled?:readonly Category[];
  variant?:'checklist'|'tabs';
  showExtensions?:boolean;
}){
  const visibleCategories=categories.filter(item=>item.id!=='extensions'||showExtensions);
  if(variant==='tabs')return <nav className="category-navigation settings-tabs-navigation" aria-label="設定カテゴリー">
    {visibleCategories.map(item=><button key={item.id} type="button" disabled={disabled.includes(item.id)}
      aria-pressed={active===item.id} aria-controls={`panel-${item.id}`}
      onClick={()=>onChange(item.id)}>{item.label}</button>)}
  </nav>;
  return <nav className="category-navigation settings-index-list" aria-label="設定カテゴリー">
    {visibleCategories.map(item=>{
      const unavailable=disabled.includes(item.id);
      return <label key={item.id}
        className={'settings-index-option'+(active===item.id?' is-selected':'')+(unavailable?' is-disabled':'')}
        htmlFor={`category-${item.id}`} title={unavailable?'このモードでは利用できません':undefined}>
        <span className="settings-option-icon" aria-hidden="true">
          <svg focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon}/>
          </svg>
        </span>
        <span className="settings-option-copy">
          <strong>{item.label}</strong>
          <small>{item.detail}</small>
        </span>
        <input type="checkbox" id={`category-${item.id}`}
          aria-label={`${item.label}の設定を開く`}
          aria-controls={`panel-${item.id}`}
          checked={active===item.id}
          disabled={unavailable}
          onChange={event=>onChange(event.target.checked?item.id:null)}/>
      </label>;
    })}
  </nav>;
}
