import {HelpInfo} from './HelpInfo';
import {FineSections} from './FineSections';
import { SettingsCategories, categories, type Category } from './SettingsCategories';
import {StudioCommandPalette, type StudioCommand} from './StudioCommandPalette';
import {SeedExplorerBoard} from './SeedExplorerBoard';
import {SeedVaultControls} from './SeedVaultControls';
import {loadSeedVault,saveSeedVault,saveBookmark,recordSeed,moveSeedHistory,seedFromSearch,SEED_VAULT_LIMIT, type SeedVault} from './seed-vault';
import {ShapeKindControls} from './ShapeKindControls';
import {MagicCircleControls,MagicColorControls} from './MagicCircleControls';
import {MagicCirclePreview} from './MagicCirclePreview';
import {backgroundForMagic,magicPaletteById,magicPaletteFromSeed} from './magic-colors';
import {MAGIC_ALGORITHM_VERSION,magicDefaults,type MagicCircleSettings} from './magic-circle';
import {ALL_SHAPE_KINDS,type ShapeKind} from './shape-controls';
import { AmbientControls, AmbientStage, useAmbientClock, ambientDefaults } from './AmbientControls';
import {figureScrollAngle} from './ambient';
import { darkTheme,VISUAL_THEMES,THEME_PRESETS,applyThemePalette,themeScene,type VisualTheme } from './themes';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimationControls,usePlayback } from './AnimationControls';
import { defaults,MOTION_DEFAULTS,motionPresetParameters,schedule,progressAt,type AnimationSettings } from './animation';
import {createFigureMotionPlan,figureFlowAt} from './figure-motion';
import { densityCandidates, visibleScene } from './density';
import { ColorEditor } from './ColorEditor';
import {GridBackgroundControls} from './GridBackgroundControls';
import {gridBackgroundDefaults} from './grid-background';
import {useGridClock} from './useGridClock';
import {ImagePaletteControls} from './ImagePaletteControls';
import {TextControls} from './TextControls';
import {useTextEntrancePreview} from './preview-text-animation';
import {PreviewTextEditor} from './PreviewTextEditor';
import {textOverlayDefaults,type TextOverlaySettings} from './text-overlay';
import {applyImagePalette} from './image-palette';
import { coloredBackground, legacyColors, reseedColors, rerollColor, type Slot, type ColorSettings } from './colors';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {generateThreeComposition, spaceThreeComposition, THREE_ALGORITHM_VERSION, visibleThreeObjects} from './three/model';
import {generateCelestialBodies, celestialDefaults} from './three/celestial';
import {threeDefaults, type ThreePreviewHandle, type ThreeSettings, type ThreeView} from './three/settings';
import {ThreeShapeControls, ThreeMaterialControls, ThreeAnimationControls} from './three/ThreeControls';
import {ThreeStandbyControls} from './three/ThreeStandbyControls';
import {standbyDefaults,type ThreeStandbyTransition} from './three/standby';
import {ThreeExportPanel} from './three/ThreeExportPanel';
import {ThreeBoundary} from './three/ThreeBoundary';
import {ThreeStyleControls} from './three/ThreeStyleControls';
import {Hybrid2DControls} from './three/Hybrid2DControls';
import {hybrid2DDefaults,hybrid2DSeed} from './three/hybrid-2d';
import {FloorGridControls} from './three/FloorGridControls';
import {SkyControls} from './three/SkyControls';
import {VoidModeControls} from './three/VoidModeControls';
import {StudioResetControls} from './StudioResetControls';
import {generateVoidComposition,isVoidComposition,spaceVoidComposition} from './three/void-graph';
import {generateVoidWeb} from './three/void-web';
import {VOID_WEB_VERSION,voidDefaults,voidWebDefaults,voidRenderSettings} from './three/void-settings';
import {galaxyDefaults} from './three/galaxy';
import {particleDefaults} from './three/particle';
import {floorGridDefaults} from './three/floor-grid';
import type {ThreeProject} from './three/project';
import {loadStudioAutosave,saveStudioAutosave,type StudioAutosave} from './studio-autosave';
import {clearStudioPreferences} from './studio-reset';
import type {ProjectSettings} from './settings';
import './three/three.css';
import { ExportPanel } from './ExportPanel';
import { Preview } from './Preview';
import { ALGORITHM_VERSION, LEGACY_ALGORITHM_VERSION, type AlgorithmVersion, createRandomSeed, generateScene, RATIOS, type Background, type Ratio } from './scene';

const initialBackground: Background = {glowIntensity:100,mode:'gradient',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135};
const ThreePreview = lazy(() => import('./three/ThreePreview'));


