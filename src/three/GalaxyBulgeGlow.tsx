import {useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {BackSide,Mesh,NormalBlending,ShaderMaterial,Vector3} from 'three';
import {galaxyAppearance,galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyNucleus} from './galaxy-nucleus';

// This is an actual ellipsoidal 3D volume, not a flat camera-facing disk.
// Integrate several Gaussian stellar densities along the camera ray through
// each ellipsoid so zooming never reveals individual nuclear particles.
const vertexShader=String.raw`
varying vec3 vUnitPosition;
void main(){
  vUnitPosition=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;

const fragmentShader=String.raw`
uniform vec3 uEyeLocal;
uniform float uStrength,uWhiteCore,uEntrance;
varying vec3 vUnitPosition;
void main(){
  vec3 ray=normalize(vUnitPosition-uEyeLocal);
  float b=dot(uEyeLocal,ray);
  float discriminant=b*b-dot(uEyeLocal,uEyeLocal)+1.0;
  if(discriminant<=0.0)discard;
  float root=sqrt(discriminant);
  float nearT=max(0.0,-b-root);
  float farT=max(0.0,-b+root);
  float distance=farT-nearT;
  if(distance<0.0001)discard;

  // Integrate smooth volume emission at sixteen depths, preserving the
  // foreshortening and thickness of the real 3D ellipsoid from any angle.
  float outer=0.0,inner=0.0,white=0.0;
  for(int i=0;i<16;i++){
    float t=nearT+distance*(float(i)+0.5)/16.0;
    vec3 q=uEyeLocal+ray*t;
    float r2=dot(q,q);
    outer+=exp(-4.5*r2);
    inner+=exp(-14.0*r2);
    white+=exp(-55.0*r2);
  }
  outer*=distance/16.0;
  inner*=distance/16.0;
  white*=distance/16.0;
  // The extremely compact ivory core can saturate like an exposure,
  // without brightening the broad orange bulge or the outer blue arms.
  float emission=(outer*1.05+inner*0.82)*uStrength+white*uWhiteCore;
  float alpha=clamp((1.0-exp(-emission))*uEntrance,0.0,0.985);
  if(alpha<0.003)discard;

  float warmth=clamp((inner*0.7+white*2.5)/(outer*0.9+0.055),0.0,1.0);
  vec3 amber=vec3(1.0,0.79,0.56);
  vec3 cream=vec3(1.0,0.94,0.81);
  vec3 ivory=vec3(1.0,1.0,0.99);
  vec3 color=mix(amber,cream,smoothstep(0.10,0.75,warmth));
  color=mix(color,ivory,smoothstep(0.55,1.0,warmth));
  gl_FragColor=vec4(color,alpha);
}
`;

function BulgeVolume({pivot,axes,angle,options,seconds,animation,morph,morphDuration}:{
  pivot:readonly [number,number];axes:readonly [number,number,number];
  angle:number;options:GalaxySettings;seconds:RefObject<number>;
  animation:boolean;morph:RefObject<boolean>;morphDuration:RefObject<number>;
}){
  const mesh=useRef<Mesh>(null);
  const gpu=useRef<ShaderMaterial>(null);
  const eye=useMemo(()=>new Vector3(),[]);
  const uniforms=useMemo(()=>({
    uEyeLocal:{value:new Vector3(0,0,3)},
    uStrength:{value:1},uWhiteCore:{value:1},uEntrance:{value:1},
  }),[]);
  useFrame(({camera})=>{
    const object=mesh.current;
    if(!object)return;
    object.updateWorldMatrix(true,false);
    eye.copy(camera.position);
    object.worldToLocal(eye);
    uniforms.uEyeLocal.value.copy(eye);
    const time=seconds.current;
    const entrance=morph.current
      ?galaxyMorphEasing(time/Math.max(.001,morphDuration.current))
      :!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uStrength.value=0.12+options.coreGlow/95;
    uniforms.uWhiteCore.value=18*Math.pow(Math.max(0,options.coreGlow/100),1.25);
    uniforms.uEntrance.value=entrance;
    if(gpu.current){
      gpu.current.uniforms.uEyeLocal.value.copy(eye);
      gpu.current.uniforms.uStrength.value=uniforms.uStrength.value;
      gpu.current.uniforms.uWhiteCore.value=uniforms.uWhiteCore.value;
      gpu.current.uniforms.uEntrance.value=entrance;
    }
  });
  return <mesh ref={mesh} name="galaxy-unresolved-bulge-volume"
    position={[pivot[0],pivot[1],0]} rotation={[0,0,angle]}
    scale={[axes[0],axes[1],axes[2]]} renderOrder={0.5}
    frustumCulled={false}>
    <sphereGeometry args={[1,48,32]}/>
    <shaderMaterial ref={gpu} vertexShader={vertexShader}
      fragmentShader={fragmentShader} uniforms={uniforms}
      side={BackSide} transparent depthTest={false} depthWrite={false}
      blending={NormalBlending}/>
  </mesh>;
}

/** Smooth, unresolved cream-to-ivory stellar bulge.
 * In interacting galaxies each nucleus has its own true 3D ellipsoid. */
export function GalaxyBulgeGlow({seed,options,stars,low,seconds,animation,morph,morphDuration,
  progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;low:boolean;
  seconds:RefObject<number>;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const centers=useMemo(()=>generateGalaxyNucleus(seed,options,low,stars).centers,
    [seed,options.galaxyType,options.radius,low,stars]);
  const orientation=galaxyAppearance(seed,options.palette).orientation;
  const R=options.radius;
  const flat=options.galaxyType==='ring'?.75:1;
  const elongated=options.galaxyType==='barred_spiral'||options.barred?1.23:1;
  const round=options.galaxyType==='elliptical';
  useFrame(()=>{
    if(progressHost?.current){
      progressHost.current.dataset.galaxyBulgeCount=String(centers.length);
      progressHost.current.dataset.galaxyBulgeRepresentation='3d-unresolved-volume';
    }
  });
  return <group name="galaxy-smooth-volumetric-bulges">
    {centers.map((center,index)=>{
      const companion=options.galaxyType==='interacting'&&index===1;
      const scale=companion?Math.max(.35,options.companionSize):1;
      const axes:[number,number,number]=[
        R*(round?.32:.36)*flat*elongated*scale,
        R*(round?.25:.16)*flat*scale,
        R*(round?.22:.095)*scale,
      ];
      return <BulgeVolume key={index} pivot={center} axes={axes}
        angle={orientation+(companion?2.35:0)} options={options}
        seconds={seconds} animation={animation} morph={morph}
        morphDuration={morphDuration}/>;
    })}
  </group>;
}
