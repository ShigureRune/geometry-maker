import {test as base,expect,type Locator,type Page} from '@playwright/test';
/** Existing functional suites navigate the real category checkboxes before acting.
 * Category-specific UI tests use Playwright directly to assert the navigation itself. */
export const test=base.extend({page:async({page},use)=>{
 const names:Record<string,string>={shapes:'図形',background:'背景',colors:'カラー',decoration:'装飾',animation:'アニメーション',export:'書き出し'};
 const actions=new Set(['click','fill','check','uncheck','setChecked','selectOption','setInputFiles','press','focus','dragTo','waitFor','screenshot','tap','_expect']);
 function wrap(locator:Locator,alternative:Locator=locator):Locator{return new Proxy(locator,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;
  if(actions.has(String(key)))return async(...args:unknown[])=>{const candidate=await target.count()?target:alternative;
   if(key==='_expect'&&(args[0]!=='to.be.visible'||(args[1] as {isNot?:boolean})?.isNot))return (candidate as any)[key](...args);
   if(await candidate.count()===1){const panel=await candidate.evaluate(node=>{
    const parent=node.closest<HTMLElement>('[data-category]');
    const detail=parent?.closest<HTMLElement>('.settings-screen-detail');
    return parent&&(parent.hidden||detail?.getAttribute('aria-hidden')==='true')?parent.dataset.category:null;
   });if(panel){
    const screen=page.locator('.settings-screen');
    if((await screen.getAttribute('class'))?.includes('is-detail'))
      await page.getByRole('button',{name:'設定一覧へ',exact:true}).click();
    await page.getByRole('checkbox',{name:names[panel]+'の設定を開く'}).check();
   }}
   const resolved=await target.count()?target:alternative;return (resolved as any)[key](...args);};
  return (...args:unknown[])=>{const result=value.apply(target,args);if(result&&typeof result==='object'&&typeof result.elementHandle==='function'){const altArgs=key==='getByRole'?[args[0],{...(args[1] as object??{}),includeHidden:true}]:args;return wrap(result,(alternative as any)[key](...altArgs));}return result;};
 }});}
 const proxy=new Proxy(page,{get(target,key){const value=Reflect.get(target,key);if(typeof value!=='function')return value;if(['locator','getByRole','getByLabel','getByText','getByTestId','getByPlaceholder'].includes(String(key)))return(...args:unknown[])=>{const result=value.apply(target,args);const altArgs=key==='getByRole'?[args[0],{...(args[1] as object??{}),includeHidden:true}]:args;return wrap(result,value.apply(target,altArgs));};return value.bind(target);}});
 await use(proxy as Page);
}});
export {expect};
export type {Page,Locator} from '@playwright/test';
