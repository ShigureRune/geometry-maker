import {describe,it,expect} from 'vitest';
import {exportMegapixels,resizeLockedResolution,rotateExportResolution} from './export-resolution';

describe('export resolution helpers',()=>{
  it('preserves portrait and landscape ratios when editing either axis',()=>{
    expect(resizeLockedResolution({width:1920,height:1080},'width',1280))
      .toEqual({width:1280,height:720});
    expect(resizeLockedResolution({width:1080,height:1920},'height',1280))
      .toEqual({width:720,height:1280});
    expect(resizeLockedResolution({width:1000,height:1000},'width',512))
      .toEqual({width:512,height:512});
  });
  it('rounds the paired dimension without fractional pixels',()=>{
    expect(resizeLockedResolution({width:1000,height:777},'width',1280))
      .toEqual({width:1280,height:995});
  });
  it('rejects invalid, oversized or unrepresentable values',()=>{
    expect(resizeLockedResolution({width:1920,height:1080},'width',200)).toBeNull();
    expect(resizeLockedResolution({width:1920,height:1080},'width',9000)).toBeNull();
    expect(resizeLockedResolution({width:8192,height:256},'height',512)).toBeNull();
    expect(resizeLockedResolution({width:1920,height:1080},'height',NaN)).toBeNull();
    expect(resizeLockedResolution({width:1920,height:1080},'height',1000.5)).toBeNull();
    expect(resizeLockedResolution({width:0,height:1080},'width',1280)).toBeNull();
  });
  it('swaps orientation and reports megapixels without mutating inputs',()=>{
    const original={width:1080,height:1920};
    expect(rotateExportResolution(original)).toEqual({width:1920,height:1080});
    expect(original).toEqual({width:1080,height:1920});
    expect(exportMegapixels(1920,1080)).toBe('2.07');
    expect(exportMegapixels(0,1080)).toBeNull();
  });
});
