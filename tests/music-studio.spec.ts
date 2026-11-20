import {readFile} from 'node:fs/promises';
import midiPackage from '@tonejs/midi';
import {expect,test} from '@playwright/test';
const {Midi}=midiPackage;

test('Music keeps isolated 2D settings, edits both views and round trips genuine MIDI and MP3',async({page},testInfo)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?seed=geometry-music-regression');
  const geometry=page.getByTestId('current-seed');
  await expect(geometry).toHaveText('geometry-music-regression',{timeout:25_000});
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await expect(studio).toBeVisible();
  await expect(page.getByTestId('three-preview')).toHaveCount(0);
  await expect(geometry).toBeHidden();
  await studio.getByLabel('音楽シード').fill('audio-integration-fixture');
  await studio.getByLabel('長さ',{exact:true}).selectOption('4');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  const timeline=studio.getByLabel('再生位置',{exact:true});
  await expect(timeline).toHaveAttribute('max','7680');
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  await expect(studio.getByLabel('落下ノーツ型ピアノロール')).toBeVisible();
  await studio.getByRole('button',{name:'音符を追加'}).click();
  await expect(studio.getByLabel('ベロシティ',{exact:true})).toHaveValue('90');
  await studio.getByLabel('ベロシティ',{exact:true}).fill('101');
  await studio.getByLabel('ベロシティ',{exact:true}).press('Enter');
  await studio.getByRole('button',{name:'横スクロール',exact:true}).click();
  await expect(studio.getByLabel('ベロシティ',{exact:true})).toHaveValue('101');
  await studio.getByRole('button',{name:'元に戻す'}).click();
  await studio.getByRole('button',{name:'やり直す'}).click();

  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(4);
  expect(midi.tracks[0].notes.some(n=>n.midi===60&&n.ticks===0&&n.durationTicks===120&&Math.round(n.velocity*127)===101)).toBe(true);

  const jsonDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const json=await readFile((await (await jsonDownload).path())!);
  const saved=JSON.parse(json.toString());
  expect(saved.song.seed).toBe('audio-integration-fixture');
  await studio.getByLabel('楽曲JSONファイル').setInputFiles({name:'song.json',mimeType:'application/json',buffer:json});
  await expect(studio.getByText('楽曲JSONを読み込みました。')).toBeVisible();

  await studio.getByRole('button',{name:/▶ 再生/}).click();
  await expect.poll(async()=>Number(await timeline.inputValue())).toBeGreaterThan(40);
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  await expect(studio.getByRole('button',{name:'一時停止',exact:true})).toBeEnabled();
  await studio.getByRole('button',{name:'一時停止',exact:true}).click();
  const paused=await timeline.inputValue();
  await expect(timeline).toHaveValue(paused);
  await studio.getByRole('button',{name:/■ 停止/}).click();
  await expect(timeline).toHaveValue('0');

  await studio.getByLabel('サンプルレート').selectOption('48000');
  const download=page.waitForEvent('download',{timeout:25_000});
  // A failed Worker or offline render should surface its UI error immediately.
  const exportFailure=studio.getByRole('alert').waitFor({timeout:25_000}).then(async()=>{
    throw new Error(await studio.getByRole('alert').innerText());
  });
  await studio.getByRole('button',{name:'MP3書き出し',exact:true}).click();
  const mp3=await Promise.race([download,exportFailure]);
  const path=testInfo.outputPath('edited-song.mp3');
  await mp3.saveAs(path);
  const bytes=await readFile(path);
  expect(bytes.length).toBeGreaterThan(160_000);
  expect(bytes[0]).toBe(255);
  expect(bytes[1]&224).toBe(224);
  const audio=await page.evaluate(async input=>{
    const context=new AudioContext({sampleRate:48000});
    try{
      const raw=Uint8Array.from(atob(input),v=>v.charCodeAt(0));
      const pcm=await context.decodeAudioData(raw.buffer);
      const channel=pcm.getChannelData(0);
      const middle=channel.subarray(3*pcm.sampleRate,4*pcm.sampleRate);
      const late=channel.subarray(7*pcm.sampleRate,8*pcm.sampleRate);
      return {channels:pcm.numberOfChannels,duration:pcm.duration,
        earlyPeak:middle.reduce((m,n)=>Math.max(m,Math.abs(n)),0),latePeak:late.reduce((m,n)=>Math.max(m,Math.abs(n)),0)};
    }finally{await context.close();}
  },bytes.toString('base64'));
  expect(audio.channels).toBe(2);
  expect(audio.duration).toBeGreaterThan(8.4);
  expect(audio.duration).toBeLessThan(8.7);
  expect(audio.earlyPeak).toBeGreaterThan(.04);
  expect(audio.latePeak).toBeGreaterThan(.04);

  const loopStart=studio.getByLabel('開始小節',{exact:true});
  const loopEnd=studio.getByLabel('終了小節',{exact:true});
  await loopStart.fill('2');
  await loopStart.press('Enter');
  await loopEnd.fill('2');
  await loopEnd.press('Enter');
  await studio.getByLabel('範囲ループ').check();
  await studio.getByRole('button',{name:/▶ 再生/}).click();
  await expect.poll(async()=>Number(await timeline.inputValue())).toBeGreaterThan(1920);
  await timeline.fill('3800');
  await expect.poll(async()=>Number(await timeline.inputValue())).toBeLessThan(2400);
  await studio.getByRole('button',{name:/■ 停止/}).click();

  await studio.getByRole('button',{name:'2Dモード',exact:true}).click();
  await expect(geometry).toHaveText('geometry-music-regression',{timeout:25_000});
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  await expect(studio.getByLabel('音楽シード')).toHaveValue('audio-integration-fixture');
  expect(errors).toEqual([]);
});

