import {describe,it,expect} from 'vitest';
import {exportMegapixels,fitExportToPngLimit,resizeLockedResolution,rotateExportResolution,scaleExportResolution} from './export-resolution';

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
  it('scales proportionally without altering the original dimensions',()=>{
    const original={width:1920,height:1080};
    expect(scaleExportResolution(original,.5)).toEqual({width:960,height:540});
    expect(scaleExportResolution(original,2)).toEqual({width:3840,height:2160});
    expect(scaleExportResolution({width:1080,height:1350},.5)).toEqual({width:540,height:675});
    expect(original).toEqual({width:1920,height:1080});
  });
  it('refuses unsafe scale operations rather than silently clipping',()=>{
    expect(scaleExportResolution({width:256,height:256},.5)).toBeNull();
    expect(scaleExportResolution({width:8192,height:4096},2)).toBeNull();
    expect(scaleExportResolution({width:1920,height:1080},Infinity)).toBeNull();
    expect(scaleExportResolution({width:1920,height:1080},0)).toBeNull();
    expect(scaleExportResolution({width:NaN,height:1080},.5)).toBeNull();
  });
  it('fits PNG size under the pixel budget without upscaling',()=>{
    const max=16_777_216;
    expect(fitExportToPngLimit({width:8192,height:8192},max))
      .toEqual({width:4096,height:4096});
    expect(fitExportToPngLimit({width:1920,height:1080},max))
      .toEqual({width:1920,height:1080});
    const wide=fitExportToPngLimit({width:8192,height:4096},max);
    expect(wide).not.toBeNull();
    expect(wide!.width*wide!.height).toBeLessThanOrEqual(max);
    expect(Math.abs(wide!.width/wide!.height-2)).toBeLessThan(.002);
    expect(fitExportToPngLimit({width:256,height:256},0)).toBeNull();
  });

});
