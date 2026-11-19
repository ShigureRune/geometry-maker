import {describe,it,expect} from 'vitest';
import {legacyColors} from './colors';
import {paletteCss,paletteGpl,paletteSvg} from './palette-export';
import type {Background} from './scene';

const bg={solid:'#112233',colors:['#445566','#778899','#aabbcc']} as Background;
const palette=legacyColors(bg);
describe('portable palette export',()=>{
  it('exports all seven current colors as valid CSS variables',()=>{
    const css=paletteCss(palette);
    expect((css.match(/--geometry-/g)??[]).length).toBe(7);
    expect(css).toContain('--geometry-solid: #112233;'.toUpperCase().replace('--GEOMETRY-SOLID','--geometry-solid'));
    expect(css).toContain('--geometry-accent: #9AF5D8;');
  });
  it('produces valid GIMP Palette RGB channels and labels',()=>{
    const gpl=paletteGpl(palette);
    expect(gpl).toMatch(/^GIMP Palette\nName: Geometry Maker/);
    expect(gpl).toContain(' 17  34  51  背景色');
    expect(gpl.trim().split('\n')).toHaveLength(11);
  });
  it('produces a standalone SVG with exactly seven swatches',()=>{
    const svg=paletteSvg(palette);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect((svg.match(/<rect x=/g)??[]).length).toBe(7);
    expect(svg).toContain('#112233'.toUpperCase());
  });
  it('never mutates the source settings or their locks',()=>{
    const before=JSON.stringify(palette);
    paletteCss(palette);paletteGpl(palette);paletteSvg(palette);
    expect(JSON.stringify(palette)).toBe(before);
  });
});
