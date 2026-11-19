import {Fragment,useEffect,useRef,useState,type ReactNode} from 'react';
import {StudioFinePortal,useStudioFine} from './StudioFinePages';

export type FineSectionItem = {
  id:string;
  label:string;
  detail:string;
  content:ReactNode;
};

/** A two-page horizontal settings navigator. Real controls remain mounted
 * across navigation, so animations, export jobs and form state survive. */
export function FineSections({id,items,enabled=false,label}:{
  id:string;
  items:readonly FineSectionItem[];
  enabled?:boolean;
  label?:string;
}){
  const studioFine=useStudioFine();
  const pageKey='fine:'+id;
  const [active,setActive]=useState<string|null>(null);
  const lastVisited=useRef<string|null>(null);
  const didNavigate=useRef(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(closeTimer.current!==null)clearTimeout(closeTimer.current);},[]);
  const closeDetail=()=>{
    didNavigate.current=true;
    studioFine?.close();
    // Keep the departing inspector visible while its page slides out.
    if(window.matchMedia('(max-width:720px) and (prefers-reduced-motion: no-preference)').matches){
      if(closeTimer.current!==null)clearTimeout(closeTimer.current);
      closeTimer.current=setTimeout(()=>{setActive(null);closeTimer.current=null;},440);
    }else setActive(null);
  };
  const itemIds=items.map(item=>item.id).join('|');
  useEffect(()=>{
    if(active&&!itemIds.split('|').includes(active))setActive(null);
  },[itemIds,active]);
  useEffect(()=>{
    if(studioFine&&active&&studioFine.activeKey!==null&&studioFine.activeKey!==pageKey)setActive(null);
  },[studioFine?.activeKey,active,pageKey]);
  useEffect(()=>{
    if(!enabled||!didNavigate.current)return;
    const selector=active?'.fine-sections-back-button':
      lastVisited.current?`#fine-${id}-${lastVisited.current}`:null;
    if(selector){
      document.querySelector<HTMLElement>(active?`#fine-sections-${id}-detail ${selector}`:`#fine-sections-${id} ${selector}`)
        ?.focus({preventScroll:true});
    }
  },[active,enabled,id]);

  if(!enabled)return <>{items.map(item=><Fragment key={item.id}>{item.content}</Fragment>)}</>;

  return <section className={'fine-sections'+(active?' is-detail':'')} id={`fine-sections-${id}`}
    data-fine-active={active??undefined}
    aria-label={`${label??({background:'背景',decoration:'装飾',animation:'アニメーション',colors:'カラー',shapes:'図形',text:'文字',export:'書き出し'}[id]??'設定')}の細かい設定`}
    onKeyDown={event=>{
      if(active&&event.key==='Escape'){
        event.preventDefault();
        event.stopPropagation();
        closeDetail();
      }
    }}>
    <div className="fine-sections-viewport">
      <div className="fine-sections-track">
        <nav className="fine-sections-list" aria-label="細かい設定項目一覧"
          aria-hidden={active!==null} inert={active!==null}>
          <p className="fine-settings-caption">項目を選ぶと画面全体がスライドします。機能のON/OFFは移動先の画面で変更できます。</p>
          {items.map(item=><button type="button" className="fine-settings-choice" key={item.id}
            id={`fine-${id}-${item.id}`}
            aria-label={`${item.label}の詳細設定を開く`}
            aria-controls={`fine-${id}-panel-${item.id}`}
            aria-expanded={active===item.id}
            onClick={()=>{
              if(closeTimer.current!==null){clearTimeout(closeTimer.current);closeTimer.current=null;}
              didNavigate.current=true;
              lastVisited.current=item.id;
              setActive(item.id);studioFine?.open(pageKey);
            }}>
            <span className="fine-settings-choice-copy">
              <strong>{item.label}</strong><small>{item.detail}</small>
            </span>
            <span className="fine-settings-chevron" aria-hidden="true">›</span>
          </button>)}
        </nav>
        <StudioFinePortal enabled={enabled}>
        <div className="fine-sections-detail-view studio-global-fine-page" id={`fine-sections-${id}-detail`}
          hidden={active===null} aria-hidden={active===null} inert={active===null}>
          <div className="fine-sections-back">
            <button type="button" className="fine-sections-back-button"
              onClick={closeDetail}>
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
        </div>
        </StudioFinePortal>
      </div>
    </div>
  </section>;
}
