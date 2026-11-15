import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferAttribute,BufferGeometry,ShaderMaterial} from 'three';
import {GalaxyDiffuse} from './GalaxyDiffuse';
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
uniform float uTime;
uniform float uRotationSpeed;
uniform float uEntrance;
uniform float uMorph;
uniform float uMorphEnabled;
uniform float uGlow;
uniform float uDpr;
varying vec3 vColor;
varying float vCore;
varying float vOpacity;
varying float vKind;
void main(){
  float spin=aSpin*uRotationSpeed*uTime;
  float c=cos(spin),s=sin(spin);
  vec3 target=vec3(position.x*c-position.y*s,position.x*s+position.y*c,position.z);
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
void main(){
  float dist=length(gl_PointCoord-vec2(0.5));
  float halo=exp(-dist*dist*(vKind>0.5?7.0:22.0));
  float center=1.0-smoothstep(0.035,0.23,dist);
  float alpha=(vKind>0.5?halo*0.24:(halo*0.29+center*0.92))*min(1.0,vOpacity*1.60);
  if(alpha<0.008)discard;
  vec3 rgb=vColor*(1.85+vCore*uGlow*1.18);
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
  return [x*c-y*s,x*s+y*c,data.positions[p+2]];
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
    const time=seconds.current;
    uniforms.uTime.value=time;
    uniforms.uRotationSpeed.value=options.rotationSpeed;
    uniforms.uEntrance.value=!settings.animation&&time===0?1:galaxyMorphEasing(time/2.6);
    uniforms.uMorphEnabled.value=isMorph.current?1:0;
    uniforms.uMorph.value=galaxyMorphEasing(time/Math.max(.001,morphDuration.current));
    uniforms.uGlow.value=options.coreGlow/100;
    uniforms.uDpr.value=low?1:1.75;
    if(progressHost?.current){
      progressHost.current.dataset.galaxySeedPhase=isMorph.current&&time<morphDuration.current?'transition':'settled';
      progressHost.current.dataset.galaxySeedProgress=isMorph.current?
        Math.min(1,time/morphDuration.current).toFixed(3):'1.000';
    }
  },[seconds,uniforms,options.rotationSpeed,options.coreGlow,low,settings.animation,progressHost]);
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
    <GalaxyDiffuse seed={seed} options={options} seconds={seconds}
      animation={settings.animation} morph={isMorph} morphDuration={morphDuration}/>
    <points name="galaxy-mode-cloud" geometry={geometry} renderOrder={1} frustumCulled={false}>
      <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
        uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending}/>
    </points>
  </group>;
}