test('direct Music entry works at mobile width and cancels MP3 without navigation',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?mode=music');
  const studio=page.getByRole('heading',{name:'Seed Music Studio'});
  await expect(studio).toBeVisible();
  await expect(page.getByTestId('current-seed')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByText('書き出し',{exact:true}).click();
  await page.getByRole('button',{name:'MP3書き出し',exact:true}).click();
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await expect(page.getByText('MP3の書き出しをキャンセルしました。')).toBeVisible();
  await expect(page.getByRole('button',{name:'MP3書き出し',exact:true})).toBeEnabled();
});

test('Music releases the 3D canvas and restores the geometry project on return',async({page})=>{
  test.setTimeout(90_000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./?seed=geometry-3d-music');
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  const preview=page.getByTestId('three-preview');
  await expect(preview.locator('canvas')).toBeVisible({timeout:30_000});
  await page.getByLabel('クイック比率').selectOption('1:1');
  const canvas=await preview.locator('canvas').elementHandle();
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Seed Music Studio'})).toBeVisible();
  await expect(preview).toHaveCount(0);
  await page.waitForFunction(element=>!!element&&!element.isConnected,canvas);
  await page.getByRole('button',{name:'3Dモード',exact:true}).click();
  await expect(preview.locator('canvas')).toBeVisible({timeout:30_000});
  await expect(page.getByLabel('クイック比率')).toHaveValue('1:1');
  await expect(page.getByTestId('current-seed')).toHaveText('geometry-3d-music');
});

test('Music can generate a long-form eight-part song and return to four parts',async({page})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('音楽シード').fill('long-form-browser-check');
  await studio.getByLabel('長さ',{exact:true}).selectOption('128');
  await studio.getByLabel('同時演奏パート数').selectOption('8');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await expect(studio.getByLabel('再生位置',{exact:true})).toHaveAttribute('max',String(128*1920));
  await expect(studio.getByRole('button',{name:'アルペジオ',exact:true})).toBeVisible();
  await expect(studio.getByRole('button',{name:'リズムシンセ',exact:true})).toBeVisible();
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(8);
  expect(midi.tracks.every(track=>track.notes.length>0)).toBe(true);
  await studio.getByRole('button',{name:'リズムシンセ',exact:true}).click();
  await studio.getByLabel('同時演奏パート数').selectOption('4');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await expect(studio.getByRole('button',{name:'リズムシンセ',exact:true})).toHaveCount(0);
  await expect(studio.getByRole('button',{name:'メロディー',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});

test('falling roll shows all eight colored parts with toggleable effects without altering MIDI',async({page})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('音楽シード').fill('falling-multi-layers');
  await studio.getByLabel('同時演奏パート数').selectOption('8');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  const canvas=studio.getByLabel('落下ノーツ型ピアノロール');
  await expect(canvas).toBeVisible();
  await studio.getByText('表示とグリッド',{exact:true}).click();
  await expect(studio.getByLabel('全パート同時落下')).toBeChecked();
  await expect(studio.getByLabel('重複ノーツを左右分離')).toBeChecked();
  await expect(studio.getByLabel('ノーツカラー')).toHaveValue('track');
  await expect(studio.getByRole('slider',{name:'発光強度'})).toHaveValue('60');
  const allTracks=await canvas.evaluate((element:HTMLCanvasElement)=>element.toDataURL());
  await studio.getByLabel('全パート同時落下').uncheck();
  const oneTrack=await canvas.evaluate((element:HTMLCanvasElement)=>element.toDataURL());
  expect(oneTrack).not.toEqual(allTracks);
  await studio.getByLabel('全パート同時落下').check();
  await studio.getByLabel('重複ノーツを左右分離').uncheck();
  await studio.getByLabel('着地波紋').uncheck();
  await studio.getByLabel('着地フラッシュ').uncheck();
  await studio.getByLabel('エフェクト品質').selectOption('low');
  await studio.getByRole('slider',{name:'発光強度'}).press('Home');
  await studio.getByRole('slider',{name:'残像強度'}).press('Home');
  await expect(studio.getByRole('slider',{name:'発光強度'})).toHaveValue('0');
  await studio.getByRole('button',{name:'横スクロール',exact:true}).click();
  await expect(studio.getByLabel('横スクロール型ピアノロール')).toBeVisible();
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(8);
  expect(errors).toEqual([]);
});

test('both piano rolls use authentic white and raised black keys without affecting MIDI',async({page})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('音楽シード').fill('authentic-keyboard-visual');
  await studio.getByLabel('同時演奏パート数').selectOption('8');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  await studio.getByText('表示とグリッド',{exact:true}).click();
  const canvas=studio.getByLabel('落下ノーツ型ピアノロール');
  const sampleKeys=async(firstWhite:number,totalWhites:number)=>{
    return canvas.evaluate((element:HTMLCanvasElement,{firstWhite,totalWhites})=>{
      const context=element.getContext('2d')!;
      const sx=element.width/element.clientWidth,sy=element.height/element.clientHeight;
      const whiteWidth=element.clientWidth/totalWhites;
      const middleC=35-firstWhite; // C4 has global white ordinal 35.
      const y=Math.floor((element.clientHeight-40+7)*sy);
      const pixel=(ordinal:number)=>{
        const x=Math.floor(ordinal*whiteWidth*sx);
        return [...context.getImageData(x,y,1,1).data].slice(0,3);
      };
      const white=pixel(middleC+.5);
      const black=pixel(middleC+1); // C#4 is at the C/D white-key boundary.
      return {
        white,black,
        brightnessDifference:white.reduce((sum,v)=>sum+v,0)-black.reduce((sum,v)=>sum+v,0),
      };
    },{firstWhite,totalWhites});
  };
  await studio.getByLabel('鍵盤範囲').selectOption('61');
  await expect.poll(async()=>(await sampleKeys(21,36)).brightnessDifference).toBeGreaterThan(220);
  await studio.getByLabel('鍵盤範囲').selectOption('88');
  await expect.poll(async()=>(await sampleKeys(12,52)).brightnessDifference).toBeGreaterThan(180);
  await studio.getByRole('button',{name:'横スクロール',exact:true}).click();
  await expect(studio.getByLabel('横スクロール型ピアノロール')).toBeVisible();
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  await expect(studio.getByLabel('落下ノーツ型ピアノロール')).toBeVisible();
  const download=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  expect(new Midi(await readFile((await (await download).path())!)).tracks).toHaveLength(8);
  expect(errors).toEqual([]);
});

test('ten-genre generator supports arrangement and melody variants through MIDI and JSON',async({page})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  const genre=studio.getByLabel('ジャンル',{exact:true});
  await expect(genre.locator('option')).toHaveCount(11);
  await genre.selectOption('ドラムンベース');
  await studio.getByLabel('曲構成').selectOption('サビ重視');
  await studio.getByLabel('メロディーの動き').selectOption('疾走');
  await studio.getByLabel('音楽シード').fill('breakbeats-deterministic');
  await studio.getByLabel('長さ',{exact:true}).selectOption('16');
  await studio.getByLabel('同時演奏パート数').selectOption('8');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await expect(studio.getByLabel('ジャンル',{exact:true})).toHaveValue('ドラムンベース');
  await studio.getByRole('button',{name:'落下ノーツ',exact:true}).click();
  await expect(studio.getByLabel('落下ノーツ型ピアノロール')).toBeVisible();
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(8);
  expect(midi.tracks.some(track=>track.notes.length>0)).toBe(true);
  const jsonDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const content=await readFile((await (await jsonDownload).path())!);
  const saved=JSON.parse(content.toString());
  expect(saved.song.config.genre).toBe('ドラムンベース');
  expect(saved.song.config.arrangement).toBe('サビ重視');
  expect(saved.song.config.melodyStyle).toBe('疾走');
  await studio.getByLabel('楽曲JSONファイル').setInputFiles({name:'variations.json',
    mimeType:'application/json',buffer:content});
  await expect(studio.getByLabel('曲構成')).toHaveValue('サビ重視');
  await expect(studio.getByLabel('メロディーの動き')).toHaveValue('疾走');
  expect(errors).toEqual([]);
});


