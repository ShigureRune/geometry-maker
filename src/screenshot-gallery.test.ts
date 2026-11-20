import {describe,it,expect} from 'vitest';
import {
  galleryEvictions,galleryNewestFirst,
  SCREENSHOT_GALLERY_MAX,SCREENSHOT_GALLERY_BUDGET,SCREENSHOT_GALLERY_MAX_PNG,
} from './screenshot-gallery';

const item=(id:string,time:number,size:number)=>({
  id,createdAt:time,blob:new Blob([new Uint8Array(size)],{type:'image/png'}),
});

describe('screenshot gallery retention and ordering',()=>{
  it('keeps the latest 12 shots without changing stored items',()=>{
    const original=Array.from({length:15},(_,i)=>item('shot-'+i,1000+i,16));
    expect(galleryEvictions(original).sort()).toEqual(['shot-0','shot-1','shot-2']);
    expect(original).toHaveLength(15);
    expect(galleryNewestFirst(original)[0].id).toBe('shot-14');
    expect(SCREENSHOT_GALLERY_MAX).toBe(12);
  });
  it('prunes the oldest photos when an aggregate storage budget is reached',()=>{
    const photos=[item('old',1,70),item('middle',2,70),item('new',3,70)];
    expect(galleryEvictions(photos,12,140)).toEqual(['old']);
    expect(galleryEvictions(photos,12,100)).toEqual(['middle','old']);
    expect(galleryEvictions(photos,2,100)).toEqual(['middle','old']);
  });
  it('caps persistent PNG sizes without imposing a cap on regular image downloads',()=>{
    expect(SCREENSHOT_GALLERY_MAX_PNG).toBeLessThan(SCREENSHOT_GALLERY_BUDGET);
    expect(SCREENSHOT_GALLERY_MAX_PNG).toBeGreaterThanOrEqual(8*1024*1024);
  });
});
