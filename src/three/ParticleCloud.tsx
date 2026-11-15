import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry,
  Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DynamicDrawUsage,
  Euler, IcosahedronGeometry, Mesh, OctahedronGeometry, SphereGeometry,
  TetrahedronGeometry, TorusGeometry, TorusKnotGeometry, Vector3,
} from 'three';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {seededRandom,type Background} from '../scene';
import {threePose,type ThreeKind,type ThreeObject} from './model';
import {particleEase,particleSeedEnvelope,particleSwirlDirection,type ParticleSettings} from './particle';
import type {ThreeSettings} from './settings';

type ParticleData={
  geometry:BufferGeometry;
  targets:Float32Array;
  targetColors:Float32Array;
  starts:Float32Array;
  owners:Uint16Array;
  count:number;
};

function surfaceGeometry(kind:ThreeKind,low:boolean):BufferGeometry {
  const n=low?12:32;
  switch(kind){
    case 'sphere':return new SphereGeometry(1,n,n/2);
    case 'cube':return new BoxGeometry(2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3));
    case 'torus':return new TorusGeometry(.72,.23,low?8:16,low?24:64);
    case 'icosahedron':return new IcosahedronGeometry(1,0);
    case 'dodecahedron':return new DodecahedronGeometry(1,0);
    case 'octahedron':return new OctahedronGeometry(1,0);
    case 'tetrahedron':return new TetrahedronGeometry(1,0);
    case 'cylinder':return new CylinderGeometry(.62,.62,1.45,n);
    case 'cone':return new ConeGeometry(.72,1.35,n);
    case 'capsule':return new CapsuleGeometry(.42,.68,low?4:8,low?10:24);
    case 'prism':return new CylinderGeometry(.69,.69,1.32,3);
    case 'pyramid':return new CylinderGeometry(0,.70,1.30,4);
    case 'torus-knot':return new TorusKnotGeometry(.50,.15,low?48:112,low?6:12,2,3);
  }
}

