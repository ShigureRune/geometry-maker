import {HelpInfo} from './HelpInfo';
import {useCallback,useEffect,useRef,useState} from 'react';
import {defaults,EASINGS,MOTION_DEFAULTS,type AnimationSettings} from './animation';
import type {AlgorithmVersion} from './scene';

export function usePlayback(settings:AnimationSettings){
 const [position,setGrowthPosition]=useState(0),[playing,setPlaying]=useState(false);
 const [motionSeconds,setMotionSeconds]=useState(0);
 const [restartSerial,setRestartSerial]=useState(0);
 const frame=useRef<number|undefined>(undefined);
 const setPosition=(next:number)=>{
   setGrowthPosition(Math.max(0,Math.min(1,next)));
   // A deliberate timeline seek returns to the original finished pose.
   setMotionSeconds(0);
 };
 const restart=useCallback((automatic=false)=>{
   if(frame.current!==undefined)cancelAnimationFrame(frame.current);
   const reduce=automatic&&matchMedia('(prefers-reduced-motion: reduce)').matches;
   setGrowthPosition(reduce?1:0);
   setMotionSeconds(0);
   setPlaying(!reduce);
   setRestartSerial(n=>n+1);
 },[]);
 useEffect(()=>{if(!settings.animationEnabled)setPlaying(false);},[settings.animationEnabled]);
 useEffect(()=>{
   if(!playing||!settings.animationEnabled)return;
   let elapsed=0,last:number|undefined,lastMotionDraw=0;
   const from=position,initialMotion=motionSeconds;
   const growthRemaining=Math.max(0,1-from)*settings.animationDuration/settings.playbackSpeed;
   const update=(now:number)=>{
     // Hidden tabs and backgrounded phones do not jump far forward on return.
     if(document.hidden){last=undefined;}
     else{
       if(last!==undefined)elapsed+=Math.max(0,Math.min(.1,(now-last)/1000));
       last=now;
       if(from<1)setGrowthPosition(Math.min(1,from+elapsed*
         settings.playbackSpeed/settings.animationDuration));
       if(settings.continuousMotion&&elapsed>growthRemaining&&now-lastMotionDraw>=1000/30){
         setMotionSeconds(initialMotion+elapsed-growthRemaining);
         lastMotionDraw=now;
       }
     }
     frame.current=requestAnimationFrame(update);
   };
   frame.current=requestAnimationFrame(update);
   return()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);};
 },[playing,restartSerial,settings.animationEnabled,settings.playbackSpeed,
   settings.animationDuration,settings.continuousMotion]);
 useEffect(()=>{if(position>=1&&!settings.continuousMotion)setPlaying(false);},
   [position,settings.continuousMotion]);
 return {position,setPosition,playing,setPlaying,restart,motionSeconds};
}
export function AnimationControls({settings,onChange,playback,version}:{
 settings:AnimationSettings;onChange:(a:AnimationSettings)=>void;
 playback:ReturnType<typeof usePlayback>;version?:AlgorithmVersion;
}){
 const {position,setPosition,playing,setPlaying}=playback;
 const continuing=version!=='2d-magic-v1'&&!!settings.continuousMotion;
 return <section className="control-section animation-controls"><h3>成長アニメーション</h3>
 <label><input type="checkbox" checked={settings.animationEnabled} onChange={e=>{onChange({...settings,animationEnabled:e.target.checked});setPosition(0);setPlaying(false);}}/> アニメーションを有効化</label>
 <label htmlFor="growth-duration">成長時間（秒）</label><output>{settings.animationDuration}</output><input id="growth-duration" type="range" min="1" max="30" value={settings.animationDuration} onChange={e=>onChange({...settings,animationDuration:+e.target.value})}/>
 <label htmlFor="growth-speed">再生速度</label><select id="growth-speed" value={settings.playbackSpeed} onChange={e=>onChange({...settings,playbackSpeed:+e.target.value})}>{[.25,.5,1,1.5,2,3,4].map(n=><option key={n} value={n}>{n}倍</option>)}</select>
 <label htmlFor="growth-easing">動きのなめらかさ</label><select id="growth-easing" aria-label="イージング" value={settings.easingType} onChange={e=>onChange({...settings,easingType:e.target.value as typeof defaults.easingType})}>{EASINGS.map((v,i)=><option key={v} value={v}>{['Linear','Ease In','Ease Out','Ease In Out','Ease Out In'][i]}</option>)}</select>
 {version!=='2d-magic-v1'&&<>
 <label><input type="checkbox" checked={continuing} onChange={e=>{
   const active=e.target.checked;
   onChange({...settings,continuousMotion:active});
   if(!active&&position===1)setPlaying(false);
   if(active&&settings.animationEnabled&&position===1)setPlaying(true);
 }}/> 完成後も線に光を流す</label>
 {continuing&&<>
 <label htmlFor="figure-motion-strength">光の流れの強さ</label>
 <output>{settings.motionStrength??MOTION_DEFAULTS.motionStrength}%</output>
 <input id="figure-motion-strength" aria-label="光の流れの強さ" type="range" min="0" max="200" step="10"
   value={settings.motionStrength??MOTION_DEFAULTS.motionStrength}
   onChange={e=>onChange({...settings,motionStrength:+e.target.value})}/>
 <label htmlFor="figure-motion-speed">光の流れる速さ</label>
 <select id="figure-motion-speed" value={settings.motionSpeed??MOTION_DEFAULTS.motionSpeed}
   onChange={e=>onChange({...settings,motionSpeed:+e.target.value})}>
   {[.25,.5,1,1.5,2,3].map(n=><option key={n} value={n}>{n}倍</option>)}
 </select>
 <label htmlFor="figure-motion-video-seconds">動画に含める光の流れ（秒）</label>
 <output>{settings.motionVideoSeconds??MOTION_DEFAULTS.motionVideoSeconds}秒</output>
 <input id="figure-motion-video-seconds" type="range" min="2" max="30" step="1"
   value={settings.motionVideoSeconds??MOTION_DEFAULTS.motionVideoSeconds}
   onChange={e=>onChange({...settings,motionVideoSeconds:+e.target.value})}/>
 <HelpInfo>v4クラシック・v5の完成後、メイン図形の白い光が実際の接続線を伝わり、先端と接続先の図形が順番にふわっと発光します。連動の順番はシードで決まります。太い棒・細い棒はこれまでどおり同じ方向に進み、固定ハイライトと二重の弧の動きも維持。一時停止・再開、動画保存に対応しています。</HelpInfo>
 </>}
 </>}
 <div className="play-buttons"><button disabled={!settings.animationEnabled} onClick={()=>{
   if(position===1&&!continuing)setPosition(0);
   setPlaying(!playing);
 }}>{playing?'一時停止':'再生'}</button>
 <button onClick={()=>{onChange({...settings,animationEnabled:true});playback.restart();}}>最初から再生</button>
 <button onClick={()=>{setPlaying(false);setPosition(1);}}>完成状態を表示</button></div>
 <label>タイムライン<input type="range" min="0" max="1000" step="1" value={Math.round(position*1000)}
   onChange={e=>{setPlaying(false);setPosition(+e.target.value/1000);}}/></label>
 <output data-testid="playback-position">{(position*settings.animationDuration).toFixed(2)} / {settings.animationDuration}秒（{Math.round(position*100)}%）</output>
 <output data-testid="post-growth-motion" aria-label="完成後の経過時間">{playback.motionSeconds.toFixed(2)}秒</output>
 <HelpInfo>シード確定・再生成で成長から再生します。「完成状態を表示」は光の流れを停止します。静止画保存は常に完成状態です。</HelpInfo>
 </section>;
}
