import {useEffect,useLayoutEffect,useMemo,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import type {NetworkEdge} from './network';
import {particleSwirlDirection} from './particle';
import type {ThreeSettings} from './settings';
import {VOID_PARTICLE_NODE_SHARE_DEFAULT,generateVoidParticles} from './void-particle';

const vertex=String.raw`
attribute vec3 aTarget;
attribute vec3 aScatter;
attribute float aPhase;
attribute vec3 aColor;
attribute float aNode;
uniform float uTime,uDuration,uSwirl,uDirection,uPointScale,uJitter;
varying vec3 vColor;
varying float vNode;
void main(){
  float t=clamp(uTime/max(.001,uDuration),0.0,1.0);
  float ease=1.0-pow(1.0-t,3.0);
  float angle=aPhase+uDirection*uSwirl*12.5663706144*t;
  float unformed=1.0-ease;
  vec3 displaced=aTarget+vec3(
    cos(angle)*aScatter.x*unformed,
    aScatter.y*unformed,
    sin(angle)*aScatter.z*unformed
  );
  // Only a tiny final shimmer, not an expensive CPU geometry update.
  displaced+=vec3(sin(uTime*3.7+aPhase),cos(uTime*3.1+aPhase),0.0)
    *uJitter*.025*(.3+.7*unformed);
  vec4 view=modelViewMatrix*vec4(displaced,1.0);
  gl_Position=projectionMatrix*view;
  // Figure particles are easier to distinguish than the thinner wire dust.
  gl_PointSize=clamp(uPointScale*18.0/max(1.0,-view.z)*(1.0+.65*aNode),1.1,8.0);
  vColor=aColor;
  vNode=aNode;
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

/** One GPU Points draw call for all knots and strands, even when the actual
 * VOID renderer would otherwise create thousands of solid instances.
 * Particle assembly depends only on the seekable shared scene clock. */
export function VoidParticleCloud({objects,edges,count,seed,background,settings,
  seconds,low,progressHost}:{
  objects:readonly ThreeObject[];edges:readonly NetworkEdge[];count:number;
  seed:string;background:Background;settings:ThreeSettings;
  seconds:RefObject<number>;low:boolean;
  progressHost?:RefObject<HTMLDivElement|null>;
}){
  const options=settings.particle!;
  const nodeShare=settings.voidMode?.nodeShare??VOID_PARTICLE_NODE_SHARE_DEFAULT;
  const data=useMemo(()=>generateVoidParticles(
    objects,edges,seed,background,count,low,options.spread,options.height,nodeShare
  ),[objects,edges,seed,background,count,options.spread,options.height,nodeShare,low]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aTarget',new BufferAttribute(data.targets,3));
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
      uDensityGain:{value:1},
    },
  }),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  const update=()=>{
    const u=material.uniforms;
    u.uTime.value=!settings.animation&&seconds.current===0
      ?options.duration:seconds.current;
    u.uDuration.value=options.duration;
    u.uSwirl.value=options.swirl;
    u.uDirection.value=direction;
    u.uPointScale.value=low?2.1:2.8;
    u.uJitter.value=options.jitter?1:0;
    // Prevent dense additive particles from washing out the dark voids.
    u.uDensityGain.value=Math.max(.27,Math.sqrt(18000/Math.max(18000,data.count)));
    if(progressHost?.current){
      const host=progressHost.current;
      host.dataset.particleSeedPhase='settled';
      host.dataset.particleSeedProgress='1.000';
    }
  };
  useLayoutEffect(update,[material,settings.animation,seconds,options.duration,
    options.swirl,options.jitter,direction,low,progressHost,data]);
  useFrame(update);
  return <points name="void-web-particle-cloud"
    geometry={geometry} material={material} frustumCulled={false}/>;
}
