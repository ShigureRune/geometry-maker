import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import {galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyDetailStars} from './galaxy-generators/detail-stars';
import {createGalaxyGravitySimulation,type GalaxyCoreMotion} from './galaxy-gravity';

// A second, finer stellar resolution that fades in only *near* the camera.
// Far away, it contributes exactly zero light: wide galaxy screenshots and
// their white-out limits do not change. Close up, starlets remain pinpoints
// instead of growing into massive blurry GL point sprites.
const vertexShader=String.raw`
attribute vec3 aColor;
attribute float aSize;
attribute float aOpacity;
attribute float aHighlight;
attribute float aSpin;
attribute vec2 aOrbitCenter;
uniform float uTime,uRotationSpeed,uGravityEnabled,uEntrance,uDpr,uExportScale;
varying vec3 vColor;
varying float vOpacity;
varying float vHighlight;
void main(){
  float angle=aSpin*uRotationSpeed*uTime;
  float cs=cos(angle),sn=sin(angle);
  vec2 relative=position.xy-aOrbitCenter;
  vec3 pos=uGravityEnabled>.5?position:vec3(
    aOrbitCenter.x+relative.x*cs-relative.y*sn,
    aOrbitCenter.y+relative.x*sn+relative.y*cs,position.z);
  vec4 view=modelViewMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*view;
  float distance=max(0.001,-view.z);
  // Limit the additive LOD to near-field; long bright overlapping halos
  // were bleaching out the colors of blue arms and warm inner stars.
  float closeFade=1.0-smoothstep(4.2,12.0,distance);
  float proximity=1.0-smoothstep(.35,4.0,distance);
  gl_PointSize=clamp(aSize*uDpr*8.4/max(.32,distance),1.6,5.8)*uExportScale;
  vColor=aColor*(1.05+proximity*.12);
  vOpacity=aOpacity*closeFade*uEntrance;
  vHighlight=aHighlight;
}
`;
const fragmentShader=String.raw`
varying vec3 vColor;
varying float vOpacity;
varying float vHighlight;
void main(){
  vec2 p=gl_PointCoord-vec2(.5);
  float d=length(p);
  // All stars have faint colored halos. Only a small deterministic subset
  // has a bright localized core; neighboring star light stays chromatic.
  float core=1.0-smoothstep(0.025,0.145,d);
  float halo=exp(-d*d*28.0);
  float coreWeight=mix(.26,.82,vHighlight);
  float alpha=clamp(vOpacity*(halo*.30+core*coreWeight),0.0,.72);
  if(alpha<.008)discard;
  vec3 color=vColor*(1.10+core*vHighlight*1.20);
  gl_FragColor=vec4(color,alpha);
}
`;

export function GalaxyDetailStars({seed,options,stars,low,seconds,animation,morph,morphDuration,
  coreMotion,progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;low:boolean;
  seconds:RefObject<number>;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;coreMotion?:GalaxyCoreMotion|null;
  progressHost?:RefObject<HTMLDivElement|null>;
}){
  const data=useMemo(()=>generateGalaxyDetailStars(seed,options,low,stars),[
    seed,stars,low,options.radius,options.galaxyType,options.companionSize,
  ]);
  const gravity=useMemo(()=>options.gravityEnabled?
    createGalaxyGravitySimulation(data,options,coreMotion):null,[
    data,options.gravityEnabled,coreMotion,
  ]);
  const geometry=useMemo(()=>{
    const result=new BufferGeometry();
    result.setAttribute('position',new BufferAttribute(
      gravity?gravity.positions:data.positions,3));
    result.setAttribute('aColor',new BufferAttribute(data.colors,3));
    result.setAttribute('aSize',new BufferAttribute(data.sizes,1));
    result.setAttribute('aOpacity',new BufferAttribute(data.opacities,1));
    result.setAttribute('aHighlight',new BufferAttribute(data.highlights,1));
    result.setAttribute('aSpin',new BufferAttribute(data.spins,1));
    result.setAttribute('aOrbitCenter',new BufferAttribute(data.orbitCenters,2));
    return result;
  },[data,gravity]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:options.rotationSpeed},
    uGravityEnabled:{value:0},
    uEntrance:{value:1},uDpr:{value:1},uExportScale:{value:1},
  }),[]);
  useFrame(()=>{
    const clock=import.meta.env.DEV&&progressHost?.current
      ?Number(progressHost.current.dataset.galaxyMotionClock):NaN;
    const time=Number.isFinite(clock)?clock:seconds.current;
    const entrance=morph.current
      ?galaxyMorphEasing(time/Math.max(.001,morphDuration.current))
      :!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    if(gravity?.advance(time,options.gravityStrength,options.gravityHalo,
      options.rotationSpeed)){
      (geometry.getAttribute('position') as BufferAttribute).needsUpdate=true;
    }
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uGravityEnabled.value=gravity?1:0;
    uniforms.uEntrance.value=entrance;
    uniforms.uDpr.value=low?1:1.75;
    if(material.current){
      material.current.uniforms.uTime.value=time;
      material.current.uniforms.uRotationSpeed.value=options.rotationSpeed;
      material.current.uniforms.uGravityEnabled.value=gravity?1:0;
      material.current.uniforms.uEntrance.value=entrance;
      material.current.uniforms.uDpr.value=uniforms.uDpr.value;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyDetailCount=String(data.count);
      progressHost.current.dataset.galaxyDetailRange='4.2-12';
      progressHost.current.dataset.galaxyDetailTime=time.toFixed(3);
      progressHost.current.dataset.galaxyGravityDetailSteps=String(gravity?.steps??0);
    }
  });
  return <points name="galaxy-near-field-detail-stars" geometry={geometry}
    renderOrder={2} frustumCulled={false}>
    <shaderMaterial ref={material} vertexShader={vertexShader}
      fragmentShader={fragmentShader} uniforms={uniforms}
      transparent depthWrite={false} depthTest={false}
      blending={AdditiveBlending}/>
  </points>;
}