test('Music playback recovers after app backgrounding, context shutdown and mode switching',async({page})=>{
  test.setTimeout(60_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const NativeAudioContext=window.AudioContext;
    const contexts:AudioContext[]=[];
    (window as typeof window & {__musicContexts:AudioContext[]}).__musicContexts=contexts;
    window.AudioContext=class extends NativeAudioContext {
      constructor(...args:ConstructorParameters<typeof AudioContext>) {
        super(...args);
        contexts.push(this);
      }
    };
  });
  await page.goto('./?seed=music-foreground-regression');
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  const play=studio.getByRole('button',{name:/▶ 再生/});
  const pause=studio.getByRole('button',{name:'一時停止',exact:true});
  const timeline=studio.getByLabel('再生位置',{exact:true});
  await play.click();
  await expect(pause).toBeEnabled();
  await expect.poll(async()=>Number(await timeline.inputValue())).toBeGreaterThan(20);

  // Mimic iOS/Android switching to another app. The old AudioContext must
  // be released, with an enabled play button even if autoplay is denied.
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(play).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>
    (window as typeof window & {__musicContexts:AudioContext[]}).__musicContexts[0].state
  )).toBe('closed');
  const savedTick=Number(await timeline.inputValue());
  expect(savedTick).toBeGreaterThan(0);

  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(()=>page.evaluate(()=>
    (window as typeof window & {__musicContexts:AudioContext[]}).__musicContexts.length
  )).toBeGreaterThanOrEqual(2);
  // Auto-resume is best effort: a browser may require another user gesture.
  if (await play.isEnabled()) await play.click();
  await expect(pause).toBeEnabled();
  await expect.poll(async()=>Number(await timeline.inputValue())).toBeGreaterThan(savedTick);

  // The OS may also close the audio device without firing visibilitychange.
  await page.evaluate(async()=>{
    const contexts=(window as typeof window & {__musicContexts:AudioContext[]}).__musicContexts;
    await contexts[contexts.length-1].close();
  });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(pause).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>
    (window as typeof window & {__musicContexts:AudioContext[]}).__musicContexts.length
  )).toBeGreaterThanOrEqual(3);

  await pause.click();
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(play).toBeEnabled(); // A user pause must not trigger auto-resume.
  await studio.getByRole('button',{name:'2Dモード',exact:true}).click();
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  await play.click();
  await expect(pause).toBeEnabled();
  expect(errors).toEqual([]);
});


