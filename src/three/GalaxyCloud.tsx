import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import {GalaxyGasCloud3D} from './GalaxyGasCloud3D';
import {
  galaxyDefaults,galaxyMorphEasing,generateGalaxy,
  type GalaxyData,type GalaxySettings,
} from './galaxy';

const vertexShader=String.raw`
attribute vec3 aColor;
attribute vec3 aFrom;
attribute vec3 aFromColor;
attribute float aSize;
attribute float aSpin;
attribute float aPhase;
attribute float aCore;
attribute float aKind;
attribute float aOpacity;
attribute vec2 aOrbitCenter;
uniform float uTime;
uniform float uRotationSpeed;
uniform float uEntrance;
uniform float uMorph;
uniform float uMorphEnabled;
uniform float uGlow;
uniform float uDpr;
uniform float uStarEnergy;
varying vec3 vColor;
varying float vCore;
varying float vOpacity;
varying float vKind;
void main(){
  float spin=aSpin*uRotationSpeed*uTime;
  float c=cos(spin),s=sin(spin);
  vec2 local=position.xy-aOrbitCenter;
  vec3 target=vec3(aOrbitCenter.x+local.x*c-local.y*s,
    aOrbitCenter.y+local.x*s+local.y*c,position.z);
  float fade=uMorphEnabled>0.5?uMorph:1.0;
  vec3 spiral=vec3(cos(aPhase+uMorph*9.0),sin(aPhase+uMorph*9.0),0.0)*
    (sin(uMorph*3.14159265)*1.6*uMorphEnabled);
  vec3 finalPos=mix(aFrom,target,fade)+spiral;
  if(uMorphEnabled<0.5){
    finalPos*=uEntrance;
  }
  vec4 mvPosition=modelViewMatrix*vec4(finalPos,1.0);
  gl_Position=projectionMatrix*mvPosition;
  float distanceScale=clamp(21.0/max(0.5,-mvPosition.z),0.45,3.0);
  gl_PointSize=clamp(aSize*uDpr*distanceScale*2.65,1.5,52.0);
  vColor=mix(aFromColor,aColor,fade);
  vCore=aCore;
  vOpacity=aOpacity*(uMorphEnabled>0.5?1.0:uEntrance);
  vKind=aKind;
}
`;
const fragmentShader=String.raw`
varying vec3 vColor;
varying float vCore;
varying float vOpacity;
varying float vKind;
uniform float uGlow;
uniform float uStarEnergy;
void main(){
  float dist=length(gl_PointCoord-vec2(0.5));
  float halo=exp(-dist*dist*(vKind>0.5?7.0:22.0));
  float center=1.0-smoothstep(0.035,0.23,dist);
  float alpha=(vKind>0.5?halo*0.24:(halo*0.29+center*0.92))*min(1.0,vOpacity*1.60);
  if(alpha<0.008)discard;
  // Light per star falls as density increases. More stars in high quality
  // should add DETAIL, not multiply overall exposure by >3x.
  // Give the compact, warm stellar bulge its own local contrast. Only
  // stars with aCore>0 get the boost; distant spiral arms retain their
  // high-quality energy normalization and don't wash out.
  vec3 rgb=vColor*(1.28+vCore*uGlow*3.1)*uStarEnergy;
  gl_FragColor=vec4(rgb,alpha);
}
`;

type SceneSnapshot={
  seed:string;restartKey:string;data:GalaxyData;
  fromPositions:Float32Array;fromColors:Float32Array;
  rotationSpeed:number;morph:boolean;duration:number;
};
function positioned(data:GalaxyData,index:number,time:number,speed:number):[number,number,number]{
  const p=index*3,angle=data.spins[index]*speed*time,c=Math.cos(angle),s=Math.sin(angle);
  const x=data.positions[p],y=data.positions[p+1];
  const cx=data.orbitCenters?.[index*2]??0,cy=data.orbitCenters?.[index*2+1]??0;
  const lx=x-cx,ly=y-cy;
  return [cx+lx*c-ly*s,cy+lx*s+ly*c,data.positions[p+2]];
}
function visibleOldStar(old:SceneSnapshot,index:number,time:number):{position:[number,number,number];color:[number,number,number]}{
  const p=index*3,target=positioned(old.data,index,time,old.rotationSpeed);
  const color:[number,number,number]=[
    old.data.colors[p],old.data.colors[p+1],old.data.colors[p+2],
  ];
  if(!old.morph)return {position:target,color};
  const progress=Math.max(0,Math.min(1,time/old.duration)),mix=galaxyMorphEasing(progress);
  const arc=Math.sin(Math.PI*progress)*1.6;
  const angle=old.data.phases[index]+progress*9;
  const position:[number,number,number]=[
    old.fromPositions[p]*(1-mix)+target[0]*mix+Math.cos(angle)*arc,
    old.fromPositions[p+1]*(1-mix)+target[1]*mix+Math.sin(angle)*arc,
    old.fromPositions[p+2]*(1-mix)+target[2]*mix,
  ];
  for(let k=0;k<3;k++)color[k]=old.fromColors[p+k]*(1-mix)+color[k]*mix;
  return {position,color};
}

