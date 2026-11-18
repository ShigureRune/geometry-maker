import {Fragment,useEffect,useRef,useState,type ReactNode} from 'react';

export type FineSectionItem = {
  id:string;
  label:string;
  detail:string;
  content:ReactNode;
};

/** Keep the real controls mounted while the fine-settings inspector changes pages.
 * Navigation checkboxes are independent of the controls they open.
 * Without preview mode this renders the original controls with no wrapper. */
export function FineSections({id,items,enabled=false,label}:{
  id:string;
  items:readonly FineSectionItem[];
  enabled?:boolean;
  label?:string;
}){
  const [active,setActive]=useState<string|null>(null);
  const lastVisited=useRef<string|null>(null);
  const didNavigate=useRef(false);
  const itemIds=items.map(item=>item.id).join('|');
  useEffect(()=>{
    if(active&&!itemIds.split('|').includes(active))setActive(null);
  },[itemIds,active]);
  useEffect(()=>{
    if(!enabled||!didNavigate.current)return;
    const selector=active?'.fine-sections-back-button':
      lastVisited.current?`#fine-${id}-${lastVisited.current}`:null;
    if(selector){
      document.querySelector<HTMLElement>(`#fine-sections-${id} ${selector}`)
        ?.focus({preventScroll:true});
    }
  },[active,enabled,id]);

  if(!enabled)return <>{items.map(item=><Fragment key={item.id}>{item.content}</Fragment>)}</>;

  return <section className="fine-sections" id={`fine-sections-${id}`}
    aria-label={`${label??({background:'背景',decoration:'装飾',animation:'アニメーション',colors:'カラー',shapes:'図形',text:'文字',export:'書き出し'}[id]??'設定')}の細かい設定`}
    onKeyDown={event=>{
      if(active&&event.key==='Escape'){
        event.preventDefault();
        event.stopPropagation();
        didNavigate.current=true;
        setActive(null);
      }
    }}>
    <nav className="fine-sections-list" aria-label="細かい設定項目一覧"
      hidden={active!==null} inert={active!==null}>
      <p className="fine-settings-caption">チェックして項目専用の設定画面を開きます。各機能のON/OFFは詳細画面内で変更できます。</p>
      {items.map(item=><label className="fine-settings-choice" key={item.id}
        htmlFor={`fine-${id}-${item.id}`}>
        <span className="fine-settings-choice-copy">
          <strong>{item.label}</strong><small>{item.detail}</small>
        </span>
        <input type="checkbox" id={`fine-${id}-${item.id}`}
          aria-label={`${item.label}の詳細設定を開く`}
          aria-controls={`fine-${id}-panel-${item.id}`}
          checked={active===item.id}
          onChange={event=>{
            if(event.target.checked){
              didNavigate.current=true;
              lastVisited.current=item.id;
              setActive(item.id);
            }
          }}/>
      </label>)}
    </nav>
    <div className="fine-sections-back" hidden={active===null}>
      <button type="button" className="fine-sections-back-button"
        onClick={()=>{didNavigate.current=true;setActive(null);}}>
        ← 細かい設定一覧へ
      </button>
      <strong>{items.find(item=>item.id===active)?.label}</strong>
    </div>
    {items.map(item=><div className="fine-sections-panel" key={item.id}
      data-fine-panel={item.id}
      id={`fine-${id}-panel-${item.id}`}
      hidden={active!==item.id}
      aria-hidden={active!==item.id}
      inert={active!==item.id}>
      {item.content}
    </div>)}
  </section>;
}
