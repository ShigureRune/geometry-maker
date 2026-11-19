import {isHex,type ColorSettings,type Slot} from './colors';

export const PALETTE_SLOTS=[
  ['solid','背景色'],['gradient0','グラデーション1'],['gradient1','グラデーション2'],
  ['gradient2','グラデーション3'],['primary','主役色'],['support','補助色'],
  ['accent','アクセント色'],
] as const satisfies readonly (readonly [Slot,string])[];

function colors(settings:ColorSettings){
  return PALETTE_SLOTS.map(([slot,label])=>{
    const color=settings.slots[slot].color;
    if(!isHex(color))throw new Error('カラーの値が不正です。');
    return {slot,label,color:color.toUpperCase()};
  });
}
export function paletteCss(settings:ColorSettings):string{
  return ':root {\n'+colors(settings).map(({slot,color})=>`  --geometry-${slot}: ${color};`).join('\n')+'\n}\n';
}
export function paletteGpl(settings:ColorSettings):string{
  return 'GIMP Palette\nName: Geometry Maker\nColumns: 7\n#\n'+colors(settings).map(({color,label})=>{
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    return rgb.map(n=>String(n).padStart(3,' ')).join(' ')+'  '+label;
  }).join('\n')+'\n';
}
export function paletteSvg(settings:ColorSettings):string{
  const entries=colors(settings);
  const width=840,cell=120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="210" viewBox="0 0 ${width} 210" role="img" aria-label="Geometry Maker palette">
<rect width="840" height="210" fill="#141b29"/>
<text x="24" y="29" font-family="sans-serif" font-size="16" fill="#ffffff">GEOMETRY MAKER / PALETTE</text>
${entries.map(({color,slot},i)=>`<rect x="${i*cell+8}" y="48" width="104" height="104" rx="9" fill="${color}"/><text x="${i*cell+8}" y="174" font-family="sans-serif" font-size="12" fill="#ffffff">${slot}</text><text x="${i*cell+8}" y="193" font-family="monospace" font-size="12" fill="#bfc8e2">${color}</text>`).join('\n')}
</svg>`;
}
