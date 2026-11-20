import type {PreviewScreenshot} from './preview-screenshot';

const DB_NAME='geometry-maker-screenshot-gallery-v1';
const STORE_NAME='captures';
const DB_VERSION=1;

/** Keep the gallery intentionally small; PNGs are stored separately from the
 * project/autosave settings so storage failures can never corrupt a project. */
export const SCREENSHOT_GALLERY_MAX=12;
export const SCREENSHOT_GALLERY_BUDGET=32*1024*1024;
export const SCREENSHOT_GALLERY_MAX_PNG=12*1024*1024;

export type ScreenshotGalleryItem=PreviewScreenshot&{
  id:string;
  createdAt:number;
};

export function galleryNewestFirst<T extends {id:string;createdAt:number}>(items:T[]):T[]{
  return [...items].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
}

export function galleryEvictions(
  items:Pick<ScreenshotGalleryItem,'id'|'createdAt'|'blob'>[],
  maxCount=SCREENSHOT_GALLERY_MAX,
  budget=SCREENSHOT_GALLERY_BUDGET,
):string[]{
  const newest=galleryNewestFirst(items);
  let total=0;
  const removed:string[]=[];
  newest.forEach((item,index)=>{
    if(index>=maxCount||total+item.blob.size>budget){removed.push(item.id);return;}
    total+=item.blob.size;
  });
  return removed;
}

function openGalleryDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){
      reject(new Error('このブラウザでは画像ギャラリーを保存できません。'));
      return;
    }
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('ギャラリーを開けませんでした。'));
    request.onblocked=()=>reject(new Error('別のタブがギャラリーを使用しています。'));
  });
}

async function withGallery<T>(
  mode:IDBTransactionMode,
  requestAction:(store:IDBObjectStore,finish:(value:T)=>void)=>void,
):Promise<T>{
  const db=await openGalleryDb();
  try{
    return await new Promise<T>((resolve,reject)=>{
      const transaction=db.transaction(STORE_NAME,mode);
      let value:T;
      let hasValue=false;
      transaction.oncomplete=()=>hasValue?resolve(value):reject(new Error('ギャラリーを完了できませんでした。'));
      transaction.onerror=()=>reject(transaction.error??new Error('ギャラリーを保存できませんでした。'));
      transaction.onabort=()=>reject(transaction.error??new Error('ギャラリーの保存が中断されました。'));
      try{
        requestAction(transaction.objectStore(STORE_NAME),(next)=>{
          value=next;hasValue=true;
        });
      }catch(error){
        transaction.abort();
        reject(error);
      }
    });
  }finally{db.close();}
}

export function listScreenshotGallery():Promise<ScreenshotGalleryItem[]>{
  return withGallery('readonly',(store,finish)=>{
    const request=store.getAll();
    request.onsuccess=()=>finish(galleryNewestFirst(request.result as ScreenshotGalleryItem[]));
  });
}

export async function addScreenshotToGallery(screenshot:PreviewScreenshot):Promise<ScreenshotGalleryItem>{
  if(!screenshot.blob.size||screenshot.blob.type!=='image/png')
    throw new Error('PNG画像のみギャラリーに保存できます。');
  if(screenshot.blob.size>SCREENSHOT_GALLERY_MAX_PNG)
    throw new Error('この画像は大きすぎるためギャラリーに保存できません。通常の「保存」を使ってください。');
  const item:ScreenshotGalleryItem={
    ...screenshot,
    id:`${Date.now()}-${Math.random().toString(36).slice(2,12)}`,
    createdAt:Date.now(),
  };
  return withGallery('readwrite',(store,finish)=>{
    const get=store.getAll();
    get.onsuccess=()=>{
      const current=get.result as ScreenshotGalleryItem[];
      const evicted=galleryEvictions([...current,item]);
      for(const id of evicted){
        if(id!==item.id)store.delete(id);
      }
      if(!evicted.includes(item.id))store.put(item);
      finish(item);
    };
  });
}

export function deleteScreenshotFromGallery(id:string):Promise<void>{
  return withGallery('readwrite',(store,finish)=>{
    store.delete(id);
    finish(undefined);
  });
}

export function clearScreenshotGallery():Promise<void>{
  return withGallery('readwrite',(store,finish)=>{
    store.clear();
    finish(undefined);
  });
}