test('Piano-only mode changes playback and MIDI without destroying the original project',async({page})=>{
  await page.goto('./?seed=piano-only-mode');
  await page.getByRole('button',{name:'Musicモード',exact:true}).click();
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('音楽シード').fill('piano-only-mode');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  const piano=studio.getByRole('button',{name:/ピアノだけ/});
  await piano.click();
  await expect(piano).toHaveAttribute('aria-pressed','true');
  await studio.getByRole('button',{name:/▶ 再生/}).click();
  await expect(studio.getByRole('button',{name:'一時停止',exact:true})).toBeEnabled();
  await studio.getByRole('button',{name:/■ 停止/}).click();

  const pianoDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const pianoMidi=new Midi(await readFile((await (await pianoDownload).path())!));
  expect(pianoMidi.tracks.filter(track=>track.notes.length).every(track=>track.instrument.number===0)).toBe(true);

  const jsonDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const saved=JSON.parse((await readFile((await (await jsonDownload).path())!)).toString());
  expect(saved.song.tracks.some((track:{instrument:string})=>track.instrument==='Drum Kit')).toBe(true);

  await studio.getByRole('button',{name:'通常編成',exact:true}).click();
  await expect(piano).toHaveAttribute('aria-pressed','false');
  const normalDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const normalMidi=new Midi(await readFile((await (await normalDownload).path())!));
  expect(normalMidi.tracks.some(track=>track.channel===9)).toBe(true);
});