function createParticleData(
  objects:readonly ThreeObject[],seed:string,background:Background,count:number,low:boolean,
  options:ParticleSettings
):ParticleData {
  const actualCount=objects.length?Math.min(count,low?1600:12000):0;
  const geometry=new BufferGeometry();
  const positions=new Float32Array(actualCount*3);
  const colors=new Float32Array(actualCount*3);
  const targets=new Float32Array(actualCount*3);
  const starts=new Float32Array(actualCount*4);
  const owners=new Uint16Array(actualCount);
  geometry.setAttribute('position',new BufferAttribute(positions,3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('color',new BufferAttribute(colors,3).setUsage(DynamicDrawUsage));
  if(!actualCount)return {geometry,targets,targetColors:colors,starts,owners,count:0};
  // Distribute the total count by visible surface area, not count per object.
  const weights=objects.map(o=>o.radius*o.radius);
  const totalWeight=weights.reduce((sum,n)=>sum+n,0);
  const counts=weights.map(weight=>Math.floor(actualCount*weight/totalWeight));
  let remaining=actualCount-counts.reduce((sum,n)=>sum+n,0);
  for(let i=0;remaining>0;i=(i+1)%counts.length,remaining--)counts[i]++;
  const colorFallback={primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'};
  const position=new Vector3();
  let index=0;
  objects.forEach((object,objectIndex)=>{
    if(counts[objectIndex]===0)return;
    const random=seededRandom('particle-v1:'+seed+':'+object.id+':'+object.kind);
    const surface=surfaceGeometry(object.kind,low);
    const sampler=new MeshSurfaceSampler(new Mesh(surface));
    // Runtime Three.js provides this API; the pinned @types/three omits its declaration.
    (sampler as MeshSurfaceSampler & {setRandomGenerator:(randomFn:()=>number)=>MeshSurfaceSampler}).setRandomGenerator(random);
    sampler.build();
    const color=new Color(background.figureColors?.[object.role]??colorFallback[object.role]);
    for(let j=0;j<counts[objectIndex];j++,index++){
      sampler.sample(position);
      const p=index*3,s=index*4;
      targets[p]=position.x;targets[p+1]=position.y;targets[p+2]=position.z;
      starts[s]=(0.7+random()*.9)*options.spread;
      starts[s+1]=random()*Math.PI*2;
      starts[s+2]=(random()*2-1)*options.height;
      starts[s+3]=random()*Math.PI*2;
      owners[index]=objectIndex;
      colors[p]=color.r;colors[p+1]=color.g;colors[p+2]=color.b;
    }
    surface.dispose();
  });
  return {geometry,targets,targetColors:new Float32Array(colors),starts,owners,count:actualCount};
}

/** One draw call for all visible solids. Every frame depends only on seed,
 * object poses, and the shared (pausable/seekable/exportable) scene clock. */
export function ParticleCloud({objects,seed,background,settings,seconds,low,restartKey,transitionDuration,progressHost}:{
  objects:readonly ThreeObject[];seed:string;background:Background;
  settings:ThreeSettings;seconds:RefObject<number>;low:boolean;
  restartKey:string;transitionDuration?:number;progressHost?:RefObject<HTMLDivElement|null>;
}) {
  const options=settings.particle!;
  const data=useMemo(()=>createParticleData(objects,seed,background,options.count,low,options),
    [objects,seed,background,options.count,options.spread,options.height,low]);
  const direction=useMemo(()=>particleSwirlDirection(seed),[seed]);
  const lastScene=useRef<{seed:string;data:ParticleData;restartKey:string}|null>(null);
  const seedMorph=useRef<{positions:Float32Array;colors:Float32Array;duration:number}|null>(null);
  useEffect(()=>()=>data.geometry.dispose(),[data]);
  const update=useCallback(()=>{
    if(!data.count)return;
    // If reduced motion was requested, show the fully formed static shape.
    // Otherwise pausing freezes the current assembly frame.
    const time=!settings.animation&&seconds.current===0&&!seedMorph.current?options.duration:seconds.current;
    const morph=seedMorph.current;
    const morphProgress=morph?Math.max(0,Math.min(1,time/morph.duration)):1;
    const envelope=morph?particleSeedEnvelope(morphProgress):null;
    const t=Math.max(0,Math.min(1,time/options.duration));
    const eased=particleEase(t),unformed=1-eased;
    const poses=objects.map(object=>{
      const pose=threePose(object,time,settings.floatAmount,settings.rotationAmount);
      return {position:pose.position,rotation:new Euler(...pose.rotation),radius:object.radius};
    });
    const attribute=data.geometry.getAttribute('position') as BufferAttribute;
    const output=attribute.array as Float32Array;
    const colorAttribute=data.geometry.getAttribute('color') as BufferAttribute;
    const colors=colorAttribute.array as Float32Array;
    const tmp=new Vector3();
    for(let i=0;i<data.count;i++){
      const p=i*3,s=i*4,pose=poses[data.owners[i]];
      const angle=data.starts[s+1]+direction*options.swirl*Math.PI*4*t;
      const radius=data.starts[s]*unformed;
      const jitter=options.jitter ? .035*unformed*Math.sin(time*9+data.starts[s+3]) : 0;
      tmp.set(
        data.targets[p]*eased+Math.cos(angle)*radius+jitter,
        data.targets[p+1]*eased+data.starts[s+2]*unformed,
        data.targets[p+2]*eased+Math.sin(angle)*radius-jitter
      ).multiplyScalar(pose.radius).applyEuler(pose.rotation);
      const x=tmp.x+pose.position[0],y=tmp.y+pose.position[1],z=tmp.z+pose.position[2];
      if(morph&&envelope){
        const mix=envelope.mix,burst=envelope.burst;
        // At t=0 retain exactly the previous rendered frame; at t=1 reach
        // the new geometry's surface. A swirling arc connects the two.
        const turn=data.starts[s+1]+direction*options.swirl*Math.PI*4*morphProgress;
        const arc=data.starts[s]*burst;
        output[p]=morph.positions[p]*(1-mix)+x*mix+Math.cos(turn)*arc;
        output[p+1]=morph.positions[p+1]*(1-mix)+y*mix+
          Math.sin(turn*.5+data.starts[s+3])*options.height*.55*burst;
        output[p+2]=morph.positions[p+2]*(1-mix)+z*mix+Math.sin(turn)*arc;
        colors[p]=morph.colors[p]*(1-mix)+data.targetColors[p]*mix;
        colors[p+1]=morph.colors[p+1]*(1-mix)+data.targetColors[p+1]*mix;
        colors[p+2]=morph.colors[p+2]*(1-mix)+data.targetColors[p+2]*mix;
      }else{
        output[p]=x;output[p+1]=y;output[p+2]=z;
      }
    }
    attribute.needsUpdate=true;
    if(morph){colorAttribute.needsUpdate=true;}
    if(progressHost?.current){
      progressHost.current.dataset.particleSeedPhase=morph&&morphProgress<1?'transition':'settled';
      progressHost.current.dataset.particleSeedProgress=morph?morphProgress.toFixed(3):'1.000';
    }
  },[data,objects,progressHost,settings.animation,settings.floatAmount,settings.rotationAmount,
    options.duration,options.swirl,options.height,options.jitter,seconds,direction]);
  // Snapshot the last displayed frame BEFORE React disposes the old geometry.
  // Repeated edits (including rapid seed typing) always start from what the
  // viewer actually saw, rather than teleporting from an older seed.
  useLayoutEffect(()=>{
    const previous=lastScene.current;
    if(previous?.seed!==undefined&&previous.seed!==seed){
      if(options.seedTransition&&settings.animation&&previous.data.count&&data.count){
        const priorPositions=(previous.data.geometry.getAttribute('position') as BufferAttribute).array;
        const priorColors=(previous.data.geometry.getAttribute('color') as BufferAttribute).array;
        const positions=new Float32Array(data.count*3);
        const colors=new Float32Array(data.count*3);
        for(let i=0;i<data.count;i++){
          const from=Math.floor(i*previous.data.count/data.count)*3,into=i*3;
          positions[into]=Number(priorPositions[from]);
          positions[into+1]=Number(priorPositions[from+1]);
          positions[into+2]=Number(priorPositions[from+2]);
          colors[into]=Number(priorColors[from]);
          colors[into+1]=Number(priorColors[from+1]);
          colors[into+2]=Number(priorColors[from+2]);
        }
        seedMorph.current={positions,colors,duration:transitionDuration??options.seedDuration};
      }else seedMorph.current=null;
    }else if(previous&&(previous.restartKey!==restartKey||previous.data.count!==data.count)){
      // Replay on the same seed is the ordinary initial assembly, not a morph.
      seedMorph.current=null;
    }
    lastScene.current={seed,data,restartKey};
    update();
  },[seed,data,update,restartKey,options.seedTransition,options.seedDuration,settings.animation,transitionDuration]);
  // Prevent an initial scattered/zeroed frame when the canvas is first mounted.
  useFrame(update);
  return <points name="particle-mode-cloud" geometry={data.geometry} frustumCulled={false}>
    <pointsMaterial size={low ? .06 : .045} sizeAttenuation vertexColors
      transparent opacity={.92} depthWrite={false} blending={AdditiveBlending}/>
  </points>;
}
