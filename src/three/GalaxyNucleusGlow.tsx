import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import {galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyNucleus} from './galaxy-nucleus';

const vertexShader=String.raw`
attribute vec3 aColor;
attribute float aSize;
attribute float aOpacity;
attribute float aSpin;
attribute vec2 aOrbitCenter;
uniform float uTime,uRotationSpeed,uEntrance,uDpr,uExportScale;
varying vec3 vColor;
varying float vOpacity;
void main(){
  float a=aSpin*uRotationSpeed*uTime;
  float c=cos(a),s=sin(a);
  vec2 local=position.xy-aOrbitCenter;
  vec3 pos=vec3(aOrbitCenter.x+local.x*c-local.y*s,
    aOrbitCenter.y+local.x*s+local.y*c,position.z);
  vec4 view=modelViewMatrix*vec4(pos,1.);
  gl_Position=projectionMatrix*view;
  float scale=clamp(21./max(.5,-view.z),.45,3.);
  // Keep sparkles spatially resolved when close to the bulge. Large sprites
  // overlap additively into a blank white sphere, especially while zooming.
  gl_PointSize=clamp(aSize*uDpr*scale*2.25,1.5,24.)*uExportScale;
  vColor=aColor;
  vOpacity=aOpacity*uEntrance;
}
`;

const fragmentShader=String.raw`
varying vec3 vColor;
varying float vOpacity;
uniform float uGlow;
void main(){
  float d=length(gl_PointCoord-vec2(.5));
  // Small concentrated sparkles, not broad flat circles. The seed generator
  // now makes the tiny pinprick bright and the wider fivefold bulge warm.
  float halo=exp(-d*d*24.);
  float alpha=clamp(vOpacity*halo*uGlow,0.,.58);
  if(alpha<.004)discard;
  gl_FragColor=vec4(vColor,alpha);
}
`;

/** Localized additive light: unlike global bloom it never overexposes arms.
 * Two interacting galaxies receive two independently orbiting nuclei. */
export function GalaxyNucleusGlow({seed,options,stars,seconds,low,animation,morph,morphDuration,progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;seconds:RefObject<number>;
  low:boolean;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const data=useMemo(()=>generateGalaxyNucleus(seed,options,low,stars),
    [seed,options.galaxyType,options.radius,low,stars]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.positions,3));
    buffer.setAttribute('aColor',new BufferAttribute(data.colors,3));
    buffer.setAttribute('aSize',new BufferAttribute(data.sizes,1));
    buffer.setAttribute('aOpacity',new BufferAttribute(data.opacities,1));
    buffer.setAttribute('aSpin',new BufferAttribute(data.spins,1));
    buffer.setAttribute('aOrbitCenter',new BufferAttribute(data.orbitCenters,2));
    return buffer;
  },[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:options.rotationSpeed},
    uEntrance:{value:1},uDpr:{value:low?1:1.75},
    uExportScale:{value:1},uGlow:{value:options.coreGlow/75},
  }),[]);
  useFrame(()=>{
    const rawClock=import.meta.env.DEV&&progressHost?.current
      ?Number(progressHost.current.dataset.galaxyMotionClock):NaN;
    const time=Number.isFinite(rawClock)?rawClock:seconds.current;
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uEntrance.value=morph.current
      ?galaxyMorphEasing(time/Math.max(.001,morphDuration.current))
      :!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uGlow.value=options.coreGlow/75;
    uniforms.uDpr.value=low?1:1.75;
    if(material.current){
      material.current.uniforms.uTime.value=uniforms.uTime.value;
      material.current.uniforms.uRotationSpeed.value=uniforms.uRotationSpeed.value;
      material.current.uniforms.uEntrance.value=uniforms.uEntrance.value;
      material.current.uniforms.uGlow.value=uniforms.uGlow.value;
      material.current.uniforms.uDpr.value=uniforms.uDpr.value;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyNucleusCount=String(data.count);
      progressHost.current.dataset.galaxyNucleusTime=time.toFixed(3);
    }
  });
  if(!data.count)return null;
  return <points name="galaxy-nucleus-glow" geometry={geometry} renderOrder={2}
    frustumCulled={false}>
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
      uniforms={uniforms} transparent depthWrite={false} depthTest={false}
      blending={AdditiveBlending}/>
  </points>;
}