test('Epic genre generates trailer-style sections and survives JSON plus MIDI export',async({page})=>{
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('ジャンル',{exact:true}).selectOption('エピック');
  await studio.getByLabel('長さ',{exact:true}).selectOption('16');
  await studio.getByLabel('同時演奏パート数').selectOption('8');
  await studio.getByLabel('音楽シード').fill('epic-trailer-browser');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  await expect(studio.getByLabel('ジャンル',{exact:true})).toHaveValue('エピック');
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(8);
  expect(midi.tracks.some(track=>track.notes.length>0)).toBe(true);
  const jsonDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const json=await readFile((await (await jsonDownload).path())!);
  const saved=JSON.parse(json.toString());
  expect(saved.song.config.genre).toBe('エピック');
  expect(saved.song.sections.some((section:{name:string})=>section.name==='Build')).toBe(true);
  await studio.getByLabel('楽曲JSONファイル').setInputFiles({name:'epic.json',mimeType:'application/json',buffer:json});
  await expect(studio.getByLabel('ジャンル',{exact:true})).toHaveValue('エピック');
});

test('Epic recommendation builds a dramatic minor-key score and a clean three-part piano edition',async({page})=>{
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('ジャンル',{exact:true}).selectOption('エピック');
  await studio.getByRole('button',{name:/Epic向け推奨設定/}).click();
  await expect(studio.getByLabel('スケール')).toHaveValue('ナチュラルマイナー');
  await expect(studio.getByLabel('同時演奏パート数')).toHaveValue('8');
  await expect(studio.getByLabel('長さ',{exact:true})).toHaveValue('32');
  await expect(studio.getByLabel('作曲BPM')).toHaveValue('140');
  await studio.getByLabel('音楽シード').fill('epic-piano-contrast');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  const piano=studio.getByRole('button',{name:/ピアノだけ/});
  await piano.click();
  await expect(piano).toHaveAttribute('aria-pressed','true');
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks).toHaveLength(3);
  expect(midi.tracks.every(track=>track.instrument.number===0)).toBe(true);
  const projectDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const project=JSON.parse((await readFile((await (await projectDownload).path())!)).toString());
  expect(project.song.tracks).toHaveLength(8);
  expect(project.song.sections.some((section:{name:string})=>section.name==='Build')).toBe(true);
});

test('Epic orchestra plays CC0 sampled instruments and exports matching MP3/MIDI without changing the JSON',async({page})=>{
  test.setTimeout(90_000);
  // Network-independent test: return a valid short WAV from every pack URL.
  // The samples are decoded through exactly the same AudioContext path as MP3.
  const rate=22050,frames=rate;
  const wav=Buffer.alloc(44+frames*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);
  wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);
  wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*330/rate)*8000),44+i*2);
  let requested=0;
  await page.route('https://koulaxizis.github.io/oros-sounds/packs/**',async route=>{
    requested++;
    await route.fulfill({status:200,contentType:'audio/wav',body:wav,
      headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto('./?mode=music');
  const studio=page.getByRole('main').filter({has:page.getByRole('heading',{name:'Seed Music Studio'})});
  await studio.getByLabel('ジャンル',{exact:true}).selectOption('エピック');
  await studio.getByLabel('長さ',{exact:true}).selectOption('4');
  await studio.getByRole('button',{name:'シードから生成'}).click();
  const orchestra=studio.getByRole('button',{name:'🎻 Epicオーケストラ',exact:true});
  await orchestra.click();
  await expect(orchestra).toHaveAttribute('aria-pressed','true',{timeout:30_000});
  expect(requested).toBeGreaterThanOrEqual(20);
  await expect(studio.getByText(/VSCO 2の録音オーケストラ音源を読み込みました/)).toBeVisible();
  const play=studio.getByRole('button',{name:/▶ 再生/});
  await play.click();
  await expect(studio.getByRole('button',{name:'一時停止',exact:true})).toBeEnabled();
  await studio.getByRole('button',{name:/■ 停止/}).click();
  const midiDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'MIDI書き出し',exact:true}).click();
  const midi=new Midi(await readFile((await (await midiDownload).path())!));
  expect(midi.tracks.slice(0,3).map(track=>track.instrument.number)).toEqual([60,48,42]);
  expect(midi.tracks[3].channel).toBe(9);
  const jsonDownload=page.waitForEvent('download');
  await studio.getByRole('button',{name:'JSON保存',exact:true}).click();
  const project=JSON.parse((await readFile((await (await jsonDownload).path())!)).toString());
  expect(project.song.tracks[0].midiProgram).toBe(81);
  const mp3Download=page.waitForEvent('download',{timeout:45_000});
  await studio.getByRole('button',{name:'MP3書き出し',exact:true}).click();
  const mp3=await readFile((await (await mp3Download).path())!);
  expect(mp3.length).toBeGreaterThan(20_000);
  await studio.getByRole('button',{name:'通常編成',exact:true}).click();
  await expect(orchestra).toHaveAttribute('aria-pressed','false');
});
