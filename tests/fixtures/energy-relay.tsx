import {createRoot} from 'react-dom/client';
import {Preview} from '../../src/Preview';
import {createFigureMotionPlan,figureFlowAt} from '../../src/figure-motion';
import {createVideoRenderer} from '../../src/video-frame';
import {motionPresetParameters,type AnimationSettings,type MotionPreset} from '../../src/animation';
import {generateScene,type Background,type Scene,type Shape} from '../../src/scene';

const version=new URLSearchParams(location.search).get('version')==='2d-v4'?'2d-v4':'2d-v5';
const seed='browser-energy-relay-'+version;
const base=generateScene(seed,'16:9',version);
const hero:Shape={...base.shapes[0],id:'relay-main',group:'relay-main',
  kind:'circle',role:'hero',layer:'midground',parent:undefined,
  size:140,x:450,y:400,rotation:0};
const wireA:Shape={...hero,id:'relay-a',kind:version==='2d-v4'?'circuit':'branch-circuit',
  role:'support',parent:hero.id,x:500,y:405,size:110,rotation:0,filled:false,
  points:[{x:0,y:0},{x:45,y:0},{x:90,y:20}]};
const wireB:Shape={...wireA,id:'relay-b',x:520,y:395,size:90,
  points:[{x:0,y:0},{x:45,y:0},{x:70,y:30}]};
const wireC:Shape={...wireA,id:'relay-c',x:525,y:500};
const childA:Shape={...hero,id:'relay-node-a',kind:'circle',role:'decoration',parent:wireA.id,
  x:590,y:425,size:12};
const childB:Shape={...childA,id:'relay-node-b',parent:wireB.id};
const bar:Shape={...hero,id:'relay-bar',kind:'band',role:'support',
  parent:hero.id,x:800,y:550,thickness:25};
const accent:Shape={...hero,id:'relay-accent',kind:'line',role:'accent',
  parent:hero.id};
const shapes=[hero,wireA,wireB,wireC,childA,childB,bar,accent];
const scene:Scene={...base,shapes};
const background:Background={mode:'solid',solid:'#111526',
  colors:['#111526','#111526','#111526'],angle:0,lineWidth:120,glowIntensity:40};
const plan=createFigureMotionPlan(scene,seed);
const link=plan.find(p=>p.id===wireA.id)!.relay!;
const secondsFor=(stage:number)=>link.period*(stage-link.phase+1);
const root=createRoot(document.getElementById('atlas')!);
const video=createVideoRenderer({scene,candidates:shapes,seed,background,
  animation:{animationEnabled:true,animationDuration:1,playbackSpeed:1,
    easingType:'linear',continuousMotion:true,motionStrength:100,motionSpeed:1}});
function stageAt(stage:number){
  root.render(<Preview scene={scene} background={background}
    flow={stage<0?undefined:figureFlowAt(plan,secondsFor(stage))}/>);
}
Object.assign(window,{
  relayStage:stageAt,
  relayVideo:(stage:number)=>video(1+secondsFor(stage),scene.width,scene.height),
  relayPreset:(preset:MotionPreset,stage:number)=>{
    const animation:AnimationSettings={animationEnabled:true,animationDuration:1,
      playbackSpeed:1,easingType:'linear',continuousMotion:true,motionStrength:100,
      motionSpeed:1,motionPreset:preset};
    const {strength,speed}=motionPresetParameters(animation);
    root.render(<Preview scene={scene} background={background}
      flow={figureFlowAt(plan,secondsFor(stage),strength,speed)}/>);
    const svg=createVideoRenderer({scene,candidates:shapes,seed,background,animation})(
      1+secondsFor(stage),scene.width,scene.height);
    const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
    const flow=doc.querySelector('[data-shape-id="relay-a"] [data-testid="figure-flow"]');
    return {opacity:flow?.getAttribute('data-flow-opacity')??null,
      offset:flow?.getAttribute('data-flow-offset')??null,
      hasBar:svg.includes('data-testid="bar-body-motion"'),
      hasCoupled:svg.includes('data-testid="coupled-rotation"')};
  },
});
stageAt(-1);
