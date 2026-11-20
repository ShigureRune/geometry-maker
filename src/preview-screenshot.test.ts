import {describe,it,expect} from 'vitest';
import {RATIOS} from './scene';
import {previewScreenshotSize,previewScreenshotFilename,screenshotXIntent} from './preview-screenshot';

describe('instant preview screenshot',()=>{
  it('uses exactly the current preview canvas ratio, including A4 and portrait',()=>{
    for(const [ratio,dimensions] of Object.entries(RATIOS)){
      const {width,height}=previewScreenshotSize(ratio as keyof typeof RATIOS);
      expect([width,height]).toEqual(dimensions);
      expect(width).toBeGreaterThanOrEqual(256);
      expect(height).toBeGreaterThanOrEqual(256);
      expect(width).toBeLessThanOrEqual(4096);
      expect(height).toBeLessThanOrEqual(4096);
      expect(width*height).toBeLessThanOrEqual(4_194_304);
    }
  });
  it('creates safe PNG filenames without altering the seed',()=>{
    const seed='♡紫雨 / ☆ ../ Rune';
    const name=previewScreenshotFilename(seed,'2d-v5','9:16');
    expect(name).toMatch(/^geometry-maker_2d-v5_seed-.*_screenshot_900x1600\.png$/);
    expect(name).not.toContain('../');
    expect(seed).toBe('♡紫雨 / ☆ ../ Rune');
  });
  it('X link only prepares a post; no unsupported image-upload claim',()=>{
    const url=new URL(screenshotXIntent('https://shugurerune.github.io/geometry-maker/'));
    expect(url.origin).toBe('https://twitter.com');
    expect(url.pathname).toBe('/intent/tweet');
    expect(url.searchParams.get('url')).toBe('https://shugurerune.github.io/geometry-maker/');
    expect(url.searchParams.get('text')).toContain('幾何学メーカー');
    expect(url.searchParams.has('media')).toBe(false);
  });
});
