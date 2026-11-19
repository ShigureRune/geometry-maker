import {describe,it,expect} from 'vitest';
import {filterCommands,normalizeCommandIds} from './command-workspaces';
const commands=[
 {id:'a',title:'背景を編集',description:'背景色を変更',keywords:'bg color'},
 {id:'b',title:'3Dモード',description:'立体',keywords:'three'},
 {id:'c',title:'SVGを書き出す',description:'画像保存',keywords:'export'},
];
describe('command workspaces',()=>{
 it('deduplicates and bounds untrusted stored IDs',()=>{
  expect(normalizeCommandIds(['a','a',null,5,'','b'])).toEqual(['a','b']);
  expect(normalizeCommandIds('not an array')).toEqual([]);
  expect(normalizeCommandIds(Array.from({length:50},(_,i)=>String(i)))).toHaveLength(20);
 });
 it('filters favorites and recents without changing original commands',()=>{
  const original=commands.map(c=>c.id);
  expect(filterCommands(commands,'','favorites',['c','a'],['b']).map(c=>c.id)).toEqual(['c','a']);
  expect(filterCommands(commands,'','recent',['a'],['b','c']).map(c=>c.id)).toEqual(['b','c']);
  expect(commands.map(c=>c.id)).toEqual(original);
 });
 it('supports multiple Japanese and ASCII terms, full-width ASCII and empty results',()=>{
  expect(filterCommands(commands,'背景 色','all',[],[]).map(c=>c.id)).toEqual(['a']);
  expect(filterCommands(commands,'ＳＶＧ export','all',[],[]).map(c=>c.id)).toEqual(['c']);
  expect(filterCommands(commands,'背景','favorites',['b'],[])).toEqual([]);
 });
 it('keeps default favorite/recent priority and query original order',()=>{
  expect(filterCommands(commands,'','all',['c'],['b']).map(c=>c.id)).toEqual(['c','b','a']);
  expect(filterCommands(commands,'','all',[],[]).map(c=>c.id)).toEqual(['a','b','c']);
 });
});
