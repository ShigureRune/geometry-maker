import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import {galaxyMorphEasing,type GalaxyData,type GalaxySettings} from './galaxy';
import {generateGalaxyDetailStars} from './galaxy-generators/detail-stars';

// A second, finer stellar resolution that fades in only *near* the camera.
// Far away, it contributes exactly zero light: wide galaxy screenshots and
// their white-out limits do not change. Close up, starlets remain pinpoints
// instead of growing into massive blurry GL point sprites.
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
  float angle=aSpin*uRotationSpeed*uTime;
  float cs=cos(angle),sn=sin(angle);
  vec2 relative=position.xy-aOrbitCenter;
  vec3 pos=vec3(aOrbitCenter.x+relative.x*cs-relative.y*sn,
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
}
`;
const fragmentShader=String.raw`
varying vec3 vColor;
varying float vOpacity;
void main(){
  vec2 p=gl_PointCoord-vec2(.5);
  float d=length(p);
  // Distinct star cores, but low-opacity colored halos to keep neighboring
  // stars from accumulating into a solid white sheet under extreme zoom.
  float core=1.0-smoothstep(0.03,0.15,d);
  float halo=exp(-d*d*27.0);
  float alpha=clamp(vOpacity*(halo*.37+core*.40),0.0,.53);
  if(alpha<.008)discard;
  gl_FragColor=vec4(vColor*(1.13+core*.16),alpha);
}
`;

export function GalaxyDetailStars({seed,options,stars,low,seconds,animation,morph,morphDuration,
  progressHost}:{
  seed:string;options:GalaxySettings;stars:GalaxyData;low:boolean;
  seconds:RefObject<number>;animation:boolean;morph:RefObject<boolean>;
  morphDuration:RefObject<number>;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const data=useMemo(()=>generateGalaxyDetailStars(seed,options,low,stars),[
    seed,stars,low,options.radius,options.galaxyType,options.companionSize,
  ]);
  const geometry=useMemo(()=>{
    const result=new BufferGeometry();
    result.setAttribute('position',new BufferAttribute(data.positions,3));
    result.setAttribute('aColor',new BufferAttribute(data.colors,3));
    result.setAttribute('aSize',new BufferAttribute(data.sizes,1));
    result.setAttribute('aOpacity',new BufferAttribute(data.opacities,1));
    result.setAttribute('aSpin',new BufferAttribute(data.spins,1));
    result.setAttribute('aOrbitCenter',new BufferAttribute(data.orbitCenters,2));
    return result;
  },[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:options.rotationSpeed},
    uEntrance:{value:1},uDpr:{value:1},uExportScale:{value:1},
  }),[]);
  useFrame(()=>{
    const clock=import.meta.env.DEV&&progressHost?.current
      ?Number(progressHost.current.dataset.galaxyMotionClock):NaN;
    const time=Number.isFinite(clock)?clock:seconds.current;
    const entrance=morph.current
      ?galaxyMorphEasing(time/Math.max(.001,morphDuration.current))
      :!animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uEntrance.value=entrance;
    uniforms.uDpr.value=low?1:1.75;
    if(material.current){
      material.current.uniforms.uTime.value=time;
      material.current.uniforms.uRotationSpeed.value=options.rotationSpeed;
      material.current.uniforms.uEntrance.value=entrance;
      material.current.uniforms.uDpr.value=uniforms.uDpr.value;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyDetailCount=String(data.count);
      progressHost.current.dataset.galaxyDetailRange='4.2-12';
      progressHost.current.dataset.galaxyDetailTime=time.toFixed(3);
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
