import {createContext,useContext,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Page-level navigation shared by every detailed setting inspector.
 * The live preview and all controls stay mounted while the entire Studio
 * overview page slides offscreen and a full-viewport detail page enters. */
export type StudioFineNavigation = {
  activeKey:string|null;
  open:(key:string)=>void;
  close:()=>void;
  host:HTMLElement|null;
};

export const StudioFineContext=createContext<StudioFineNavigation|null>(null);
export function useStudioFine(){return useContext(StudioFineContext);}

export function StudioFinePortal({enabled,children}:{
  enabled:boolean;
  children:ReactNode;
}){
  const context=useStudioFine();
  if(!enabled||!context?.host)return <>{children}</>;
  return createPortal(children,context.host);
}
