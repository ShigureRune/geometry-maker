import {describe,expect,it} from 'vitest';
import {
  isBlackKey,whiteKeyBounds,buildFallingKeyboardLayout,buildHorizontalKeyboardLayout,
} from './keyboard-layout';

describe('authentic piano keyboard geometry',()=>{
  it('places every black key at the boundary of adjacent white keys',()=>{
    const keys=buildFallingKeyboardLayout(60,72,700,250,48);
    expect(keys.whites).toHaveLength(8);
    expect(keys.blacks).toHaveLength(5);
    const c=keys.byPitch.get(60)!;
    const cs=keys.byPitch.get(61)!;
    const d=keys.byPitch.get(62)!;
    const e=keys.byPitch.get(64)!;
    const f=keys.byPitch.get(65)!;
    const fs=keys.byPitch.get(66)!;
    const g=keys.byPitch.get(67)!;
    expect(cs.centerX).toBeCloseTo(c.x+c.w,4);
    expect(cs.centerX).toBeCloseTo(d.x,4);
    expect(fs.centerX).toBeCloseTo(f.x+f.w,4);
    expect(fs.centerX).toBeCloseTo(g.x,4);
    expect(f.x).toBeCloseTo(e.x+e.w,4); // E-F has no raised black key.
    expect(cs.w).toBeLessThan(c.w);
    expect(cs.h).toBeLessThan(c.h);
    expect(cs.noteWidth).toBeLessThan(c.noteWidth);
    expect(c.noteX+c.noteWidth).toBeLessThan(cs.noteX);
    expect(cs.noteX+cs.noteWidth).toBeLessThan(d.noteX);
  });

  it('fits a proper 61-key and 88-key keyboard edge to edge on mobile',()=>{
    for (const [low,high,count,whites] of [[36,96,61,36],[21,108,88,52]]) {
      const layout=buildFallingKeyboardLayout(low,high,390,312,40);
      expect(layout.byPitch.size).toBe(count);
      expect(layout.whites).toHaveLength(whites);
      expect(layout.whites[0].x).toBe(0);
      const last=layout.whites.at(-1)!;
      expect(last.x+last.w).toBeCloseTo(390,4);
      expect(layout.blacks).toHaveLength(count-whites);
      for (const key of [...layout.whites,...layout.blacks]) {
        expect(key.noteX).toBeGreaterThanOrEqual(-.001);
        expect(key.noteX+key.noteWidth).toBeLessThanOrEqual(390.001);
        expect(key.centerX).toBeGreaterThanOrEqual(0);
        expect(key.centerX).toBeLessThanOrEqual(390);
      }
    }
    expect(whiteKeyBounds(61,82)).toEqual([60,83]);
    expect(whiteKeyBounds(21,108)).toEqual([21,108]);
  });

  it('keeps each chromatic edit row fixed while black keys overlay white faces',()=>{
    const low=60,high=72,top=31,row=12;
    const layout=buildHorizontalKeyboardLayout(low,high,top,row,56);
    const c=layout.byPitch.get(60)!;
    const cs=layout.byPitch.get(61)!;
    const d=layout.byPitch.get(62)!;
    expect(layout.whites).toHaveLength(8);
    expect(layout.blacks).toHaveLength(5);
    expect(cs.centerY).toBeCloseTo(top+(high-61+.5)*row);
    expect(cs.x).toBeGreaterThan(c.x);
    expect(cs.w).toBeLessThan(c.w);
    expect(c.y+c.h).toBeCloseTo(cs.centerY,4);
    expect(d.y).toBeCloseTo(cs.centerY,4);
    expect(isBlackKey(61)).toBe(true);
    expect(isBlackKey(64)).toBe(false);
  });
});
