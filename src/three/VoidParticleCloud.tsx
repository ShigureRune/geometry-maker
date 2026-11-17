import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import type {NetworkEdge} from './network';
import {particleSwirlDirection} from './particle';
import type {ThreeSettings} from './settings';
import {VOID_PARTICLE_NODE_SHARE_DEFAULT,generateVoidParticles} from './void-particle';
import {snapshotVoidSeedFrame,type VoidSeedMorph} from './void-seed-morph';

const vertex=String.raw`
attribute vec3 aTarget;
attribute vec3 aFrom;
attribute vec3 aFromColor;
attribute float aFromNode;
attribute vec3 aScatter;
attribute float aPhase;
attribute vec3 aColor;
attribute float aNode;
uniform float uTime,uDuration,uSwirl,uDirection,uPointScale,uJitter,uSeedProgress;
varying vec3 vColor;
varying float vNode;
void main(){
  vec3 displaced;
  float node=aNode;
  if(uSeedProgress>=0.0){
    // A real seed morph starts at the old *visible* frame, including a
    // previously interrupted morph. Only the uniforms change per frame.
    float progress=clamp(uSeedProgress,0.0,1.0);
    float blend=progress*progress*(3.0-2.0*progress);
    float burst=sin(progress*3.1415926536);
    float angle=aPhase+uDirection*uSwirl*12.5663706144*progress;
    float travel=length(aTarget-aFrom);
    float radius=burst*(.45+.05*min(9.0,travel))*max(.15,uSwirl);
    displaced=mix(aFrom,aTarget,blend)+vec3(
      cos(angle),sin(angle*.7+aPhase)*.5,sin(angle)
    )*radius;
    displaced+=vec3(sin(uTime*3.7+aPhase),cos(uTime*3.1+aPhase),0.0)
      *uJitter*.025*.3*blend;
    vColor=mix(aFromColor,aColor,blend);
    node=mix(aFromNode,aNode,blend);
  }else{
    float t=clamp(uTime/max(.001,uDuration),0.0,1.0);
    float ease=1.0-pow(1.0-t,3.0);
    float angle=aPhase+uDirection*uSwirl*12.5663706144*t;
    float unformed=1.0-ease;
    displaced=aTarget+vec3(
      cos(angle)*aScatter.x*unformed,
      aScatter.y*unformed,
      sin(angle)*aScatter.z*unformed
    );
    displaced+=vec3(sin(uTime*3.7+aPhase),cos(uTime*3.1+aPhase),0.0)
      *uJitter*.025*(.3+.7*unformed);
    vColor=aColor;
  }
  vec4 view=modelViewMatrix*vec4(displaced,1.0);
  gl_Position=projectionMatrix*view;
  // Figure particles are easier to distinguish than the thinner wire dust.
  gl_PointSize=clamp(uPointScale*18.0/max(1.0,-view.z)*(1.0+.65*node),1.1,8.0);
  vNode=node;
}
`;
const fragment=String.raw`
varying vec3 vColor;
varying float vNode;
uniform float uDensityGain;
void main(){
  float d=length(gl_PointCoord-vec2(.5));
  float alpha=exp(-d*d*15.0)*(1.0-smoothstep(.40,.50,d));
  if(alpha<.014)discard;
  gl_FragColor=vec4(vColor*1.3,alpha*.82*uDensityGain*mix(.55,1.3,vNode));
}
`;

/** One GPU Points draw call for both ordinary assembly and seed morphs.
 * Re-seeding snapshots the last displayed frame only once; all subsequent
 * motion, color blending and swirl run in the existing GPU vertex shader.
 * Pausing, resuming, seeking and automatic standby share the scene clock. */