export default function App() {
  // Read once, synchronously, before any state initializer or effect can
  // overwrite the last draft with a fresh random seed.
  const saved=useMemo(loadStudioAutosave,[]);
  const resetting=useRef(false);
  const lastProject=saved?.twoD;
  // A share URL overrides only the seed, never the recipient's saved editor settings.
  const sharedSeed=useMemo(()=>seedFromSearch(window.location.search),[]);
  useEffect(()=>{
    if(sharedSeed===null)return;
    // Once opened, restore normal autosave behavior on reload/navigation.
    const address=new URL(window.location.href);
    address.searchParams.delete('seed');
    window.history.replaceState(window.history.state,'',address.pathname+address.search+address.hash);
  },[sharedSeed]);
  const [renderMode,setRenderMode]=useState<'2d'|'3d'>(saved?.mode??'2d');
  const [category,setCategory]=useState<Category|null>(saved?.category??'shapes');
  const [threeCategory,setThreeCategory]=useState<Category|null>(saved?.threeCategory??'shapes');
  const activeCategory=renderMode==='2d'?category:threeCategory;
  // Fine-detail prototype: keep the seven main categories as compact tabs;
  // individual sections, not main categories, use the checkbox drill-down.
  const finePreview=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('legacy-ui')!=='1';
  const [settingsOverview,setSettingsOverview]=useState(!finePreview);
  const settingsNavigationInitialized=useRef(false);
  const [showBackToTop,setShowBackToTop]=useState(false);
  useEffect(()=>{
    // When the overview becomes inert, move keyboard focus into the new page.
    // Returning restores focus to the category the editor last visited.
    if(!settingsNavigationInitialized.current){
      settingsNavigationInitialized.current=true;
      return;
    }
    const selector=settingsOverview
      ? `#category-${activeCategory??'shapes'}`
      : '.settings-detail-back';
    document.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
  },[settingsOverview]);
  const [studioFocus,setStudioFocus]=useState(saved?.focus??false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(saved?.collapsed??false);
  const [autosaveStatus,setAutosaveStatus]=useState<'pending'|'saved'|'unavailable'>('pending');
  const [commandOpen,setCommandOpen]=useState(false);
  const [explorerOpen,setExplorerOpen]=useState(false);
  const closeCommands=useCallback(()=>setCommandOpen(false),[]);
  const closeExplorer=useCallback(()=>setExplorerOpen(false),[]);
  const [sidebarWidth,setSidebarWidth]=useState(()=>{
    try{
      const stored=Number(localStorage.getItem('geometry-studio-sidebar-width'));
      return Number.isFinite(stored)&&stored>=280&&stored<=480?stored:360;
    }catch{return 360;}
  });
  useEffect(()=>{
    try{localStorage.setItem('geometry-studio-sidebar-width',String(sidebarWidth));}catch{}
  },[sidebarWidth]);
  useEffect(()=>{
    const update=()=>setShowBackToTop(window.scrollY>320);
    update();
    window.addEventListener('scroll',update,{passive:true});
    return()=>window.removeEventListener('scroll',update);
  },[]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();setCommandOpen(prev=>!prev);
      }else if(event.key==='/'&&!commandOpen&&!event.ctrlKey&&!event.metaKey&&
        !event.altKey&&!event.isComposing&&!event.repeat&&
        !(event.target instanceof HTMLElement&&
          (event.target.isContentEditable||event.target.closest('input,textarea,select,[contenteditable="true"]')))){
        event.preventDefault();setCommandOpen(true);
      }else if(event.key==='Escape'&&studioFocus&&!commandOpen){
        setStudioFocus(false);
      }else if(event.key==='Escape'&&!finePreview&&!commandOpen&&!settingsOverview&&
        !(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select'))){
        setSettingsOverview(true);
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[studioFocus,commandOpen,settingsOverview]);
  const [threeSettings,setThreeSettings]=useState<ThreeSettings>(()=>{
    if(saved)return saved.threeD.settings;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {...threeDefaults,animation:!reducedMotion,
      // Keep the new reveal opt-in on devices explicitly requesting fewer animations.
      entrance:{...threeDefaults.entrance!,enabled:!reducedMotion}};
  });
  const threeApi=useRef<ThreePreviewHandle|null>(null);
  const threeView=useRef<ThreeView|undefined>(saved?.threeD.view);
  const [threeReady,setThreeReady]=useState(false);
  const [voidVisibleCount,setVoidVisibleCount]=useState(0);
  const beforeVoid=useRef<{view:ThreeView|undefined;time:number;seed:string;complete:string|null}|null>(null);
  const [threeRestore,setThreeRestore]=useState({
    serial:0,time:saved?.threeD.elapsedSeconds??0,
    floorTime:saved?.threeD.floorElapsedSeconds??saved?.threeD.elapsedSeconds??0,
  });
  const [standbyTransition,setStandbyTransition]=useState<ThreeStandbyTransition|null>(null);
  const [standbyFinishedSeed,setStandbyFinishedSeed]=useState<string|null>(saved?.threeD.standbyComplete?saved.threeD.seed:null);
  const [threeExportBusy,setThreeExportBusy]=useState(false);
  const standbyInteractionUntil=useRef(0);
  const standbySerial=useRef(0);
  const resume2D=useRef({growth:false,ambient:false});
  const [visualTheme,setVisualTheme]=useState<VisualTheme>(lastProject?.visualTheme??'standard');
  const [textOverlay,setTextOverlay]=useState<TextOverlaySettings>(()=>lastProject?.textOverlay??{...textOverlayDefaults});
  const entrancePreview=useTextEntrancePreview(textOverlay);
  const [enabledShapeKinds,setEnabledShapeKinds]=useState<ShapeKind[]>(()=>lastProject?.enabledShapeKinds??[...ALL_SHAPE_KINDS]);
  const lastGlow=useRef(100);
  const [ratio, setRatio] = useState<Ratio>(lastProject?.aspectRatio??'16:9');
  const [ambient,setAmbient]=useState(()=>lastProject?.ambient??{...ambientDefaults});
  const [version,setVersion]=useState<AlgorithmVersion>((lastProject?.algorithmVersion as AlgorithmVersion|undefined)??ALGORITHM_VERSION);
  const [magicSettings,setMagicSettings]=useState<MagicCircleSettings>(()=>lastProject?.magicCircle??{...magicDefaults});
  const ambientClock=useAmbientClock(renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&ambient.enabled,ambient.lowPower,ambient,ratio);
  const artworkRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(()=>sharedSeed??lastProject?.seed??createRandomSeed());
  const [seedVault,setSeedVault]=useState<SeedVault>(()=>loadSeedVault(seed));
  useEffect(()=>{if(!resetting.current)saveSeedVault(seedVault);},[seedVault]);
  const [seedClipboardMessage,setSeedClipboardMessage]=useState('');
  const [initialColors]=useState(()=>{
    const existing=lastProject?.colorSettings??saved?.threeD.colorSettings??
      reseedColors({...legacyColors(initialBackground),mode:'seed'},seed);
    return sharedSeed!==null?reseedColors(existing,seed):existing;
  });
  const [uiTheme,setUiTheme]=useState(()=>{try{return localStorage.getItem('geometry-ui-theme')==='light'?'light':'dark';}catch{return 'dark';}});
  useEffect(()=>{document.documentElement.dataset.theme=uiTheme;try{localStorage.setItem('geometry-ui-theme',uiTheme);}catch{}},[uiTheme]);
  const committedSeed=useRef(seed);
  const [background, setBackground] = useState<Background>(()=>{
    if(saved){
      const p=saved.twoD;
      const restored:Background=saved.mode==='3d'?
        {...saved.threeD.background,grid:p.gridBackground}:
        {mode:p.backgroundMode,solid:p.solidColor,colors:p.gradientColors,
          angle:p.gradientAngle,grid:p.gridBackground,lineWidth:p.lineWidth??125,
          glowIntensity:p.glowIntensity??100};
      return coloredBackground(restored,initialColors);
    }
    return {...coloredBackground(initialBackground,initialColors),lineWidth:125};
  });
  const gridSeconds=useGridClock(renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&!ambient.enabled&&!!background.grid?.enabled&&!!background.grid?.animation?.enabled);
  const [colorSettings,setColorSettings] = useState<ColorSettings | undefined>(initialColors);
  const activeColors = colorSettings ?? legacyColors(background);
  // Old manual 2D settings may omit figureColors intentionally. In 3D the
  // visible color slots are always the material colors, including locked slots.
  const threeBackground=useMemo(()=>({...background,figureColors:{primary:activeColors.slots.primary.color,support:activeColors.slots.support.color,accent:activeColors.slots.accent.color}}),[background,activeColors]);
  const magicColors=useMemo(()=>magicSettings.colorMode==='auto'
    ?magicPaletteFromSeed(seed,magicSettings.paletteReroll)
    :magicSettings.colorMode==='preset'?magicPaletteById(magicSettings.colorPreset)
      :magicSettings.customColors,[seed,magicSettings]);
  const twoDBackground=useMemo(()=>version===MAGIC_ALGORITHM_VERSION
    ?backgroundForMagic(background,magicColors):background,[version,background,magicColors]);
  function applyColors(c:ColorSettings) { setColorSettings(c);setBackground(bg=>coloredBackground(bg,c)); }
  function changeSeed(value:string) {setSeedClipboardMessage('');setStandbyTransition(null);setSeed(value);if(colorSettings)applyColors(reseedColors(colorSettings,value));}
  function editor(id:Slot,label:string) { const slot=activeColors.slots[id];return <ColorEditor label={label} value={slot.color} locked={slot.locked}
   onColor={color=>applyColors({...activeColors,edited:[...new Set([...(activeColors.edited??[]),id])],slots:{...activeColors.slots,[id]:{...slot,color}}})}
   onRoll={()=>applyColors(rerollColor(activeColors,seed,id))}
   onLock={()=>applyColors({...activeColors,slots:{...activeColors.slots,[id]:{...slot,locked:!slot.locked}}})}/>; }
  const [regenerations, setRegenerations] = useState(0);
  const [density,setDensity] = useState(lastProject?.density??50);
  const baseScene = useMemo(() => generateScene(seed, ratio, version,enabledShapeKinds,magicSettings), [seed, ratio, version,enabledShapeKinds,magicSettings]);
  const candidates = useMemo(()=>densityCandidates(baseScene,seed),[baseScene,seed]);
  const scene = useMemo(()=>{
    const visible=visibleScene(baseScene,candidates,density);
    return version===MAGIC_ALGORITHM_VERSION?visible:themeScene(visible,visualTheme,seed);
  },[baseScene,candidates,density,visualTheme,seed,version]);

  // Reuse the exact 2D SVG renderer as a transparent in-world 3D texture.
  // The SVG is ephemeral; projects store the source generator settings instead.
  const [smallHybridDevice,setSmallHybridDevice]=useState(()=>
    matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  useEffect(()=>{
    const media=matchMedia('(max-width: 720px), (pointer: coarse)');
    const update=()=>setSmallHybridDevice(media.matches);
    media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  const hybridOptions=threeSettings.hybrid2D??hybrid2DDefaults;
  const hybridCount=hybridOptions.enabled
    ?Math.min(hybridOptions.count,threeSettings.quality==='low'||
      (threeSettings.quality==='auto'&&smallHybridDevice)?12:32):0;
  // Keep native SVGs isolated and never regenerate them while moving the
  // entire constellation, orbiting the camera or editing 3D transparency.
  const hybridArtworks=useMemo(()=>{
    if(renderMode!=='3d'||hybridCount===0)return undefined;
    return Array.from({length:hybridCount},(_,index)=>{
      const artworkSeed=hybrid2DSeed(seed,hybridOptions.variation,index);
      let artworkScene=scene;
      if(index>0){
        const generated=generateScene(artworkSeed,ratio,version,enabledShapeKinds,magicSettings);
        const visible=visibleScene(generated,densityCandidates(generated,artworkSeed),density);
        artworkScene=version===MAGIC_ALGORITHM_VERSION?visible:themeScene(visible,visualTheme,artworkSeed);
      }
      return {seed:artworkSeed,svg:renderToStaticMarkup(
        <Preview scene={artworkScene} background={twoDBackground} transparent/>),
        width:artworkScene.width,height:artworkScene.height};
    });
  },[renderMode,hybridCount,seed,hybridOptions.variation,
    ratio,version,enabledShapeKinds,magicSettings,density,visualTheme,scene,twoDBackground]);

  const [animation,setAnimation]=useState<AnimationSettings>(()=>({
    animationEnabled:lastProject?.animationEnabled??true,
    animationDuration:lastProject?.animationDuration??defaults.animationDuration,
    playbackSpeed:lastProject?.playbackSpeed??defaults.playbackSpeed,
    easingType:lastProject?.easingType??defaults.easingType,
    continuousMotion:lastProject?.continuousMotion??MOTION_DEFAULTS.continuousMotion,
    motionStrength:lastProject?.motionStrength??MOTION_DEFAULTS.motionStrength,
    motionSpeed:lastProject?.motionSpeed??MOTION_DEFAULTS.motionSpeed,
    motionVideoSeconds:lastProject?.motionVideoSeconds??MOTION_DEFAULTS.motionVideoSeconds,
    motionPreset:lastProject?.motionPreset??'standard',
  }));
  // Magic Circle already owns a separate continuous rotation clock.
  // Never run a redundant 2D figure-motion clock in that mode.
  const playback=usePlayback(version===MAGIC_ALGORITHM_VERSION
    ?{...animation,continuousMotion:false}:animation);
  useEffect(()=>{
    const store=()=>{
      if(resetting.current)return;
      // Save both editor modes using the same, existing import/export schemas.
      // Resolution controls are separate outputs, not part of this live draft.
      const twoD:ProjectSettings={
        schemaVersion:1,algorithmVersion:version,seed,aspectRatio:ratio,
        density,visualTheme,enabledShapeKinds,
        backgroundMode:background.mode,solidColor:background.solid,
        gradientColors:background.colors,gradientAngle:background.angle,
        glowIntensity:background.glowIntensity??100,lineWidth:background.lineWidth??125,
        ...(background.grid?{gridBackground:background.grid}:{}),
        colorSettings:activeColors,textOverlay,magicCircle:magicSettings,
        ambient,...animation,exportWidth:1920,exportHeight:1080,
      };
      const elapsed=Math.max(0,Math.min(1e9,threeApi.current?.getElapsedSeconds?.()??
        threeRestore.time));
      const threeD:ThreeProject={
        kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,
        seed,aspectRatio:ratio,density,visualTheme,background,
        colorSettings:activeColors,settings:threeSettings,
        hybridSource:{algorithmVersion:version,enabledShapeKinds,magicCircle:magicSettings},
        ...(threeView.current?{view:threeView.current}:{}),
        elapsedSeconds:elapsed,
        floorElapsedSeconds:Math.max(0,Math.min(1e9,
          threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime)),
        exportWidth:1920,exportHeight:1080,
        ...(standbyFinishedSeed===seed?{standbyComplete:true}:{}),
      };
      const draft:StudioAutosave={
        schemaVersion:1,mode:renderMode,category,threeCategory,
        focus:studioFocus,collapsed:sidebarCollapsed,twoD,threeD,
      };
      const success=saveStudioAutosave(draft);
      setAutosaveStatus(success?'saved':'unavailable');
    };
    // Debounce sliders/text changes, but flush immediately when the tab hides
    // or Safari refreshes. Poll the 3D camera/clock refs while navigating.
    const delayed=window.setTimeout(store,450);
    const cameraTimer=renderMode==='3d'?window.setInterval(store,2500):null;
    const flush=()=>store();
    const hide=()=>{if(document.hidden)store();};
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',hide);
    return()=>{
      window.clearTimeout(delayed);
      if(cameraTimer!==null)window.clearInterval(cameraTimer);
      window.removeEventListener('pagehide',flush);
      document.removeEventListener('visibilitychange',hide);
    };
  },[renderMode,category,threeCategory,studioFocus,sidebarCollapsed,
    version,seed,ratio,density,visualTheme,enabledShapeKinds,background,
    activeColors,textOverlay,magicSettings,ambient,animation,threeSettings,
    threeRestore.time,threeRestore.floorTime,standbyFinishedSeed]);
  useEffect(()=>{playback.restart(true);},[]);
  // The continuous 2D clock must not consume CPU while a restored project is
  // already in 3D mode or while the independent ambient renderer is active.
  // Run after the initial restart effect so it also covers startup.
  useEffect(()=>{if(renderMode==='3d'||(ambient.enabled&&version!==MAGIC_ALGORITHM_VERSION))
    playback.setPlaying(false);},[renderMode,ambient.enabled,version]);
  const cues=useMemo(()=>schedule(candidates,seed,version),[candidates,seed,version]);
  const figureMotionPlan=useMemo(()=>createFigureMotionPlan(scene,seed),[scene,seed]);
  function replayOnRegenerate(){if(renderMode==='2d'&&animation.animationEnabled)playback.restart(true);}
  function confirmReset(message:string):boolean{
    return !threeExportBusy&&!standbyTransition&&window.confirm(message);
  }
  function resetAllSettings(){
    if(!confirmReset('2D・3D・シード・配色・画面設定と、この端末の自動保存をすべて初期化します。元に戻せません。実行しますか？'))return;
    // pagehide/visibilitychange handlers normally autosave; prevent the old
    // draft from being written back AFTER we have removed its keys.
    resetting.current=true;
    try{
      clearStudioPreferences(window.localStorage);
      window.location.reload();
    }catch{
      resetting.current=false;
      window.alert('端末の保存データを消去できませんでした。ブラウザの保存設定を確認してください。');
    }
  }
  function resetTwoDSettings(){
    if(!confirmReset('2D設定を初期化しますか？ シードは保持します。配色・背景・縦横比・密度は3Dとも共通なので、そちらも変わります。'))return;
    const colors=reseedColors({...legacyColors(initialBackground),mode:'seed'},seed);
    setVersion(ALGORITHM_VERSION);
    setEnabledShapeKinds([...ALL_SHAPE_KINDS]);
    setMagicSettings({...magicDefaults});
    setAmbient({...ambientDefaults});
    setAnimation({...defaults,...MOTION_DEFAULTS,animationEnabled:true});
    setTextOverlay({...textOverlayDefaults});
    setVisualTheme('standard');
    setColorSettings(colors);
    setBackground({...coloredBackground({...initialBackground,lineWidth:125},colors),lineWidth:125});
    setRatio('16:9');setDensity(50);lastGlow.current=100;
    setCategory('shapes');
    playback.restart(true);
  }
  function resetThreeDSettings(){
    if(!confirmReset('3D設定（GALAXY・PARTICLE・VOID・床・空・光・カメラ・アニメーションなど）をすべて初期化しますか？ シードと2D設定は保持します。'))return;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    setThreeSettings({...threeDefaults,animation:!reduce,
      entrance:{...threeDefaults.entrance!,enabled:!reduce},
      galaxy:{...galaxyDefaults},particle:{...particleDefaults}});
    beforeVoid.current=null;threeView.current=undefined;
    setThreeReady(false);setVoidVisibleCount(0);
    setStandbyTransition(null);setStandbyFinishedSeed(null);
    setThreeRestore(current=>({serial:current.serial+1,time:0,floorTime:0}));
    setRegenerations(n=>n+1);
  }
  function resetGalaxySettings(){
    if(!confirmReset('GALAXYの設定を初期化しますか？ 現在のシードと他のモード設定は保持します。'))return;
    setThreeSettings(current=>({...current,galaxy:{...galaxyDefaults,enabled:current.galaxy?.enabled??false}}));
    setStandbyTransition(null);setStandbyFinishedSeed(null);
    if(threeSettings.galaxy?.enabled)setRegenerations(n=>n+1);
  }
  function resetParticleSettings(){
    if(!confirmReset('PARTICLEの設定を初期化しますか？ 現在のシードと他のモード設定は保持します。'))return;
    setThreeSettings(current=>({...current,particle:{...particleDefaults,enabled:current.particle?.enabled??false}}));
    setStandbyTransition(null);setStandbyFinishedSeed(null);
    if(threeSettings.particle?.enabled)setRegenerations(n=>n+1);
  }
  function resetVoidSettings(){
    if(!confirmReset('VOIDの設定を初期化しますか？ 大規模コズミックウェブの初期設定に戻ります。現在のシードは保持します。'))return;
    const wasEnabled=!!threeSettings.voidMode?.enabled;
    setThreeSettings(current=>({...current,voidMode:{
      ...voidWebDefaults,enabled:current.voidMode?.enabled??false,
      network:{...voidWebDefaults.network},neon:{...voidWebDefaults.neon},
    }}));
    setStandbyTransition(null);setStandbyFinishedSeed(null);
    if(wasEnabled){
      beforeVoid.current=null;threeView.current=undefined;
      setThreeReady(false);
      setThreeRestore(current=>({serial:current.serial+1,time:0,floorTime:0}));
      setRegenerations(n=>n+1);
    }
  }
  function switchRenderMode(next:'2d'|'3d'){
    if(threeExportBusy||next===renderMode)return;
    if(next==='2d'){setStandbyTransition(null);setStandbyFinishedSeed(null);}
    if(next==='3d'){
      resume2D.current={growth:playback.playing,ambient:ambientClock.playing};
      playback.setPlaying(false);ambientClock.pause();setThreeReady(false);
    }else{
      if(resume2D.current.growth)playback.setPlaying(true);
      if(resume2D.current.ambient)ambientClock.play();
    }
    setRenderMode(next);
  }
  // Transform spacing only after deterministic geometry has been generated.
  // The scene seed, candidate selection, IDs and density remain unchanged.
  const voidEnabled=!!threeSettings.voidMode?.enabled;
  const voidVersion=threeSettings.voidMode?.version;
  const threeBaseComposition=useMemo(()=>renderMode==='3d'?
    voidEnabled?(voidVersion===VOID_WEB_VERSION?generateVoidWeb(seed,ratio):generateVoidComposition(seed,ratio)):generateThreeComposition(seed,ratio):null,[renderMode,seed,ratio,voidEnabled,voidVersion]);
  const threeComposition=useMemo(()=>threeBaseComposition?
    isVoidComposition(threeBaseComposition)?spaceVoidComposition(threeBaseComposition,threeSettings.spacingPercent??100):spaceThreeComposition(threeBaseComposition,threeSettings.spacingPercent??100):null,
    [threeBaseComposition,threeSettings.spacingPercent]);
  const standby=threeSettings.standby??standbyDefaults;
  function beginStandbyTransition(){
    if(renderMode!=='3d'||!threeComposition||!threeBaseComposition||standbyTransition||threeExportBusy||!threeReady)return;
    let next=createRandomSeed();
    if(next===seed)next=createRandomSeed();
    if(!threeSettings.animation)setThreeSettings(current=>({...current,animation:true}));
    setStandbyTransition({id:++standbySerial.current,mode:standby.mode,duration:standby.transitionSeconds,
      fromSeed:seed,fromComposition:threeComposition,fromSourceComposition:threeBaseComposition,
      fromBackground:threeBackground,fromTheme:visualTheme,fromTime:threeApi.current?.getElapsedSeconds?.()??0,
      cameraPosition:threeView.current?.position?[...threeView.current.position]:undefined});
    committedSeed.current=next;
    setSeed(next);
    setSeedVault(current=>recordSeed(current,next));
    if(colorSettings)applyColors(reseedColors(colorSettings,next));
  }
  useEffect(()=>{
    if(renderMode!=='3d'||!standby.enabled)return;
    const mark=()=>{standbyInteractionUntil.current=performance.now()+5000;};
    for(const event of ['pointerdown','keydown','wheel','focusin'] as const)
      document.addEventListener(event,mark,{passive:true});
    const dragging=(event:PointerEvent)=>{if(event.buttons!==0||document.pointerLockElement)mark();};
    document.addEventListener('pointermove',dragging,{passive:true});
    return()=>{
      for(const event of ['pointerdown','keydown','wheel','focusin'] as const)
        document.removeEventListener(event,mark);
      document.removeEventListener('pointermove',dragging);
    };
  },[renderMode,standby.enabled]);
  useEffect(()=>{
    if(renderMode!=='3d'||!standby.enabled||!threeReady||!threeSettings.animation||standbyTransition)return;
    let elapsed=0,last=performance.now();
    const timer=window.setInterval(()=>{
      const now=performance.now(),delta=Math.max(0,Math.min(.5,(now-last)/1000));last=now;
      const focus=document.activeElement;
      const typing=focus instanceof HTMLTextAreaElement||
        (focus instanceof HTMLInputElement&&['text','number','search'].includes(focus.type))||
        (focus instanceof HTMLElement&&focus.isContentEditable);
      if(document.hidden||threeExportBusy||
        (standby.pauseOnInteraction&&(now<standbyInteractionUntil.current||typing)))return;
      elapsed+=delta;
      if(elapsed>=standby.intervalSeconds){elapsed=0;beginStandbyTransition();}
    },200);
    return()=>window.clearInterval(timer);
  },[renderMode,standby.enabled,standby.intervalSeconds,standby.transitionSeconds,standby.pauseOnInteraction,
    standby.mode,threeReady,threeSettings.animation,standbyTransition,threeExportBusy,seed,
    threeComposition,threeBaseComposition,threeBackground,visualTheme,colorSettings]);
  function commitSeed(){
    if(committedSeed.current!==seed){
      committedSeed.current=seed;
      setSeedVault(current=>recordSeed(current,seed));
      replayOnRegenerate();
    }
  }
  function randomizeSeed(){
    if(threeExportBusy)return;
    const value=createRandomSeed();committedSeed.current=value;
    changeSeed(value);setSeedVault(current=>recordSeed(current,value));
    replayOnRegenerate();
  }
  function selectVaultSeed(value:string){
    if(threeExportBusy||standbyTransition)return;
    committedSeed.current=value;changeSeed(value);replayOnRegenerate();
  }
  function useVaultHistory(index:number){
    if(threeExportBusy||standbyTransition||index<0||index>=seedVault.history.length)return;
    setSeedVault(current=>({...current,cursor:index}));
    selectVaultSeed(seedVault.history[index]);
  }
  function navigateVault(direction:-1|1){
    const next=moveSeedHistory(seedVault,direction);
    if(next&&!threeExportBusy&&!standbyTransition){
      setSeedVault(next.vault);selectVaultSeed(next.seed);
    }
  }
  function selectExplorerSeed(value:string){
    if(threeExportBusy||standbyTransition)return;
    recallBookmarkedSeed(value);
    setExplorerOpen(false);
  }
  function saveExplorerFavorite(value:string,label:string):string{
    if(seedVault.bookmarks.some(item=>item.seed===value))return 'このシードは保存済みです。';
    if(seedVault.bookmarks.length>=SEED_VAULT_LIMIT)return 'シード保管庫が満杯です（24件まで）。';
    setSeedVault(current=>saveBookmark(current,value,label));
    return 'シード保管庫に保存しました。';
  }
  function recallBookmarkedSeed(value:string){
    if(threeExportBusy||standbyTransition)return;
    setSeedVault(current=>recordSeed(current,value));
    selectVaultSeed(value);
  }
  async function copySeed(){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(seed);
      setSeedClipboardMessage('シードをコピーしました');
    }catch{setSeedClipboardMessage('コピーできませんでした。ブラウザの権限を確認してください。');}
  }
  async function pasteSeed(){
    if(threeExportBusy)return;
    try{
      if(!navigator.clipboard?.readText)throw new Error('clipboard unavailable');
      const value=(await navigator.clipboard.readText()).trim();
      if(!value||value.length>256){
        setSeedClipboardMessage('1〜256文字のシードをコピーしてから貼り付けてください。');return;
      }
      committedSeed.current=value;changeSeed(value);
      setSeedVault(current=>recordSeed(current,value));
      replayOnRegenerate();
      setSeedClipboardMessage('シードを貼り付けて生成しました');
    }catch{setSeedClipboardMessage('貼り付けできませんでした。ブラウザの権限を確認してください。');}
  }
  function goToSettings(next:Category){
    if(threeExportBusy&&next!=='export')return;
    if(next==='text'&&(renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION))return;
    (renderMode==='2d'?setCategory:setThreeCategory)(next);
    setSettingsOverview(false);
    setStudioFocus(false);setSidebarCollapsed(false);
    // Only reposition the page on phones; desktop keeps the live preview in place.
    if(matchMedia('(max-width:720px)').matches){
      requestAnimationFrame(()=>document.querySelector('.studio-controls')?.scrollIntoView({
        block:'start',behavior:'smooth'
      }));
    }
  }
  function goToSettingsIndex(){
    setSettingsOverview(!finePreview);
    setStudioFocus(false);setSidebarCollapsed(false);
    if(matchMedia('(max-width:720px)').matches){
      requestAnimationFrame(()=>document.getElementById('studio-settings')?.scrollIntoView({
        block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'
      }));
    }
  }
  function scrollToTop(){
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function chooseVisualTheme(theme:VisualTheme){
   setVisualTheme(theme);
   if(theme==='standard'){
    const colors=reseedColors({...activeColors,mode:'seed',appearance:'seed'},seed);
    applyColors(colors);
    setBackground(bg=>({...coloredBackground(bg,colors),mode:'gradient',angle:135,lineWidth:125,glowIntensity:100}));
   }else{
    const preset=applyThemePalette(activeColors,background,theme);
    setColorSettings(preset.colors);setBackground(preset.background);
    if(preset.background.glowIntensity)lastGlow.current=preset.background.glowIntensity;
   }
   replayOnRegenerate();
  }
  const growth=animation.animationEnabled?Object.fromEntries(scene.shapes.map(s=>[s.id,progressAt(cues[s.id],playback.position,animation.easingType)])):undefined;
  // Growth stops at 100%; the independent pauseable clock drives bright
  // streaks along the existing v4/v5 contours, never changing their layout.
  const motionParams=motionPresetParameters(animation);
  const completedFlow=useMemo(()=>animation.animationEnabled&&animation.continuousMotion&&
    version!==MAGIC_ALGORITHM_VERSION&&playback.motionSeconds>0
      ?figureFlowAt(figureMotionPlan,playback.motionSeconds,
        motionParams.strength,motionParams.speed):undefined,
    [figureMotionPlan,animation.animationEnabled,animation.continuousMotion,
      animation.motionStrength,animation.motionSpeed,animation.motionPreset,
      version,playback.motionSeconds]);
  function completedArtwork(transparentOnly=false){return new DOMParser().parseFromString(renderToStaticMarkup(<Preview scene={scene} background={twoDBackground} transparent={version===MAGIC_ALGORITHM_VERSION&&transparentOnly} textOverlay={version===MAGIC_ALGORITHM_VERSION?undefined:textOverlay} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>),'image/svg+xml').documentElement as unknown as SVGSVGElement;}
  const studioCommands:StudioCommand[]=[
    ...categories.filter(item=>item.id!=='text'||
      (renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION))
      .map(item=>({id:'open-'+item.id,title:item.label+'の設定を開く',
        description:'設定パネル / '+item.label,keywords:item.id,run:()=>goToSettings(item.id)})),
    {id:'seed',title:'新しいシードを生成',description:'ランダムな構図をすぐ生成',keywords:'random 乱数',run:randomizeSeed},
    {id:'seed-copy',title:'シードをコピー',description:'構図の再現用に合言葉をコピー',keywords:'clipboard コピー',run:()=>{void copySeed();}},
    {id:'seed-paste',title:'シードを貼り付け',description:'コピーしたシードで構図を再生成',keywords:'clipboard ペースト',run:()=>{void pasteSeed();}},
    ...(renderMode==='2d'?[{id:'seed-explorer',title:'構図探索ボードを開く',
      description:'4〜8案のサムネイルを比較・保存',keywords:'compare gallery candidate 比較 候補',
      run:()=>setExplorerOpen(true)}]:[]),
    {id:'focus',title:studioFocus?'集中表示を終了':'プレビューに集中',
      description:'作業パネルを隠してキャンバスを広げる',keywords:'full screen canvas',run:()=>setStudioFocus(v=>!v)},
    {id:'panel',title:'設定パネルの表示を切り替える',
      description:'サイドバーを開く・閉じる',keywords:'sidebar',run:()=>{setStudioFocus(false);setSidebarCollapsed(v=>!v);}},
    {id:'theme',title:'ライト・ダーク表示を切り替える',
      description:'編集画面の配色だけを変更',keywords:'theme',run:()=>setUiTheme(v=>v==='dark'?'light':'dark')},
    {id:'2d',title:'2Dモードに切り替える',description:'SVG編集に戻る',run:()=>switchRenderMode('2d')},
    {id:'3d',title:'3Dモードに切り替える',description:'WebGLキャンバスを表示',run:()=>switchRenderMode('3d')},
  ];
  const workspaceStyle={'--studio-sidebar-width':sidebarWidth+'px'} as CSSProperties;
  return <div className={'app studio-app'+(threeExportBusy?' three-video-exporting':'')+
    (studioFocus?' studio-focus':'')+
    (sidebarCollapsed?' studio-sidebar-collapsed':'')}>
    <header className="topbar studio-topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><div><h1>幾何学メーカー</h1><span className="brand-sub">GEOMETRY / BACKGROUND STUDIO</span></div></div>
      <div className="render-mode-switch segmented" role="group" aria-label="描画モード">
        <button type="button" aria-pressed={renderMode==='2d'} disabled={threeExportBusy} onClick={()=>switchRenderMode('2d')}>2Dモード</button>
        <button type="button" aria-pressed={renderMode==='3d'} disabled={threeExportBusy} onClick={()=>switchRenderMode('3d')}>3Dモード</button>
      </div>
      <div className="studio-topbar-tools">
        <button type="button" className="studio-command-launch" aria-label="コマンド検索"
          title="Ctrl / ⌘ + K" onClick={()=>setCommandOpen(true)}>
          <span aria-hidden="true">⌕</span><span>検索</span><kbd>⌘ K</kbd>
        </button>
        <button type="button" className="studio-panel-toggle" aria-label="設定パネルの表示切り替え"
          aria-pressed={!sidebarCollapsed&&!studioFocus}
          onClick={()=>{if(studioFocus){setStudioFocus(false);setSidebarCollapsed(false);}
            else setSidebarCollapsed(v=>!v);}}>
          <span aria-hidden="true">▥</span><span>パネル</span>
        </button>
        <button className="ui-theme-button studio-theme-toggle" type="button"
          onClick={()=>setUiTheme(t=>t==='dark'?'light':'dark')} aria-label="UIテーマ切り替え"
          title="UIテーマ切り替え">{uiTheme==='dark'?'☀':'☾'}<span>{uiTheme==='dark'?'ライト':'ダーク'}</span></button>
      </div>
      <div className="mode-badge"><span /> {renderMode==='2d'?'2D':'3D'} STUDIO <span className="version">v2</span></div>
    </header>

    <main className="workspace studio-workspace" style={workspaceStyle}>
      <aside className="controls studio-controls" aria-label="生成設定" id="studio-settings">
        <div className="studio-controls-header">
          <span><i aria-hidden="true"/> INSPECTOR</span>
          <button type="button" aria-label="設定パネルを折りたたむ" title="パネルを折りたたむ"
            onClick={()=>setSidebarCollapsed(true)}>✕</button>
        </div>
        <div className="panel-intro"><span className="eyebrow">MAKE IT YOURS</span><h2>ひとつのシードから、<br />あなただけの幾何学を。</h2><p>文字や数字を変えて、新しい構図に出会う。</p></div>

        {finePreview&&<SettingsCategories variant="tabs" active={activeCategory}
          onChange={value=>{if(value)goToSettings(value);}}
          disabled={threeExportBusy?categories.map(item=>item.id):
            renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION?['text']:[]}/>}
        <div className={'settings-screen'+(settingsOverview?'':' is-detail')} aria-label="設定画面">
          <section className="settings-screen-index" aria-label="設定一覧"
            inert={!settingsOverview} aria-hidden={!settingsOverview}>
            <div className="settings-index-intro">
              <span className="eyebrow">SETTINGS HUB</span>
              <h2>設定一覧</h2>
              <p>右のチェックをオンにして、専用の設定画面を開きます。</p>
            </div>
            {!finePreview&&<SettingsCategories active={settingsOverview?null:activeCategory}
              onChange={value=>{if(threeExportBusy)return;
                if(value===null){goToSettingsIndex();return;}
                goToSettings(value);}}
              disabled={threeExportBusy?categories.map(item=>item.id):
                renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION?['text']:[]}/>}
            <div className="studio-sidebar-resize">
              <label htmlFor="studio-sidebar-width">パネル幅</label>
              <input id="studio-sidebar-width" type="range" min={280} max={480} step={20}
                value={sidebarWidth} onChange={event=>setSidebarWidth(Number(event.target.value))}/>
              <output htmlFor="studio-sidebar-width">{sidebarWidth}px</output>
            </div>
          </section>
          <section className="settings-screen-detail" aria-label="個別設定"
            inert={settingsOverview} aria-hidden={settingsOverview}>
            <div className="settings-detail-toolbar" hidden={finePreview}>
              <button type="button" className="settings-detail-back" onClick={goToSettingsIndex}>
                <span aria-hidden="true">←</span> 設定一覧へ
              </button>
              <span className="settings-detail-current">{categories.find(item=>item.id===activeCategory)?.label??'設定'}</span>
            </div>
            <div id="panel-shapes" className="category-panel" data-category="shapes" role="region" aria-labelledby="category-shapes" hidden={activeCategory!=='shapes'}>
          <h2 className="category-title">図形</h2>
        <FineSections id="shapes" enabled={finePreview&&renderMode==='2d'} items={[{id:'seed',label:'シードと生成方式',detail:'シード値・アルゴリズム',content:<><section className="control-section" aria-labelledby="seed-heading">
          <div className="section-heading"><h3 id="seed-heading"><span>01</span> シード</h3><span className="tiny-label">SEED</span></div>
          <div className="studio-setting-label">
            <label htmlFor="seed">模様の合言葉</label>
            <HelpInfo label="シードの説明">「シード」は模様を再現する合言葉。同じ文字なら同じ模様になります。Enterか入力欄の外を押すと確定します。</HelpInfo>
          </div>
          <div className="seed-row"><input id="seed" aria-label="シード値" value={seed} onChange={e => changeSeed(e.target.value)} onBlur={commitSeed} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229)commitSeed();}} spellCheck={false} autoComplete="off" /><button className="dice-button" type="button" onClick={randomizeSeed} aria-label="ランダムシードを生成" title="ランダムシードを生成">⚄ <span>ランダム</span></button><button type="button" className="seed-clipboard-button" onClick={()=>void copySeed()} aria-label="シードをコピー">コピー</button><button type="button" className="seed-clipboard-button" disabled={threeExportBusy} onClick={()=>void pasteSeed()} aria-label="シードを貼り付け">貼付</button></div>
          {seedClipboardMessage&&<p className="seed-clipboard-status" role="status" aria-live="polite">{seedClipboardMessage}</p>} 
          <div hidden={renderMode==='3d'}><div className="studio-setting-label">
            <label className="algorithm-label" htmlFor="algorithm-version">作り方の種類</label>
            {version===LEGACY_ALGORITHM_VERSION&&<HelpInfo>旧v4設定の構図を保持しています。v5を選ぶと新しい構図に変わります。図形の種類別設定はv5で有効です。</HelpInfo>}
          </div>
          <select id="algorithm-version" aria-label="生成アルゴリズム" value={version} onChange={e=>{const next=e.target.value as AlgorithmVersion;setVersion(next);if(next===MAGIC_ALGORITHM_VERSION){playback.setPosition(1);playback.setPlaying(false);}}}>
            <option value={ALGORITHM_VERSION}>v5 — 拡張モード</option><option value={LEGACY_ALGORITHM_VERSION}>v4 — クラシックモード</option><option value={MAGIC_ALGORITHM_VERSION}>魔法陣 — Magic Circle</option>
          </select>
          </div>
        </section>
        </>},
{id:'history',label:'シード履歴',detail:'保存・呼び出し・履歴移動',content:<><SeedVaultControls seed={seed} vault={seedVault} disabled={threeExportBusy||!!standbyTransition}
          onChange={setSeedVault} onSelect={recallBookmarkedSeed}
          onNavigate={navigateVault} onHistoryIndex={useVaultHistory}/>
        </>},
{id:'explorer',label:'構図探索ボード',detail:'複数シードの比較',content:<>{renderMode==='2d'&&<section className="control-section seed-explorer-launch">
          <h3>構図探索ボード</h3>
          <p className="help">今の生成設定で複数案を同時に見比べ、好きなシードを採用できます。</p>
          <button type="button" onClick={()=>setExplorerOpen(true)} aria-label="構図探索ボードを開く">
            ◈ 4〜8案をまとめて比較
          </button>
        </section>}
        </>},
{id:'kinds',label:'図形の種類',detail:'2D図形・魔法陣の設定',content:<>{renderMode==='2d'&&version===ALGORITHM_VERSION&&<ShapeKindControls enabled={enabledShapeKinds} onChange={setEnabledShapeKinds}/>}
        {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION&&<MagicCircleControls value={magicSettings} onChange={setMagicSettings} seed={seed}/>}
        {renderMode==='3d'&&<><ThreeShapeControls settings={threeSettings} onChange={next=>{
          // Switching on the mode starts its one-shot assembly at t=0; ordinary
          // setting sliders preserve the current scene time.
          if(next.animation&&((!threeSettings.particle?.enabled&&next.particle?.enabled)||
            (!threeSettings.galaxy?.enabled&&next.galaxy?.enabled))){
            setStandbyTransition(null);setStandbyFinishedSeed(null);setRegenerations(n=>n+1);
          }
          setThreeSettings(next);
        }}/>
          <Hybrid2DControls settings={threeSettings} onChange={setThreeSettings}
            sourceLabel={version===MAGIC_ALGORITHM_VERSION?'魔法陣':version===LEGACY_ALGORITHM_VERSION?'v4（クラシック）':'v5（拡張）'}/></>}

        </>},
{id:'ratio',label:'縦横比',detail:'キャンバスの比率',content:<><section className="control-section ratio-section" aria-labelledby="ratio-heading">
          <div className="section-heading"><h3 id="ratio-heading"><span>03</span> 縦横比</h3><span className="tiny-label">ASPECT RATIO</span></div>
          <div className="studio-setting-label">
            <label htmlFor="ratio">キャンバスの比率</label>
            <HelpInfo>図形の形を保ったまま、構図を調整します。</HelpInfo>
          </div>
          <select id="ratio" value={ratio} onChange={e => setRatio(e.target.value as Ratio)}>
            {Object.keys(RATIOS).map(value => <option key={value} value={value}>{value}{value === '16:9' ? ' — ワイド' : value === '9:16' ? ' — 縦長' : value === '1:1' ? ' — スクエア' : ''}</option>)}
          </select> 
        </section>

        </>},
{id:'density',label:'図形密度',detail:'密度の微調整',content:<><section className="control-section">
          <div className="studio-setting-label studio-setting-label-range">
            <label className="range-label" htmlFor="density">図形密度 <output htmlFor="density">{density}%</output></label>
            <HelpInfo>{renderMode==='3d'?'0%は背景のみ。主役の位置を保って3Dオブジェクトを段階的に追加します。':version===MAGIC_ALGORITHM_VERSION?'0%は背景のみ。主線は保持し、装飾は密度を上げるほど増えます。':'0%は背景のみ。50%が標準。主役の位置を保って図形量を調整します。'}</HelpInfo>
          </div>
          <input id="density" type="range" min="0" max="100" step="5" value={density} onChange={e=>setDensity(Number(e.target.value))}/> 
        </section>
        </>},
{id:'reset',label:'再生成とリセット',detail:'リセット・再生成・自動保存',content:<><StudioResetControls mode={renderMode} disabled={threeExportBusy||!!standbyTransition}
          onResetAll={resetAllSettings} onReset2D={resetTwoDSettings}
          onReset3D={resetThreeDSettings} onResetGalaxy={resetGalaxySettings}
          onResetParticle={resetParticleSettings} onResetVoid={resetVoidSettings}/>
        <button type="button" className="generate-button" aria-label="同じ設定で再生成" onClick={() => {setStandbyFinishedSeed(null);setRegenerations(n => n + 1);committedSeed.current=seed;replayOnRegenerate();}}><span aria-hidden="true">↻</span> 同じ設定で再生成</button>
        <p className="local-note" data-testid="autosave-status" role="status">
          <span aria-hidden="true">◉</span>
          {autosaveStatus==='saved'?'この端末に作業を自動保存中':
            autosaveStatus==='unavailable'?'自動保存を利用できません。設定ファイルで保存してください。':
              '自動保存を準備中…'}
        </p>
        </>}]}/>
        </div>
        <div id="panel-background" className="category-panel" data-category="background" role="region" aria-labelledby="category-background" hidden={activeCategory!=='background'}>
          <h2 className="category-title">背景</h2>
        {renderMode==='2d'&&version!==MAGIC_ALGORITHM_VERSION&&
    <FineSections id="background" enabled={finePreview} items={[
      {id:'base',label:'背景の種類',detail:'単色・グラデーション・角度',content:<section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode==='gradient'&&<>
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e=>setBackground({...background,angle:Number(e.target.value)})}/>
          </>}
          <HelpInfo>背景の各色は「カラー」で編集できます。</HelpInfo>
        </section>},
      {id:'grid',label:'2Dグリッド背景',detail:'格子・アニメーション・遠近感',content:<GridBackgroundControls value={background.grid??gridBackgroundDefaults} onChange={grid=>setBackground(bg=>({...bg,grid}))}/>}
    ]}/>}
    {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION&&<HelpInfo>魔法陣の背景・自動配色は「カラー」から変更できます。背景なしでの表示や透過保存は「図形」の魔法陣設定で切り替えられます。</HelpInfo>}
    {renderMode==='3d'&&<FineSections id="background" enabled={finePreview} items={[
{id:'base',label:'背景の種類',detail:'単色・グラデーションと方向',content:<section className="control-section" aria-labelledby="background-heading">
          <div className="section-heading"><h3 id="background-heading"><span>02</span> 背景</h3><span className="tiny-label">BACKGROUND</span></div>
          <div className="segmented" role="group" aria-label="背景の種類">
            <button type="button" aria-pressed={background.mode === 'solid'} onClick={() => setBackground({ ...background, mode: 'solid' })}>単色</button>
            <button type="button" aria-pressed={background.mode === 'gradient'} onClick={() => setBackground({ ...background, mode: 'gradient' })}>グラデーション</button>
          </div>
          {background.mode==='gradient'&&<>
            <label className="range-label" htmlFor="angle">方向 <output htmlFor="angle">{background.angle}°</output></label>
            <input id="angle" type="range" min="0" max="360" value={background.angle} onChange={e=>setBackground({...background,angle:Number(e.target.value)})}/>
          </>}
          <HelpInfo>背景の各色は「カラー」で編集できます。</HelpInfo>
        </section>},
{id:'void',label:'VOID MODE',detail:'コズミックウェブ・無限空間',content:<VoidModeControls value={threeSettings.voidMode} disabled={threeExportBusy||!!standbyTransition} onChange={voidMode=>{
          if(voidMode.enabled!==voidEnabled||(voidMode.enabled&&voidMode.version!==voidVersion)){
            const floorTime=threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime;
            if(voidMode.enabled){
              if(!voidEnabled)beforeVoid.current={view:threeView.current?{position:[...threeView.current.position],target:[...threeView.current.target]}:undefined,time:threeApi.current?.getElapsedSeconds?.()??0,seed,complete:standbyFinishedSeed};
              threeView.current=undefined;
            }else threeView.current=beforeVoid.current?.seed===seed?beforeVoid.current.view:undefined;
            setThreeReady(false);setThreeRestore(current=>({...current,serial:current.serial+1,time:!voidMode.enabled&&beforeVoid.current?.seed===seed?beforeVoid.current.time:0,floorTime}));
            setStandbyTransition(null);setStandbyFinishedSeed(!voidMode.enabled&&beforeVoid.current?.seed===seed?beforeVoid.current.complete:null);
          }
          setThreeSettings(settings=>({...settings,voidMode}));
        }}/>},
{id:'sky',label:'空と景色',detail:'空・天候・地形・自然',content:<SkyControls value={threeSettings.sky} onChange={sky=>setThreeSettings(settings=>({...settings,sky}))}/>},
{id:'floor',label:'床の模様',detail:'3D床・回路・床グリッド',content:<FloorGridControls value={threeSettings.floorGrid??floorGridDefaults} onChange={floorGrid=>setThreeSettings(settings=>({...settings,floorGrid}))}/>}
]}/>}


        </div>
        <div id="panel-colors" className="category-panel" data-category="colors" role="region" aria-labelledby="category-colors" hidden={activeCategory!=='colors'}>
          <h2 className="category-title">カラー</h2>
        {renderMode==='2d'&&version===MAGIC_ALGORITHM_VERSION
? <FineSections id="colors" enabled={finePreview} items={[
    {id:'magic',label:'魔法陣の配色',detail:'背景色・魔法陣の自動配色',content:<MagicColorControls value={magicSettings} onChange={setMagicSettings} seed={seed}/>}
  ]}/>
: <FineSections id="colors" enabled={finePreview} items={[
    {id:'theme',label:'ビジュアルテーマ',detail:'配色テーマとプリセット',content:<section className="control-section" aria-labelledby="theme-heading">
          <h3 id="theme-heading">ビジュアルテーマ</h3>
          <label htmlFor="visual-theme">テーマを選ぶ</label>
          <select id="visual-theme" value={visualTheme} onChange={e=>chooseVisualTheme(e.target.value as VisualTheme)}>
            {VISUAL_THEMES.map(theme=><option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
          <HelpInfo>{VISUAL_THEMES.find(theme=>theme.id===visualTheme)?.description}。テーマを変えてもシード値は維持します。</HelpInfo>
          {visualTheme!=='standard'&&<div className="theme-swatches" aria-label="テーマのカラー">
            {[THEME_PRESETS[visualTheme].primary,THEME_PRESETS[visualTheme].support,THEME_PRESETS[visualTheme].accent,
              ...THEME_PRESETS[visualTheme].colors].map((color,i)=><span key={i} style={{backgroundColor:color}} title={color} aria-label={color}/>)}
          </div>}
          <HelpInfo>テーマに応じて図形の強弱・線・発光・背景色を変更します。下のカラー・装飾設定からさらに調整できます。</HelpInfo>
        </section>},
    {id:'image',label:'画像から配色',detail:'画像を使ったカラー調整',content:<ImagePaletteControls onApply={(palette,scope)=>applyColors(applyImagePalette(activeColors,palette,scope))}/>},
    {id:'palette',label:'背景と図形の配色',detail:'個別カラー・シード連動',content:<section className="control-section">
          <h3>背景と図形の配色</h3>
          {editor('solid','背景色')}
          {editor('gradient0','グラデーション色1')}{editor('gradient1','グラデーション色2')}{editor('gradient2','グラデーション色3')}
          <div className="play-buttons" aria-label="従来の暗色配色"><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'night'));}}>ミッドナイト（配色のみ）</button><button onClick={()=>{setVisualTheme('standard');applyColors(darkTheme(activeColors,seed,'neon'));}}>ネオンナイト（配色のみ）</button></div>
          <HelpInfo>暗色テーマは固定していない色に適用します。単色・グラデーションの両方に対応します。</HelpInfo>
          <label htmlFor="color-mode">カラー変更モード</label>
          <select id="color-mode" value={activeColors.mode} onChange={e=>applyColors(reseedColors({...activeColors,edited:activeColors.mode==='seed'?['primary','support','accent']:activeColors.edited,mode:e.target.value as 'manual'|'seed'},seed))}>
            <option value="manual">手動色を維持</option><option value="seed">シードに連動</option>
          </select>
          <label htmlFor="color-appearance">自動配色の明暗</label>
          <select id="color-appearance" value={activeColors.appearance} onChange={e=>applyColors(reseedColors({...activeColors,appearance:e.target.value as ColorSettings['appearance']},seed))}>
            <option value="seed">シードで決定</option><option value="light">明るい背景向け</option><option value="dark">暗い背景向け</option>
          </select>
          {editor('primary','主役色')}{editor('support','補助色')}{editor('accent','アクセント色')}
          <HelpInfo>シード連動が初期状態です。固定中も手動編集・個別再抽選ができます。入力色をそのまま描画します。</HelpInfo>
        </section>}
  ]}/>}

        </div>
        <div id="panel-text" className="category-panel" data-category="text" role="region" aria-labelledby="category-text" hidden={renderMode==='3d'||version===MAGIC_ALGORITHM_VERSION||activeCategory!=='text'}>
          <h2 className="category-title">文字</h2>
          <TextControls settings={textOverlay} onChange={setTextOverlay} onReplay={entrancePreview.replay} previewPlaying={entrancePreview.playing} finePreview={finePreview}/>
        </div>
        <div id="panel-decoration" className="category-panel" data-category="decoration" role="region" aria-labelledby="category-decoration" hidden={activeCategory!=='decoration'}>
          <h2 className="category-title">装飾</h2>
        {renderMode==='2d'&&<FineSections id="decoration" enabled={finePreview} items={[
   {id:'glow',label:'発光の強さ',detail:'発光のON/OFFと強度',content:<section className="control-section">
          <label className="glow-toggle"><input type="checkbox" checked={(background.glowIntensity??0)>0} onChange={e=>{if(e.target.checked)setBackground({...background,glowIntensity:lastGlow.current||100});else{lastGlow.current=background.glowIntensity||100;setBackground({...background,glowIntensity:0});}}}/> 発光を有効化</label>
          
          <label className="range-label" htmlFor="glow-intensity">発光強度 <output>{background.glowIntensity??0}%</output></label>
          <input id="glow-intensity" type="range" min="0" max="200" step="5" value={background.glowIntensity??0} onChange={e=>setBackground({...background,glowIntensity:+e.target.value})}/>
          <HelpInfo>0%は発光なし。主役を強め、補助・装飾は控えめに光らせます。</HelpInfo>
        </section>},
   {id:'line',label:'線の太さ',detail:'主役と装飾の線幅',content:<section className="control-section"><div><label className="range-label" htmlFor="line-width">線の太さ <output>{background.lineWidth ?? 125}%</output></label>
          <input id="line-width" type="range" min="50" max="300" step="5" value={background.lineWidth ?? 125} onChange={e=>setBackground({...background,lineWidth:+e.target.value})}/></div></section>}
 ]}/>}
        {renderMode==='3d'&&<FineSections id="decoration" enabled={finePreview} items={[
{id:'glow',label:'発光と線の太さ',detail:'発光のON/OFFと強度',content:<section className="control-section">
          <label className="glow-toggle"><input type="checkbox" checked={(background.glowIntensity??0)>0} onChange={e=>{if(e.target.checked)setBackground({...background,glowIntensity:lastGlow.current||100});else{lastGlow.current=background.glowIntensity||100;setBackground({...background,glowIntensity:0});}}}/> 発光を有効化</label>
          <div hidden={renderMode==='3d'}><label className="range-label" htmlFor="line-width">線の太さ <output>{background.lineWidth ?? 125}%</output></label>
          <input id="line-width" type="range" min="50" max="300" step="5" value={background.lineWidth ?? 125} onChange={e=>setBackground({...background,lineWidth:+e.target.value})}/></div>
          <label className="range-label" htmlFor="glow-intensity">発光強度 <output>{background.glowIntensity??0}%</output></label>
          <input id="glow-intensity" type="range" min="0" max="200" step="5" value={background.glowIntensity??0} onChange={e=>setBackground({...background,glowIntensity:+e.target.value})}/>
          <HelpInfo>0%は発光なし。主役を強め、補助・装飾は控えめに光らせます。</HelpInfo>
        </section>},
{id:'network',label:'光る線とつながり',detail:'接続線・ネオン輪郭',content:<ThreeStyleControls settings={voidRenderSettings(threeSettings)} fixedTopology={voidEnabled} onChange={next=>{
          if(!voidEnabled){setThreeSettings(next);return;}
          setThreeSettings(current=>({...current,voidMode:{...(current.voidMode??voidDefaults),
            network:{...next.network!,mode:'neural'},neon:next.neon!}}));
        }}/>},
{id:'material',label:'質感と光',detail:'素材・金属感・ライト',content:<ThreeMaterialControls settings={threeSettings} onChange={setThreeSettings}/>}
]}/>}
        </div>
        <div id="panel-animation" className="category-panel" data-category="animation" role="region" aria-labelledby="category-animation" hidden={activeCategory!=='animation'}>
          <h2 className="category-title">アニメーション</h2>
        {/* Keep the 2D animation clocks mounted but hidden while 3D is active. */}
        <div hidden={renderMode==='3d'}><FineSections id="animation-2d" label="アニメーション" enabled={finePreview} items={[
      ...(version!==MAGIC_ALGORITHM_VERSION?[{id:'ambient',label:'自動再生・待機画面',detail:'自動切替・スクロール',content:<AmbientControls input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} settings={ambient} onChange={setAmbient} clock={ambientClock}/>}]:[]),
      {id:'growth',label:'成長アニメーション',detail:'速度・動き・再生',content:<AnimationControls settings={animation} onChange={setAnimation} playback={playback} version={version}/>}
    ]}/></div>
        {renderMode==='3d'&&<FineSections id="animation" enabled={finePreview} items={[
{id:'motion',label:'図形の動き',detail:'回転・登場・消える演出',content:<ThreeAnimationControls settings={threeSettings} onChange={setThreeSettings} seed={seed} onReplay={()=>{setStandbyFinishedSeed(null);setThreeSettings(current=>({...current,animation:true}));setRegenerations(n=>n+1);}}/>
          },
{id:'standby',label:'自動切り替え',detail:'待機画面・シード・カメラ',content:<ThreeStandbyControls settings={threeSettings} onChange={setThreeSettings} onNext={beginStandbyTransition}
            transitioning={!!standbyTransition} exporting={threeExportBusy}/>}
]}/>}
        </div>
        <div id="panel-export" className="category-panel" data-category="export" role="region" aria-labelledby="category-export" hidden={activeCategory!=='export'}>
          <h2 className="category-title">書き出し</h2>
      <div className="export-area" hidden={renderMode==='3d'}>
        <ExportPanel finePreview={finePreview} textOverlay={textOverlay} magicSettings={version===MAGIC_ALGORITHM_VERSION?magicSettings:undefined} videoArtwork={{scene,candidates,seed,background:twoDBackground,animation,magicSettings:version===MAGIC_ALGORITHM_VERSION?magicSettings:undefined,textOverlay:version===MAGIC_ALGORITHM_VERSION?undefined:textOverlay,ambient:{scrollFigureState:ambientClock.scrollFigureState,scrollPaletteState:ambientClock.scrollPaletteState,scrollPath:ambientClock.scrollPath,seed,version,ratio,density,background:twoDBackground,colors:activeColors,animation,settings:{...ambient,enabled:version!==MAGIC_ALGORITHM_VERSION&&ambient.enabled},visualTheme,enabledShapeKinds,textOverlay}}} version={version} density={density} colorSettings={activeColors} visualTheme={visualTheme} enabledShapeKinds={enabledShapeKinds} seed={seed} ratio={ratio} background={background} animation={animation} artwork={completedArtwork}
          onRatio={setRatio} onRestore={settings => {
            ambientClock.stop();setAmbient({...ambientDefaults,...settings.ambient,enabled:false});
            setDensity(settings.density ?? 50);setVisualTheme(settings.visualTheme??'standard');setTextOverlay(settings.textOverlay??{...textOverlayDefaults});
            setEnabledShapeKinds(settings.enabledShapeKinds??[...ALL_SHAPE_KINDS]);
            setAnimation({animationEnabled:settings.animationEnabled??false,animationDuration:settings.animationDuration??8,playbackSpeed:settings.playbackSpeed??1,easingType:settings.easingType??'ease-in-out',continuousMotion:settings.continuousMotion??MOTION_DEFAULTS.continuousMotion,motionStrength:settings.motionStrength??MOTION_DEFAULTS.motionStrength,motionSpeed:settings.motionSpeed??MOTION_DEFAULTS.motionSpeed,motionVideoSeconds:settings.motionVideoSeconds??MOTION_DEFAULTS.motionVideoSeconds,motionPreset:settings.motionPreset??'standard'});playback.setPlaying(false);playback.setPosition(settings.algorithmVersion===MAGIC_ALGORITHM_VERSION?1:0);
            setMagicSettings(settings.magicCircle??{...magicDefaults});
             setVersion(settings.algorithmVersion as AlgorithmVersion);committedSeed.current=settings.seed;
            setSeed(settings.seed);setSeedVault(current=>recordSeed(current,settings.seed));setRatio(settings.aspectRatio);
            const bg:Background={grid:settings.gridBackground??gridBackgroundDefaults,lineWidth:settings.lineWidth??100,glowIntensity:settings.glowIntensity??0,mode:settings.backgroundMode,solid:settings.solidColor,colors:settings.gradientColors,angle:settings.gradientAngle};
            setColorSettings(settings.colorSettings);
            setBackground(settings.colorSettings ? coloredBackground(bg,settings.colorSettings) : bg);
            setRegenerations(0);
          }} />
      </div>
        {renderMode==='3d'&&<ThreeExportPanel finePreview={finePreview} api={threeApi} seed={seed} ready={threeReady}
           onBusyChange={setThreeExportBusy}
          project={()=>({kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,seed,aspectRatio:ratio,density,visualTheme,background,
            colorSettings:activeColors,settings:threeSettings,
            hybridSource:{algorithmVersion:version,enabledShapeKinds,magicCircle:magicSettings},
             ...(standbyFinishedSeed===seed?{standbyComplete:true}:{}),
             floorElapsedSeconds:Math.max(0,Math.min(1e9,
               threeApi.current?.getFloorElapsedSeconds?.()??threeRestore.floorTime)),
             ...(threeView.current?{view:threeView.current}:{})})}
          onRestore={(project:ThreeProject)=>{
            beforeVoid.current=null;
            setStandbyTransition(null);setStandbyFinishedSeed(project.standbyComplete?project.seed:null);setThreeReady(false);setSeed(project.seed);committedSeed.current=project.seed;setRatio(project.aspectRatio);setDensity(project.density);
            setVisualTheme(project.visualTheme);setColorSettings(project.colorSettings);setBackground(project.colorSettings?coloredBackground(project.background,project.colorSettings):project.background);
            if(project.hybridSource){setVersion(project.hybridSource.algorithmVersion);
              setEnabledShapeKinds(project.hybridSource.enabledShapeKinds);
              setMagicSettings(project.hybridSource.magicCircle);}
            setThreeSettings(project.settings);threeView.current=project.view;setThreeRestore(previous=>({serial:previous.serial+1,time:project.elapsedSeconds,
              floorTime:project.floorElapsedSeconds??project.elapsedSeconds}));
          }}/>}
        </div>
          </section>
        </div>
      </aside>

      <section className="preview-panel studio-preview-panel" aria-labelledby="preview-heading">
        <div className="preview-toolbar studio-preview-toolbar">
          <div className="studio-preview-heading">
            <span className="eyebrow">01 / LIVE CANVAS</span>
            <h2 id="preview-heading">ライブプレビュー <span className="studio-canvas-version">{renderMode==='3d'?'3D':'2D'}</span></h2>
            <p>アイデアを即座に描画、すべてリアルタイムに反映。</p>
          </div>
          <div className="studio-preview-toolbar-actions">
            <span className="live-indicator"><i/> リアルタイム反映</span>
            <button type="button" className="studio-focus-button" aria-pressed={studioFocus}
              onClick={()=>setStudioFocus(v=>!v)}>
              <span aria-hidden="true">{studioFocus?'↙':'⤢'}</span>
              {studioFocus?'集中表示を終了':'集中表示'}
            </button>
          </div>
        </div>
        <div className="canvas-stage">
          {renderMode==='2d'?<PreviewTextEditor settings={textOverlay} onChange={setTextOverlay} onAdvanced={()=>goToSettings('text')}>
            <div ref={artworkRef} className="canvas-frame" style={{ aspectRatio: `${scene.width} / ${scene.height}`, width: `min(100%, calc(var(--preview-height, 70vh) * ${scene.width / scene.height}))` }}>
              {ambient.enabled&&version!==MAGIC_ALGORITHM_VERSION?<AmbientStage input={{seed,version,ratio,density,background,colors:activeColors,animation,settings:ambient,visualTheme,enabledShapeKinds,textOverlay}} clock={ambientClock}/>:version===MAGIC_ALGORITHM_VERSION?<MagicCirclePreview scene={scene} background={twoDBackground} settings={magicSettings} animation={animation} growth={growth}/>:<Preview scene={scene} background={twoDBackground} growth={growth} flow={completedFlow} textOverlay={textOverlay} textSeconds={entrancePreview.seconds} gridSeconds={gridSeconds} gridFigureAngle={figureScrollAngle(ambient,ratio)}/>}
            </div>
          </PreviewTextEditor>:<div className="canvas-frame three-frame" style={{aspectRatio:`${scene.width} / ${scene.height}`,width:`min(100%, calc(var(--preview-height, 70vh) * ${scene.width/scene.height}))`}}>
            <ThreeBoundary onReturn={()=>switchRenderMode('2d')} onRetryLowQuality={()=>{
              setThreeReady(false);
              setThreeSettings(current=>({...current,quality:'low',
                floorGrid:{...(current.floorGrid??floorGridDefaults),circuitWorldEnabled:false}}));
              setThreeRestore(current=>({...current,serial:current.serial+1}));
            }}>
              <Suspense fallback={<div className="three-fallback" role="status">3Dエンジンを読み込んでいます…</div>}>
                {threeComposition&&<ThreePreview key={threeRestore.serial} initialTime={threeRestore.time}
                  initialFloorTime={threeRestore.floorTime} composition={threeComposition} sourceComposition={threeBaseComposition!} hybridArtworks={hybridArtworks} skySeed={seed} density={density} background={threeBackground} visualTheme={visualTheme} settings={threeSettings} restartKey={`${seed}:${ratio}:${regenerations}${voidEnabled?':'+voidVersion:''}`} view={threeView} api={threeApi} onReady={setThreeReady} transition={standbyTransition}
                   skipEntrance={standbyFinishedSeed===seed} onVoidVisibleCount={setVoidVisibleCount}
                   onTransitionComplete={id=>{
                     setStandbyFinishedSeed(seed);
                     setStandbyTransition(current=>current?.id===id?null:current);
                     if(!standby.preserveCamera)threeApi.current?.smoothResetView?.();
                   }}/>}
              </Suspense>
            </ThreeBoundary>
          </div>}
        </div>
        <div className="studio-quickbar" role="group" aria-label="クイック調整">
          <div className="studio-quickbar-caption"><span className="studio-quickbar-symbol" aria-hidden="true">✳</span>
            <span><strong>QUICK TUNE</strong><small>今のシーンを調整</small></span></div>
          <label className="studio-quick-field">比率
            <select aria-label="クイック比率" disabled={threeExportBusy} value={ratio} onChange={event=>setRatio(event.target.value as Ratio)}>
              {Object.keys(RATIOS).map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="studio-quick-field studio-quick-density">密度 <span>{density}%</span>
            <input type="range" aria-label="クイック密度" disabled={threeExportBusy} min={0} max={100} step={5} value={density}
              onChange={event=>setDensity(Number(event.target.value))}/>
          </label>
          <div className="studio-quick-actions">
            <button type="button" onClick={randomizeSeed} disabled={threeExportBusy} title="新しいシードを生成">
              <span aria-hidden="true">↻</span> 新しいシード</button>
            <button type="button" className="studio-quick-export" onClick={()=>goToSettings('export')}>
              <span aria-hidden="true">↥</span> 書き出しへ</button>
          </div>
        </div>
        {renderMode==='3d'&&<div className="three-view-toolbar"><p>1本指で見回す · 2本指で平行移動 · ピンチで前後移動</p><button type="button" disabled={!threeReady} onClick={()=>threeApi.current?.resetView()}>視点をリセット</button></div>}
        <div className="canvas-info"><span>{ratio} <span className="info-divider">/</span> {renderMode==='2d'?'SVG · 2D':'WebGL · 3D'}</span><span>{threeComposition && renderMode==='3d' ? voidEnabled?voidVisibleCount:threeSettings.galaxy?.enabled?Math.min(threeSettings.galaxy.count,threeSettings.quality==='low'?3600:30000):visibleThreeObjects(threeComposition,density,threeSettings.enabledKinds).length + generateCelestialBodies(threeComposition,threeSettings.celestial??celestialDefaults,density).length : scene.shapes.length} {renderMode==='3d'&&threeSettings.galaxy?.enabled&&!voidEnabled?'STARS':'SHAPES'}</span></div>
        <div className="seed-card"><span className="seed-card-icon" aria-hidden="true">⌘</span><div><span className="tiny-label">CURRENT SEED</span><code data-testid="current-seed">{seed === '' ? '（空文字）' : seed}</code></div><span className="algorithm">{renderMode==='2d'?version:THREE_ALGORITHM_VERSION}</span></div>
        <p className="preview-hint" role="status">{regenerations > 0 ? `再生成しました（${regenerations}回）。同じシードと設定の模様です。` : '設定を変えると、プレビューが自動で更新されます。'}</p>
      </section>

    </main>
    <button type="button" className="studio-back-to-top" aria-label="ページの先頭に戻る"
      title="ページの先頭に戻る" hidden={!showBackToTop} onClick={scrollToTop}>
      <span aria-hidden="true">↑</span><small>TOP</small>
    </button>
    <nav className="studio-mobile-dock" aria-label="モバイルクイック操作">
      <button type="button" onClick={goToSettingsIndex}>
        <span aria-hidden="true">◈</span><small>設定</small></button>
      <button type="button" onClick={randomizeSeed} disabled={threeExportBusy}>
        <span aria-hidden="true">↻</span><small>新規</small></button>
      <button type="button" onClick={()=>goToSettings('export')}>
        <span aria-hidden="true">↥</span><small>保存</small></button>
      <button type="button" aria-pressed={studioFocus} onClick={()=>setStudioFocus(v=>!v)}>
        <span aria-hidden="true">{studioFocus?'↙':'⤢'}</span><small>{studioFocus?'戻る':'集中'}</small></button>
      <button type="button" onClick={()=>setCommandOpen(true)}>
        <span aria-hidden="true">⌕</span><small>探す</small></button>
    </nav>
    <StudioCommandPalette open={commandOpen} onClose={closeCommands} commands={studioCommands}/>
    {explorerOpen&&renderMode==='2d'&&<SeedExplorerBoard
      activeSeed={seed} ratio={ratio} version={version} shapeKinds={enabledShapeKinds}
      magicSettings={magicSettings} density={density} visualTheme={visualTheme}
      background={background} colors={activeColors}
      favoriteSeeds={seedVault.bookmarks.map(item=>item.seed)}
      onClose={closeExplorer} onSelect={selectExplorerSeed} onSave={saveExplorerFavorite}/>}

    <footer><span>GENERATIVE DESIGN, DETERMINISTIC BY NATURE.</span><span>2D / 3D 背景スタジオ</span></footer>
  </div>;
}