export function GalaxyCloud({seed,settings,seconds,low,restartKey,transitionDuration,progressHost}:{
  seed:string;settings:{galaxy?:GalaxySettings;animation:boolean};
  seconds:RefObject<number>;low:boolean;restartKey:string;
  transitionDuration?:number;progressHost?:RefObject<HTMLDivElement|null>;
}){
  const options=settings.galaxy??galaxyDefaults;
  // Development-only screenshot probe: isolate the gas layer so browser
  // regression tests cannot pass merely because STAR particles moved.
  // Vite removes this probe from production builds.
  const gasOnlyProbe=import.meta.env.DEV&&
    new URLSearchParams(window.location.search).has('galaxyGasOnly');
  const starsOnlyProbe=import.meta.env.DEV&&
    new URLSearchParams(window.location.search).has('galaxyStarsOnly');
  const data=useMemo(()=>generateGalaxy(seed,options,low),[
    seed,low,options.count,options.arms,options.twist,options.radius,options.dust,options.palette,options.armWidth,options.barred,
    options.galaxyType,options.ringRadius,options.ringWidth,options.ellipticity,
    options.clumpiness,options.branchiness,options.irregularity,
    options.companionDistance,options.companionSize,options.tidalStrength,
  ]);
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRotationSpeed:{value:options.rotationSpeed},
    uEntrance:{value:1},uMorph:{value:1},uMorphEnabled:{value:0},
    uGlow:{value:options.coreGlow/100},uDpr:{value:1},
    uStarEnergy:{value:1},
  }),[]);
  const geometry=useMemo(()=>{
    const buffer=new BufferGeometry();
    buffer.setAttribute('position',new BufferAttribute(data.positions,3));
    buffer.setAttribute('aColor',new BufferAttribute(data.colors,3));
    buffer.setAttribute('aSize',new BufferAttribute(data.sizes,1));
    buffer.setAttribute('aSpin',new BufferAttribute(data.spins,1));
    buffer.setAttribute('aPhase',new BufferAttribute(data.phases,1));
    buffer.setAttribute('aCore',new BufferAttribute(data.cores,1));
    buffer.setAttribute('aOpacity',new BufferAttribute(data.opacities,1));
    buffer.setAttribute('aKind',new BufferAttribute(data.kinds,1));
    buffer.setAttribute('aOrbitCenter',new BufferAttribute(
      data.orbitCenters??new Float32Array(data.count*2),2));
    // Readable buffers: previous GPU frame is reproduced by the CPU snapshot
    // at seed switches, then the shader smoothly interpolates into new targets.
    buffer.setAttribute('aFrom',new BufferAttribute(new Float32Array(data.positions),3));
    buffer.setAttribute('aFromColor',new BufferAttribute(new Float32Array(data.colors),3));
    return buffer;
  },[data]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const last=useRef<SceneSnapshot|null>(null);
  const isMorph=useRef(false),morphDuration=useRef(options.transitionSeconds);
  const material=useRef<ShaderMaterial>(null);
  const update=useCallback(()=>{
    // Dev-only deterministic clock for actual pixel motion/direction tests.
    // Production builds never read or accept this DOM override.
    const probeClock=import.meta.env.DEV&&progressHost?.current
      ?Number(progressHost.current.dataset.galaxyMotionClock):NaN;
    const time=Number.isFinite(probeClock)?probeClock:seconds.current;
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uEntrance.value=!settings.animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uMorphEnabled.value=isMorph.current?1:0;
    uniforms.uMorph.value=galaxyMorphEasing(time/Math.max(.001,morphDuration.current));
    uniforms.uGlow.value=options.coreGlow/100;
    uniforms.uDpr.value=low?1:1.75;
    // High quality also passes through OutputPass (different from the
    // lightweight direct renderer), whose color conversion lifts midtones.
    // Thus normalize both star density AND that renderer-specific exposure.
    // Star quantity adds detail, never makes the arms lose their color.
    // Volumetric gas adds real colored depth behind the stars. Trim the
    // HDR star contribution in high quality so dense rings stay colored.
    uniforms.uStarEnergy.value=.65*3600/Math.max(3600,data.count)*
      (low?1:Math.max(.27,.72*Math.pow(3600/Math.max(3600,data.count),.4)));
    // Write through to the mounted material as well as the declarative
    // uniform bag. Both shader layers must see the SAME scene clock.
    const gpu=material.current?.uniforms;
    if(gpu){
      gpu.uTime.value=time;
      gpu.uRotationSpeed.value=options.rotationSpeed;
      gpu.uEntrance.value=uniforms.uEntrance.value;
      gpu.uMorph.value=uniforms.uMorph.value;
      gpu.uMorphEnabled.value=uniforms.uMorphEnabled.value;
      gpu.uGlow.value=uniforms.uGlow.value;
      gpu.uDpr.value=uniforms.uDpr.value;
      gpu.uStarEnergy.value=uniforms.uStarEnergy.value;
    }
    if(progressHost?.current){
      progressHost.current.dataset.galaxyGasOnlyProbe=gasOnlyProbe?'true':'false';
      progressHost.current.dataset.galaxyStarsOnlyProbe=starsOnlyProbe?'true':'false';
      progressHost.current.dataset.galaxyStarTime=time.toFixed(3);
      progressHost.current.dataset.galaxyStarMaterialTime=Number(
        material.current?.uniforms.uTime.value??-1).toFixed(3);
      progressHost.current.dataset.galaxyStarEnergy=uniforms.uStarEnergy.value.toFixed(3);
      progressHost.current.dataset.galaxySeedPhase=isMorph.current&&time<morphDuration.current?'transition':'settled';
      progressHost.current.dataset.galaxySeedProgress=isMorph.current?
        Math.min(1,time/morphDuration.current).toFixed(3):'1.000';
    }
  },[seconds,uniforms,data.count,options.rotationSpeed,options.coreGlow,low,settings.animation,progressHost]);
  useLayoutEffect(()=>{
    const previous=last.current;
    if(previous&&previous.seed!==seed&&options.seedTransition&&settings.animation){
      const fromPosition=(geometry.getAttribute('aFrom') as BufferAttribute).array as Float32Array;
      const fromColor=(geometry.getAttribute('aFromColor') as BufferAttribute).array as Float32Array;
      const oldTime=seconds.current;
      for(let i=0;i<data.count;i++){
        const oldIndex=Math.floor(i*previous.data.count/data.count);
        const pose=visibleOldStar(previous,oldIndex,oldTime);
        const p=i*3;
        fromPosition[p]=pose.position[0];fromPosition[p+1]=pose.position[1];fromPosition[p+2]=pose.position[2];
        fromColor[p]=pose.color[0];fromColor[p+1]=pose.color[1];fromColor[p+2]=pose.color[2];
      }
      (geometry.getAttribute('aFrom') as BufferAttribute).needsUpdate=true;
      (geometry.getAttribute('aFromColor') as BufferAttribute).needsUpdate=true;
      isMorph.current=true;
      morphDuration.current=transitionDuration??options.transitionSeconds;
    }else if(previous?.seed!==seed || previous?.restartKey!==restartKey){
      isMorph.current=false;
    }
    last.current={
      seed,restartKey,data,
      fromPositions:new Float32Array((geometry.getAttribute('aFrom') as BufferAttribute).array),
      fromColors:new Float32Array((geometry.getAttribute('aFromColor') as BufferAttribute).array),
      rotationSpeed:options.rotationSpeed,morph:isMorph.current,duration:morphDuration.current,
    };
    update();
  },[seed,restartKey,data,geometry,options.rotationSpeed,options.seedTransition,options.transitionSeconds,
    settings.animation,transitionDuration,seconds,update]);
  useFrame(update);
  return <group rotation={[options.inclination*Math.PI/180,0,0]}>
    <group visible={!starsOnlyProbe}>
      <GalaxyGasCloud3D key={options.galaxyType} seed={seed} options={options} stars={data}
        seconds={seconds} low={low} animation={settings.animation}
        morph={isMorph} morphDuration={morphDuration} progressHost={progressHost}/>
    </group>
    <points name="galaxy-mode-cloud" visible={!gasOnlyProbe} geometry={geometry} renderOrder={1} frustumCulled={false}>
      <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
        uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending}/>
    </points>
  </group>;
}
