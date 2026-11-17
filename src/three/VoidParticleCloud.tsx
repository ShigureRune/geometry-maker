import {useEffect,useLayoutEffect,useMemo,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import type {NetworkEdge} from './network';
import {particleSwirlDirection} from './particle';
import type {ThreeSettings} from './settings';
import {generateVoidParticles} from './void-particle';

const vertex=String.raw`
attribute vec3 aTarget;
attribute vec3 aScatter;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime,uDuration,uSwirl,uDirection,uPointScale,uJitter;
varying vec3 vColor;
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
  gl_PointSize=clamp(uPointScale*18.0/max(1.0,-view.z),1.1,5.0);
  vColor=aColor;
}
`;
const fragment=String.raw`
varying vec3 vColor;
void main(){
  float d=length(gl_PointCoord-vec2(.5));
  float alpha=exp(-d*d*15.0)*(1.0-smoothstep(.40,.50,d));
  if(alpha<.014)discard;
  gl_FragColor=vec4(vColor*1.3,alpha*.82);
}
`;

/** One GPU Points draw call for all knots and strands, even when the actual
 * VOID renderer would otherwise create thousands of solid instances.
 * Particle assembly depends only on the seekable shared scene clock. */
export function VoidParticleCloud({objects,edges,seed,background,settings,
  seconds,low,progressHost}:{
  objects:readonly ThreeObject[];edges:readonly NetworkEdge[];
  seed:string;background:Background;settings:ThreeSettings;
  seconds:RefObject<number>;low:boolean;
  progressHost?:RefObject<HTMLDivElement|null>;
}){
  const options=settings.particle!;
  const data=useMemo(()=>generateVoidParticles(
    objects,edges,seed,background,options.count,low,options.spread,options.height
  ),[objects,edges,seed,background,options.count,options.spread,options.height,low]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aTarget',new BufferAttribute(data.targets,3));
    buffer.setAttribute('aScatter',new BufferAttribute(data.scatter,3));
    buffer.setAttribute('aPhase',new BufferAttribute(data.phases,1));
    buffer.setAttribute('aColor',new BufferAttribute(data.colors,3));
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