export function VoidParticleCloud({objects,edges,count,seed,background,settings,
  seconds,low,progressHost,restartKey,transitionDuration}:{
  objects:readonly ThreeObject[];edges:readonly NetworkEdge[];count:number;
  seed:string;background:Background;settings:ThreeSettings;
  seconds:RefObject<number>;low:boolean;restartKey:string;
  transitionDuration?:number;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const options=settings.particle!;
  const lastScene=useRef<{seed:string;data:ReturnType<typeof generateVoidParticles>;restartKey:string}|null>(null);
  const seedMorph=useRef<VoidSeedMorph|null>(null);
  const nodeShare=settings.voidMode?.nodeShare??VOID_PARTICLE_NODE_SHARE_DEFAULT;
  const data=useMemo(()=>generateVoidParticles(
    objects,edges,seed,background,count,low,options.spread,options.height,nodeShare
  ),[objects,edges,seed,background,count,options.spread,options.height,nodeShare,low]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aTarget',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aFrom',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aFromColor',new BufferAttribute(data.colors,3));
    buffer.setAttribute('aFromNode',new BufferAttribute(data.nodeFlags,1));
    buffer.setAttribute('aScatter',new BufferAttribute(data.scatter,3));
    buffer.setAttribute('aPhase',new BufferAttribute(data.phases,1));
    buffer.setAttribute('aColor',new BufferAttribute(data.colors,3));
    buffer.setAttribute('aNode',new BufferAttribute(data.nodeFlags,1));
    return buffer;
  },[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const direction=useMemo(()=>particleSwirlDirection(seed),[seed]);
  const material=useMemo(()=>new ShaderMaterial({
    vertexShader:vertex,fragmentShader:fragment,
    transparent:true,depthWrite:false,blending:AdditiveBlending,
    uniforms:{
      uTime:{value:0},uDuration:{value:options.duration},
      uSwirl:{value:options.swirl},uDirection:{value:direction},
      uPointScale:{value:low?2.1:2.8},uJitter:{value:options.jitter?1:0},
      uDensityGain:{value:1},uSeedProgress:{value:-1},
    },
  }),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const update=()=>{
    const u=material.uniforms;
    const morph=seedMorph.current;
    u.uTime.value=!settings.animation&&seconds.current===0&&!morph
      ?options.duration:seconds.current;
    u.uSeedProgress.value=morph?
      Math.max(0,Math.min(1,seconds.current/Math.max(.001,morph.duration))):-1;
    u.uDuration.value=options.duration;
    u.uSwirl.value=options.swirl;
    u.uDirection.value=direction;
    u.uPointScale.value=low?2.1:2.8;
    u.uJitter.value=options.jitter?1:0;
    // Prevent dense additive particles from washing out the dark voids.
    u.uDensityGain.value=Math.max(.27,Math.sqrt(18000/Math.max(18000,data.count)));
    if(progressHost?.current){
      const host=progressHost.current;
      host.dataset.particleSeedPhase=morph&&u.uSeedProgress.value<1?'transition':'settled';
      host.dataset.particleSeedProgress=morph?u.uSeedProgress.value.toFixed(3):'1.000';
    }
  };
  // Layout effect runs before the next WebGL draw: the old position buffers
  // are still available when the new seed's geometry is installed.
  useLayoutEffect(()=>{
    const previous=lastScene.current;
    const changedSeed=!!previous&&previous.seed!==seed;
    if(changedSeed){
      if(options.seedTransition&&settings.animation&&previous!.data.count&&data.count){
        const uniforms=material.uniforms;
        const snapshot=snapshotVoidSeedFrame(previous!.data,data.count,{
          time:uniforms.uTime.value,duration:uniforms.uDuration.value,
          swirl:uniforms.uSwirl.value,direction:uniforms.uDirection.value,
          jitter:uniforms.uJitter.value>0,
          morph:seedMorph.current,progress:uniforms.uSeedProgress.value,
        });
        geometry.setAttribute('aFrom',new BufferAttribute(snapshot.positions,3));
        geometry.setAttribute('aFromColor',new BufferAttribute(snapshot.colors,3));
        geometry.setAttribute('aFromNode',new BufferAttribute(snapshot.nodes,1));
        seedMorph.current={...snapshot,duration:transitionDuration??options.seedDuration};
        // The parent runtime resets the shared scene clock in its layout
        // effect. Start at progress zero even before its first frame.
        uniforms.uSeedProgress.value=0;
        if(progressHost?.current){
          progressHost.current.dataset.particleSeedPhase='transition';
          progressHost.current.dataset.particleSeedProgress='0.000';
        }
      }else seedMorph.current=null;
    }else if(previous&&(previous.data!==data||previous.restartKey!==restartKey)){
      // Changes to density/quality or a replay of the same seed must not
      // mistake a new particle buffer for another seed morph.
      seedMorph.current=null;
    }
    lastScene.current={seed,data,restartKey};
    if(!changedSeed||!seedMorph.current)update();
  },[data,geometry,seed,restartKey,transitionDuration,options.seedTransition,
    options.seedDuration,settings.animation,options.duration,options.swirl,
    options.jitter,direction,low,progressHost,seconds,material]);
  useFrame(update);
  return <points name="void-web-particle-cloud"
    geometry={geometry} material={material} frustumCulled={false}/>;
}
